import type { GameMode, GameUiState, LevelGoalType, LevelSettings } from './types';

const WIN_PRAISES = [
  'Уровень пройден, так держать!',
  'Уровень пройден, ты отлично справился!',
  'Уровень пройден, очень сильная игра!',
  'Уровень пройден, ты здорово держишь темп!',
  'Уровень пройден, отличный результат!',
  'Уровень пройден, ты уверенно разобрался с ним!',
  'Уровень пройден, очень хорошая работа!'
] as const;

function getGoalNoun(goalType: LevelGoalType) {
  switch (goalType) {
    case 'special':
      return 'спецфигур';
    case 'normal':
      return 'обычных фигур и фигур с символами';
    case 'all':
    default:
      return 'фигур';
  }
}

export function getProgressLabelText(mode: GameMode, goalType: LevelGoalType) {
  if (mode === 'turn-based') {
    return goalType === 'special' ? 'SPECIAL' : 'NORMAL';
  }

  return 'DESTROYED';
}

export function createInitialUiState(): GameUiState {
  return {
    progressLabelText: 'DESTROYED',
    progressCountText: '0 \\ 16',
    progressSubText: '',
    levelCountText: '1',
    levelDangerText: '',
    scoreCountText: '0',
    scoreSubText: '',
    freezeButtonDisabled: true,
    freezeButtonActive: false,
    fireButtonDisabled: true,
    fireButtonActive: false,
    spectrumButtonDisabled: true,
    spectrumButtonActive: false,
    barInfoText: '',
    overlayVisible: false,
    overlayCardWin: false,
    overlayTitleTone: 'lose',
    overlayTitleText: 'Уровень проигран',
    overlayMessageText:
      'Стакан переполнен. Попробуй снова пройти этот уровень.',
    overlayPrimaryVisible: true,
    overlayPrimaryText: 'Перезапустить уровень',
    overlayPrimaryAction: 'retry',
    overlaySecondaryVisible: true,
    overlaySecondaryText: 'Переиграть уровень',
    pauseButtonText: 'Пауза',
    pauseButtonDisabled: false
  };
}

export function getProgressCountText(levelDestroyed: number, levelGoal: number) {
  return `${levelDestroyed} \\ ${levelGoal}`;
}

export function getProgressSubText(levelDestroyed: number, levelGoal: number) {
  void levelDestroyed;
  void levelGoal;
  return '';
}

export function getLevelCountText(level: number) {
  return `${level}`;
}

export function getScoreCountText(points: number) {
  return `${points}`;
}

export function getScoreSubText() {
  return '';
}

export function getLevelDangerText(settings: LevelSettings) {
  void settings;
  return '';
}

export function getDefaultBarInfo(levelGoal: number) {
  void levelGoal;
  return '';
}

export function getSelectedBarInfo(levelGoal: number) {
  void levelGoal;
  return '';
}

export function getWinOverlayState(
  currentLevel: number,
  levelGoal: number,
  mode: GameMode,
  goalType: LevelGoalType
) {
  const nextLevel = currentLevel + 1;
  const praise = WIN_PRAISES[Math.floor(Math.random() * WIN_PRAISES.length)];
  const goalNoun = getGoalNoun(goalType);
  const overlayMessageText =
    mode === 'turn-based'
      ? `Уровень ${currentLevel} завершен: цель на ${levelGoal} ${goalNoun} выполнена. На уровне ${nextLevel} стартовая раскладка станет плотнее, а после каждого хода будет падать больше фигур.`
      : `Уровень ${currentLevel} завершен: уничтожено ${levelGoal} фигур. На уровне ${nextLevel} фигур будет больше и они будут падать чаще.`;

  return {
    overlayVisible: true,
    overlayCardWin: true,
    overlayTitleTone: 'win' as const,
    overlayTitleText: praise,
    overlayMessageText,
    overlayPrimaryVisible: true,
    overlayPrimaryText: `Перейти на уровень ${nextLevel}`,
    overlayPrimaryAction: 'next' as const,
    overlaySecondaryVisible: false,
    overlaySecondaryText: 'Переиграть этот уровень',
    freezeButtonDisabled: true,
    freezeButtonActive: false,
    fireButtonDisabled: true,
    fireButtonActive: false,
    spectrumButtonDisabled: true,
    spectrumButtonActive: false,
    barInfoText: '',
    pauseButtonText: 'Пауза',
    pauseButtonDisabled: true
  };
}

