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
  // Размеры фигур: базовый размер и множители для обычных и больших фигур.
  sizes: {
    rootMinFactor: 0.065,
    rootMaxFactor: 0.085,
    smallMultiplierMin: 2.0,
    smallMultiplierMax: 2.2,
    hugeMultiplierMin: 2.4,
    hugeMultiplierMax: 2.6
  },

  // Физика материала и столкновений.
  physics: {
    restitution: 0.08,
    friction: 0.22,
    frictionAir: 0.014,
    contactSlop: 0.0015,
    plasticDeformMax: 0.032,
    plasticDeformRecovery: 0.015,
    baseGravityY: 1.92
  },

  // Рост сложности по уровням.
  progression: {
    gravityPerLevel: 0.02,
    timeScaleBase: 1,
    timeScalePerLevel: 0.012,
    levelGoalBase: 16,
    levelGoalPerLevel: 4
  },

  // Все, что связано со спавном фигур и волн.
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

  // Параметры появления и действия бомб.
  bombs: {
    startLevel: 10,
    chancePerLevel: 0.02, // было 0.03
    maxChance: 0.1, // было 0.14
    blastRadiusFactor: 2.2,
    minBlastRadius: 92
  },

  // Параметры фигуры, которая удаляет все фигуры выбранного цвета.
  colorDestroyers: {
    startLevel: 8,
    chancePerLevel: 0.01, // было 0.025
    maxChance: 0.08 // было 0.12
  },

  // Насколько медленнее спецфигуры должны наращивать частоту,
  // когда общий темп спавна и размер волн увеличиваются.
  specials: {
    tempoPenaltyPerStep: 0.45,
    wavePenaltyPerExtraPiece: 0.28
  },

  // Спец-комбо между особыми фигурами.
  combos: {
    bombDestroyerBlastRadiusFactor: 0.92,
    bombDestroyerMinBlastRadius: 240
  },

  // Когда и как в игру добавляются фигуры с маленькими символами внутри.
  markers: {
    startLevel: 5,
    chancePerLevel: 0.05,
    maxChance: 0.36
  },

  // Частицы и визуальные вспышки при уничтожении фигур.
  particles: {
    lifeMs: 500,
    count: 14
  },

  // Награды за уничтожение фигур.
  rewards: {
    normalFigurePoints: 2,
    markedFigurePoints: 6
  },

  // Активные способности, которые игрок может покупать за монеты.
  abilities: {
    freezeCost: 50,
    freezeDurationMs: 3000,
    fireCost: 40,
    fireDurationMs: 400,
    spectrumCost: 50,
    spectrumDurationMs: 850
  },

  // Правила раунда: когда считается, что игрок проиграл.
  round: {
    overflowMs: 1900
  },

  // Резерв под будущий баланс импульсов или внешних сил.
  tuning: {
    baseImpulse: 0.0051
  }
} as const;
