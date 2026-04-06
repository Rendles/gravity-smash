import { COLORS, GAME_CONFIG, INNER_MARKER_TYPES } from '../config';
import { rand } from '../level';
import type { GamePieceBody, LevelSettings } from '../types';

export function getTurnBasedSpawnCount(difficulty: LevelSettings | null) {
  if (!difficulty) {
    return 0;
  }

  const min = difficulty.turnSpawnMin;
  const max = difficulty.turnSpawnMax;
  return Math.max(min, Math.round(rand(min, max + 0.999)));
}

export function canPiecesResolveAsMove(a: GamePieceBody, b: GamePieceBody) {
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

export function hasAvailableMoves(pieces: GamePieceBody[]) {
  const livePieces = pieces.filter(piece => !piece.pendingDestroy);

  for (let firstIndex = 0; firstIndex < livePieces.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < livePieces.length;
      secondIndex += 1
    ) {
      if (canPiecesResolveAsMove(livePieces[firstIndex], livePieces[secondIndex])) {
        return true;
      }
    }
  }

  return false;
}

function applyRandomColorToPiece(piece: GamePieceBody) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  piece.colorName = color.name;
  piece.colorValue =
    (piece.markerType ?? 'none') !== 'none' ? '#ffffff' : color.value;
}

function applyRandomMarkerToPiece(piece: GamePieceBody) {
  piece.markerType =
    INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)];
  piece.colorValue = '#ffffff';
}

export function ensureTurnBasedPlayableBoard(pieces: GamePieceBody[]) {
  if (hasAvailableMoves(pieces)) {
    return;
  }

  const recolorCandidates = pieces.filter(
    piece =>
      !piece.pendingDestroy &&
      !piece.isBomb &&
      !piece.isColorDestroyer &&
      (piece.markerType ?? 'none') === 'none'
  );
  const remarkCandidates = pieces.filter(
    piece =>
      !piece.pendingDestroy &&
      !piece.isBomb &&
      !piece.isColorDestroyer &&
      (piece.markerType ?? 'none') !== 'none'
  );

  if (recolorCandidates.length < 2 && remarkCandidates.length < 2) {
    return;
  }

  for (
    let attempt = 0;
    attempt < GAME_CONFIG.progression.turnBased.reshuffleMaxAttempts &&
    !hasAvailableMoves(pieces);
    attempt += 1
  ) {
    recolorCandidates.forEach(applyRandomColorToPiece);
    remarkCandidates.forEach(applyRandomMarkerToPiece);
  }

  if (!hasAvailableMoves(pieces) && recolorCandidates.length >= 2) {
    const forcedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    recolorCandidates[0].colorName = forcedColor.name;
    recolorCandidates[0].colorValue = forcedColor.value;
    recolorCandidates[1].colorName = forcedColor.name;
    recolorCandidates[1].colorValue = forcedColor.value;
  }

  if (!hasAvailableMoves(pieces) && remarkCandidates.length >= 2) {
    const forcedMarker =
      INNER_MARKER_TYPES[Math.floor(Math.random() * INNER_MARKER_TYPES.length)];
    remarkCandidates[0].markerType = forcedMarker;
    remarkCandidates[0].colorValue = '#ffffff';
    remarkCandidates[1].markerType = forcedMarker;
    remarkCandidates[1].colorValue = '#ffffff';
  }
}