export function getLoseOverlayState(
  currentLevel: number,
  levelGoal: number,
  mode: GameMode,
  goalType: LevelGoalType
) {
  const goalNoun = getGoalNoun(goalType);
  const overlayMessageText =
    mode === 'turn-based'
      ? `Стакан переполнен. На этом уровне нужно уничтожить ${levelGoal} ${goalNoun}, внимательно планируя каждый ход.`
      : `Стакан переполнен. Для победы на этом уровне нужно вручную находить пары одинакового цвета и уничтожить ${levelGoal} фигур.`;

  return {
    overlayVisible: true,
    overlayCardWin: false,
    overlayTitleTone: 'lose' as const,
    overlayTitleText: `Уровень ${currentLevel} проигран`,
    overlayMessageText,
    overlayPrimaryVisible: true,
    overlayPrimaryText: 'Перезапустить уровень',
    overlayPrimaryAction: 'retry' as const,
    overlaySecondaryVisible: false,
    overlaySecondaryText: 'Переиграть уровень',
    freezeButtonDisabled: true,
    freezeButtonActive: false,
    fireButtonDisabled: true,
    fireButtonActive: false,
    spectrumButtonDisabled: true,
    spectrumButtonActive: false,
    barInfoText: '',
    pauseButtonText: 'Пауза',
    pauseButtonDisabled: true
  };
}

export function getPausedOverlayState(mode: GameMode) {
  const overlayMessageText =
    mode === 'turn-based'
      ? 'Пошаговый уровень приостановлен. Нажми «Продолжить», когда будешь готов вернуться к следующему ходу.'
      : 'Игра приостановлена. Нажми «Продолжить», когда будешь готов вернуться.';

  return {
    overlayVisible: true,
    overlayCardWin: false,
    overlayTitleTone: 'pause' as const,
    overlayTitleText: 'Пауза',
    overlayMessageText,
    overlayPrimaryVisible: true,
    overlayPrimaryText: 'Продолжить',
    overlayPrimaryAction: 'resume' as const,
    overlaySecondaryVisible: false,
    overlaySecondaryText: 'Переиграть уровень',
    freezeButtonDisabled: true,
    freezeButtonActive: false,
    fireButtonDisabled: true,
    fireButtonActive: false,
    spectrumButtonDisabled: true,
    spectrumButtonActive: false,
    barInfoText: '',
    pauseButtonText: 'Пауза',
    pauseButtonDisabled: true
  };
}

export function getResumeCountdownOverlayState(secondsLeft: number, mode: GameMode) {
  const overlayMessageText =
    mode === 'turn-based'
      ? 'Приготовься: уровень скоро продолжится.'
      : 'Приготовься: игра скоро вернется в реальное время.';

  return {
    overlayVisible: true,
    overlayCardWin: false,
    overlayTitleTone: 'pause' as const,
    overlayTitleText: `Продолжение через ${secondsLeft}`,
    overlayMessageText,
    overlayPrimaryVisible: false,
    overlayPrimaryText: 'Продолжить',
    overlayPrimaryAction: 'resume' as const,
    overlaySecondaryVisible: false,
    overlaySecondaryText: 'Переиграть уровень',
    freezeButtonDisabled: true,
    freezeButtonActive: true,
    fireButtonDisabled: true,
    fireButtonActive: false,
    spectrumButtonDisabled: true,
    spectrumButtonActive: false,
    barInfoText: '',
    pauseButtonText: 'Пауза',
    pauseButtonDisabled: true
  };
}
