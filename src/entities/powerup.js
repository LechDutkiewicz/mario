import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// Rare Candy — blue/purple round sweet with twisted wrapper ends
function _drawRareCandy(ctx, cx, cy, size, anim) {
  const r = size * 0.38;
  const pulse = 1 + Math.sin(anim * 0.08) * 0.04;

  // Soft glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.6);
  glow.addColorStop(0, 'rgba(160,140,255,0.35)');
  glow.addColorStop(1, 'rgba(160,140,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();

  // Wrapper left twist
  ctx.fillStyle = '#5050b8';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy - r * 0.25);
  ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.55, cx - r * 1.7, cy - r * 0.1, cx - r * 1.55, cy + r * 0.15);
  ctx.bezierCurveTo(cx - r * 1.35, cy + r * 0.45, cx - r * 0.9, cy + r * 0.35, cx - r * 0.85, cy + r * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.stroke();
  // Left wrapper highlight
  ctx.fillStyle = 'rgba(130,120,220,0.6)';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.95, cy - r * 0.15);
  ctx.bezierCurveTo(cx - r * 1.45, cy - r * 0.4, cx - r * 1.55, cy - r * 0.05, cx - r * 1.35, cy + r * 0.1);
  ctx.bezierCurveTo(cx - r * 1.15, cy + r * 0.3, cx - r * 0.9, cy + r * 0.2, cx - r * 0.9, cy + r * 0.1);
  ctx.closePath(); ctx.fill();

  // Wrapper right twist
  ctx.fillStyle = '#5050b8';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.85, cy - r * 0.25);
  ctx.bezierCurveTo(cx + r * 1.5, cy - r * 0.55, cx + r * 1.7, cy - r * 0.1, cx + r * 1.55, cy + r * 0.15);
  ctx.bezierCurveTo(cx + r * 1.35, cy + r * 0.45, cx + r * 0.9, cy + r * 0.35, cx + r * 0.85, cy + r * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(130,120,220,0.6)';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.95, cy - r * 0.15);
  ctx.bezierCurveTo(cx + r * 1.45, cy - r * 0.4, cx + r * 1.55, cy - r * 0.05, cx + r * 1.35, cy + r * 0.1);
  ctx.bezierCurveTo(cx + r * 1.15, cy + r * 0.3, cx + r * 0.9, cy + r * 0.2, cx + r * 0.9, cy + r * 0.1);
  ctx.closePath(); ctx.fill();

  // Main ball — radial gradient from light blue-purple to deep purple
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.05, cx, cy, r * pulse);
  grad.addColorStop(0,   '#b0b0f8');
  grad.addColorStop(0.4, '#7878e8');
  grad.addColorStop(1,   '#4040a8');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a2a70'; ctx.lineWidth = 1.5; ctx.stroke();

  // Diagonal seam line (like the reference image)
  ctx.strokeStyle = 'rgba(50,50,130,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.7, cy - r * 0.7);
  ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.1, cx - r * 0.6, cy + r * 0.7);
  ctx.stroke();

  // Two specular highlights (large soft + small sharp)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.28, cy - r * 0.32, r * 0.38, r * 0.22, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.18, cy - r * 0.42, r * 0.13, r * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
}

