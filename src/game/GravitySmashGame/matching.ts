import { Query } from 'matter-js';
import type { GamePieceBody } from '../types';

function isChainMatchCandidate(piece: GamePieceBody, targetColorName: string) {
  return (
    !piece.pendingDestroy &&
    !piece.isBomb &&
    !piece.isColorDestroyer &&
    (piece.markerType ?? 'none') === 'none' &&
    piece.colorName === targetColorName
  );
}

function isMarkerChainMatchCandidate(piece: GamePieceBody, targetMarkerType: string) {
  return (
    !piece.pendingDestroy &&
    !piece.isBomb &&
    !piece.isColorDestroyer &&
    (piece.markerType ?? 'none') === targetMarkerType
  );
}

export function collectTouchingColorCluster(
  pieces: GamePieceBody[],
  seedBodies: GamePieceBody[]
) {
  const targetColorName = seedBodies[0]?.colorName;
  if (!targetColorName) {
    return seedBodies;
  }

  const candidates = pieces.filter(piece =>
    isChainMatchCandidate(piece, targetColorName)
  );
  const cluster = new Set<GamePieceBody>();
  const queue = seedBodies.filter(piece =>
    isChainMatchCandidate(piece, targetColorName)
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
      .filter(piece => isChainMatchCandidate(piece, targetColorName));

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

export function collectTouchingMarkerCluster(
  pieces: GamePieceBody[],
  seedBodies: GamePieceBody[]
) {
  const targetMarkerType = seedBodies[0]?.markerType ?? 'none';
  if (targetMarkerType === 'none') {
    return seedBodies;
  }

  const candidates = pieces.filter(piece =>
    isMarkerChainMatchCandidate(piece, targetMarkerType)
  );
  const cluster = new Set<GamePieceBody>();
  const queue = seedBodies.filter(piece =>
    isMarkerChainMatchCandidate(piece, targetMarkerType)
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
      .filter(piece => isMarkerChainMatchCandidate(piece, targetMarkerType));

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
