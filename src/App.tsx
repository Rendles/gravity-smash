import { useEffect, useRef, useState } from 'react';
import { GameAudio } from './audio/GameAudio';
import { GravitySmashGame } from './game/GravitySmashGame';
import { GAME_CONFIG, getAbilityCost } from './game/config';
import {
  createEmptyUpgradeLevels,
  getFreezeArcadeDurationMultiplier,
  getFreezeTurnDuration,
  PlayerEconomy
} from './game/economy';
import type {
  GameMode,
  GameProgressSnapshot,
  UpgradeId
} from './game/types';
import { createInitialUiState } from './game/ui';
import { loadProgress, saveProgress } from './storage/progressStore';

const SOUND_STORAGE_KEY = 'gravity-smash-sound-enabled';
const TUTORIAL_STORAGE_KEY = 'gravity-smash-tutorials-seen';

type TutorialId = 'abilities' | 'markers' | 'color-destroyer' | 'bomb';

interface TutorialCard {
  id: TutorialId;
  title: string;
  message: string;
}

const TUTORIALS: Record<TutorialId, TutorialCard> = {
  abilities: {
    id: 'abilities',
    title: 'Способности',
    message:
      'Трать Coin на помощь: заморозка задерживает спавн, огонь чистит дно, спектр убирает самый частый цвет.'
  },
  markers: {
    id: 'markers',
    title: 'Новая механика',
    message:
      'С этого уровня появляются белые символы. Матчь одинаковые A, M, T или +, цвет не важен.'
  },
  'color-destroyer': {
    id: 'color-destroyer',
    title: 'Новая механика',
    message:
      'Появляется уничтожитель цвета. Выбери его и фигуру, чтобы убрать весь выбранный цвет или символ.'
  },
  bomb: {
    id: 'bomb',
    title: 'Новая механика',
    message:
      'Появляются бомбы. Совмести бомбу с любой фигурой, чтобы взорвать соседей.'
  }
};

function getInitialSoundEnabled() {
  try {
    const storedValue = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return storedValue === null ? true : storedValue === 'true';
  } catch {
    return true;
  }
}

function getInitialSeenTutorialIds(): TutorialId[] {
  try {
    const storedValue = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue.filter((id): id is TutorialId => id in TUTORIALS)
      : [];
  } catch {
    return [];
  }
}

function saveSeenTutorialIds(ids: TutorialId[]) {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Tutorial hints are helpful, but the game should keep working without storage.
  }
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

function createDefaultProgressSnapshot(): GameProgressSnapshot {
  return {
    resumeLevel: 1,
    highestUnlockedLevel: 1,
    economy: {
      points: 0,
      upgradeLevels: createEmptyUpgradeLevels()
    }
  };
}

function getUnlockTutorialForLevel(level: number): TutorialId | null {
  const markerUnlockLevel = GAME_CONFIG.markers.spawnChanceByLevel[0]?.minLevel;
  const colorDestroyerUnlockLevel =
    GAME_CONFIG.colorDestroyers.spawnChanceByLevel[0]?.minLevel;
  const bombUnlockLevel = GAME_CONFIG.bombs.spawnChanceByLevel[0]?.minLevel;

  if (level === markerUnlockLevel) {
    return 'markers';
  }

  if (level === colorDestroyerUnlockLevel) {
    return 'color-destroyer';
  }

  if (level === bombUnlockLevel) {
    return 'bomb';
  }

  return null;
}

function getTutorialsForLevelStart(level: number, includeAbilityIntro: boolean) {
  const tutorialIds: TutorialId[] = [];
  const unlockTutorial = getUnlockTutorialForLevel(level);

  if (includeAbilityIntro) {
    tutorialIds.push('abilities');
  }

  if (unlockTutorial) {
    tutorialIds.push(unlockTutorial);
  }

  return tutorialIds;
}

