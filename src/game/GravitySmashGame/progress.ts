import { INITIAL_LEVEL } from '../config';
import type { EconomySnapshot, GameProgressSnapshot } from '../types';

export interface ProgressState {
  highestUnlockedLevel: number;
  lastRoundOutcome: 'win' | 'lose' | null;
}

export function createProgressState(
  initialProgress?: GameProgressSnapshot | null
): ProgressState {
  return {
    highestUnlockedLevel: Math.max(
      INITIAL_LEVEL,
      initialProgress?.resumeLevel ?? INITIAL_LEVEL,
      initialProgress?.highestUnlockedLevel ?? INITIAL_LEVEL
    ),
    lastRoundOutcome: null
  };
}

export function markLevelStarted(state: ProgressState, level: number) {
  state.highestUnlockedLevel = Math.max(state.highestUnlockedLevel, level);
  state.lastRoundOutcome = null;
}

export function markRoundEnded(
  state: ProgressState,
  level: number,
  outcome: 'win' | 'lose'
) {
  state.lastRoundOutcome = outcome;

  if (outcome === 'win') {
    state.highestUnlockedLevel = Math.max(state.highestUnlockedLevel, level + 1);
  }
}

export function buildProgressSnapshot(
  state: ProgressState,
  currentLevel: number,
  economy: EconomySnapshot
): GameProgressSnapshot {
  const resumeLevel =
    state.lastRoundOutcome === 'win'
      ? Math.max(currentLevel + 1, state.highestUnlockedLevel)
      : currentLevel;
  const normalizedResumeLevel = Math.max(INITIAL_LEVEL, resumeLevel);

  return {
    resumeLevel: normalizedResumeLevel,
    highestUnlockedLevel: Math.max(
      state.highestUnlockedLevel,
      normalizedResumeLevel
    ),
    economy
  };
}
