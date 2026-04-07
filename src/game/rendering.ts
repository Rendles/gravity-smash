import { Vector } from 'matter-js';
import type {
  Arena,
  BlastWave,
  ComboPopup,
  GamePieceBody,
  Particle
} from './types';

interface CollisionPairLike {
  bodyA: GamePieceBody;
  bodyB: GamePieceBody;
  collision: {
    normal: {
      x: number;
      y: number;
    };
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const SPECTRUM_COLORS = [
  '#ff5a5f',
  '#ff9f1c',
  '#ffe66d',
  '#2ec4b6',
  '#3a86ff',
  '#c77dff'
];

function drawBodyPath(ctx: CanvasRenderingContext2D, body: GamePieceBody) {
  if (body.isCircleShape) {
    const radius = (body.bounds.max.x - body.bounds.min.x) * 0.5;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
    return;
  }

  const vertices = body.vertices;
  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);

  for (let i = 1; i < vertices.length; i += 1) {
    ctx.lineTo(vertices[i].x, vertices[i].y);
  }

  ctx.closePath();
}

function isBodyPastDangerLine(body: GamePieceBody, arena?: Arena) {
  return (
    !!arena &&
    !body.pendingDestroy &&
    body.bounds.min.y <= arena.dangerLineY &&
    body.overflowSince !== null &&
    body.overflowSince !== undefined
  );
}

function drawInnerSelectionOutline(
  ctx: CanvasRenderingContext2D,
  body: GamePieceBody
) {
  if (!body.isSelected) {
    return;
  }

  const insetScale = body.isCircleShape ? 0.82 : 0.84;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.scale(insetScale, insetScale);
  ctx.translate(-body.position.x, -body.position.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.lineWidth = body.isHuge ? 3.2 : 2.6;
  ctx.shadowColor = 'rgba(255,255,255,0.34)';
  ctx.shadowBlur = 12;
  drawBodyPath(ctx, body);
  ctx.stroke();
  ctx.restore();
}

function drawInnerMarker(ctx: CanvasRenderingContext2D, body: GamePieceBody) {
  if (!body.markerType || body.markerType === 'none') {
    return;
  }

  const width = body.bounds.max.x - body.bounds.min.x;
  const height = body.bounds.max.y - body.bounds.min.y;
  const cx = body.position.x;
  const cy = body.position.y;
  const markerSize = Math.max(12, Math.min(width, height) * 0.42);
  const half = markerSize * 0.5;

  ctx.save();
  drawBodyPath(ctx, body);
  ctx.clip();

  ctx.globalAlpha = body.isSelected ? 0.98 : 0.84;
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.lineWidth = Math.max(2, markerSize * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = body.colorValue ?? '#ffffff';
  ctx.shadowBlur = body.isSelected ? 16 : 10;

  switch (body.markerType) {
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.stroke();
      break;

    case 'letter-m':
      ctx.beginPath();
      ctx.moveTo(cx - half, cy + half);
      ctx.lineTo(cx - half, cy - half);
      ctx.lineTo(cx, cy + half * 0.05);
      ctx.lineTo(cx + half, cy - half);
      ctx.lineTo(cx + half, cy + half);
      ctx.stroke();
      break;

    case 'letter-a':
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.8, cy + half);
      ctx.lineTo(cx, cy - half);
      ctx.lineTo(cx + half * 0.8, cy + half);
      ctx.moveTo(cx - half * 0.45, cy + half * 0.08);
      ctx.lineTo(cx + half * 0.45, cy + half * 0.08);
      ctx.stroke();
      break;

    case 'letter-t':
      ctx.beginPath();
      ctx.moveTo(cx - half, cy - half);
      ctx.lineTo(cx + half, cy - half);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

function applyBodyDeformTransform(ctx: CanvasRenderingContext2D, body: GamePieceBody) {
  if (!body.deformAmount) {
    return;
  }

  const cx = body.position.x;
  const cy = body.position.y;
  const squash = Math.max(0.94, 1 - body.deformAmount);
  const stretch = 1 + body.deformAmount * 0.68;

  ctx.translate(cx, cy);
  ctx.rotate(body.deformAngle ?? 0);
  ctx.scale(squash, stretch);
  ctx.rotate(-(body.deformAngle ?? 0));
  ctx.translate(-cx, -cy);
}

function registerImpactDeformation(
  body: GamePieceBody,
  normal: { x: number; y: number },
  impactSpeed: number,
  plasticDeformMax: number
) {
  if (!body.isGamePiece) {
    return;
  }

  const normalizedImpact = clamp((impactSpeed - 0.35) / 4.8, 0, 1);
  if (normalizedImpact <= 0) {
    return;
  }

  const impactDeform = normalizedImpact * plasticDeformMax;
  if (impactDeform <= (body.deformAmount ?? 0)) {
    return;
  }

  body.deformAmount = impactDeform;
  body.deformAngle = Math.atan2(normal.y, normal.x);
}

export function drawArena(
  ctx: CanvasRenderingContext2D,
  arena: Arena,
  options?: {
    isFrozen?: boolean;
    fireHeatProgress?: number;
    isDangerActive?: boolean;
  }
) {
  const isFrozen = options?.isFrozen ?? false;
  const fireHeatProgress = options?.fireHeatProgress ?? 0;
  const isDangerActive = options?.isDangerActive ?? false;
  const dangerPulse = isDangerActive
    ? 0.5 + Math.sin(performance.now() / 92) * 0.5
    : 0;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = isFrozen ? 'rgba(12, 26, 40, 0.44)' : 'rgba(7, 12, 20, 0.34)';
  ctx.fillRect(arena.x, arena.y, arena.width, arena.height);
  ctx.restore();

  ctx.save();

  if (fireHeatProgress > 0) {
    const heatAlpha = fireHeatProgress * 0.95;
    const heatHeight = Math.max(92, arena.height * 0.24);
    const heatTop = arena.y + arena.height - heatHeight;

    const heatGradient = ctx.createLinearGradient(
      arena.x,
      arena.y + arena.height,
      arena.x,
      heatTop
    );
    heatGradient.addColorStop(0, `rgba(255, 103, 36, ${0.34 * heatAlpha})`);
    heatGradient.addColorStop(0.45, `rgba(255, 167, 56, ${0.22 * heatAlpha})`);
    heatGradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

    ctx.fillStyle = heatGradient;
    ctx.fillRect(arena.x, heatTop, arena.width, heatHeight);
  }

  ctx.shadowColor = isFrozen ? 'rgba(150, 232, 255, 0.55)' : 'rgba(0, 240, 255, 0.28)';
  ctx.shadowBlur = isFrozen ? 28 : 22;
  ctx.strokeStyle = isFrozen ? 'rgba(172, 240, 255, 0.92)' : 'rgba(0, 240, 255, 0.65)';
  ctx.lineWidth = isFrozen ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(arena.x, arena.y);
  ctx.lineTo(arena.x, arena.y + arena.height);
  ctx.lineTo(arena.x + arena.width, arena.y + arena.height);
  ctx.lineTo(arena.x + arena.width, arena.y);
  ctx.stroke();

  if (fireHeatProgress > 0) {
    const heatAlpha = fireHeatProgress * 0.9;

    ctx.shadowColor = `rgba(255, 132, 40, ${0.44 * heatAlpha})`;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = `rgba(255, 156, 74, ${0.86 * heatAlpha})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(arena.x + 8, arena.y + arena.height);
    ctx.lineTo(arena.x + arena.width - 8, arena.y + arena.height);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(arena.x, arena.y + arena.height - 68);
    ctx.lineTo(arena.x, arena.y + arena.height);
    ctx.moveTo(arena.x + arena.width, arena.y + arena.height - 68);
    ctx.lineTo(arena.x + arena.width, arena.y + arena.height);
    ctx.stroke();
  }

  if (isFrozen) {
    ctx.strokeStyle = 'rgba(220, 248, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(180, 240, 255, 0.22)';
    ctx.shadowBlur = 16;

    for (let offset = 22; offset < arena.height; offset += 44) {
      ctx.beginPath();
      ctx.moveTo(arena.x + 2, arena.y + offset);
      ctx.lineTo(arena.x + 12, arena.y + offset + 10);
      ctx.lineTo(arena.x + 2, arena.y + offset + 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(arena.x + arena.width - 2, arena.y + offset);
      ctx.lineTo(arena.x + arena.width - 12, arena.y + offset + 10);
      ctx.lineTo(arena.x + arena.width - 2, arena.y + offset + 20);
      ctx.stroke();
    }
  }

  ctx.shadowColor = isFrozen
    ? 'rgba(168, 235, 255, 0.34)'
    : `rgba(255, 59, 91, ${isDangerActive ? 0.55 + dangerPulse * 0.35 : 0.42})`;
  ctx.shadowBlur = isFrozen ? 22 : isDangerActive ? 18 + dangerPulse * 14 : 18;
  ctx.strokeStyle = isFrozen
    ? 'rgba(176, 236, 255, 0.72)'
    : `rgba(255, 59, 91, ${isDangerActive ? 0.72 + dangerPulse * 0.28 : 0.84})`;
  ctx.lineWidth = isDangerActive ? 4 + dangerPulse * 1.8 : 4;
  ctx.beginPath();
  ctx.moveTo(arena.x + 10, arena.dangerLineY);
  ctx.lineTo(arena.x + arena.width - 10, arena.dangerLineY);
  ctx.stroke();

  ctx.restore();
}

export function drawGlowBody(
  ctx: CanvasRenderingContext2D,
  body: GamePieceBody,
  arena?: Arena
) {
  ctx.save();
  applyBodyDeformTransform(ctx, body);
  const isDangerBody = isBodyPastDangerLine(body, arena);

  if (body.isColorDestroyer) {
    const vertices = body.vertices;
    const cx = body.position.x;
    const cy = body.position.y;

    ctx.shadowColor = 'rgba(255,255,255,0.35)';
    ctx.shadowBlur = body.isSelected ? 40 : 26;

    for (let i = 0; i < vertices.length; i += 1) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(current.x, current.y);
      ctx.lineTo(next.x, next.y);
      ctx.closePath();
      ctx.fillStyle = SPECTRUM_COLORS[i % SPECTRUM_COLORS.length];
      ctx.globalAlpha = body.isSelected ? 0.92 : 0.84;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = body.isSelected ? 4.6 : 3.2;
    drawBodyPath(ctx, body);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(5, (body.bounds.max.x - body.bounds.min.x) * 0.11), 0, Math.PI * 2);
    ctx.fill();
  } else if (body.isBomb) {
    const radius = (body.bounds.max.x - body.bounds.min.x) * 0.5;

    ctx.shadowColor = body.colorValue ?? '#ffb347';
    ctx.shadowBlur = body.isSelected ? 42 : 28;
    ctx.strokeStyle = body.colorValue ?? '#ffb347';
    ctx.fillStyle = 'rgba(14, 16, 20, 0.96)';
    ctx.lineWidth = body.isSelected ? 4.6 : 3.2;

    drawBodyPath(ctx, body);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(2.2, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(body.position.x - radius * 0.26, body.position.y + radius * 0.08);
    ctx.lineTo(body.position.x + radius * 0.24, body.position.y - radius * 0.18);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(body.position.x + radius * 0.1, body.position.y - radius * 0.5);
    ctx.lineTo(body.position.x + radius * 0.34, body.position.y - radius * 0.82);
    ctx.lineTo(body.position.x + radius * 0.52, body.position.y - radius * 0.58);
    ctx.stroke();

    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    ctx.arc(
      body.position.x + radius * 0.56,
      body.position.y - radius * 0.62,
      Math.max(2.4, radius * 0.11),
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    const isMarked = !!body.markerType && body.markerType !== 'none';
    ctx.shadowColor = body.colorValue ?? '#ffffff';
    ctx.shadowBlur = body.isSelected ? 38 : 26;
    ctx.strokeStyle = body.colorValue ?? '#ffffff';
    ctx.fillStyle = isMarked
      ? body.isHuge
        ? 'rgba(255, 255, 255, 0.16)'
        : 'rgba(255, 255, 255, 0.12)'
      : body.isHuge
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = body.isSelected ? 4.2 : body.isHuge ? 3 : 2.5;

    drawBodyPath(ctx, body);
    ctx.fill();
    drawInnerMarker(ctx, body);
    ctx.stroke();
  }

  if (isDangerBody) {
    const dangerPulse = 0.5 + Math.sin(performance.now() / 86 + body.id) * 0.5;

    ctx.save();
    drawBodyPath(ctx, body);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.12 + dangerPulse * 0.2;
    ctx.fillStyle = '#ff3b5b';
    ctx.shadowColor = 'rgba(255, 59, 91, 0.48)';
    ctx.shadowBlur = 18 + dangerPulse * 12;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawBodyPath(ctx, body);
    ctx.globalAlpha = 0.28 + dangerPulse * 0.34;
    ctx.strokeStyle = '#ff3b5b';
    ctx.lineWidth = body.isHuge ? 4 : 3;
    ctx.shadowColor = 'rgba(255, 59, 91, 0.62)';
    ctx.shadowBlur = 16 + dangerPulse * 10;
    ctx.stroke();
    ctx.restore();
  }

  drawInnerSelectionOutline(ctx, body);

  ctx.restore();
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();

  particles.forEach(particle => {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export function drawBlastWaves(ctx: CanvasRenderingContext2D, blastWaves: BlastWave[]) {
  ctx.save();

  blastWaves.forEach(wave => {
    const alpha = Math.max(0, wave.life / wave.maxLife);
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

export function drawComboPopups(ctx: CanvasRenderingContext2D, popups: ComboPopup[]) {
  if (!popups.length) {
    return;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  popups.forEach(popup => {
    const progress = 1 - popup.life / popup.maxLife;
    const alpha = Math.max(0, Math.min(1, popup.life / popup.maxLife));
    const y = popup.y - 38 * progress;
    const scale = 1 + Math.sin(Math.min(1, progress) * Math.PI) * 0.12;

    ctx.save();
    ctx.translate(popup.x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, alpha * 1.25);

    const pillWidth = 126;
    const pillHeight = 46;
    const radius = 14;
    const left = -pillWidth * 0.5;
    const top = -pillHeight * 0.5;

    ctx.shadowColor = 'rgba(255, 225, 130, 0.38)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.78)';
    ctx.beginPath();
    ctx.roundRect(left, top, pillWidth, pillHeight, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 225, 130, 0.78)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 16;
    ctx.shadowColor = 'rgba(255, 225, 130, 0.42)';
    ctx.fillStyle = '#ffe182';
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.fillText(`Комбо x${popup.destroyedCount}`, 0, -7);

    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(111, 255, 176, 0.36)';
    ctx.fillStyle = '#6fffb0';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.fillText(`+${popup.bonusPoints} Coin`, 0, 11);

    ctx.restore();
  });

  ctx.restore();
}

export function updateBodyDeformation(
  body: GamePieceBody,
  delta: number,
  plasticDeformRecovery: number
) {
  if (!body.deformAmount) {
    return;
  }

  const decay = Math.exp(-plasticDeformRecovery * delta);
  body.deformAmount *= decay;

  if (body.deformAmount < 0.001) {
    body.deformAmount = 0;
  }
}

export function handlePlasticCollisions(
  pairs: CollisionPairLike[],
  plasticDeformMax: number
) {
  pairs.forEach(pair => {
    const { bodyA, bodyB, collision } = pair;
    const relativeVelocity = Vector.sub(bodyA.velocity, bodyB.velocity);
    const impactSpeed = Math.abs(Vector.dot(relativeVelocity, collision.normal));

    registerImpactDeformation(bodyA, collision.normal, impactSpeed, plasticDeformMax);
    registerImpactDeformation(
      bodyB,
      { x: -collision.normal.x, y: -collision.normal.y },
      impactSpeed,
      plasticDeformMax
    );
  });
}
