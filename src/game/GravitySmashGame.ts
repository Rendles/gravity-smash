import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  Query,
  Render,
  Runner
} from 'matter-js';
import {
  COLORS,
  GAME_CONFIG,
  INNER_MARKER_TYPES,
  INITIAL_LEVEL,
  SHAPES
} from './config';
import { getLevelSettings, rand } from './level';
import {
  drawArena,
  drawBlastWaves,
  drawGlowBody,
  drawParticles,
  handlePlasticCollisions,
  updateBodyDeformation
} from './rendering';
import {
  createInitialUiState,
  getDefaultBarInfo,
  getLevelCountText,
  getLevelDangerText,
  getLoseOverlayState,
  getPausedOverlayState,
  getProgressLabelText,
  getProgressCountText,
  getProgressSubText,
  getResumeCountdownOverlayState,
  getScoreCountText,
  getScoreSubText,
  getSelectedBarInfo,
  getWinOverlayState
} from './ui';
import { PlayerEconomy, UPGRADE_DEFINITIONS } from './economy';
import type {
  GameAudioEvent,
  Arena,
  BlastWave,
  EconomySnapshot,
  GameMode,
  GameControllerOptions,
  GamePieceBody,
  GameProgressSnapshot,
  GameUiState,
  LevelSettings,
  LevelGoalType,
  Particle,
  UpgradeId,
  WallBodies
} from './types';

type CollisionEventLike = {
  pairs: Array<{
    bodyA: GamePieceBody;
    bodyB: GamePieceBody;
    collision: {
      normal: {
        x: number;
        y: number;
      };
    };
  }>;
};

function areUiStatesEqual(a: GameUiState, b: GameUiState) {
  return (
    a.progressLabelText === b.progressLabelText &&
    a.progressCountText === b.progressCountText &&
    a.progressSubText === b.progressSubText &&
    a.levelCountText === b.levelCountText &&
    a.levelDangerText === b.levelDangerText &&
    a.scoreCountText === b.scoreCountText &&
    a.scoreSubText === b.scoreSubText &&
    a.freezeButtonDisabled === b.freezeButtonDisabled &&
    a.freezeButtonActive === b.freezeButtonActive &&
    a.fireButtonDisabled === b.fireButtonDisabled &&
    a.fireButtonActive === b.fireButtonActive &&
    a.spectrumButtonDisabled === b.spectrumButtonDisabled &&
    a.spectrumButtonActive === b.spectrumButtonActive &&
    a.barInfoText === b.barInfoText &&
    a.overlayVisible === b.overlayVisible &&
    a.overlayCardWin === b.overlayCardWin &&
    a.overlayTitleTone === b.overlayTitleTone &&
    a.overlayTitleText === b.overlayTitleText &&
    a.overlayMessageText === b.overlayMessageText &&
    a.overlayPrimaryVisible === b.overlayPrimaryVisible &&
    a.overlayPrimaryText === b.overlayPrimaryText &&
    a.overlayPrimaryAction === b.overlayPrimaryAction &&
    a.overlaySecondaryVisible === b.overlaySecondaryVisible &&
    a.overlaySecondaryText === b.overlaySecondaryText &&
    a.pauseButtonText === b.pauseButtonText &&
    a.pauseButtonDisabled === b.pauseButtonDisabled
  );
}

export class GravitySmashGame {
  private readonly root: HTMLElement;
  private readonly bottomBar: HTMLElement;
  private readonly onUiChange: (state: GameUiState) => void;
  private readonly onAudioEvent?: (event: GameAudioEvent) => void;
  private readonly onProgressChange?: (progress: GameProgressSnapshot) => void;
  private readonly mode: GameMode;

