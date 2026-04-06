import { GAME_CONFIG } from './config';
import type {
  EconomySnapshot,
  GamePieceBody,
  UpgradeDefinition,
  UpgradeId,
  UpgradeLevelsSnapshot,
  UpgradeShopItem
} from './types';

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: 'blast-radius',
    name: 'Усиление взрыва',
    description: 'Каждый уровень увеличивает радиус взрыва бомбы на 4%. Максимум 8 уровней.',
    baseCost: GAME_CONFIG.upgrades.baseCost,
    costGrowthRate: GAME_CONFIG.upgrades.costGrowthRate,
    maxLevel: GAME_CONFIG.upgrades.maxLevel
  },
  {
    id: 'fire-height',
    name: 'Сильнее поджиг',
    description: 'Каждый уровень увеличивает высоту поджигания фигур снизу на 4%. Максимум 8 уровней.',
    baseCost: GAME_CONFIG.upgrades.baseCost,
    costGrowthRate: GAME_CONFIG.upgrades.costGrowthRate,
    maxLevel: GAME_CONFIG.upgrades.maxLevel
  },
  {
    id: 'freeze-duration',
    name: 'Дольше заморозка',
    description:
      'Аркада: +10% к длительности за уровень. Пошаговый режим: +1 ход раз в 2 уровня, максимум 5 ходов.',
    baseCost: GAME_CONFIG.upgrades.baseCost,
    costGrowthRate: GAME_CONFIG.upgrades.costGrowthRate,
    maxLevel: GAME_CONFIG.upgrades.maxLevel
  }
];

export function createEmptyUpgradeLevels(): UpgradeLevelsSnapshot {
  return {
    'blast-radius': 0,
    'fire-height': 0,
    'freeze-duration': 0
  };
}

export function normalizeUpgradeLevels(
  levels?: Partial<UpgradeLevelsSnapshot> | null
): UpgradeLevelsSnapshot {
  const normalized = createEmptyUpgradeLevels();

  if (!levels) {
    return normalized;
  }

  UPGRADE_DEFINITIONS.forEach(definition => {
    const value = levels[definition.id];
    normalized[definition.id] =
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? clampUpgradeLevel(Math.floor(value), definition.maxLevel)
        : 0;
  });

  return normalized;
}

export function getUpgradeCost(
  definition: UpgradeDefinition,
  currentLevel: number
) {
  return Math.ceil(
    definition.baseCost * Math.pow(definition.costGrowthRate, currentLevel)
  );
}

export function getBombBlastRadiusMultiplier(level: number) {
  return 1 + level * GAME_CONFIG.upgrades.blastRadiusBonusPerLevel;
}

export function getFireHeightBonusFactor(level: number) {
  return level * GAME_CONFIG.upgrades.fireHeightBonusPerLevel;
}

export function getFreezeArcadeDurationMultiplier(level: number) {
  return 1 + level * GAME_CONFIG.upgrades.freezeArcadeDurationBonusPerLevel;
}

export function getFreezeTurnDuration(level: number) {
  const extraTurns = Math.floor(
    level / GAME_CONFIG.upgrades.freezeTurnExtraEveryLevels
  );

  return Math.min(
    GAME_CONFIG.upgrades.freezeTurnMaxTurns,
    GAME_CONFIG.abilities.freezeTurnDuration + extraTurns
  );
}

function getTurnWord(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return 'ход';
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'хода';
  }

  return 'ходов';
}

function getUpgradeDefinition(upgradeId: UpgradeId) {
  return UPGRADE_DEFINITIONS.find(definition => definition.id === upgradeId);
}

