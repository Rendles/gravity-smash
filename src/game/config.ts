import type { ColorDefinition, MarkerType, ShapeType } from './types';
import type { GameMode } from './types';

type AbilityId = 'freeze' | 'fire' | 'spectrum';

type ChanceRange = {
  minLevel: number;
  maxLevel: number;
  minChance: number;
  maxChance: number;
};

type ValueRange = {
  minLevel: number;
  maxLevel: number;
  minValue: number;
  maxValue: number;
};

type TurnSpawnRange = {
  minLevel: number;
  maxLevel: number;
  minSpawn: number;
  maxSpawn: number;
};

type RewardBonusTier = {
  minDestroyed: number;
  maxDestroyed: number;
  bonusPoints: number;
};

export const COLORS: ColorDefinition[] = [
  { name: 'red', value: '#ff0000' },
  { name: 'orange', value: '#ff7700' },
  { name: 'yellow', value: '#fff200' },
  { name: 'green', value: '#0dff00' },
  { name: 'cyan', value: '#00ffea' },
  { name: 'blue', value: '#000dff' },
  { name: 'violet', value: '#d000ff' },
  { name: 'pink', value: '#ff007c' },
  { name: 'red', value: '#ff0000' }
];

export const SHAPES: ShapeType[] = [
  'circle',
  'square',
  'triangle',
  'pentagon',
  'hexagon',
  'bar'
];

export const INNER_MARKER_TYPES: MarkerType[] = [
  'cross',
  'letter-m',
  'letter-a',
  'letter-t'
];

export const INITIAL_LEVEL = 1;

