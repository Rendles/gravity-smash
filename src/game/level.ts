import { GAME_CONFIG } from './config';
import type { GameMode, LevelGoalType, LevelSettings } from './types';

type LevelRhythm = 'normal' | 'breather' | 'tense';

type RangeWithChance = {
  minLevel: number;
  maxLevel: number;
  minChance: number;
  maxChance: number;
};

type RangeWithValue = {
  minLevel: number;
  maxLevel: number;
  minValue: number;
  maxValue: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function getRangeInterpolationProgress(level: number, minLevel: number, maxLevel: number) {
  const rangeSpan = Math.max(1, maxLevel - minLevel);
  return clamp((level - minLevel) / rangeSpan, 0, 1);
}

function getInterpolatedChance(level: number, ranges: readonly RangeWithChance[]) {
  const range = ranges.find(item => level >= item.minLevel && level <= item.maxLevel);
  if (range) {
    const progress = getRangeInterpolationProgress(level, range.minLevel, range.maxLevel);
    return lerp(range.minChance, range.maxChance, progress);
  }

  const lastRange = ranges[ranges.length - 1];
  if (lastRange && level > lastRange.maxLevel) {
    return lastRange.maxChance;
  }

  return 0;
}

function getInterpolatedValue(level: number, ranges: readonly RangeWithValue[]) {
  const range = ranges.find(item => level >= item.minLevel && level <= item.maxLevel);
  if (range) {
    const progress = getRangeInterpolationProgress(level, range.minLevel, range.maxLevel);
    return Math.round(lerp(range.minValue, range.maxValue, progress));
  }

  const lastRange = ranges[ranges.length - 1];
  if (lastRange && level > lastRange.maxLevel) {
    return lastRange.maxValue;
  }

  return ranges[0]?.minValue ?? 0;
}

function getLevelRhythm(level: number): LevelRhythm {
  if (level % GAME_CONFIG.progression.rhythm.tenseEveryLevels === 0) {
    return 'tense';
  }

  if (level % GAME_CONFIG.progression.rhythm.breatherEveryLevels === 0) {
    return 'breather';
  }

  return 'normal';
}

function applyGoalRhythm(goal: number, rhythm: LevelRhythm) {
  switch (rhythm) {
    case 'breather':
      return Math.max(1, Math.round(goal * GAME_CONFIG.progression.rhythm.breatherGoalMultiplier));
    case 'tense':
      return Math.max(1, Math.round(goal * GAME_CONFIG.progression.rhythm.tenseGoalMultiplier));
    case 'normal':
    default:
      return goal;
  }
}

function getSpecialGoalType(level: number): LevelGoalType {
  return level >= GAME_CONFIG.progression.turnBased.specialGoalStartLevel &&
    (level - GAME_CONFIG.progression.turnBased.specialGoalStartLevel) %
      GAME_CONFIG.progression.turnBased.specialGoalEveryLevels ===
      0
    ? 'special'
    : 'normal';
}

function getArcadeGoal(levelIndex: number, rhythm: LevelRhythm) {
  const baseGoal =
    GAME_CONFIG.progression.arcade.goalBase +
    levelIndex * GAME_CONFIG.progression.arcade.goalPerLevel +
    Math.floor(levelIndex / GAME_CONFIG.progression.arcade.goalBonusEveryLevels) *
      GAME_CONFIG.progression.arcade.goalBonusAmount;

  return applyGoalRhythm(baseGoal, rhythm);
}

function getArcadeOverflowMs(level: number) {
  return getInterpolatedValue(level, GAME_CONFIG.round.arcadeOverflowByLevel);
}

function getArcadeLevelSettings(level: number): LevelSettings {
  const levelIndex = Math.max(0, level - 1);
  const rhythm = getLevelRhythm(level);
  const baseAverageSpawnInterval =
    (GAME_CONFIG.spawn.arcadeIntervalMinMs + GAME_CONFIG.spawn.arcadeIntervalMaxMs) * 0.5;

  const gravityTiers = Math.floor(
    levelIndex / GAME_CONFIG.progression.arcade.gravityGrowthEveryLevels
  );
  const gravityY =
    GAME_CONFIG.physics.baseGravityY *
    Math.pow(GAME_CONFIG.progression.arcade.gravityGrowthMultiplier, gravityTiers);

  const timeScaleTiers = Math.floor(
    levelIndex / GAME_CONFIG.progression.arcade.timeScaleGrowthEveryLevels
  );
  const timeScale = Math.pow(
    GAME_CONFIG.progression.arcade.timeScaleGrowthMultiplier,
    timeScaleTiers
  );

  const spawnTempoTiers = Math.floor(levelIndex / GAME_CONFIG.spawn.arcadeTempoGrowthEveryLevels);
  const rhythmSpawnDelayMultiplier =
    rhythm === 'breather'
      ? GAME_CONFIG.progression.rhythm.breatherArcadeSpawnDelayMultiplier
      : rhythm === 'tense'
        ? GAME_CONFIG.progression.rhythm.tenseArcadeSpawnDelayMultiplier
        : 1;
  const spawnDelayMultiplier =
    Math.pow(GAME_CONFIG.spawn.arcadeIntervalMultiplierPerStep, spawnTempoTiers) *
    rhythmSpawnDelayMultiplier;

  const spawnMin = Math.max(
    GAME_CONFIG.spawn.arcadeIntervalMinFloorMs,
    Math.round(GAME_CONFIG.spawn.arcadeIntervalMinMs * spawnDelayMultiplier)
  );
  const spawnMax = Math.max(
    GAME_CONFIG.spawn.arcadeIntervalMaxFloorMs,
    Math.round(GAME_CONFIG.spawn.arcadeIntervalMaxMs * spawnDelayMultiplier)
  );

  const averageSpawnInterval = (spawnMin + spawnMax) * 0.5;
  const spawnTempoFactor = baseAverageSpawnInterval / averageSpawnInterval;
  const bombBaseChance = getInterpolatedChance(level, GAME_CONFIG.bombs.spawnChanceByLevel);
  const colorDestroyerBaseChance = getInterpolatedChance(
    level,
    GAME_CONFIG.colorDestroyers.spawnChanceByLevel
  );
  const markedBaseChance = getInterpolatedChance(level, GAME_CONFIG.markers.spawnChanceByLevel);

  const hugeChance = clamp(
    GAME_CONFIG.spawn.hugeChanceBase +
      Math.floor(levelIndex / GAME_CONFIG.spawn.hugeChanceGrowthEveryLevels) *
        GAME_CONFIG.spawn.hugeChanceGrowthPerStep,
    GAME_CONFIG.spawn.hugeChanceBase,
    GAME_CONFIG.spawn.hugeChanceMax
  );

  const waveRhythmMultiplier =
    rhythm === 'breather'
      ? GAME_CONFIG.progression.rhythm.breatherArcadeWaveMultiplier
      : rhythm === 'tense'
        ? GAME_CONFIG.progression.rhythm.tenseArcadeWaveMultiplier
        : 1;

  const doubleSpawnChance = clamp(
    (GAME_CONFIG.spawn.doubleWaveChanceBase +
      Math.floor(levelIndex / GAME_CONFIG.spawn.doubleWaveChanceGrowthEveryLevels) *
        GAME_CONFIG.spawn.doubleWaveChanceGrowthPerStep) *
      waveRhythmMultiplier,
    GAME_CONFIG.spawn.doubleWaveChanceBase * 0.7,
    GAME_CONFIG.spawn.doubleWaveChanceMax
  );

  const tripleSpawnBaseChance =
    level < GAME_CONFIG.spawn.tripleWaveStartLevel
      ? 0
      : (1 +
          Math.floor(
            (level - GAME_CONFIG.spawn.tripleWaveStartLevel) /
              GAME_CONFIG.spawn.tripleWaveChanceGrowthEveryLevels
          )) *
        GAME_CONFIG.spawn.tripleWaveChanceGrowthPerStep;

  const tripleSpawnChance = clamp(
    tripleSpawnBaseChance * waveRhythmMultiplier,
    0,
    GAME_CONFIG.spawn.tripleWaveChanceMax
  );

  const guaranteedExtraSpawns = Math.floor(
    levelIndex / GAME_CONFIG.spawn.guaranteedExtraWaveEveryLevels
  );
  const expectedWaveSize =
    1 +
    guaranteedExtraSpawns +
    doubleSpawnChance +
    tripleSpawnChance;
  const specialSpawnThrottle =
    1 +
    Math.max(0, spawnTempoFactor - 1) * GAME_CONFIG.specials.tempoPenaltyPerStep +
    Math.max(0, expectedWaveSize - 1) *
      GAME_CONFIG.specials.wavePenaltyPerExtraPiece;

  return {
    mode: 'arcade',
    level,
    goal: getArcadeGoal(levelIndex, rhythm),
    goalType: 'all',
    gravityY,
    timeScale,
    spawnMin,
    spawnMax,
    bombChance: bombBaseChance / specialSpawnThrottle,
    colorDestroyerChance: colorDestroyerBaseChance / specialSpawnThrottle,
    hugeChance,
    markedChance: markedBaseChance / specialSpawnThrottle,
    doubleSpawnChance,
    tripleSpawnChance,
    guaranteedExtraSpawns,
    baseWavePieces: 1 + guaranteedExtraSpawns,
    speedMultiplier: (gravityY / GAME_CONFIG.physics.baseGravityY) * timeScale,
    initialPieces: 0,
    turnSpawnMin: 0,
    turnSpawnMax: 0,
    overflowMs: getArcadeOverflowMs(level),
    guaranteedStartSpecials: 0,
    guaranteedEarlySpecialSpawns: 0,
    guaranteedEarlySpecialTurns: 0
  };
}

function getTurnBasedLevelSettings(level: number): LevelSettings {
  const levelIndex = Math.max(0, level - 1);
  const rhythm = getLevelRhythm(level);
  const baseArcadeSettings = getArcadeLevelSettings(level);
  const goalType = getSpecialGoalType(level);
  const specialSpawnMultiplier =
    goalType === 'special'
      ? GAME_CONFIG.progression.turnBased.specialGoalSpecialSpawnMultiplier
      : 1;
  const initialPieces = clamp(
    GAME_CONFIG.progression.turnBased.initialPiecesBase +
      Math.floor(
        levelIndex / GAME_CONFIG.progression.turnBased.initialPiecesGrowthEveryLevels
      ),
    GAME_CONFIG.progression.turnBased.initialPiecesBase,
    GAME_CONFIG.progression.turnBased.initialPiecesMax
  );
  const spawnRange =
    GAME_CONFIG.progression.turnBased.turnSpawnByLevel.find(
      range => level >= range.minLevel && level <= range.maxLevel
    ) ??
    GAME_CONFIG.progression.turnBased.turnSpawnByLevel[
      GAME_CONFIG.progression.turnBased.turnSpawnByLevel.length - 1
    ];
  const turnSpawnCap =
    GAME_CONFIG.progression.turnBased.turnSpawnByLevel[
      GAME_CONFIG.progression.turnBased.turnSpawnByLevel.length - 1
    ].maxSpawn;
  const turnSpawnOffset =
    rhythm === 'breather'
      ? GAME_CONFIG.progression.rhythm.breatherTurnSpawnOffset
      : rhythm === 'tense'
        ? GAME_CONFIG.progression.rhythm.tenseTurnSpawnOffset
        : 0;
  const turnSpawnMin = clamp(
    (spawnRange?.minSpawn ?? 1) + turnSpawnOffset,
    1,
    turnSpawnCap
  );
  const turnSpawnMax = clamp(
    (spawnRange?.maxSpawn ?? 1) + turnSpawnOffset,
    turnSpawnMin,
    turnSpawnCap
  );
  const specialTier = Math.floor(
    Math.max(0, level - GAME_CONFIG.progression.turnBased.specialGoalStartLevel) /
      GAME_CONFIG.progression.turnBased.specialGoalEveryLevels
  );
  const rawGoal =
    goalType === 'special'
      ? GAME_CONFIG.progression.turnBased.specialGoalBase +
        specialTier * GAME_CONFIG.progression.turnBased.specialGoalPerTier
      : GAME_CONFIG.progression.turnBased.normalGoalBase +
        levelIndex * GAME_CONFIG.progression.turnBased.normalGoalPerLevel +
        Math.floor(
          levelIndex / GAME_CONFIG.progression.turnBased.normalGoalBonusEveryLevels
        ) * GAME_CONFIG.progression.turnBased.normalGoalBonusAmount;
  const goal = applyGoalRhythm(rawGoal, rhythm);
  const guaranteedStartSpecials =
    goalType === 'special'
      ? clamp(
          Math.floor(
            goal * GAME_CONFIG.progression.turnBased.specialGoalGuaranteedStartRatio
          ),
          1,
          Math.min(
            GAME_CONFIG.progression.turnBased.specialGoalGuaranteedStartCap,
            initialPieces
          )
        )
      : 0;
  const guaranteedEarlySpecialSpawns =
    goalType === 'special'
      ? Math.max(
          0,
          Math.min(
            goal - guaranteedStartSpecials,
            clamp(
              Math.ceil(
                goal *
                  GAME_CONFIG.progression.turnBased.specialGoalGuaranteedEarlyRatio
              ),
              1,
              GAME_CONFIG.progression.turnBased.specialGoalGuaranteedEarlyCap
            )
          )
        )
      : 0;

  return {
    ...baseArcadeSettings,
    mode: 'turn-based',
    goal,
    goalType,
    gravityY:
      GAME_CONFIG.physics.baseGravityY * GAME_CONFIG.progression.turnBased.baseGravityScale,
    timeScale: 1,
    spawnMin: 0,
    spawnMax: 0,
    doubleSpawnChance: 0,
    tripleSpawnChance: 0,
    guaranteedExtraSpawns: 0,
    baseWavePieces: 0,
    speedMultiplier: 1,
    bombChance: clamp(
      baseArcadeSettings.bombChance * specialSpawnMultiplier,
      0,
      1
    ),
    colorDestroyerChance: clamp(
      baseArcadeSettings.colorDestroyerChance * specialSpawnMultiplier,
      0,
      1
    ),
    markedChance: clamp(
      baseArcadeSettings.markedChance * specialSpawnMultiplier,
      0,
      1
    ),
    initialPieces,
    turnSpawnMin,
    turnSpawnMax,
    guaranteedStartSpecials,
    guaranteedEarlySpecialSpawns,
    guaranteedEarlySpecialTurns:
      goalType === 'special'
        ? GAME_CONFIG.progression.turnBased.specialGoalGuaranteedTurnWindow
        : 0
  };
}

export function getLevelSettings(level: number, mode: GameMode = 'arcade'): LevelSettings {
  return mode === 'turn-based'
    ? getTurnBasedLevelSettings(level)
    : getArcadeLevelSettings(level);
}