function clampUpgradeLevel(level: number, maxLevel: number) {
  return clampNumber(level, 0, maxLevel);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getActionBonusPoints(destroyedCount: number) {
  return (
    GAME_CONFIG.rewards.actionBonuses.find(
      tier =>
        destroyedCount >= tier.minDestroyed && destroyedCount <= tier.maxDestroyed
    )?.bonusPoints ?? 0
  );
}

function getUpgradeBonusText(upgradeId: UpgradeId, level: number) {
  switch (upgradeId) {
    case 'blast-radius':
      return `Текущий бонус: +${Math.round(level * GAME_CONFIG.upgrades.blastRadiusBonusPerLevel * 100)}% к радиусу`;
    case 'fire-height':
      return `Текущий бонус: +${Math.round(level * GAME_CONFIG.upgrades.fireHeightBonusPerLevel * 100)}% к высоте`;
    case 'freeze-duration':
      return `Аркада: +${Math.round(level * GAME_CONFIG.upgrades.freezeArcadeDurationBonusPerLevel * 100)}% • Пошаговый: ${getFreezeTurnDuration(level)} ${getTurnWord(getFreezeTurnDuration(level))}`;
    default:
      return '';
  }
}

export class PlayerEconomy {
  private points = 0;
  private readonly upgradeLevels = createEmptyUpgradeLevels();

  hydrate(snapshot?: EconomySnapshot | null) {
    this.points =
      snapshot && Number.isFinite(snapshot.points) && snapshot.points > 0
        ? Math.floor(snapshot.points)
        : 0;

    Object.assign(
      this.upgradeLevels,
      normalizeUpgradeLevels(snapshot?.upgradeLevels ?? null)
    );
  }

  awardForDestroyedBodies(bodies: GamePieceBody[]) {
    let earnedPoints = 0;

    bodies.forEach(body => {
      earnedPoints +=
        body.markerType && body.markerType !== 'none'
          ? GAME_CONFIG.rewards.markedFigurePoints
          : GAME_CONFIG.rewards.normalFigurePoints;
    });

    earnedPoints += getActionBonusPoints(bodies.length);
    this.points += earnedPoints;
    return earnedPoints;
  }

  getSnapshot(): EconomySnapshot {
    return {
      points: this.points,
      upgradeLevels: { ...this.upgradeLevels }
    };
  }

  canAfford(cost: number) {
    return this.points >= cost;
  }

  spendPoints(cost: number) {
    if (cost <= 0) {
      return true;
    }

    if (this.points < cost) {
      return false;
    }

    this.points -= cost;
    return true;
  }

  canPurchaseUpgrade(upgradeId: UpgradeId) {
    const definition = getUpgradeDefinition(upgradeId);
    if (!definition) {
      return false;
    }

    const currentLevel = this.getUpgradeLevel(upgradeId);
    if (currentLevel >= definition.maxLevel) {
      return false;
    }

    return this.points >= getUpgradeCost(definition, currentLevel);
  }

  purchaseUpgrade(upgradeId: UpgradeId) {
    const definition = getUpgradeDefinition(upgradeId);
    if (!definition) {
      return false;
    }

    const currentLevel = this.getUpgradeLevel(upgradeId);
    if (currentLevel >= definition.maxLevel) {
      return false;
    }

    const cost = getUpgradeCost(definition, currentLevel);
    if (this.points < cost) {
      return false;
    }

    this.points -= cost;
    this.upgradeLevels[upgradeId] = clampUpgradeLevel(
      currentLevel + 1,
      definition.maxLevel
    );
    return true;
  }

  getUpgradeLevel(upgradeId: UpgradeId) {
    return this.upgradeLevels[upgradeId] ?? 0;
  }

  getUpgradeCatalog(): UpgradeShopItem[] {
    return UPGRADE_DEFINITIONS.map(definition => {
      const level = this.getUpgradeLevel(definition.id);
      const isMaxLevel = level >= definition.maxLevel;
      const nextCost = isMaxLevel ? null : getUpgradeCost(definition, level);

      return {
        ...definition,
        level,
        nextCost,
        currentBonusText: getUpgradeBonusText(definition.id, level),
        canPurchase: !isMaxLevel && nextCost !== null && this.points >= nextCost,
        isMaxLevel
      };
    });
  }
}