export const GAME_CONFIG = {
  // Sizes: base figure size and multipliers for small/huge pieces.
  sizes: {
    rootMinFactor: 0.065,
    rootMaxFactor: 0.085,
    smallMultiplierMin: 2.0,
    smallMultiplierMax: 2.2,
    hugeMultiplierMin: 2.4,
    hugeMultiplierMax: 2.6
  },

  // Core physics and collision tuning.
  physics: {
    restitution: 0.08,
    friction: 0.22,
    frictionAir: 0.014,
    contactSlop: 0.0015,
    plasticDeformMax: 0.032,
    plasticDeformRecovery: 0.015,
    baseGravityY: 1.92
  },

  // Level rhythm and progression pacing.
  progression: {
    rhythm: {
      breatherEveryLevels: 4,
      tenseEveryLevels: 8,
      breatherGoalMultiplier: 0.92,
      breatherArcadeSpawnDelayMultiplier: 1.05,
      breatherArcadeWaveMultiplier: 0.9,
      breatherTurnSpawnOffset: -1,
      tenseGoalMultiplier: 1.08,
      tenseArcadeSpawnDelayMultiplier: 0.96,
      tenseArcadeWaveMultiplier: 1.08,
      tenseTurnSpawnOffset: 0
    },
    arcade: {
      goalBase: 16,
      goalPerLevel: 2,
      goalBonusEveryLevels: 4,
      goalBonusAmount: 1,
      gravityGrowthEveryLevels: 5,
      gravityGrowthMultiplier: 1.024,
      timeScaleGrowthEveryLevels: 8,
      timeScaleGrowthMultiplier: 1.01
    },
    turnBased: {
      baseGravityScale: 0.88,
      initialPiecesBase: 5,
      initialPiecesGrowthEveryLevels: 3,
      initialPiecesMax: 12,
      normalGoalBase: 12,
      normalGoalPerLevel: 2,
      normalGoalBonusEveryLevels: 4,
      normalGoalBonusAmount: 1,
      specialGoalStartLevel: 5,
      specialGoalEveryLevels: 3,
      specialGoalBase: 4,
      specialGoalPerTier: 1,
      specialGoalSpecialSpawnMultiplier: 1.35,
      specialGoalGuaranteedStartRatio: 0.4,
      specialGoalGuaranteedEarlyRatio: 0.2,
      specialGoalGuaranteedStartCap: 3,
      specialGoalGuaranteedEarlyCap: 2,
      specialGoalGuaranteedTurnWindow: 4,
      turnSpawnByLevel: [
        { minLevel: 1, maxLevel: 6, minSpawn: 1, maxSpawn: 1 },
        { minLevel: 7, maxLevel: 14, minSpawn: 2, maxSpawn: 2 },
        { minLevel: 15, maxLevel: 24, minSpawn: 2, maxSpawn: 3 },
        { minLevel: 25, maxLevel: 999, minSpawn: 3, maxSpawn: 3 }
      ] as readonly TurnSpawnRange[],
      emptyBoardRefillCount: 8,
      deadlockRefillCount: 8,
      overflowSettleMs: 1500,
      reshuffleMaxAttempts: 18
    }
  },

  // Timed spawn behavior for the arcade mode.
  spawn: {
    arcadeIntervalMinMs: 920,
    arcadeIntervalMaxMs: 1180,
    arcadeTempoGrowthEveryLevels: 2,
    arcadeIntervalMultiplierPerStep: 0.965,
    arcadeIntervalMinFloorMs: 360,
    arcadeIntervalMaxFloorMs: 520,
    hugeChanceBase: 0.24,
    hugeChanceGrowthEveryLevels: 6,
    hugeChanceGrowthPerStep: 0.012,
    hugeChanceMax: 0.34,
    doubleWaveChanceBase: 0.06,
    doubleWaveChanceGrowthEveryLevels: 4,
    doubleWaveChanceGrowthPerStep: 0.02,
    doubleWaveChanceMax: 0.22,
    tripleWaveStartLevel: 12,
    tripleWaveChanceGrowthEveryLevels: 6,
    tripleWaveChanceGrowthPerStep: 0.01,
    tripleWaveChanceMax: 0.08,
    guaranteedExtraWaveEveryLevels: 10,
    maxWaveCount: 8,
    initialDelayMs: 260
  },

  // Bomb spawn and blast tuning.
  bombs: {
    blastRadiusFactor: 2.2,
    minBlastRadius: 92,
    spawnChanceByLevel: [
      { minLevel: 13, maxLevel: 16, minChance: 0.01, maxChance: 0.02 },
      { minLevel: 17, maxLevel: 28, minChance: 0.02, maxChance: 0.04 }
    ] as readonly ChanceRange[]
  },

  // Color destroyer spawn tuning.
  colorDestroyers: {
    spawnChanceByLevel: [
      { minLevel: 9, maxLevel: 12, minChance: 0.02, maxChance: 0.03 },
      { minLevel: 13, maxLevel: 16, minChance: 0.03, maxChance: 0.04 },
      { minLevel: 17, maxLevel: 28, minChance: 0.04, maxChance: 0.05 }
    ] as readonly ChanceRange[]
  },

  // Special piece throttling and subtle anti-frustration assistance.
  specials: {
    tempoPenaltyPerStep: 0.32,
    wavePenaltyPerExtraPiece: 0.2,
    activeSpecialSpawnPenaltyMultiplier: 0.12,
    softAssist: {
      warningDistanceFactor: 0.18,
      criticalDistanceFactor: 0.08,
      warningHugeChanceMultiplier: 0.84,
      criticalHugeChanceMultiplier: 0.7,
      warningBombChanceMultiplier: 1.15,
      criticalBombChanceMultiplier: 1.3,
      warningDestroyerChanceMultiplier: 1.12,
      criticalDestroyerChanceMultiplier: 1.24
    }
  },

  // Combo tuning between special pieces.
  combos: {
    bombDestroyerBlastRadiusFactor: 0.92,
    bombDestroyerMinBlastRadius: 240
  },

  // Marker figure introduction and scaling.
  markers: {
    spawnChanceByLevel: [
      { minLevel: 5, maxLevel: 8, minChance: 0.05, maxChance: 0.07 },
      { minLevel: 9, maxLevel: 12, minChance: 0.08, maxChance: 0.1 },
      { minLevel: 13, maxLevel: 16, minChance: 0.1, maxChance: 0.12 },
      { minLevel: 17, maxLevel: 28, minChance: 0.12, maxChance: 0.15 }
    ] as readonly ChanceRange[]
  },

  // Destroy particles and flash effects.
  particles: {
    lifeMs: 500,
    count: 14
  },

  // Rewards for destroyed figures and large single-action clears.
  rewards: {
    normalFigurePoints: 2,
    markedFigurePoints: 5,
    actionBonuses: [
      { minDestroyed: 3, maxDestroyed: 4, bonusPoints: 2 },
      { minDestroyed: 5, maxDestroyed: 6, bonusPoints: 5 },
      {
        minDestroyed: 7,
        maxDestroyed: Number.MAX_SAFE_INTEGER,
        bonusPoints: 9
      }
    ] as readonly RewardBonusTier[]
  },

  // Player abilities. Costs differ by mode, effects remain centralized here.
  abilities: {
    costs: {
      arcade: {
        freeze: 50,
        fire: 45,
        spectrum: 35
      },
      'turn-based': {
        freeze: 65,
        fire: 45,
        spectrum: 35
      }
    },
    freezeDurationMs: 3000,
    freezeTurnDuration: 2,
    fireDurationMs: 400,
    fireBaseBurnHeightPx: 8,
    spectrumDurationMs: 850
  },

  // Permanent upgrade formulas and caps.
  upgrades: {
    baseCost: 100,
    costGrowthRate: 1.25,
    maxLevel: 8,
    blastRadiusBonusPerLevel: 0.04,
    fireHeightBonusPerLevel: 0.04,
    freezeArcadeDurationBonusPerLevel: 0.1,
    freezeTurnExtraEveryLevels: 2,
    freezeTurnMaxTurns: 5
  },

  // Round loss conditions.
  round: {
    arcadeOverflowByLevel: [
      { minLevel: 1, maxLevel: 8, minValue: 2500, maxValue: 2400 },
      { minLevel: 9, maxLevel: 18, minValue: 2350, maxValue: 2250 },
      { minLevel: 19, maxLevel: 32, minValue: 2200, maxValue: 2050 }
    ] as readonly ValueRange[]
  },

  // Misc future balance hooks.
  tuning: {
    baseImpulse: 0.0051
  }
} as const;

export function getAbilityCost(mode: GameMode, abilityId: AbilityId) {
  return GAME_CONFIG.abilities.costs[mode][abilityId];
}
