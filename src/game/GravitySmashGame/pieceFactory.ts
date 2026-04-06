import { Bodies, Body, Composite, type Composite as MatterComposite } from 'matter-js';
import {
  COLORS,
  GAME_CONFIG,
  INNER_MARKER_TYPES,
  SHAPES
} from '../config';
import { rand } from '../level';
import type { Arena, GamePieceBody, LevelSettings } from '../types';

interface CreatePieceOptions {
  world: MatterComposite;
  arena: Arena;
  difficulty: LevelSettings;
  hasActiveSpecialPiece: boolean;
  forcedKind?: 'auto' | 'normal' | 'marker' | 'bomb' | 'color-destroyer';
  spawnAssist?: {
    hugeChanceMultiplier: number;
    bombChanceMultiplier: number;
    colorDestroyerChanceMultiplier: number;
  };
  position?: {
    x?: number;
    y?: number;
  };
}

export function createGamePiece(options: CreatePieceOptions) {
  const {
    world,
    arena,
    difficulty,
    hasActiveSpecialPiece,
    forcedKind = 'auto',
    spawnAssist,
    position
  } = options;

  const specialSpawnPenalty = hasActiveSpecialPiece
    ? GAME_CONFIG.specials.activeSpecialSpawnPenaltyMultiplier
    : 1;
  const assistHugeChanceMultiplier = spawnAssist?.hugeChanceMultiplier ?? 1;
  const assistBombChanceMultiplier = spawnAssist?.bombChanceMultiplier ?? 1;
  const assistColorDestroyerChanceMultiplier =
    spawnAssist?.colorDestroyerChanceMultiplier ?? 1;
  const adjustedColorDestroyerChance = Math.min(
    1,
    difficulty.colorDestroyerChance *
      specialSpawnPenalty *
      assistColorDestroyerChanceMultiplier
  );
  const adjustedBombChance = Math.min(
    1,
    difficulty.bombChance * specialSpawnPenalty * assistBombChanceMultiplier
  );
  const specialRoll = Math.random();
  const isColorDestroyer =
    forcedKind === 'color-destroyer'
      ? true
      : forcedKind === 'auto'
        ? specialRoll < adjustedColorDestroyerChance
        : false;
  const isBomb =
    forcedKind === 'bomb'
      ? true
      : forcedKind === 'auto'
        ? !isColorDestroyer &&
          specialRoll < adjustedColorDestroyerChance + adjustedBombChance
        : false;

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
    forcedKind === 'marker'
      ? INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)]
      : forcedKind === 'normal'
        ? 'none'
        : !isBomb &&
            !isColorDestroyer &&
            Math.random() < difficulty.markedChance
      ? INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)]
      : 'none';
  const visualColorValue = markerType !== 'none' ? '#ffffff' : color.value;
  const adjustedHugeChance = Math.min(
    1,
    Math.max(0, difficulty.hugeChance * assistHugeChanceMultiplier)
  );
  const sizeMode =
    forcedKind === 'marker'
      ? 'small'
      : Math.random() < adjustedHugeChance
        ? 'huge'
        : 'small';
  const rootSize = rand(
    arena.width * GAME_CONFIG.sizes.rootMinFactor,
    arena.width * GAME_CONFIG.sizes.rootMaxFactor
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
    rand(arena.x + horizontalMargin, arena.x + arena.width - horizontalMargin);
  const y = position?.y ?? arena.spawnY;

  const bodyOptions = {
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
      piece = Bodies.polygon(x, y, 6, baseSize * 0.58, bodyOptions) as GamePieceBody;
      Body.setAngle(piece, rand(-0.24, 0.24));
      break;
    case 'bomb':
      piece = Bodies.circle(x, y, baseSize * 0.48, bodyOptions) as GamePieceBody;
      piece.isCircleShape = true;
      break;
    case 'circle':
      piece = Bodies.circle(x, y, baseSize * 0.5, bodyOptions) as GamePieceBody;
      piece.isCircleShape = true;
      break;
    case 'square':
      piece = Bodies.rectangle(x, y, baseSize, baseSize, {
        ...bodyOptions,
        chamfer: { radius: Math.max(4, baseSize * 0.14) }
      }) as GamePieceBody;
      Body.setAngle(piece, rand(-0.2, 0.2));
      break;
    case 'triangle':
      piece = Bodies.polygon(x, y, 3, baseSize * 0.64, bodyOptions) as GamePieceBody;
      Body.setAngle(piece, rand(-0.45, 0.45));
      break;
    case 'pentagon':
      piece = Bodies.polygon(x, y, 5, baseSize * 0.6, bodyOptions) as GamePieceBody;
      Body.setAngle(piece, rand(-0.3, 0.3));
      break;
    case 'hexagon':
      piece = Bodies.polygon(x, y, 6, baseSize * 0.6, bodyOptions) as GamePieceBody;
      Body.setAngle(piece, rand(-0.3, 0.3));
      break;
    case 'bar':
    default:
      piece = Bodies.rectangle(x, y, baseSize * 1.55, baseSize * 0.76, {
        ...bodyOptions,
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

  Composite.add(world, piece);
  return piece;
}
