import type { ColorDefinition, MarkerType, ShapeType } from './types';

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

  // Timed arcade mode progression.
  progression: {
    gravityPerLevel: 0.02,
    timeScaleBase: 1,
    timeScalePerLevel: 0.012,
    levelGoalBase: 16,
    levelGoalPerLevel: 4
  },

  // Turn-based mode progression.
  turnBased: {
    baseGravityScale: 0.88,
    initialPiecesBase: 6,
    initialPiecesGrowthEveryLevels: 3,
    initialPiecesMax: 11,
    normalGoalBase: 14,
    normalGoalPerLevel: 3,
    specialGoalStartLevel: 5,
    specialGoalEveryLevels: 3,
    specialGoalBase: 5,
    specialGoalPerTier: 1,
    turnSpawnBase: 4,
    turnSpawnGrowthEveryLevels: 6,
    turnSpawnBonusStartLevel: 4,
    turnSpawnMax: 8,
    emptyBoardRefillCount: 8,
    specialGoalSpecialSpawnMultiplier: 1.85,
    overflowSettleMs: 1500,
    reshuffleMaxAttempts: 18
  },

  // Timed spawn behavior for the arcade mode.
  spawn: {
    intervalMinMs: 820,
    intervalMaxMs: 1180,
    intervalMinStepPerLevel: 18,
    intervalMaxStepPerLevel: 24,
    intervalMinFloorMs: 180,
    intervalMaxFloorMs: 260,
    hugeChanceBase: 0.3,
    hugeChancePerLevel: 0.008,
    hugeChanceMax: 0.42,
    doubleWaveChanceBase: 0.06,
    doubleWaveChancePerLevel: 0.025,
    doubleWaveChanceMax: 0.32,
    tripleWaveStartLevel: 8,
    tripleWaveChancePerLevel: 0.018,
    tripleWaveChanceMax: 0.12,
    guaranteedExtraWaveEveryLevels: 6,
    maxWaveCount: 10,
    initialDelayMs: 260
  },

  // Bomb spawn and blast tuning.
  bombs: {
    startLevel: 10,
    chancePerLevel: 0.02,
    maxChance: 0.1,
    blastRadiusFactor: 2.2,
    minBlastRadius: 92
  },

  // Color destroyer spawn tuning.
  colorDestroyers: {
    startLevel: 8,
    chancePerLevel: 0.01,
    maxChance: 0.08
  },

  // How much special piece frequency should slow down when the arcade tempo rises.
  specials: {
    tempoPenaltyPerStep: 0.45,
    wavePenaltyPerExtraPiece: 0.28,
    activeSpecialSpawnPenaltyMultiplier: 0.12
  },

  // Combo tuning between special pieces.
  combos: {
    bombDestroyerBlastRadiusFactor: 0.92,
    bombDestroyerMinBlastRadius: 240
  },

  // Marker figure introduction and scaling.
  markers: {
    startLevel: 5,
    chancePerLevel: 0.05,
    maxChance: 0.36
  },

  // Destroy particles and flash effects.
  particles: {
    lifeMs: 500,
    count: 14
  },

  // Rewards for destroyed figures.
  rewards: {
    normalFigurePoints: 2,
    markedFigurePoints: 6
  },

  // Player abilities.
  abilities: {
    freezeCost: 50,
    freezeDurationMs: 3000,
    freezeTurnDuration: 3,
    fireCost: 40,
    fireDurationMs: 400,
    spectrumCost: 50,
    spectrumDurationMs: 850
  },

  // Round loss conditions.
  round: {
    overflowMs: 1900
  },

  // Misc future balance hooks.
  tuning: {
    baseImpulse: 0.0051
  }
} as const;