export default function App() {
  const gameRootRef = useRef<HTMLDivElement | null>(null);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GravitySmashGame | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const pendingProgressSaveRef = useRef<GameProgressSnapshot | null>(null);
  const progressSaveTimerRef = useRef<number | null>(null);
  const pendingTutorialIdsRef = useRef<TutorialId[]>([]);
  const pendingTutorialActionRef = useRef<(() => void) | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('arcade');
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [uiState, setUiState] = useState(createInitialUiState);
  const [savedProgress, setSavedProgress] = useState<GameProgressSnapshot | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [isMenuShopOpen, setIsMenuShopOpen] = useState(false);
  const [seenTutorialIds, setSeenTutorialIds] = useState(getInitialSeenTutorialIds);
  const [activeTutorial, setActiveTutorial] = useState<TutorialCard | null>(null);

  useEffect(() => {
    let isMounted = true;

    void loadProgress().then(progress => {
      if (!isMounted) {
        return;
      }

      setSavedProgress(progress);
      setProgressReady(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const audio = new GameAudio();
    audioRef.current = audio;
    audio.setMuted(!soundEnabled);
    audio.setMenuMusicEnabled(true);

    return () => {
      audio.destroy();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(!soundEnabled);

    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    } catch {
      // Ignore storage errors and keep the toggle working for the current session.
    }
  }, [soundEnabled]);

  useEffect(() => {
    audioRef.current?.setMenuMusicEnabled(!hasStarted);
  }, [hasStarted]);

  const persistProgressSnapshot = (progress: GameProgressSnapshot) => {
    pendingProgressSaveRef.current = progress;

    if (progressSaveTimerRef.current !== null) {
      window.clearTimeout(progressSaveTimerRef.current);
      progressSaveTimerRef.current = null;
    }

    setSavedProgress(progress);
    void saveProgress(progress);
  };

  useEffect(() => {
    if (!hasStarted || !progressReady || !gameRootRef.current || !bottomBarRef.current) {
      return undefined;
    }

    const scheduleProgressSave = (progress: GameProgressSnapshot) => {
      pendingProgressSaveRef.current = progress;

      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
      }

      progressSaveTimerRef.current = window.setTimeout(() => {
        progressSaveTimerRef.current = null;

        if (!pendingProgressSaveRef.current) {
          return;
        }

        void saveProgress(pendingProgressSaveRef.current);
      }, 120);
    };

    const game = new GravitySmashGame({
      root: gameRootRef.current,
      bottomBar: bottomBarRef.current,
      mode: selectedMode,
      onUiChange: setUiState,
      initialProgress: savedProgress,
      onProgressChange: progress => {
        setSavedProgress(progress);
        scheduleProgressSave(progress);
      },
      onAudioEvent: event => {
        audioRef.current?.playEvent(event);
      }
    });

    gameRef.current = game;
    game.startLevel(savedProgress?.resumeLevel ?? 1);

    return () => {
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
        progressSaveTimerRef.current = null;
      }

      if (pendingProgressSaveRef.current) {
        void saveProgress(pendingProgressSaveRef.current);
      }

      game.destroy();
      gameRef.current = null;
    };
  }, [hasStarted, progressReady, selectedMode]);

  const appClassName = [
    uiState.freezeButtonActive ? 'freeze-active' : '',
    uiState.fireButtonActive ? 'fire-active' : '',
    uiState.spectrumButtonActive ? 'spectrum-active' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const soundToggleText = soundEnabled ? 'Звук: вкл' : 'Звук: выкл';
  const baseMenuProgress = savedProgress ?? createDefaultProgressSnapshot();
  const menuEconomy = new PlayerEconomy();
  menuEconomy.hydrate(baseMenuProgress.economy);
  const menuUpgradeCatalog = menuEconomy.getUpgradeCatalog();
  const freezeCost = getAbilityCost(selectedMode, 'freeze');
  const fireCost = getAbilityCost(selectedMode, 'fire');
  const spectrumCost = getAbilityCost(selectedMode, 'spectrum');
  const upgradeLevels =
    gameRef.current?.getEconomySnapshot().upgradeLevels ??
    savedProgress?.economy.upgradeLevels ??
    createEmptyUpgradeLevels();
  const freezeUpgradeLevel = upgradeLevels['freeze-duration'] ?? 0;
  const freezeTurnCount = getFreezeTurnDuration(freezeUpgradeLevel);
  const freezeArcadeSeconds =
    (GAME_CONFIG.abilities.freezeDurationMs *
      getFreezeArcadeDurationMultiplier(freezeUpgradeLevel)) /
    1000;
  const freezeArcadeSecondsText = Number.isInteger(freezeArcadeSeconds)
    ? String(freezeArcadeSeconds)
    : freezeArcadeSeconds.toFixed(1);
  const freezeHint =
    selectedMode === 'turn-based'
      ? `Заморозка: следующие ${freezeTurnCount} ${getTurnWord(
          freezeTurnCount
        )} новые фигуры не падают`
      : `Заморозка: останавливает спавн новых фигур на ${freezeArcadeSecondsText} сек.`;
  const fireHint = 'Огонь: сжигает фигуры у дна стакана';
  const spectrumHint = 'Спектр: уничтожает самый распространенный обычный цвет на поле';
  const winUpgradeCatalog =
    hasStarted && uiState.overlayCardWin
      ? gameRef.current?.getUpgradeCatalog() ?? []
      : [];

  const runAfterTutorials = (
    tutorialIds: TutorialId[],
    action: () => void
  ) => {
    const unseenTutorialIds = tutorialIds.filter(
      id => !seenTutorialIds.includes(id)
    );

    if (!unseenTutorialIds.length) {
      action();
      return;
    }

    pendingTutorialIdsRef.current = unseenTutorialIds.slice(1);
    pendingTutorialActionRef.current = action;
    setActiveTutorial(TUTORIALS[unseenTutorialIds[0]]);
  };

  const handleTutorialContinue = () => {
    if (!activeTutorial) {
      return;
    }

    const nextSeenTutorialIds = Array.from(
      new Set([...seenTutorialIds, activeTutorial.id])
    );
    setSeenTutorialIds(nextSeenTutorialIds);
    saveSeenTutorialIds(nextSeenTutorialIds);

    const nextTutorialId = pendingTutorialIdsRef.current.shift();
    if (nextTutorialId) {
      setActiveTutorial(TUTORIALS[nextTutorialId]);
      return;
    }

    const action = pendingTutorialActionRef.current;
    pendingTutorialActionRef.current = null;
    setActiveTutorial(null);
    action?.();
  };

  const handleStartMode = (mode: GameMode) => {
    void audioRef.current?.resume();
    setIsMenuShopOpen(false);
    const startLevel = savedProgress?.resumeLevel ?? 1;

    runAfterTutorials(
      getTutorialsForLevelStart(startLevel, true),
      () => {
        setSelectedMode(mode);
        setHasStarted(true);
      }
    );
  };

  const handleMenuUpgradePurchase = (upgradeId: UpgradeId) => {
    const nextEconomy = new PlayerEconomy();
    nextEconomy.hydrate(baseMenuProgress.economy);

    if (!nextEconomy.purchaseUpgrade(upgradeId)) {
      return;
    }

    persistProgressSnapshot({
      ...baseMenuProgress,
      economy: nextEconomy.getSnapshot()
    });
  };

  const handleReturnToMainMenu = () => {
    const latestProgress = gameRef.current?.getProgressSnapshot() ?? savedProgress;
    if (latestProgress) {
      persistProgressSnapshot(latestProgress);
    }

    setIsMenuShopOpen(false);
    setUiState(createInitialUiState());
    setHasStarted(false);
  };

  const handlePrimaryOverlayAction = () => {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    if (uiState.overlayPrimaryAction === 'next') {
      const nextLevel = game.getCurrentLevel() + 1;
      const unlockTutorial = getUnlockTutorialForLevel(nextLevel);

      runAfterTutorials(
        unlockTutorial ? [unlockTutorial] : [],
        () => game.startLevel(nextLevel)
      );
      return;
    }

    game.handlePrimaryOverlayAction();
  };

  return (
    <div
      id="app"
      className={appClassName}
      onPointerDownCapture={() => {
        void audioRef.current?.resume();
      }}
    >
      <div id="game-root" ref={gameRootRef} />
      <div id="spectrum-overlay" className={uiState.spectrumButtonActive ? 'show' : ''} />

      <div id="top-status" className={hasStarted ? '' : 'ui-hidden'}>
        <div className="top-chip">
          <div className="top-chip-label">LVL</div>
          <div id="level-count" className="top-chip-value">
            {uiState.levelCountText}
          </div>
        </div>

        <div className="top-chip top-chip-progress">
          <div className="top-chip-label">{uiState.progressLabelText}</div>
          <div id="progress-count" className="top-chip-value">
            {uiState.progressCountText}
          </div>
        </div>

        <button
          id="pause-btn"
          className="top-pause-btn"
          type="button"
          aria-label={uiState.pauseButtonText}
          title={uiState.pauseButtonText}
          disabled={uiState.pauseButtonDisabled}
          onClick={() => gameRef.current?.pauseGame()}
        >
          <span className="pause-icon" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>
      </div>

      <div id="bottom-bar" ref={bottomBarRef} className={hasStarted ? '' : 'ui-hidden'}>
        <div id="coin-panel">
          <div className="coin-label">COIN</div>
          <div id="score-count" className="coin-value">
            {uiState.scoreCountText}
          </div>
        </div>

        <div id="power-buttons">
          <div className="power-slot">
            <button
              className={`power-btn${uiState.freezeButtonActive ? ' power-btn-active' : ''}`}
              type="button"
              aria-label="Заморозка"
              title={freezeHint}
              disabled={uiState.freezeButtonDisabled}
              onClick={() => gameRef.current?.useFreezePower()}
            >
              <span className="power-icon power-icon-snow" aria-hidden="true">
                ❄
              </span>
            </button>
            <div className="power-cost">{freezeCost} Coin</div>
          </div>

          <div className="power-slot">
            <button
              className={`power-btn${uiState.fireButtonActive ? ' power-btn-fire-active' : ''}`}
              type="button"
              aria-label="Огонь"
              title={fireHint}
              disabled={uiState.fireButtonDisabled}
              onClick={() => gameRef.current?.useFirePower()}
            >
              <span className="power-icon power-icon-fire" aria-hidden="true">
                <span className="fire-core" />
              </span>
            </button>
            <div className="power-cost">{fireCost} Coin</div>
          </div>

          <div className="power-slot">
            <button
              className={`power-btn power-btn-spectrum${
                uiState.spectrumButtonActive ? ' power-btn-spectrum-active' : ''
              }`}
              type="button"
              aria-label="Многоцветный многоугольник"
              title={spectrumHint}
              disabled={uiState.spectrumButtonDisabled}
              onClick={() => gameRef.current?.useSpectrumPower()}
            >
              <span className="power-icon power-icon-spectrum" aria-hidden="true" />
            </button>
            <div className="power-cost">{spectrumCost} Coin</div>
          </div>
        </div>
      </div>

      <div id="overlay" className={uiState.overlayVisible ? 'show' : ''}>
        <div
          id="overlay-card"
          className={`overlay-card${uiState.overlayCardWin ? ' win' : ''}`}
        >
          <h1 id="overlay-title" className={uiState.overlayTitleTone}>
            {uiState.overlayTitleText}
          </h1>
          <p id="overlay-message">{uiState.overlayMessageText}</p>
          {uiState.overlayCardWin ? (
            <div className="upgrade-shop">
              <div className="upgrade-shop-header">
                <span className="upgrade-shop-title">Магазин улучшений</span>
                <span className="upgrade-shop-balance">
                  {uiState.scoreCountText} Coin
                </span>
              </div>

              <div className="upgrade-shop-list">
                {winUpgradeCatalog.map(item => (
                  <button
                    key={item.id}
                    className="upgrade-shop-card"
                    type="button"
                    disabled={!item.canPurchase}
                    onClick={() => gameRef.current?.purchaseUpgrade(item.id)}
                  >
                    <div className="upgrade-shop-card-top">
                      <span className="upgrade-shop-card-title">{item.name}</span>
                      <span className="upgrade-shop-card-level">
                        LVL {item.level}/{item.maxLevel}
                      </span>
                    </div>
                    <div className="upgrade-shop-card-description">
                      {item.description}
                    </div>
                    <div className="upgrade-shop-card-bonus">
                      {item.currentBonusText}
                    </div>
                    <div className="upgrade-shop-card-cost">
                      {item.isMaxLevel
                        ? 'Максимальный уровень достигнут'
                        : `Следующее улучшение: ${item.nextCost} Coin`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="overlay-actions">
            <button
              id="overlay-primary-btn"
              className="action-btn"
              type="button"
              style={{ display: uiState.overlayPrimaryVisible ? 'inline-flex' : 'none' }}
              onClick={handlePrimaryOverlayAction}
            >
              {uiState.overlayPrimaryText}
            </button>
            {uiState.overlayTitleTone === 'pause' ? (
              <button
                className="action-btn secondary-btn"
                type="button"
                onClick={() => setSoundEnabled(current => !current)}
              >
                {soundToggleText}
              </button>
            ) : null}
            {uiState.overlayTitleTone === 'pause' &&
            uiState.overlayPrimaryAction === 'resume' ? (
              <button
                className="action-btn secondary-btn"
                type="button"
                onClick={handleReturnToMainMenu}
              >
                В главное меню
              </button>
            ) : null}
            <button
              id="overlay-secondary-btn"
              className="action-btn secondary-btn"
              type="button"
              style={{ display: uiState.overlaySecondaryVisible ? 'inline-flex' : 'none' }}
              onClick={() => gameRef.current?.restartCurrentLevel()}
            >
              {uiState.overlaySecondaryText}
            </button>
          </div>
        </div>
      </div>

      <div id="main-menu" className={hasStarted ? '' : 'show'}>
        <div className="menu-backdrop" />
        <div className="menu-card">
          <div className="menu-eyebrow">Gravity Smash</div>
          <h1>Выбери режим</h1>
          <div className="menu-copy">
            <p>
              Можно играть в быстрый аркадный режим, где нужно держать темп и
              успевать разбирать стакан, или выбрать новый спокойный пошаговый
              режим, где важнее тактика и планирование.
            </p>
            <p>
              В обоих режимах доступны способности, монеты и специальные фигуры,
              но ощущаются они по-разному: один режим про давление, второй про
              вдумчивые решения.
            </p>
            <p className="menu-note">
              Это тестовая версия игры. В будущем оба режима будут дорабатываться,
              и твое мнение о них для меня очень важно.
            </p>
          </div>

          <div className="menu-mode-grid">
            <button
              type="button"
              className="menu-mode-card"
              disabled={!progressReady}
              onClick={() => handleStartMode('arcade')}
            >
              <span className="menu-mode-title">Режим на скорость</span>
              <span className="menu-mode-text">
                Фигуры падают постоянно, сложность растет за счет темпа и частоты волн.
              </span>
            </button>

            <button
              type="button"
              className="menu-mode-card"
              disabled={!progressReady}
              aria-disabled={!progressReady}
              onClick={() => handleStartMode('turn-based')}
            >
              <span className="menu-mode-title">Пошаговый режим</span>
              <span className="menu-mode-text">
                После каждого действия падают новые фигуры, и можно спокойно думать над каждым ходом.
              </span>
            </button>
          </div>

          <div className="menu-actions">
            <button
              id="menu-shop-btn"
              className="action-btn secondary-btn"
              type="button"
              disabled={!progressReady}
              onClick={() => setIsMenuShopOpen(true)}
            >
              Магазин
            </button>
            <button
              id="menu-sound-btn"
              className="action-btn secondary-btn"
              type="button"
              onClick={() => {
                void audioRef.current?.resume();
                setSoundEnabled(current => !current);
              }}
            >
              {soundToggleText}
            </button>
          </div>
        </div>

        {isMenuShopOpen ? (
          <div className="menu-shop-modal" role="dialog" aria-modal="true">
            <div className="menu-shop-backdrop" onClick={() => setIsMenuShopOpen(false)} />
            <div className="menu-shop-panel">
              <div className="upgrade-shop">
                <div className="upgrade-shop-header">
                  <span className="upgrade-shop-title">Магазин улучшений</span>
                  <span className="upgrade-shop-balance">
                    {baseMenuProgress.economy.points} Coin
                  </span>
                </div>

                <div className="upgrade-shop-list">
                  {menuUpgradeCatalog.map(item => (
                    <button
                      key={item.id}
                      className="upgrade-shop-card"
                      type="button"
                      disabled={!item.canPurchase}
                      onClick={() => handleMenuUpgradePurchase(item.id)}
                    >
                      <div className="upgrade-shop-card-top">
                        <span className="upgrade-shop-card-title">{item.name}</span>
                        <span className="upgrade-shop-card-level">
                          LVL {item.level}/{item.maxLevel}
                        </span>
                      </div>
                      <div className="upgrade-shop-card-description">
                        {item.description}
                      </div>
                      <div className="upgrade-shop-card-bonus">
                        {item.currentBonusText}
                      </div>
                      <div className="upgrade-shop-card-cost">
                        {item.isMaxLevel
                          ? 'Максимальный уровень достигнут'
                          : `Следующее улучшение: ${item.nextCost} Coin`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="menu-shop-actions">
                <button
                  type="button"
                  className="action-btn secondary-btn"
                  onClick={() => setIsMenuShopOpen(false)}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {activeTutorial ? (
        <div id="tutorial-overlay" role="dialog" aria-modal="true">
          <div className="tutorial-card">
            <div className="tutorial-eyebrow">Подсказка</div>
            <h2>{activeTutorial.title}</h2>
            <p>{activeTutorial.message}</p>
            <button
              className="action-btn"
              type="button"
              onClick={handleTutorialContinue}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