  private engine: Engine | null = null;
  private render: Render | null = null;
  private runner: Runner | null = null;
  private walls: WallBodies = {};
  private arena: Arena = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    wallThickness: 34,
    dangerLineY: 0,
    spawnY: 0
  };
  private spawnTimer: number | null = null;
  private nextSpawnDueAt: number | null = null;
  private pausedSpawnRemainingMs: number | null = null;
  private resumeCountdownTimer: number | null = null;
  private freezeSpawnRemainingMs: number | null = null;
  private freezeTimer: number | null = null;
  private freezeEndsAt: number | null = null;
  private freezeTurnsRemaining = 0;
  private fireTimer: number | null = null;
  private fireEndsAt: number | null = null;
  private spectrumTimer: number | null = null;
  private spectrumEndsAt: number | null = null;
  private particles: Particle[] = [];
  private blastWaves: BlastWave[] = [];
  private roundEnded = false;
  private isPaused = false;
  private isResumeCountdownActive = false;
  private currentLevel = INITIAL_LEVEL;
  private levelGoalType: LevelGoalType = 'all';
  private levelGoal = 0;
  private levelDestroyed = 0;
  private levelNormalDestroyed = 0;
  private levelSpecialDestroyed = 0;
  private currentDifficulty: LevelSettings | null = null;
  private selectedPiece: GamePieceBody | null = null;
  private turnBasedOverflowCheckAt: number | null = null;
  private turnBasedOverflowCheckConsumesTurn = false;
  private turnBasedOverflowWarningActive = false;
  private suppressTurnBasedMoveConsumption = false;
  private uiState = createInitialUiState();
  private readonly economy = new PlayerEconomy();
  private highestUnlockedLevel = INITIAL_LEVEL;
  private lastRoundOutcome: 'win' | 'lose' | null = null;

  private readonly resizeHandler = () => {
    this.resizeGame();
  };

  private readonly pointerDownHandler = (event: PointerEvent) => {
    event.preventDefault();
    this.handlePieceSelection(event.clientX, event.clientY);
  };

  private readonly afterUpdateHandler = () => {
    if (this.roundEnded || !this.engine) {
      return;
    }

    const delta = this.engine.timing.lastDelta || 16.666;
    this.updateParticles(delta);
    this.getPieces().forEach(body =>
      updateBodyDeformation(body, delta, GAME_CONFIG.physics.plasticDeformRecovery)
    );
    this.applyDifficultyState();

    if (this.isTurnBasedMode()) {
      if (!this.getPieces().length) {
        this.resolveTurnBasedStep({ consumeTurn: false });
        return;
      }

      const now = performance.now();
      if (this.turnBasedOverflowCheckAt !== null && now >= this.turnBasedOverflowCheckAt) {
        this.turnBasedOverflowCheckAt = null;
        this.checkTurnBasedOverflow();
      }
    } else {
      this.checkOverflow(performance.now());
    }
  };

  private readonly collisionStartHandler = (event: CollisionEventLike) => {
    handlePlasticCollisions(event.pairs, GAME_CONFIG.physics.plasticDeformMax);
  };

  private readonly afterRenderHandler = () => {
    if (!this.render) {
      return;
    }

    const ctx = this.render.context;
    drawArena(ctx, this.arena, {
      isFrozen: this.isFreezeActive(),
      fireHeatProgress: this.getFireHeatProgress()
    });
    this.getPieces().forEach(body => drawGlowBody(ctx, body));
    drawBlastWaves(ctx, this.blastWaves);
    drawParticles(ctx, this.particles);
  };

  constructor(options: GameControllerOptions) {
    this.root = options.root;
    this.bottomBar = options.bottomBar;
    this.onUiChange = options.onUiChange;
    this.onAudioEvent = options.onAudioEvent;
    this.onProgressChange = options.onProgressChange;
    this.mode = options.mode ?? 'arcade';
    this.highestUnlockedLevel = Math.max(
      INITIAL_LEVEL,
      options.initialProgress?.resumeLevel ?? INITIAL_LEVEL,
      options.initialProgress?.highestUnlockedLevel ?? INITIAL_LEVEL
    );
    this.economy.hydrate(options.initialProgress?.economy ?? null);
    window.addEventListener('resize', this.resizeHandler);
  }

  startLevel(level: number) {
    this.currentLevel = Math.max(1, level);
    this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, this.currentLevel);
    this.levelGoal = getLevelSettings(this.currentLevel, this.mode).goal;
    this.levelGoalType = getLevelSettings(this.currentLevel, this.mode).goalType;
    this.levelDestroyed = 0;
    this.levelNormalDestroyed = 0;
    this.levelSpecialDestroyed = 0;
    this.roundEnded = false;
    this.isPaused = false;
    this.isResumeCountdownActive = false;
    this.pausedSpawnRemainingMs = null;
    this.freezeSpawnRemainingMs = null;
    this.freezeEndsAt = null;
    this.freezeTurnsRemaining = 0;
    this.fireEndsAt = null;
    this.spectrumEndsAt = null;
    this.turnBasedOverflowCheckAt = null;
    this.suppressTurnBasedMoveConsumption = false;
    this.particles = [];
    this.blastWaves = [];
    this.currentDifficulty = null;
    this.selectedPiece = null;
    this.lastRoundOutcome = null;

    this.setUiState({
      overlayVisible: false,
      overlayPrimaryVisible: false,
      overlaySecondaryVisible: false,
      freezeButtonActive: false,
      fireButtonActive: false,
      spectrumButtonActive: false,
      pauseButtonDisabled: false
    });

    this.teardownGame();

    this.engine = Engine.create({
      gravity: { x: 0, y: GAME_CONFIG.physics.baseGravityY },
      positionIterations: 14,
      velocityIterations: 10,
      constraintIterations: 4
    });

    this.computeArena();

    this.render = Render.create({
      element: this.root,
      engine: this.engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: '#05070c',
        pixelRatio: window.devicePixelRatio || 1
      }
    });

    this.render.canvas.style.width = '100%';
    this.render.canvas.style.height = '100%';

    this.createWalls();
    this.attachWorldEvents();

    this.runner = Runner.create({
      delta: 1000 / 120
    });

    Render.run(this.render);
    Runner.run(this.runner, this.engine);

    this.render.canvas.addEventListener('pointerdown', this.pointerDownHandler, {
      passive: false
    });

    this.applyDifficultyState();
    this.updateHud();

    if (this.isTurnBasedMode()) {
      this.populateTurnBasedStart();
      this.ensureTurnBasedPlayableBoard();
      this.scheduleTurnBasedOverflowCheck(false);
    } else {
      this.scheduleSpawnAfterDelay(GAME_CONFIG.spawn.initialDelayMs);
    }

    this.emitProgressChange();
  }

  restartCurrentLevel() {
    this.startLevel(this.currentLevel);
  }

  pauseGame() {
    if (this.roundEnded || this.isPaused || this.isResumeCountdownActive) {
      return;
    }

    this.isPaused = true;
    this.pausedSpawnRemainingMs = this.captureRemainingSpawnDelay();

    if (this.runner) {
      Runner.stop(this.runner);
    }

    this.setUiState(getPausedOverlayState(this.mode));
  }

  useFreezePower() {
    if (this.roundEnded || this.isPaused || this.isResumeCountdownActive) {
      return false;
    }

    if (!this.economy.spendPoints(GAME_CONFIG.abilities.freezeCost)) {
      this.updateHud();
      return false;
    }

    this.startFreezeEffect(GAME_CONFIG.abilities.freezeDurationMs);
    this.onAudioEvent?.({ type: 'ability', ability: 'freeze' });
    this.emitProgressChange();
    this.updateHud();
    return true;
  }

  useFirePower() {
    if (this.roundEnded || this.isPaused || this.isResumeCountdownActive) {
      return false;
    }

    const burnableBodies = this.getBottomBodies();
    if (!burnableBodies.length) {
      this.updateHud();
      return false;
    }

    if (!this.economy.spendPoints(GAME_CONFIG.abilities.fireCost)) {
      this.updateHud();
      return false;
    }

    this.suppressTurnBasedMoveConsumption = this.isTurnBasedMode();
    try {
      this.burnBottomPieces(burnableBodies);
    } finally {
      this.suppressTurnBasedMoveConsumption = false;
    }

    this.startFireEffect(GAME_CONFIG.abilities.fireDurationMs);
    this.onAudioEvent?.({ type: 'ability', ability: 'fire' });
    this.emitProgressChange();
    this.updateHud();
    return true;
  }

  useSpectrumPower() {
    if (this.roundEnded || this.isPaused || this.isResumeCountdownActive) {
      return false;
    }

    const targetColorName = this.getRandomSpectrumTargetColor();
    if (!targetColorName) {
      this.updateHud();
      return false;
    }

    if (!this.economy.spendPoints(GAME_CONFIG.abilities.spectrumCost)) {
      this.updateHud();
      return false;
    }

    this.suppressTurnBasedMoveConsumption = this.isTurnBasedMode();
    let destroyed = false;

    try {
      destroyed = this.destroyRandomColorGroup(targetColorName);
    } finally {
      this.suppressTurnBasedMoveConsumption = false;
    }

    if (!destroyed) {
      this.updateHud();
      return false;
    }

    this.startSpectrumEffect(GAME_CONFIG.abilities.spectrumDurationMs);
    this.onAudioEvent?.({ type: 'ability', ability: 'spectrum' });
    this.emitProgressChange();
    this.updateHud();
    return true;
  }

  handlePrimaryOverlayAction() {
    if (this.uiState.overlayPrimaryAction === 'next') {
      this.startLevel(this.currentLevel + 1);
      return;
    }

    if (this.uiState.overlayPrimaryAction === 'resume') {
      this.startResumeCountdown();
      return;
    }

    this.restartCurrentLevel();
  }

  destroy() {
    window.removeEventListener('resize', this.resizeHandler);
    this.teardownGame();
  }

  getEconomySnapshot(): EconomySnapshot {
    return this.economy.getSnapshot();
  }

  getProgressSnapshot(): GameProgressSnapshot {
    const resumeLevel =
      this.lastRoundOutcome === 'win'
        ? Math.max(this.currentLevel + 1, this.highestUnlockedLevel)
        : this.currentLevel;
    const normalizedResumeLevel = Math.max(INITIAL_LEVEL, resumeLevel);

    return {
      resumeLevel: normalizedResumeLevel,
      highestUnlockedLevel: Math.max(this.highestUnlockedLevel, normalizedResumeLevel),
      economy: this.economy.getSnapshot()
    };
  }

  getUpgradeCatalog() {
    return UPGRADE_DEFINITIONS;
  }

  purchaseUpgrade(upgradeId: UpgradeId) {
    const purchased = this.economy.purchaseUpgrade(upgradeId);
    if (purchased) {
      this.emitProgressChange();
      this.updateHud();
    }

    return purchased;
  }

  private emitProgressChange() {
    this.onProgressChange?.(this.getProgressSnapshot());
  }

  private isTurnBasedMode() {
    return this.mode === 'turn-based';
  }

  private isSpecialGoalPiece(body: GamePieceBody) {
    return (
      !!body.isBomb ||
      !!body.isColorDestroyer ||
      (body.markerType ?? 'none') !== 'none'
    );
  }

  private isNormalGoalPiece(body: GamePieceBody) {
    return !body.isBomb && !body.isColorDestroyer;
  }

  private getDisplayedDestroyedCount() {
    switch (this.levelGoalType) {
      case 'normal':
        return this.levelNormalDestroyed;
      case 'special':
        return this.levelSpecialDestroyed;
      case 'all':
      default:
        return this.levelDestroyed;
    }
  }

  private isGoalReached() {
    return this.getDisplayedDestroyedCount() >= this.levelGoal;
  }

  private isFreezeActive() {
    if (this.isTurnBasedMode()) {
      return this.freezeTurnsRemaining > 0;
    }

    return this.freezeEndsAt !== null && this.freezeEndsAt > performance.now();
  }

  private isFireActive() {
    return this.fireEndsAt !== null && this.fireEndsAt > performance.now();
  }

  private isSpectrumActive() {
    return this.spectrumEndsAt !== null && this.spectrumEndsAt > performance.now();
  }

  private getFireHeatProgress() {
    if (!this.fireEndsAt) {
      return 0;
    }

    const remainingMs = Math.max(0, this.fireEndsAt - performance.now());
    return Math.min(1, remainingMs / GAME_CONFIG.abilities.fireDurationMs);
  }

  private startFreezeEffect(durationMs: number) {
    if (this.isTurnBasedMode()) {
      this.freezeTurnsRemaining += GAME_CONFIG.abilities.freezeTurnDuration;
      this.updateHud();
      return;
    }

    const remainingFreezeMs = this.freezeEndsAt
      ? Math.max(0, this.freezeEndsAt - performance.now())
      : 0;

    if (remainingFreezeMs <= 0) {
      this.freezeSpawnRemainingMs = this.captureRemainingSpawnDelay();
    }

    const totalFreezeMs = remainingFreezeMs + durationMs;
    this.freezeEndsAt = performance.now() + totalFreezeMs;
    this.clearFreezeTimer();

    this.freezeTimer = window.setTimeout(() => {
      this.finishFreezeEffect();
    }, totalFreezeMs);
  }

  private finishFreezeEffect() {
    if (this.isTurnBasedMode()) {
      this.freezeTurnsRemaining = 0;
      this.updateHud();
      return;
    }

    if (this.roundEnded) {
      return;
    }

    this.clearFreezeTimer();
    this.freezeEndsAt = null;

    const remainingDelay = this.freezeSpawnRemainingMs;
    this.freezeSpawnRemainingMs = null;

    if (remainingDelay !== null) {
      this.scheduleSpawnAfterDelay(remainingDelay);
    } else if (!this.isPaused && !this.isResumeCountdownActive) {
      this.scheduleSpawn();
    }

    this.updateHud();
  }

  private startFireEffect(durationMs: number) {
    const remainingFireMs = this.fireEndsAt
      ? Math.max(0, this.fireEndsAt - performance.now())
      : 0;
    const totalFireMs = Math.max(durationMs, remainingFireMs + durationMs * 0.45);

    this.fireEndsAt = performance.now() + totalFireMs;
    this.clearFireTimer();
    this.fireTimer = window.setTimeout(() => {
      this.finishFireEffect();
    }, totalFireMs);
  }

  private finishFireEffect() {
    this.clearFireTimer();
    this.fireEndsAt = null;
    this.updateHud();
  }

  private startSpectrumEffect(durationMs: number) {
    const remainingSpectrumMs = this.spectrumEndsAt
      ? Math.max(0, this.spectrumEndsAt - performance.now())
      : 0;
    const totalSpectrumMs = Math.max(
      durationMs,
      remainingSpectrumMs + durationMs * 0.35
    );

    this.spectrumEndsAt = performance.now() + totalSpectrumMs;
    this.clearSpectrumTimer();
    this.spectrumTimer = window.setTimeout(() => {
      this.finishSpectrumEffect();
    }, totalSpectrumMs);
  }

  private finishSpectrumEffect() {
    this.clearSpectrumTimer();
    this.spectrumEndsAt = null;
    this.updateHud();
  }

  private setUiState(patch: Partial<GameUiState>) {
    const nextState = { ...this.uiState, ...patch };

    if (areUiStatesEqual(this.uiState, nextState)) {
      return;
    }

    this.uiState = nextState;
    this.onUiChange(nextState);
  }

  private getWorld() {
    if (!this.engine) {
      throw new Error('Matter engine is not initialized.');
    }

    return this.engine.world;
  }

  private getPieces() {
    if (!this.engine) {
      return [] as GamePieceBody[];
    }

    return Composite.allBodies(this.getWorld()).filter(
      body => (body as GamePieceBody).isGamePiece
    ) as GamePieceBody[];
  }

  private computeArena() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const bottomInset = this.bottomBar.offsetHeight + 28;
    const topInset = 52;
    const playHeight = Math.max(360, height - topInset - bottomInset);
    const playWidth = Math.min(width * 0.8, playHeight * 0.58, 450);

    this.arena = {
      x: (width - playWidth) * 0.5,
      y: topInset,
      width: playWidth,
      height: playHeight,
      wallThickness: 34,
      dangerLineY: topInset + Math.max(72, playHeight * 0.22),
      spawnY: topInset - 76
    };
  }

  private createWalls() {
    const thickness = this.arena.wallThickness;

    const wallOptions = {
      isStatic: true,
      restitution: 0.02,
      friction: 0.34,
      frictionStatic: 1,
      slop: GAME_CONFIG.physics.contactSlop,
      render: { visible: false }
    };

    const floorOptions = {
      isStatic: true,
      restitution: 0.02,
      friction: 0.36,
      frictionStatic: 1.1,
      slop: GAME_CONFIG.physics.contactSlop,
      render: { visible: false }
    };

    const left = Bodies.rectangle(
      this.arena.x - thickness * 0.5,
      this.arena.y + this.arena.height * 0.5,
      thickness,
      this.arena.height + 260,
      wallOptions
    );

    const right = Bodies.rectangle(
      this.arena.x + this.arena.width + thickness * 0.5,
      this.arena.y + this.arena.height * 0.5,
      thickness,
      this.arena.height + 260,
      wallOptions
    );

    const floor = Bodies.rectangle(
      this.arena.x + this.arena.width * 0.5,
      this.arena.y + this.arena.height + thickness * 0.5,
      this.arena.width + thickness * 2,
      thickness,
      floorOptions
    );

    this.walls = { left, right, floor };
    Composite.add(this.getWorld(), [left, right, floor]);
  }

  private clampPiecesInsideArena() {
    const pad = 18;

    this.getPieces().forEach(body => {
      const radiusX = (body.bounds.max.x - body.bounds.min.x) * 0.5;
      const minX = this.arena.x + pad + radiusX;
      const maxX = this.arena.x + this.arena.width - pad - radiusX;
      const x = Math.min(Math.max(body.position.x, minX), maxX);

      Body.setPosition(body, { x, y: body.position.y });
    });
  }

  private resizeGame() {
    if (!this.render || !this.engine) {
      return;
    }

    this.computeArena();
    Render.setSize(this.render, window.innerWidth, window.innerHeight);
    this.render.canvas.style.width = '100%';
    this.render.canvas.style.height = '100%';

    if (this.walls.left) {
      Composite.remove(this.getWorld(), this.walls.left);
    }

    if (this.walls.right) {
      Composite.remove(this.getWorld(), this.walls.right);
    }

    if (this.walls.floor) {
      Composite.remove(this.getWorld(), this.walls.floor);
    }

    this.createWalls();
    this.clampPiecesInsideArena();
  }

  private updateHud() {
    const isInteractionPaused = this.isPaused || this.isResumeCountdownActive;
    const freezeActive = this.isFreezeActive();
    const fireActive = this.isFireActive();
    const spectrumActive = this.isSpectrumActive();
    const hasSpectrumTarget = this.getRandomSpectrumTargetColor() !== null;

    this.setUiState({
      progressLabelText: getProgressLabelText(this.mode, this.levelGoalType),
      progressCountText: getProgressCountText(
        this.getDisplayedDestroyedCount(),
        this.levelGoal
      ),
      progressSubText: getProgressSubText(
        this.getDisplayedDestroyedCount(),
        this.levelGoal
      ),
      levelCountText: getLevelCountText(this.currentLevel),
      levelDangerText: this.currentDifficulty
        ? getLevelDangerText(this.currentDifficulty)
        : this.uiState.levelDangerText,
      scoreCountText: getScoreCountText(this.economy.getSnapshot().points),
      scoreSubText: getScoreSubText(),
      freezeButtonDisabled:
        this.roundEnded ||
        isInteractionPaused ||
        !this.economy.canAfford(GAME_CONFIG.abilities.freezeCost),
      freezeButtonActive: freezeActive,
      fireButtonDisabled:
        this.roundEnded ||
        isInteractionPaused ||
        !this.economy.canAfford(GAME_CONFIG.abilities.fireCost),
      fireButtonActive: fireActive,
      spectrumButtonDisabled:
        this.roundEnded ||
        isInteractionPaused ||
        !hasSpectrumTarget ||
        !this.economy.canAfford(GAME_CONFIG.abilities.spectrumCost),
      spectrumButtonActive: spectrumActive,
      barInfoText:
        isInteractionPaused
          ? this.uiState.barInfoText
          : !this.roundEnded && this.selectedPiece && !this.selectedPiece.pendingDestroy
          ? getSelectedBarInfo(this.levelGoal)
          : !this.roundEnded
            ? getDefaultBarInfo(this.levelGoal)
            : this.uiState.barInfoText,
      pauseButtonText: 'Пауза',
      pauseButtonDisabled: this.roundEnded || isInteractionPaused
    });
  }

  private applyDifficultyState() {
    if (!this.engine) {
      return;
    }

    this.currentDifficulty = getLevelSettings(this.currentLevel, this.mode);
    this.engine.gravity.y = this.currentDifficulty.gravityY;
    this.engine.timing.timeScale = this.currentDifficulty.timeScale;
    this.updateHud();
  }

  private createPiece(position?: { x?: number; y?: number }) {
    const difficulty =
      this.currentDifficulty ?? getLevelSettings(this.currentLevel, this.mode);
    const hasActiveSpecialPiece = this.getPieces().some(
      piece =>
        !piece.pendingDestroy && (piece.isBomb || piece.isColorDestroyer)
    );
    const specialSpawnPenalty = hasActiveSpecialPiece
      ? GAME_CONFIG.specials.activeSpecialSpawnPenaltyMultiplier
      : 1;
    const adjustedColorDestroyerChance =
      difficulty.colorDestroyerChance * specialSpawnPenalty;
    const adjustedBombChance = difficulty.bombChance * specialSpawnPenalty;
    const specialRoll = Math.random();
    const isColorDestroyer = specialRoll < adjustedColorDestroyerChance;
    const isBomb =
      !isColorDestroyer &&
      specialRoll < adjustedColorDestroyerChance + adjustedBombChance;
    const shape = isColorDestroyer
      ? 'color-destroyer'
      : isBomb
        ? 'bomb'
        : SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = isColorDestroyer
      ? { name: 'spectrum', value: '#ffffff' }
      : isBomb
        ? { name: 'bomb', value: '#ffb347' }
        : COLORS[Math.floor(Math.random() * COLORS.length)];
    const markerType =
      !isBomb && !isColorDestroyer && Math.random() < difficulty.markedChance
        ? INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)]
        : 'none';
    const visualColorValue = markerType !== 'none' ? '#ffffff' : color.value;
    const sizeMode = Math.random() < difficulty.hugeChance ? 'huge' : 'small';
    const rootSize = rand(
      this.arena.width * GAME_CONFIG.sizes.rootMinFactor,
      this.arena.width * GAME_CONFIG.sizes.rootMaxFactor
    );
    const sizeMultiplier =
      sizeMode === 'huge'
        ? rand(
            GAME_CONFIG.sizes.hugeMultiplierMin,
            GAME_CONFIG.sizes.hugeMultiplierMax
          )
        : rand(
            GAME_CONFIG.sizes.smallMultiplierMin,
            GAME_CONFIG.sizes.smallMultiplierMax
          );
    const baseSize = rootSize * sizeMultiplier;

    const horizontalMargin = Math.max(26, baseSize * 0.95);
    const x =
      position?.x ??
      rand(
        this.arena.x + horizontalMargin,
        this.arena.x + this.arena.width - horizontalMargin
      );
    const y = position?.y ?? this.arena.spawnY;

    const options = {
      restitution: GAME_CONFIG.physics.restitution,
      friction: GAME_CONFIG.physics.friction,
      frictionStatic: 0.92,
      frictionAir: GAME_CONFIG.physics.frictionAir,
      slop: GAME_CONFIG.physics.contactSlop,
      density: 0.00175,
      render: {
        visible: false
      }
    };

    let piece: GamePieceBody;

    switch (shape) {
      case 'color-destroyer':
        piece = Bodies.polygon(x, y, 6, baseSize * 0.58, options) as GamePieceBody;
        Body.setAngle(piece, rand(-0.24, 0.24));
        break;
      case 'bomb':
        piece = Bodies.circle(x, y, baseSize * 0.48, options) as GamePieceBody;
        piece.isCircleShape = true;
        break;
      case 'circle':
        piece = Bodies.circle(x, y, baseSize * 0.5, options) as GamePieceBody;
        piece.isCircleShape = true;
        break;
      case 'square':
        piece = Bodies.rectangle(x, y, baseSize, baseSize, {
          ...options,
          chamfer: { radius: Math.max(4, baseSize * 0.14) }
        }) as GamePieceBody;
        Body.setAngle(piece, rand(-0.2, 0.2));
        break;
      case 'triangle':
        piece = Bodies.polygon(x, y, 3, baseSize * 0.64, options) as GamePieceBody;
        Body.setAngle(piece, rand(-0.45, 0.45));
        break;
      case 'pentagon':
        piece = Bodies.polygon(x, y, 5, baseSize * 0.6, options) as GamePieceBody;
        Body.setAngle(piece, rand(-0.3, 0.3));
        break;
      case 'hexagon':
        piece = Bodies.polygon(x, y, 6, baseSize * 0.6, options) as GamePieceBody;
        Body.setAngle(piece, rand(-0.3, 0.3));
        break;
      case 'bar':
      default:
        piece = Bodies.rectangle(x, y, baseSize * 1.55, baseSize * 0.76, {
          ...options,
          chamfer: { radius: Math.max(4, baseSize * 0.12) }
        }) as GamePieceBody;
        Body.setAngle(piece, rand(-0.7, 0.7));
        break;
    }

    piece.isGamePiece = true;
    piece.isBomb = isBomb;
    piece.isColorDestroyer = isColorDestroyer;
    piece.isHuge = sizeMode === 'huge';
    piece.colorName = color.name;
    piece.colorValue = visualColorValue;
    piece.markerType = markerType;
    piece.shapeType = shape;
    piece.overflowSince = null;
    piece.pendingDestroy = false;
    piece.isSelected = false;
    piece.deformAmount = 0;
    piece.deformAngle = 0;

    Composite.add(this.getWorld(), piece);
    return piece;
  }

  private populateTurnBasedStart() {
    if (!this.currentDifficulty) {
      return;
    }

    const columnFractions = [0.22, 0.4, 0.6, 0.78];
    const baseY = this.arena.y + this.arena.height - 78;

    for (let index = 0; index < this.currentDifficulty.initialPieces; index += 1) {
      const columnIndex = index % columnFractions.length;
      const rowIndex = Math.floor(index / columnFractions.length);
      const x =
        this.arena.x +
        this.arena.width * columnFractions[columnIndex] +
        rand(-12, 12);
      const y = baseY - rowIndex * 68 + rand(-10, 10);
      const piece = this.createPiece({ x, y });
      Body.setVelocity(piece, { x: rand(-0.12, 0.12), y: 0 });
      Body.setAngularVelocity(piece, rand(-0.02, 0.02));
    }
  }

  private getTurnBasedSpawnCount() {
    if (!this.currentDifficulty) {
      return 0;
    }

    const min = this.currentDifficulty.turnSpawnMin;
    const max = this.currentDifficulty.turnSpawnMax;
    return Math.max(min, Math.round(rand(min, max + 0.999)));
  }

  private spawnTurnBasedPieces(count: number) {
    for (let index = 0; index < count; index += 1) {
      this.createPiece();
    }
  }

  private scheduleTurnBasedOverflowCheck(consumesTurn: boolean) {
    this.turnBasedOverflowCheckAt =
      performance.now() + GAME_CONFIG.turnBased.overflowSettleMs;
    this.turnBasedOverflowCheckConsumesTurn = consumesTurn;
  }

  private resolveTurnBasedStep(options?: { consumeTurn?: boolean }) {
    if (!this.isTurnBasedMode() || this.roundEnded) {
      return;
    }

    const consumesTurn = options?.consumeTurn !== false;
    const freezeConsumesThisTurn = consumesTurn && this.freezeTurnsRemaining > 0;
    let spawnCount =
      consumesTurn && !freezeConsumesThisTurn ? this.getTurnBasedSpawnCount() : 0;

    if (!this.getPieces().length) {
      spawnCount += GAME_CONFIG.turnBased.emptyBoardRefillCount;
    }

    if (spawnCount > 0) {
      this.spawnTurnBasedPieces(spawnCount);
    }

    if (freezeConsumesThisTurn) {
      this.freezeTurnsRemaining = Math.max(0, this.freezeTurnsRemaining - 1);
    }

    this.ensureTurnBasedPlayableBoard();
    this.scheduleTurnBasedOverflowCheck(consumesTurn);
    this.updateHud();
  }

  private canPiecesResolveAsMove(a: GamePieceBody, b: GamePieceBody) {
    if (a === b || a.pendingDestroy || b.pendingDestroy) {
      return false;
    }

    if (a.isColorDestroyer || b.isColorDestroyer) {
      return true;
    }

    if (a.isBomb || b.isBomb) {
      return true;
    }

    const firstMarker = a.markerType ?? 'none';
    const secondMarker = b.markerType ?? 'none';

    if (firstMarker !== 'none' || secondMarker !== 'none') {
      return firstMarker !== 'none' && firstMarker === secondMarker;
    }

    return !!a.colorName && a.colorName === b.colorName;
  }

  private hasAvailableMoves() {
    const pieces = this.getPieces().filter(piece => !piece.pendingDestroy);

    for (let firstIndex = 0; firstIndex < pieces.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < pieces.length; secondIndex += 1) {
        if (this.canPiecesResolveAsMove(pieces[firstIndex], pieces[secondIndex])) {
          return true;
        }
      }
    }

    return false;
  }

  private applyRandomColorToPiece(piece: GamePieceBody) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.colorName = color.name;
    piece.colorValue = (piece.markerType ?? 'none') !== 'none' ? '#ffffff' : color.value;
  }

  private applyRandomMarkerToPiece(piece: GamePieceBody) {
    piece.markerType =
      INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)];
    piece.colorValue = '#ffffff';
  }

  private ensureTurnBasedPlayableBoard() {
    if (!this.isTurnBasedMode() || this.hasAvailableMoves()) {
      return;
    }

    const recolorCandidates = this.getPieces().filter(
      piece =>
        !piece.pendingDestroy &&
        !piece.isBomb &&
        !piece.isColorDestroyer &&
        (piece.markerType ?? 'none') === 'none'
    );
    const remarkCandidates = this.getPieces().filter(
      piece =>
        !piece.pendingDestroy &&
        !piece.isBomb &&
        !piece.isColorDestroyer &&
        (piece.markerType ?? 'none') !== 'none'
    );

    if (recolorCandidates.length >= 2 || remarkCandidates.length >= 2) {
      for (
        let attempt = 0;
        attempt < GAME_CONFIG.turnBased.reshuffleMaxAttempts && !this.hasAvailableMoves();
        attempt += 1
      ) {
        recolorCandidates.forEach(piece => {
          this.applyRandomColorToPiece(piece);
        });

        remarkCandidates.forEach(piece => {
          this.applyRandomMarkerToPiece(piece);
        });
      }

      if (!this.hasAvailableMoves() && recolorCandidates.length >= 2) {
        const forcedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        recolorCandidates[0].colorName = forcedColor.name;
        recolorCandidates[0].colorValue = forcedColor.value;
        recolorCandidates[1].colorName = forcedColor.name;
        recolorCandidates[1].colorValue = forcedColor.value;
      }

      if (!this.hasAvailableMoves() && remarkCandidates.length >= 2) {
        const forcedMarker =
          INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)];
        remarkCandidates[0].markerType = forcedMarker;
        remarkCandidates[0].colorValue = '#ffffff';
        remarkCandidates[1].markerType = forcedMarker;
        remarkCandidates[1].colorValue = '#ffffff';
      }
    }
  }

  private spawnWave() {
    if (
      this.isTurnBasedMode() ||
      this.roundEnded ||
      this.isPaused ||
      this.isResumeCountdownActive ||
      this.isFreezeActive() ||
      !this.currentDifficulty
    ) {
      return;
    }

    this.applyDifficultyState();

    let spawnCount = this.currentDifficulty.baseWavePieces;

    if (Math.random() < this.currentDifficulty.doubleSpawnChance) {
      spawnCount += 1;
    }

    if (Math.random() < this.currentDifficulty.tripleSpawnChance) {
      spawnCount += 1;
    }

    spawnCount = Math.min(spawnCount, GAME_CONFIG.spawn.maxWaveCount);

    for (let i = 0; i < spawnCount; i += 1) {
      this.createPiece();
    }
  }

  private scheduleSpawn() {
    if (
      this.isTurnBasedMode() ||
      this.roundEnded ||
      this.isPaused ||
      this.isResumeCountdownActive ||
      this.isFreezeActive() ||
      !this.currentDifficulty
    ) {
      return;
    }

    this.applyDifficultyState();

    const delay = rand(
      this.currentDifficulty.spawnMin,
      this.currentDifficulty.spawnMax
    );

    this.scheduleSpawnAfterDelay(delay);
  }

  private scheduleSpawnAfterDelay(delay: number) {
    if (this.isTurnBasedMode()) {
      return;
    }

    this.clearSpawnTimer();
    this.nextSpawnDueAt = performance.now() + delay;

    this.spawnTimer = window.setTimeout(() => {
      this.spawnTimer = null;
      this.nextSpawnDueAt = null;

      if (!this.roundEnded) {
        this.spawnWave();
        this.scheduleSpawn();
      }
    }, delay);
  }

  private spawnParticles(x: number, y: number, color: string) {
    for (let i = 0; i < GAME_CONFIG.particles.count; i += 1) {
      const angle =
        (Math.PI * 2 * i) / GAME_CONFIG.particles.count + rand(-0.18, 0.18);
      const speed = rand(1.8, 6.2);

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: GAME_CONFIG.particles.lifeMs,
        maxLife: GAME_CONFIG.particles.lifeMs,
        size: rand(2, 4.8),
        color
      });
    }
  }

  private createBlastWave(x: number, y: number) {
    this.blastWaves.push({
      x,
      y,
      radius: 10,
      life: 240,
      maxLife: 240
    });
  }

  private getCanvasPoint(clientX: number, clientY: number) {
    if (!this.render) {
      return { x: clientX, y: clientY };
    }

    const rect = this.render.canvas.getBoundingClientRect();
    const width = this.render.options.width ?? window.innerWidth;
    const height = this.render.options.height ?? window.innerHeight;

    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height
    };
  }

  private clearSelection() {
    if (this.selectedPiece && !this.selectedPiece.pendingDestroy) {
      this.selectedPiece.isSelected = false;
    }

    this.selectedPiece = null;
  }

  private selectPiece(body: GamePieceBody | null) {
    this.clearSelection();

    if (!body || body.pendingDestroy) {
      this.updateHud();
      return;
    }

    body.isSelected = true;
    this.selectedPiece = body;
    this.updateHud();
  }

  private getPieceAtPoint(point: { x: number; y: number }) {
    const hits = Query.point(this.getPieces(), point).filter(
      body =>
        (body as GamePieceBody).isGamePiece &&
        !(body as GamePieceBody).pendingDestroy
    ) as GamePieceBody[];

    return hits.length ? hits[hits.length - 1] : null;
  }

  private handlePieceSelection(clientX: number, clientY: number) {
    if (this.roundEnded || this.isPaused || this.isResumeCountdownActive || !this.render) {
      return;
    }

    const point = this.getCanvasPoint(clientX, clientY);
    const clickedPiece = this.getPieceAtPoint(point);

    if (!clickedPiece) {
      this.clearSelection();
      this.updateHud();
      return;
    }

    if (!this.selectedPiece || this.selectedPiece.pendingDestroy) {
      this.selectPiece(clickedPiece);
      return;
    }

    if (this.selectedPiece === clickedPiece) {
      this.clearSelection();
      this.updateHud();
      return;
    }

    if (this.selectedPiece.isColorDestroyer && clickedPiece.isColorDestroyer) {
      this.clearSelection();
      this.destroyAllPieces({
        x: (this.selectedPiece.position.x + clickedPiece.position.x) * 0.5,
        y: (this.selectedPiece.position.y + clickedPiece.position.y) * 0.5
      });
      return;
    }

    if (
      (this.selectedPiece.isColorDestroyer && clickedPiece.isBomb) ||
      (this.selectedPiece.isBomb && clickedPiece.isColorDestroyer)
    ) {
      const destroyerPiece = this.selectedPiece.isColorDestroyer
        ? this.selectedPiece
        : clickedPiece;
      const bombPiece = destroyerPiece === this.selectedPiece ? clickedPiece : this.selectedPiece;
      this.clearSelection();
      this.detonateDestroyerBombCombo(destroyerPiece, bombPiece);
      return;
    }

    if (this.selectedPiece.isColorDestroyer || clickedPiece.isColorDestroyer) {
      const destroyerPiece = this.selectedPiece.isColorDestroyer
        ? this.selectedPiece
        : clickedPiece;
      const targetPiece =
        destroyerPiece === this.selectedPiece ? clickedPiece : this.selectedPiece;
      this.clearSelection();
      this.destroyColorGroup(destroyerPiece, targetPiece);
      return;
    }

    if (this.selectedPiece.isBomb || clickedPiece.isBomb) {
      const bombPiece = this.selectedPiece.isBomb ? this.selectedPiece : clickedPiece;
      const triggerPiece = bombPiece === this.selectedPiece ? clickedPiece : this.selectedPiece;
      this.clearSelection();
      this.detonateBomb(bombPiece, triggerPiece);
      return;
    }

    const selectedMarkerType = this.selectedPiece.markerType ?? 'none';
    const clickedMarkerType = clickedPiece.markerType ?? 'none';
    const isMarkedMatch =
      selectedMarkerType !== 'none' &&
      selectedMarkerType === clickedMarkerType;
    const isPlainColorMatch =
      selectedMarkerType === 'none' &&
      clickedMarkerType === 'none' &&
      this.selectedPiece.colorName === clickedPiece.colorName;

    if (isMarkedMatch || isPlainColorMatch) {
      const firstPiece = this.selectedPiece;
      this.clearSelection();
      this.destroyPieces(firstPiece, clickedPiece, {
        includeTouchingSameColor: isPlainColorMatch,
        includeTouchingSameMarker: isMarkedMatch
      });
      return;
    }

    this.selectPiece(clickedPiece);
  }

  private completeLevel() {
    if (this.roundEnded) {
      return;
    }

    if (this.levelGoalType === 'normal') {
      this.levelNormalDestroyed = this.levelGoal;
    } else if (this.levelGoalType === 'special') {
      this.levelSpecialDestroyed = this.levelGoal;
    } else {
      this.levelDestroyed = this.levelGoal;
    }

    this.updateHud();
    this.endRound('win');
  }

  private isChainMatchCandidate(piece: GamePieceBody, targetColorName: string) {
    return (
      !piece.pendingDestroy &&
      !piece.isBomb &&
      !piece.isColorDestroyer &&
      (piece.markerType ?? 'none') === 'none' &&
      piece.colorName === targetColorName
    );
  }

  private isMarkerChainMatchCandidate(piece: GamePieceBody, targetMarkerType: string) {
    return (
      !piece.pendingDestroy &&
      !piece.isBomb &&
      !piece.isColorDestroyer &&
      (piece.markerType ?? 'none') === targetMarkerType
    );
  }

  private collectTouchingColorCluster(seedBodies: GamePieceBody[]) {
    const targetColorName = seedBodies[0]?.colorName;
    if (!targetColorName) {
      return seedBodies;
    }

    const candidates = this.getPieces().filter(piece =>
      this.isChainMatchCandidate(piece, targetColorName)
    );
    const cluster = new Set<GamePieceBody>();
    const queue = seedBodies.filter(piece =>
      this.isChainMatchCandidate(piece, targetColorName)
    );

    queue.forEach(piece => {
      cluster.add(piece);
    });

    for (let index = 0; index < queue.length; index += 1) {
      const currentPiece = queue[index];
      const touchingPieces = Query.collides(currentPiece, candidates)
        .map(result =>
          result.bodyA === currentPiece
            ? (result.bodyB as GamePieceBody)
            : (result.bodyA as GamePieceBody)
        )
        .filter(piece => this.isChainMatchCandidate(piece, targetColorName));

      touchingPieces.forEach(piece => {
        if (cluster.has(piece)) {
          return;
        }

        cluster.add(piece);
        queue.push(piece);
      });
    }

    return Array.from(cluster);
  }

  private collectTouchingMarkerCluster(seedBodies: GamePieceBody[]) {
    const targetMarkerType = seedBodies[0]?.markerType ?? 'none';
    if (targetMarkerType === 'none') {
      return seedBodies;
    }

    const candidates = this.getPieces().filter(piece =>
      this.isMarkerChainMatchCandidate(piece, targetMarkerType)
    );
    const cluster = new Set<GamePieceBody>();
    const queue = seedBodies.filter(piece =>
      this.isMarkerChainMatchCandidate(piece, targetMarkerType)
    );

    queue.forEach(piece => {
      cluster.add(piece);
    });

    for (let index = 0; index < queue.length; index += 1) {
      const currentPiece = queue[index];
      const touchingPieces = Query.collides(currentPiece, candidates)
        .map(result =>
          result.bodyA === currentPiece
            ? (result.bodyB as GamePieceBody)
            : (result.bodyA as GamePieceBody)
        )
        .filter(piece => this.isMarkerChainMatchCandidate(piece, targetMarkerType));

      touchingPieces.forEach(piece => {
        if (cluster.has(piece)) {
          return;
        }

        cluster.add(piece);
        queue.push(piece);
      });
    }

    return Array.from(cluster);
  }

  private destroyPieces(
    a: GamePieceBody,
    b: GamePieceBody,
    options?: {
      includeTouchingSameColor?: boolean;
      includeTouchingSameMarker?: boolean;
    }
  ) {
    if (options?.includeTouchingSameColor) {
      this.destroyBodies(this.collectTouchingColorCluster([a, b]));
      return;
    }

    if (options?.includeTouchingSameMarker) {
      this.destroyBodies(this.collectTouchingMarkerCluster([a, b]));
      return;
    }

    this.destroyBodies([a, b]);
  }

  private detonateBomb(bomb: GamePieceBody, triggerPiece: GamePieceBody) {
    if (bomb.pendingDestroy || triggerPiece.pendingDestroy || this.roundEnded) {
      return;
    }

    const bombRadius = Math.max(
      GAME_CONFIG.bombs.minBlastRadius,
      (bomb.bounds.max.x - bomb.bounds.min.x) * GAME_CONFIG.bombs.blastRadiusFactor
    );

    const blastTargets = new Set<GamePieceBody>([bomb, triggerPiece]);

    this.getPieces().forEach(piece => {
      if (piece.pendingDestroy || piece === bomb || piece === triggerPiece) {
        return;
      }

      const dx = piece.position.x - bomb.position.x;
      const dy = piece.position.y - bomb.position.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= bombRadius) {
        blastTargets.add(piece);
      }
    });

    this.destroyBodies(Array.from(blastTargets), {
      x: bomb.position.x,
      y: bomb.position.y
    });
  }

  private detonateDestroyerBombCombo(
    destroyer: GamePieceBody,
    bomb: GamePieceBody
  ) {
    if (destroyer.pendingDestroy || bomb.pendingDestroy || this.roundEnded) {
      return;
    }

    const comboCenter = {
      x: (destroyer.position.x + bomb.position.x) * 0.5,
      y: (destroyer.position.y + bomb.position.y) * 0.5
    };

    const comboRadius = Math.max(
      GAME_CONFIG.combos.bombDestroyerMinBlastRadius,
      Math.max(this.arena.width, this.arena.height) *
        GAME_CONFIG.combos.bombDestroyerBlastRadiusFactor
    );

    const comboTargets = this.getPieces().filter(piece => {
      if (piece.pendingDestroy) {
        return false;
      }

      const dx = piece.position.x - comboCenter.x;
      const dy = piece.position.y - comboCenter.y;
      return Math.hypot(dx, dy) <= comboRadius;
    });

    this.destroyBodies(comboTargets, comboCenter);
  }

  private destroyColorGroup(destroyer: GamePieceBody, targetPiece: GamePieceBody) {
    if (
      destroyer.pendingDestroy ||
      targetPiece.pendingDestroy ||
      this.roundEnded
    ) {
      return;
    }

    const targetColorName = targetPiece.colorName;
    const targetBodies = this.getPieces().filter(
      piece => !piece.pendingDestroy && piece.colorName === targetColorName
    );

    this.destroyBodies([destroyer, ...targetBodies], {
      x: destroyer.position.x,
      y: destroyer.position.y
    });
  }

  private destroyAllPieces(effectCenter?: { x: number; y: number }) {
    this.destroyBodies(this.getPieces(), effectCenter);
  }

  private getRandomSpectrumTargetColor() {
    const availableColors = Array.from(
      new Set(
        this.getPieces()
          .filter(
            piece =>
              !piece.pendingDestroy &&
              !piece.isBomb &&
              !piece.isColorDestroyer &&
              !!piece.colorName
          )
          .map(piece => piece.colorName as string)
      )
    );

    if (!availableColors.length) {
      return null;
    }

    return availableColors[Math.floor(Math.random() * availableColors.length)];
  }

  private destroyRandomColorGroup(targetColorName: string) {
    const targetBodies = this.getPieces().filter(
      piece =>
        !piece.pendingDestroy &&
        !piece.isBomb &&
        !piece.isColorDestroyer &&
        piece.colorName === targetColorName
    );

    if (!targetBodies.length) {
      return false;
    }

    const effectCenter = {
      x:
        targetBodies.reduce((sum, body) => sum + body.position.x, 0) /
        targetBodies.length,
      y:
        targetBodies.reduce((sum, body) => sum + body.position.y, 0) /
        targetBodies.length
    };

    this.spawnParticles(effectCenter.x, effectCenter.y, '#ffffff');
    this.destroyBodies(targetBodies, effectCenter);
    return true;
  }

  private getBottomBodies() {
    const floorY = this.arena.y + this.arena.height;
    const burnThreshold = 8;
    return this.getPieces().filter(
      body => !body.pendingDestroy && body.bounds.max.y >= floorY - burnThreshold
    );
  }

  private burnBottomPieces(bottomBodies = this.getBottomBodies()) {
    const floorY = this.arena.y + this.arena.height;
    const center = {
      x: this.arena.x + this.arena.width * 0.5,
      y: floorY - 6
    };

    if (!bottomBodies.length) {
      this.spawnParticles(center.x, center.y, '#ff8d2b');
      this.createBlastWave(center.x, center.y);
      return 0;
    }

    const burnCenter = {
      x:
        bottomBodies.reduce((sum, body) => sum + body.position.x, 0) /
        bottomBodies.length,
      y: floorY - 6
    };

    this.spawnParticles(burnCenter.x, burnCenter.y, '#ff8d2b');
    this.destroyBodies(bottomBodies, burnCenter);
    return bottomBodies.length;
  }

  private destroyBodies(
    bodies: GamePieceBody[],
    effectCenter?: { x: number; y: number }
  ) {
    const uniqueBodies = bodies.filter(
      (body, index, list) =>
        !body.pendingDestroy &&
        list.indexOf(body) === index
    );

    if (!uniqueBodies.length || this.roundEnded) {
      return;
    }

    if (this.selectedPiece && uniqueBodies.includes(this.selectedPiece)) {
      this.clearSelection();
    }

    uniqueBodies.forEach(body => {
      body.pendingDestroy = true;
      body.isSelected = false;
      this.spawnParticles(body.position.x, body.position.y, body.colorValue ?? '#ffffff');
      Composite.remove(this.getWorld(), body);
    });

    this.economy.awardForDestroyedBodies(uniqueBodies);
    const normalDestroyed = uniqueBodies.filter(body => this.isNormalGoalPiece(body)).length;
    const specialDestroyed = uniqueBodies.filter(body => this.isSpecialGoalPiece(body)).length;

    const center = effectCenter ?? {
      x:
        uniqueBodies.reduce((sum, body) => sum + body.position.x, 0) /
        uniqueBodies.length,
      y:
        uniqueBodies.reduce((sum, body) => sum + body.position.y, 0) /
        uniqueBodies.length
    };

    this.spawnParticles(center.x, center.y, '#ffffff');
    this.createBlastWave(center.x, center.y);

    this.levelDestroyed += uniqueBodies.length;
    this.levelNormalDestroyed += normalDestroyed;
    this.levelSpecialDestroyed += specialDestroyed;
    this.onAudioEvent?.({ type: 'destroy', count: uniqueBodies.length });
    this.emitProgressChange();
    this.updateHud();

    if (this.isGoalReached()) {
      this.completeLevel();
      return;
    }

    if (this.isTurnBasedMode()) {
      this.resolveTurnBasedStep({
        consumeTurn: !this.suppressTurnBasedMoveConsumption
      });
    }
  }

  private checkOverflow(now: number) {
    for (const body of this.getPieces()) {
      const touchingDangerLine =
        body.bounds.min.y <= this.arena.dangerLineY &&
        body.bounds.max.y >= this.arena.dangerLineY;

      if (touchingDangerLine) {
        if (body.overflowSince === null || body.overflowSince === undefined) {
          body.overflowSince = now;
        }

        if (now - body.overflowSince >= GAME_CONFIG.round.overflowMs) {
          this.endRound('lose');
          return;
        }
      } else {
        body.overflowSince = null;
      }
    }
  }

  private checkTurnBasedOverflow() {
    const hasOverflowingPiece = this.getPieces().some(
      body => body.bounds.min.y <= this.arena.dangerLineY
    );

    if (!hasOverflowingPiece) {
      this.turnBasedOverflowWarningActive = false;
      return;
    }

    if (!this.turnBasedOverflowWarningActive) {
      this.turnBasedOverflowWarningActive = true;
      return;
    }

    if (this.turnBasedOverflowCheckConsumesTurn) {
      this.endRound('lose');
    }
  }

  private updateParticles(delta: number) {
    this.particles = this.particles.filter(particle => {
      particle.life -= delta;
      particle.x += particle.vx * (delta / 16.666);
      particle.y += particle.vy * (delta / 16.666);
      particle.vx *= 0.985;
      particle.vy *= 0.985;
      return particle.life > 0;
    });

    this.blastWaves = this.blastWaves.filter(wave => {
      wave.life -= delta;
      wave.radius += 12 * (delta / 16.666);
      return wave.life > 0;
    });
  }

  private showOverlay(mode: 'win' | 'lose') {
    if (mode === 'win') {
      this.setUiState(
        getWinOverlayState(
          this.currentLevel,
          this.levelGoal,
          this.mode,
          this.levelGoalType
        )
      );
      return;
    }

    this.setUiState(
      getLoseOverlayState(
        this.currentLevel,
        this.levelGoal,
        this.mode,
        this.levelGoalType
      )
    );
  }

  private endRound(mode: 'win' | 'lose') {
    if (this.roundEnded) {
      return;
    }

    this.roundEnded = true;
    this.isPaused = false;
    this.isResumeCountdownActive = false;
    this.freezeSpawnRemainingMs = null;
    this.freezeEndsAt = null;
    this.freezeTurnsRemaining = 0;
    this.fireEndsAt = null;
    this.spectrumEndsAt = null;
    this.turnBasedOverflowCheckAt = null;
    this.clearSpawnTimer();
    this.clearResumeCountdownTimer();
    this.clearFreezeTimer();
    this.clearFireTimer();
    this.clearSpectrumTimer();
    this.lastRoundOutcome = mode;

    if (mode === 'win') {
      this.highestUnlockedLevel = Math.max(this.highestUnlockedLevel, this.currentLevel + 1);
    }

    if (this.runner) {
      Runner.stop(this.runner);
    }

    this.onAudioEvent?.({ type: 'round', result: mode });
    this.emitProgressChange();
    this.showOverlay(mode);
    this.updateHud();
  }

  private attachWorldEvents() {
    if (!this.engine || !this.render) {
      return;
    }

    Events.on(this.engine, 'afterUpdate', this.afterUpdateHandler);
    Events.on(this.engine, 'collisionStart', this.collisionStartHandler);
    Events.on(this.render, 'afterRender', this.afterRenderHandler);
  }

  private detachWorldEvents() {
    if (this.engine) {
      Events.off(this.engine, 'afterUpdate', this.afterUpdateHandler);
      Events.off(this.engine, 'collisionStart', this.collisionStartHandler);
    }

    if (this.render) {
      Events.off(this.render, 'afterRender', this.afterRenderHandler);
    }
  }

  private clearSpawnTimer() {
    if (this.spawnTimer !== null) {
      window.clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }

    this.nextSpawnDueAt = null;
  }

  private captureRemainingSpawnDelay() {
    if (this.spawnTimer === null) {
      return null;
    }

    const remaining = this.nextSpawnDueAt
      ? Math.max(0, this.nextSpawnDueAt - performance.now())
      : 0;

    this.clearSpawnTimer();
    return remaining;
  }

  private clearResumeCountdownTimer() {
    if (this.resumeCountdownTimer !== null) {
      window.clearTimeout(this.resumeCountdownTimer);
      this.resumeCountdownTimer = null;
    }
  }

  private clearFreezeTimer() {
    if (this.freezeTimer !== null) {
      window.clearTimeout(this.freezeTimer);
      this.freezeTimer = null;
    }
  }

  private clearFireTimer() {
    if (this.fireTimer !== null) {
      window.clearTimeout(this.fireTimer);
      this.fireTimer = null;
    }
  }

  private clearSpectrumTimer() {
    if (this.spectrumTimer !== null) {
      window.clearTimeout(this.spectrumTimer);
      this.spectrumTimer = null;
    }
  }

  private startResumeCountdown(secondsLeft = 3) {
    if (this.roundEnded || (!this.isPaused && !this.isResumeCountdownActive)) {
      return;
    }

    this.isPaused = false;
    this.isResumeCountdownActive = true;
    this.clearResumeCountdownTimer();
    this.setUiState(getResumeCountdownOverlayState(secondsLeft, this.mode));

    if (secondsLeft <= 1) {
      this.resumeCountdownTimer = window.setTimeout(() => {
        this.finishResumeCountdown();
      }, 1000);

      return;
    }

    this.resumeCountdownTimer = window.setTimeout(() => {
      this.startResumeCountdown(secondsLeft - 1);
    }, 1000);
  }

  private finishResumeCountdown() {
    if (this.roundEnded) {
      return;
    }

    this.clearResumeCountdownTimer();
    this.isResumeCountdownActive = false;
    this.setUiState({
      overlayVisible: false,
      overlayPrimaryVisible: true,
      overlayPrimaryText: 'Перезапустить уровень',
      overlayPrimaryAction: 'retry',
      overlaySecondaryVisible: true,
      overlaySecondaryText: 'Переиграть уровень',
      pauseButtonText: 'Пауза',
      pauseButtonDisabled: false
    });

    if (this.runner && this.engine) {
      Runner.run(this.runner, this.engine);
    }

    const remainingDelay = this.pausedSpawnRemainingMs;
    this.pausedSpawnRemainingMs = null;

    if (remainingDelay !== null) {
      this.scheduleSpawnAfterDelay(remainingDelay);
    }

    this.applyDifficultyState();
    this.updateHud();
  }

  private teardownGame() {
    this.clearSpawnTimer();
    this.clearResumeCountdownTimer();
    this.clearFreezeTimer();
    this.clearFireTimer();
    this.clearSpectrumTimer();
    this.detachWorldEvents();

    if (this.render) {
      this.render.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
      Render.stop(this.render);
      this.render.canvas.remove();
      this.render.textures = {};
      this.render = null;
    }

    if (this.runner) {
      Runner.stop(this.runner);
      this.runner = null;
    }

    this.engine = null;
    this.walls = {};
    this.freezeSpawnRemainingMs = null;
    this.freezeEndsAt = null;
    this.freezeTurnsRemaining = 0;
    this.fireEndsAt = null;
    this.spectrumEndsAt = null;
    this.turnBasedOverflowCheckAt = null;
    this.turnBasedOverflowCheckConsumesTurn = false;
    this.turnBasedOverflowWarningActive = false;
    this.suppressTurnBasedMoveConsumption = false;
  }
}
