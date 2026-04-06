import { GAME_CONFIG } from './config';
import type { GameMode, LevelGoalType, LevelSettings } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getSpecialGoalType(level: number): LevelGoalType {
  return level >= GAME_CONFIG.turnBased.specialGoalStartLevel &&
    (level - GAME_CONFIG.turnBased.specialGoalStartLevel) %
      GAME_CONFIG.turnBased.specialGoalEveryLevels ===
      0
    ? 'special'
    : 'normal';
}

function getArcadeLevelSettings(level: number): LevelSettings {
  const levelIndex = Math.max(0, level - 1);
  const baseAverageSpawnInterval =
    (GAME_CONFIG.spawn.intervalMinMs + GAME_CONFIG.spawn.intervalMaxMs) * 0.5;

  const gravityY =
    GAME_CONFIG.physics.baseGravityY +
    levelIndex * GAME_CONFIG.progression.gravityPerLevel;
  const timeScale =
    GAME_CONFIG.progression.timeScaleBase +
    levelIndex * GAME_CONFIG.progression.timeScalePerLevel;

  const spawnMin = Math.max(
    GAME_CONFIG.spawn.intervalMinFloorMs,
    GAME_CONFIG.spawn.intervalMinMs -
      levelIndex * GAME_CONFIG.spawn.intervalMinStepPerLevel
  );

  const spawnMax = Math.max(
    GAME_CONFIG.spawn.intervalMaxFloorMs,
    GAME_CONFIG.spawn.intervalMaxMs -
      levelIndex * GAME_CONFIG.spawn.intervalMaxStepPerLevel
  );

  const averageSpawnInterval = (spawnMin + spawnMax) * 0.5;
  const spawnTempoFactor = baseAverageSpawnInterval / averageSpawnInterval;

  const rawBombChance = clamp(
    Math.max(0, level - GAME_CONFIG.bombs.startLevel + 1) *
      GAME_CONFIG.bombs.chancePerLevel,
    0,
    GAME_CONFIG.bombs.maxChance
  );

  const rawColorDestroyerChance = clamp(
    Math.max(0, level - GAME_CONFIG.colorDestroyers.startLevel + 1) *
      GAME_CONFIG.colorDestroyers.chancePerLevel,
    0,
    GAME_CONFIG.colorDestroyers.maxChance
  );

  const hugeChance = clamp(
    GAME_CONFIG.spawn.hugeChanceBase +
      levelIndex * GAME_CONFIG.spawn.hugeChancePerLevel,
    GAME_CONFIG.spawn.hugeChanceBase,
    GAME_CONFIG.spawn.hugeChanceMax
  );

  const markedChance = clamp(
    Math.max(0, level - GAME_CONFIG.markers.startLevel + 1) *
      GAME_CONFIG.markers.chancePerLevel,
    0,
    GAME_CONFIG.markers.maxChance
  );

  const doubleSpawnChance = clamp(
    GAME_CONFIG.spawn.doubleWaveChanceBase +
      levelIndex * GAME_CONFIG.spawn.doubleWaveChancePerLevel,
    GAME_CONFIG.spawn.doubleWaveChanceBase,
    GAME_CONFIG.spawn.doubleWaveChanceMax
  );

  const tripleSpawnChance = clamp(
    Math.max(0, level - GAME_CONFIG.spawn.tripleWaveStartLevel) *
      GAME_CONFIG.spawn.tripleWaveChancePerLevel,
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

  const bombChance = clamp(
    rawBombChance / specialSpawnThrottle,
    0,
    GAME_CONFIG.bombs.maxChance
  );

  const colorDestroyerChance = clamp(
    rawColorDestroyerChance / specialSpawnThrottle,
    0,
    GAME_CONFIG.colorDestroyers.maxChance
  );

  const goal =
    GAME_CONFIG.progression.levelGoalBase +
    levelIndex * GAME_CONFIG.progression.levelGoalPerLevel;

  return {
    mode: 'arcade',
    level,
    goal,
    goalType: 'all',
    gravityY,
    timeScale,
    spawnMin,
    spawnMax,
    bombChance,
    colorDestroyerChance,
    hugeChance,
    markedChance,
    doubleSpawnChance,
    tripleSpawnChance,
    guaranteedExtraSpawns,
    baseWavePieces: 1 + guaranteedExtraSpawns,
    speedMultiplier: (gravityY / GAME_CONFIG.physics.baseGravityY) * timeScale,
    initialPieces: 0,
    turnSpawnMin: 0,
    turnSpawnMax: 0
  };
}

function getTurnBasedLevelSettings(level: number): LevelSettings {
  const levelIndex = Math.max(0, level - 1);
  const baseArcadeSettings = getArcadeLevelSettings(level);
  const goalType = getSpecialGoalType(level);
  const specialSpawnMultiplier =
    goalType === 'special'
      ? GAME_CONFIG.turnBased.specialGoalSpecialSpawnMultiplier
      : 1;
  const specialTier = Math.floor(
    Math.max(0, level - GAME_CONFIG.turnBased.specialGoalStartLevel) /
      GAME_CONFIG.turnBased.specialGoalEveryLevels
  );
  const goal =
    goalType === 'special'
      ? GAME_CONFIG.turnBased.specialGoalBase +
        specialTier * GAME_CONFIG.turnBased.specialGoalPerTier
      : GAME_CONFIG.turnBased.normalGoalBase +
        levelIndex * GAME_CONFIG.turnBased.normalGoalPerLevel;
  const initialPieces = clamp(
    GAME_CONFIG.turnBased.initialPiecesBase +
      Math.floor(levelIndex / GAME_CONFIG.turnBased.initialPiecesGrowthEveryLevels),
    GAME_CONFIG.turnBased.initialPiecesBase,
    GAME_CONFIG.turnBased.initialPiecesMax
  );
  const turnSpawnMin = clamp(
    GAME_CONFIG.turnBased.turnSpawnBase +
      Math.floor(levelIndex / GAME_CONFIG.turnBased.turnSpawnGrowthEveryLevels),
    GAME_CONFIG.turnBased.turnSpawnBase,
    GAME_CONFIG.turnBased.turnSpawnMax
  );
  const turnSpawnMax = clamp(
    turnSpawnMin +
      (level >= GAME_CONFIG.turnBased.turnSpawnBonusStartLevel ? 1 : 0),
    turnSpawnMin,
    GAME_CONFIG.turnBased.turnSpawnMax
  );

  return {
    ...baseArcadeSettings,
    mode: 'turn-based',
    goal,
    goalType,
    gravityY: GAME_CONFIG.physics.baseGravityY * GAME_CONFIG.turnBased.baseGravityScale,
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
      GAME_CONFIG.bombs.maxChance
    ),
    colorDestroyerChance: clamp(
      baseArcadeSettings.colorDestroyerChance * specialSpawnMultiplier,
      0,
      GAME_CONFIG.colorDestroyers.maxChance
    ),
    markedChance: clamp(
      baseArcadeSettings.markedChance * specialSpawnMultiplier,
      0,
      GAME_CONFIG.markers.maxChance
    ),
    initialPieces,
    turnSpawnMin,
    turnSpawnMax
  };
}

export function getLevelSettings(level: number, mode: GameMode = 'arcade'): LevelSettings {
  return mode === 'turn-based'
    ? getTurnBasedLevelSettings(level)
    : getArcadeLevelSettings(level);
}
