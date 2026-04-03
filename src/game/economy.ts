import { GAME_CONFIG } from './config';
import type { EconomySnapshot, GamePieceBody, UpgradeDefinition, UpgradeId } from './types';

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: 'blast-radius',
    name: 'Усиленный взрыв',
    description: 'В будущем увеличит радиус взрыва специальных фигур.',
    cost: 120
  },
  {
    id: 'color-destroyer-efficiency',
    name: 'Точный спектр',
    description: 'В будущем усилит фигуру, уничтожающую цвет.',
    cost: 160
  },
  {
    id: 'special-figure-frequency',
    name: 'Редкий катализатор',
    description: 'В будущем повлияет на шанс появления особых фигур.',
    cost: 220
  }
];

export class PlayerEconomy {
  private points = 0;
  private readonly purchasedUpgrades = new Set<UpgradeId>();

  awardForDestroyedBodies(bodies: GamePieceBody[]) {
    let earnedPoints = 0;

    bodies.forEach(body => {
      earnedPoints += body.markerType && body.markerType !== 'none'
        ? GAME_CONFIG.rewards.markedFigurePoints
        : GAME_CONFIG.rewards.normalFigurePoints;
    });

    this.points += earnedPoints;
    return earnedPoints;
  }

  getSnapshot(): EconomySnapshot {
    return {
      points: this.points,
      purchasedUpgrades: Array.from(this.purchasedUpgrades)
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
    const definition = UPGRADE_DEFINITIONS.find(item => item.id === upgradeId);
    if (!definition || this.purchasedUpgrades.has(upgradeId)) {
      return false;
    }

    return this.points >= definition.cost;
  }

  purchaseUpgrade(upgradeId: UpgradeId) {
    const definition = UPGRADE_DEFINITIONS.find(item => item.id === upgradeId);
    if (!definition || this.purchasedUpgrades.has(upgradeId) || this.points < definition.cost) {
      return false;
    }

    this.points -= definition.cost;
    this.purchasedUpgrades.add(upgradeId);
    return true;
  }
}
