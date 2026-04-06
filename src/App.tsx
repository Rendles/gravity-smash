import { useEffect, useRef, useState } from 'react';
import { GameAudio } from './audio/GameAudio';
import { GravitySmashGame } from './game/GravitySmashGame';
import { GAME_CONFIG } from './game/config';
import type { GameMode, GameProgressSnapshot } from './game/types';
import { createInitialUiState } from './game/ui';
import { loadProgress, saveProgress } from './storage/progressStore';

const SOUND_STORAGE_KEY = 'gravity-smash-sound-enabled';

function getInitialSoundEnabled() {
  try {
    const storedValue = window.localStorage.getItem(SOUND_STORAGE_KEY);
    return storedValue === null ? true : storedValue === 'true';
  } catch {
    return true;
  }
}

export default function App() {
  const gameRootRef = useRef<HTMLDivElement | null>(null);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<GravitySmashGame | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const pendingProgressSaveRef = useRef<GameProgressSnapshot | null>(null);
  const progressSaveTimerRef = useRef<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('arcade');
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [uiState, setUiState] = useState(createInitialUiState);
  const [savedProgress, setSavedProgress] = useState<GameProgressSnapshot | null>(null);
  const [progressReady, setProgressReady] = useState(false);

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
              disabled={uiState.freezeButtonDisabled}
              onClick={() => gameRef.current?.useFreezePower()}
            >
              <span className="power-icon power-icon-snow" aria-hidden="true">
                ❄
              </span>
            </button>
            <div className="power-cost">{GAME_CONFIG.abilities.freezeCost} Coin</div>
          </div>

          <div className="power-slot">
            <button
              className={`power-btn${uiState.fireButtonActive ? ' power-btn-fire-active' : ''}`}
              type="button"
              aria-label="Огонь"
              disabled={uiState.fireButtonDisabled}
              onClick={() => gameRef.current?.useFirePower()}
            >
              <span className="power-icon power-icon-fire" aria-hidden="true">
                <span className="fire-core" />
              </span>
            </button>
            <div className="power-cost">{GAME_CONFIG.abilities.fireCost} Coin</div>
          </div>

          <div className="power-slot">
            <button
              className={`power-btn power-btn-spectrum${
                uiState.spectrumButtonActive ? ' power-btn-spectrum-active' : ''
              }`}
              type="button"
              aria-label="Многоцветный многоугольник"
              disabled={uiState.spectrumButtonDisabled}
              onClick={() => gameRef.current?.useSpectrumPower()}
            >
              <span className="power-icon power-icon-spectrum" aria-hidden="true" />
            </button>
            <div className="power-cost">{GAME_CONFIG.abilities.spectrumCost} Coin</div>
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
          <div className="overlay-actions">
            <button
              id="overlay-primary-btn"
              className="action-btn"
              type="button"
              style={{ display: uiState.overlayPrimaryVisible ? 'inline-flex' : 'none' }}
              onClick={() => gameRef.current?.handlePrimaryOverlayAction()}
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
              onClick={() => {
                void audioRef.current?.resume();
                setSelectedMode('arcade');
                setHasStarted(true);
              }}
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
              onClick={() => {
                void audioRef.current?.resume();
                setSelectedMode('turn-based');
                setHasStarted(true);
              }}
            >
              <span className="menu-mode-title">Пошаговый режим</span>
              <span className="menu-mode-text">
                После каждого действия падают новые фигуры, и можно спокойно думать над каждым ходом.
              </span>
            </button>
          </div>

          <div className="menu-actions">
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
      </div>
    </div>
  );
}