// Fire Stone — yellowish-green kidney-shaped stone with fire design
function _drawFireStone(ctx, cx, cy, size, anim) {
  const s = size * 0.44;
  const flicker = Math.sin(anim * 0.15) * 1.5;

  // Soft amber glow
  const glow = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 1.7);
  glow.addColorStop(0, 'rgba(255,160,0,0.3)');
  glow.addColorStop(1, 'rgba(255,160,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, s * 1.7, 0, Math.PI * 2); ctx.fill();

  // Stone body — rounded irregular shape (slightly wider than tall, like a kidney stone)
  const stoneGrad = ctx.createRadialGradient(cx - s * 0.15, cy - s * 0.1, s * 0.1, cx, cy, s);
  stoneGrad.addColorStop(0,   '#c8c870');
  stoneGrad.addColorStop(0.5, '#a0a040');
  stoneGrad.addColorStop(1,   '#707020');
  ctx.fillStyle = stoneGrad;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.85);
  ctx.bezierCurveTo(cx + s * 0.4, cy - s * 1.05, cx + s * 1.1, cy - s * 0.55, cx + s * 1.05, cy);
  ctx.bezierCurveTo(cx + s * 1.0, cy + s * 0.55, cx + s * 0.4, cy + s * 0.9, cx - s * 0.1, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 0.7, cy + s * 0.9, cx - s * 1.1, cy + s * 0.5, cx - s * 1.05, cy);
  ctx.bezierCurveTo(cx - s * 1.0, cy - s * 0.5, cx - s * 0.7, cy - s * 0.75, cx - s * 0.3, cy - s * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a4a10'; ctx.lineWidth = 1.8; ctx.stroke();

  // Stone highlight (top-left sheen)
  ctx.fillStyle = 'rgba(220,220,120,0.45)';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.75);
  ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.9, cx + s * 0.65, cy - s * 0.5, cx + s * 0.6, cy - s * 0.1);
  ctx.bezierCurveTo(cx + s * 0.55, cy + s * 0.1, cx + s * 0.1, cy - s * 0.05, cx - s * 0.1, cy - s * 0.3);
  ctx.bezierCurveTo(cx - s * 0.3, cy - s * 0.5, cx - s * 0.35, cy - s * 0.65, cx - s * 0.2, cy - s * 0.75);
  ctx.closePath(); ctx.fill();

  // Flame on stone — outer red/orange
  const fy = cy + s * 0.1 + flicker * 0.3;
  ctx.fillStyle = '#cc2200';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.38, fy + s * 0.55);
  ctx.bezierCurveTo(cx - s * 0.5, fy - s * 0.1, cx - s * 0.2, fy - s * 0.6, cx, fy - s * 0.85 - flicker);
  ctx.bezierCurveTo(cx + s * 0.2, fy - s * 0.6, cx + s * 0.5, fy - s * 0.1, cx + s * 0.38, fy + s * 0.55);
  ctx.closePath(); ctx.fill();

  // Flame middle orange
  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.24, fy + s * 0.55);
  ctx.bezierCurveTo(cx - s * 0.32, fy - s * 0.05, cx - s * 0.1, fy - s * 0.5, cx, fy - s * 0.7 - flicker);
  ctx.bezierCurveTo(cx + s * 0.1, fy - s * 0.5, cx + s * 0.32, fy - s * 0.05, cx + s * 0.24, fy + s * 0.55);
  ctx.closePath(); ctx.fill();

  // Flame core yellow
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, fy + s * 0.55);
  ctx.bezierCurveTo(cx - s * 0.14, fy + s * 0.1, cx - s * 0.04, fy - s * 0.25, cx, fy - s * 0.45 - flicker * 0.5);
  ctx.bezierCurveTo(cx + s * 0.04, fy - s * 0.25, cx + s * 0.14, fy + s * 0.1, cx + s * 0.1, fy + s * 0.55);
  ctx.closePath(); ctx.fill();
}

// kind: 'candy' (Rare Candy → Umbreon) | 'firestone' (Fire Stone → Flareon)
export class PowerUp {
  constructor(x, y, kind) {
    if (kind === 'mushroom' || kind === 'grow') kind = 'candy';
    if (kind === 'flower' || kind === 'fire' || kind === 'tm') kind = 'firestone';
    this.kind = kind;
    this.x = x;
    this.w = 28;
    this.h = 28;
    this.y = y;
    this.targetY = y - 30;
    this.vx = kind === 'candy' ? 1.4 : 0;
    this.vy = 0;
    this.dead = false;
    this.emerging = true;
    this.anim = 0;
  }

  update(solids) {
    this.anim++;
    if (this.emerging) {
      this.y -= 1;
      if (this.y <= this.targetY) this.emerging = false;
      return;
    }
    if (this.kind === 'firestone') return; // Fire Stone stays in place

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const res = resolveCollisions(this, solids);
    if (res.hitSide) this.vx = -this.vx;  // bounce off walls
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;
    const cx = x + w / 2, cy = y + h / 2;

    if (this.kind === 'candy') {
      _drawRareCandy(ctx, cx, cy, w, this.anim);
    } else {
      _drawFireStone(ctx, cx, cy, w, this.anim);
    }
  }
}
