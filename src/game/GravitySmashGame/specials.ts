import { GAME_CONFIG } from '../config';
import type { Arena, GamePieceBody } from '../types';

export function getBombDetonationResult(
  pieces: GamePieceBody[],
  bomb: GamePieceBody,
  triggerPiece: GamePieceBody,
  radiusMultiplier = 1
) {
  const bombRadius = Math.max(
    GAME_CONFIG.bombs.minBlastRadius,
    (bomb.bounds.max.x - bomb.bounds.min.x) * GAME_CONFIG.bombs.blastRadiusFactor
  ) * radiusMultiplier;

  const blastTargets = new Set<GamePieceBody>([bomb, triggerPiece]);

  pieces.forEach(piece => {
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

  return {
    center: {
      x: bomb.position.x,
      y: bomb.position.y
    },
    targets: Array.from(blastTargets)
  };
}

export function getDestroyerBombComboResult(
  pieces: GamePieceBody[],
  arena: Arena,
  destroyer: GamePieceBody,
  bomb: GamePieceBody,
  radiusMultiplier = 1
) {
  const center = {
    x: (destroyer.position.x + bomb.position.x) * 0.5,
    y: (destroyer.position.y + bomb.position.y) * 0.5
  };

  const comboRadius = Math.max(
    GAME_CONFIG.combos.bombDestroyerMinBlastRadius,
    Math.max(arena.width, arena.height) *
      GAME_CONFIG.combos.bombDestroyerBlastRadiusFactor
  ) * radiusMultiplier;

  const targets = pieces.filter(piece => {
    if (piece.pendingDestroy) {
      return false;
    }

    const dx = piece.position.x - center.x;
    const dy = piece.position.y - center.y;
    return Math.hypot(dx, dy) <= comboRadius;
  });

  return { center, targets };
}

export function getColorDestroyerTargets(
  pieces: GamePieceBody[],
  targetColorName?: string
) {
  return pieces.filter(
    piece => !piece.pendingDestroy && piece.colorName === targetColorName
  );
}

export function getColorDestroyerSelectionTargets(
  pieces: GamePieceBody[],
  targetPiece: GamePieceBody
) {
  const targetMarkerType = targetPiece.markerType ?? 'none';

  if (targetMarkerType !== 'none') {
    return pieces.filter(
      piece =>
        !piece.pendingDestroy &&
        (piece.markerType ?? 'none') === targetMarkerType
    );
  }

  return getColorDestroyerTargets(pieces, targetPiece.colorName);
}

function isOrdinarySpectrumCandidate(piece: GamePieceBody) {
  return (
    !piece.pendingDestroy &&
    !piece.isBomb &&
    !piece.isColorDestroyer &&
    (piece.markerType ?? 'none') === 'none' &&
    !!piece.colorName
  );
}

export function getSpectrumTargets(
  pieces: GamePieceBody[],
  targetColorName?: string
) {
  return pieces.filter(
    piece =>
      isOrdinarySpectrumCandidate(piece) && piece.colorName === targetColorName
  );
}

export function getSpectrumTargetColor(pieces: GamePieceBody[]) {
  const colorCounts = new Map<string, number>();

  pieces.forEach(piece => {
    if (!isOrdinarySpectrumCandidate(piece)) {
      return;
    }

    const colorName = piece.colorName as string;
    colorCounts.set(colorName, (colorCounts.get(colorName) ?? 0) + 1);
  });

  let bestColor: string | null = null;
  let bestCount = 0;

  colorCounts.forEach((count, colorName) => {
    if (count > bestCount) {
      bestColor = colorName;
      bestCount = count;
    }
  });

  return bestColor;
}

export function getBottomBodies(
  pieces: GamePieceBody[],
  arena: Arena,
  burnThreshold = 8
) {
  const floorY = arena.y + arena.height;

  return pieces.filter(
    body => !body.pendingDestroy && body.bounds.max.y >= floorY - burnThreshold
  );
}

export function getBodiesCenter(bodies: GamePieceBody[]) {
  return {
    x: bodies.reduce((sum, body) => sum + body.position.x, 0) / bodies.length,
    y: bodies.reduce((sum, body) => sum + body.position.y, 0) / bodies.length
  };
}
