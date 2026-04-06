import type { Body } from 'matter-js';

export interface ColorDefinition {
  name: string;
  value: string;
}

export type ShapeType =
  | 'bomb'
  | 'color-destroyer'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'bar';

export type MarkerType =
  | 'none'
  | 'cross'
  | 'letter-m'
  | 'letter-a'
  | 'letter-t';

export type GameMode = 'arcade' | 'turn-based';
export type LevelGoalType = 'all' | 'normal' | 'special';

export interface Arena {
  x: number;
  y: number;
  width: number;
  height: number;
  wallThickness: number;
  dangerLineY: number;
  spawnY: number;
}

export interface LevelSettings {
  mode: GameMode;
  level: number;
  goal: number;
  goalType: LevelGoalType;
  gravityY: number;
  timeScale: number;
  spawnMin: number;
  spawnMax: number;
  bombChance: number;
  colorDestroyerChance: number;
  hugeChance: number;
  markedChance: number;
  doubleSpawnChance: number;
  tripleSpawnChance: number;
  guaranteedExtraSpawns: number;
  baseWavePieces: number;
  speedMultiplier: number;
  initialPieces: number;
  turnSpawnMin: number;
  turnSpawnMax: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface BlastWave {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export type OverlayTitleTone = 'win' | 'lose' | 'pause';
export type OverlayPrimaryAction = 'next' | 'retry' | 'resume';
export type AbilityAudioCue = 'freeze' | 'fire' | 'spectrum';
export type GameAudioEvent =
  | { type: 'destroy'; count: number }
  | { type: 'ability'; ability: AbilityAudioCue }
  | { type: 'round'; result: 'win' | 'lose' };
export type UpgradeId =
  | 'blast-radius'
  | 'color-destroyer-efficiency'
  | 'special-figure-frequency';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
}

export interface EconomySnapshot {
  points: number;
  purchasedUpgrades: UpgradeId[];
}

export interface GameUiState {
  progressLabelText: string;
  progressCountText: string;
  progressSubText: string;
  levelCountText: string;
  levelDangerText: string;
  scoreCountText: string;
  scoreSubText: string;
  freezeButtonDisabled: boolean;
  freezeButtonActive: boolean;
  fireButtonDisabled: boolean;
  fireButtonActive: boolean;
  spectrumButtonDisabled: boolean;
  spectrumButtonActive: boolean;
  barInfoText: string;
  overlayVisible: boolean;
  overlayCardWin: boolean;
  overlayTitleTone: OverlayTitleTone;
  overlayTitleText: string;
  overlayMessageText: string;
  overlayPrimaryVisible: boolean;
  overlayPrimaryText: string;
  overlayPrimaryAction: OverlayPrimaryAction;
  overlaySecondaryVisible: boolean;
  overlaySecondaryText: string;
  pauseButtonText: string;
  pauseButtonDisabled: boolean;
}

export interface GameControllerOptions {
  root: HTMLElement;
  bottomBar: HTMLElement;
  onUiChange: (state: GameUiState) => void;
  onAudioEvent?: (event: GameAudioEvent) => void;
  mode?: GameMode;
}

export interface GamePieceBody extends Body {
  isGamePiece?: boolean;
  isBomb?: boolean;
  isColorDestroyer?: boolean;
  isCircleShape?: boolean;
  isHuge?: boolean;
  colorName?: string;
  colorValue?: string;
  markerType?: MarkerType;
  shapeType?: ShapeType;
  overflowSince?: number | null;
  pendingDestroy?: boolean;
  isSelected?: boolean;
  deformAmount?: number;
  deformAngle?: number;
}

export interface WallBodies {
  left?: Body;
  right?: Body;
  floor?: Body;
}
