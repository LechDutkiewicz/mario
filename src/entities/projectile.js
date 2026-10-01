import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { TAU, shape, ell, hilite } from './sprite-utils.js';

// flat two-step halo behind a projectile (pixel-style glow, no gradient)
function _glow(ctx, cx, cy, r, rgb, a = 0.4) {
  ctx.fillStyle = `rgba(${rgb},${a * 0.45})`;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(${rgb},${a * 0.6})`;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, TAU); ctx.fill();
}

// Player projectile — visual matches the character's type (element),
// physics identical for all: bounces on ground, dies on wall hit.
// element: 'fire' | 'leaf' | 'electric' | 'shadow' | 'water'
export class Fireball {
  constructor(x, y, dir, element = 'fire') {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 10;
    this.vx = 6.5 * dir;
    this.vy = -1;
    this.dir = dir;
    this.element = element;
    this.dead = false;
    this.life = 140;
    this.anim = 0;
  }

  update(solids) {
    this.anim++;
    this.life--;
    if (this.life <= 0) { this.dead = true; return; }

    this.vy += GRAVITY * 0.65;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    const prevX = this.x;
    const res = resolveCollisions(this, solids);
    if (res.onGround) this.vy = -5;
    if (this.x === prevX) this.dead = true;
    if (this.y > 800) this.dead = true;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;

    switch (this.element) {
      case 'leaf':     this._drawLeaf(ctx, cx, cy); break;
      case 'electric': this._drawSpark(ctx, cx, cy); break;
      case 'shadow':   this._drawShadowOrb(ctx, cx, cy); break;
      case 'water':    this._drawBubble(ctx, cx, cy); break;
      default:         this._drawFlame(ctx, cx, cy);
    }
  }

  // Flamethrower arc — orange/red elongated teardrop (Fire)
  _drawFlame(ctx, cx, cy) {
    const t = Math.floor(this.anim / 3) % 3;
    const colors = ['#ff4400', '#ff8800', '#ffcc00'];
    _glow(ctx, cx, cy, 13, '255,150,40', 0.45);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.dir > 0 ? 0.3 : -0.3 + Math.PI);
    // Teardrop flame: darker rim + ink outline, bright core up front
    shape(ctx, () => {
      ctx.moveTo(this.w * 0.5, 0);
      ctx.quadraticCurveTo(this.w * 0.2, -this.h * 0.6, -this.w * 0.3, -this.h * 0.35);
      ctx.quadraticCurveTo(-this.w * 0.62, 0, -this.w * 0.3, this.h * 0.35);
      ctx.quadraticCurveTo(this.w * 0.2, this.h * 0.6, this.w * 0.5, 0);
      ctx.closePath();
    }, colors[t], '#7a1a00', { sh: 0.72, dy: 2, lw: 1.3 });
    ell(ctx, 2, -0.5, this.w * 0.24, this.h * 0.28, 0, colors[(t + 1) % 3], null, { sh: 0 });
    ell(ctx, 3.5, -1, this.w * 0.11, this.h * 0.14, 0, '#fff6d0', null, { sh: 0 });
    ctx.restore();
  }

  // Razor Leaf — spinning green leaf (Grass)
  _drawLeaf(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.anim * 0.35 * this.dir);
    shape(ctx, () => {
      ctx.moveTo(-9, 0);
      ctx.bezierCurveTo(-4, -6, 4, -6, 9, 0);
      ctx.bezierCurveTo(4, 6, -4, 6, -9, 0);
      ctx.closePath();
    }, '#3aa832', '#164a12', { sh: 0.72, dy: 2, lw: 1.3 });
    hilite(ctx, -3, -2, 2.5, 1, 0.4);
    // Center vein
    ctx.strokeStyle = '#a8e070'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.restore();
  }

  // Thunder Shock — crackling yellow spark ball (Electric)
  _drawSpark(ctx, cx, cy) {
    const flick = Math.floor(this.anim / 2) % 2;
    // Core orb
    _glow(ctx, cx, cy, 13, '255,230,80', 0.4);
    ell(ctx, cx, cy, 5.5, 5.5, 0, flick ? '#fff890' : '#ffd820', '#8a6400', { sh: 0.78, dy: 2, lw: 1.3 });
    ell(ctx, cx - 0.5, cy - 0.8, 2.5, 2.5, 0, '#ffffff', null, { sh: 0 });
    // Zigzag sparks radiating out — rotate with anim
    ctx.strokeStyle = flick ? '#ffe040' : '#fff8a0';
    ctx.lineWidth = 1.5;
    const base = this.anim * 0.3;
    for (let i = 0; i < 4; i++) {
      const a = base + i * Math.PI / 2;
      const x1 = cx + Math.cos(a) * 6,  y1 = cy + Math.sin(a) * 6;
      const xm = cx + Math.cos(a + 0.3) * 9, ym = cy + Math.sin(a + 0.3) * 9;
      const x2 = cx + Math.cos(a) * 12, y2 = cy + Math.sin(a) * 12;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xm, ym); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // Shadow Ball — dark violet orb, flat 3-tone bands + ink outline (Dark)
  _drawShadowOrb(ctx, cx, cy) {
    const pulse = 1 + Math.sin(this.anim * 0.25) * 0.15;
    _glow(ctx, cx, cy, 8.5 * pulse, '140,70,220', 0.24);
    // Trailing wisps behind (flat, outlined)
    const tb = -this.dir;
    for (let i = 1; i <= 2; i++) {
      const wob = Math.sin(this.anim * 0.4 + i * 2) * 3;
      ell(ctx, cx + tb * (7 + i * 5), cy + wob, 3.5 - i, 3.5 - i, 0, '#7a3cc8', '#1a0630', { sh: 0, lw: 1 });
    }
    // Orb: dark base, mid band, bright upper-left core
    ell(ctx, cx, cy, 6.8, 6.8, 0, '#5a2090', '#1a0630', { sh: 0.5, dy: 3, lw: 1.4 });
    ell(ctx, cx - 1.2, cy - 1.4, 3.6, 3.6, 0, '#a060e0', null, { sh: 0 });
    // Sparkle
    ctx.fillStyle = '#efe0ff';
    ctx.fillRect(cx - 3, cy - 4, 2, 2);
  }

  // Bubble Beam — glossy blue bubble (Water)
  _drawBubble(ctx, cx, cy) {
    const wobble = 1 + Math.sin(this.anim * 0.3) * 0.1;
    ctx.fillStyle = 'rgba(120,200,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 * wobble, 8 / wobble, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a68b0'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 * wobble, 8 / wobble, 0, 0, Math.PI * 2); ctx.stroke();
    // darker underside of the bubble
    ctx.strokeStyle = 'rgba(40,90,160,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, 6.5 * wobble, 6.5 / wobble, 0, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    // Rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - 2.5, cy - 2.5, 4, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
    // Small trailing bubbles
    ctx.fillStyle = 'rgba(160,220,255,0.5)';
    const tb = -this.dir;
    ctx.beginPath(); ctx.arc(cx + tb * 10, cy + 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + tb * 14, cy - 2, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

// Boss projectile.
// Without ylev: Hyper Beam orb (Persian) — flies straight.
// With ylev (FSM BowserFire): Gengar's ghost-flame — flies left and homes
// DOWN to the target height level (moveFlying: shiftVert by ≤ unitsize until
// bottom == ylev), never up.
export class BossShot {
  constructor(x, y, vx, vy, ylev = null) {
    this.x = x;
    this.y = y;
    this.ylev = ylev;
    this.w = ylev != null ? 26 : 20;
    this.h = ylev != null ? 10 : 20;
    this.vx = vx;
    this.vy = vy;
    this.dead = false;
    this.life = 300;
    this.anim = 0;
  }

  update() {
    this.anim++;
    this.life--;
    this.x += this.vx;
    this.y += this.vy;
    if (this.grav) this.vy += 0.3;          // arcing bone (Cubone)
    // FSM moveFlying — descend toward ylev, max unitsize (4px) per frame
    if (this.ylev != null) {
      const bottom = this.y + this.h;
      if (Math.round(bottom) < this.ylev) {
        this.y += Math.min(this.ylev - bottom, 4);
      }
    }
    if (this.y > 820) this.dead = true;
    if (this.life <= 0) this.dead = true;
  }

  draw(r, cam) {
    if (this.style === 'bone') { this._drawBone(r, cam); return; }
    if (this.ylev != null) { this._drawFlame(r, cam); return; }
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const t = Math.floor(this.anim / 4) % 2;
    // Hyper Beam orb: glow halo, darker rim + ink outline, white-hot core
    _glow(ctx, cx, cy, this.w * 0.85, '255,220,60', 0.45);
    ell(ctx, cx, cy, this.w / 2, this.w / 2, 0, t ? '#ffe420' : '#ffc800', '#7a4a00', { sh: 0.74, dy: 3, lw: 1.4 });
    ell(ctx, cx - 1, cy - 1.5, this.w * 0.28, this.w * 0.28, 0, '#ffffcc', null, { sh: 0 });
    hilite(ctx, cx - 3, cy - 4, 2.2, 1.2, 0.7);
  }

  // Spinning bone thrown by Cubone
  _drawBone(r, cam) {
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.anim * 0.25 * (this.vx > 0 ? 1 : -1));
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    for (const [bx, by] of [[-8, -2.5], [-8, 2.5], [8, -2.5], [8, 2.5]]) {
      ell(ctx, bx, by, 2.6, 2.6, 0, '#f0ece0', '#5a4a30', { sh: 0.85, dy: 1.2, lw: 1 });
    }
    ctx.strokeStyle = '#f0ece0'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.strokeStyle = '#c8c0a8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, 1.2); ctx.lineTo(6, 1.2); ctx.stroke();
    ctx.restore();
  }

  // Gengar's ghost-flame — purple horizontal flame, flips vertically like the
  // FSM BowserFire sprite cycle
  _drawFlame(r, cam) {
    const ctx = r.ctx;
    const bx = this.x - cam.x;
    const cy = this.y + this.h / 2;
    const flip = Math.floor(this.anim / 6) % 2 ? -1 : 1;

    ctx.save();
    ctx.translate(bx + this.w / 2, cy);
    ctx.scale(1, flip);

    // Flame body — head at the front (left), wavy tail behind
    const t = Math.floor(this.anim / 3) % 2;
    _glow(ctx, -this.w * 0.2, 0, this.w * 0.6, '190,90,255', 0.45);
    shape(ctx, () => {
      ctx.arc(-this.w * 0.32, 0, this.h * 0.5, Math.PI * 0.5, Math.PI * 1.5);
      ctx.lineTo(this.w * 0.18, -this.h * 0.28);
      ctx.lineTo(this.w * 0.34, -this.h * 0.1);
      ctx.lineTo(this.w * 0.22, this.h * 0.12);
      ctx.lineTo(this.w * 0.5, this.h * 0.3);
      ctx.lineTo(-this.w * 0.1, this.h * 0.5);
      ctx.closePath();
    }, t ? '#b040e0' : '#8828c8', '#2a0848', { sh: 0.72, dy: 2, lw: 1.3 });
    // Bright core
    ell(ctx, -this.w * 0.24, 0, this.w * 0.18, this.h * 0.28, 0, t ? '#e8a0ff' : '#d070f8', null, { sh: 0 });
    ell(ctx, -this.w * 0.28, -0.5, this.w * 0.08, this.h * 0.14, 0, '#fbeaff', null, { sh: 0 });

    ctx.restore();
  }
}
