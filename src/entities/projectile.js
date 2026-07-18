import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

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
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.dir > 0 ? 0.3 : -0.3 + Math.PI);
    ctx.fillStyle = colors[t];
    ctx.beginPath();
    ctx.ellipse(0, 0, this.w * 0.55, this.h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[(t + 1) % 3];
    ctx.beginPath();
    ctx.ellipse(-3, 0, this.w * 0.28, this.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Razor Leaf — spinning green leaf (Grass)
  _drawLeaf(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.anim * 0.35 * this.dir);
    ctx.fillStyle = '#3aa832';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.bezierCurveTo(-4, -6, 4, -6, 9, 0);
    ctx.bezierCurveTo(4, 6, -4, 6, -9, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1e6018'; ctx.lineWidth = 1; ctx.stroke();
    // Center vein
    ctx.strokeStyle = '#a8e070'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.restore();
  }

  // Thunder Shock — crackling yellow spark ball (Electric)
  _drawSpark(ctx, cx, cy) {
    const flick = Math.floor(this.anim / 2) % 2;
    // Core orb
    ctx.fillStyle = flick ? '#fff890' : '#ffd820';
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
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

  // Shadow Ball — dark violet orb with wispy aura (Dark)
  _drawShadowOrb(ctx, cx, cy) {
    // Wispy aura ring
    const pulse = 1 + Math.sin(this.anim * 0.25) * 0.15;
    ctx.fillStyle = 'rgba(120,60,200,0.3)';
    ctx.beginPath(); ctx.arc(cx, cy, 9 * pulse, 0, Math.PI * 2); ctx.fill();
    // Main orb
    const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 7);
    grad.addColorStop(0, '#a060e0');
    grad.addColorStop(0.6, '#5a2090');
    grad.addColorStop(1, '#28084a');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    // Trailing wisps behind
    ctx.fillStyle = 'rgba(160,100,240,0.5)';
    const tb = -this.dir;
    for (let i = 1; i <= 2; i++) {
      const wob = Math.sin(this.anim * 0.4 + i * 2) * 3;
      ctx.beginPath();
      ctx.arc(cx + tb * (7 + i * 5), cy + wob, 3.5 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sparkle
    ctx.fillStyle = '#e8d0ff';
    ctx.fillRect(cx - 3, cy - 4, 2, 2);
  }

  // Bubble Beam — glossy blue bubble (Water)
  _drawBubble(ctx, cx, cy) {
    const wobble = 1 + Math.sin(this.anim * 0.3) * 0.1;
    ctx.fillStyle = 'rgba(120,200,255,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 * wobble, 8 / wobble, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a0d8f8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, 8 * wobble, 8 / wobble, 0, 0, Math.PI * 2); ctx.stroke();
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

// Hyper Beam orb — yellow glowing orb, flies straight from Persian
export class BossShot {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 20;
    this.vx = vx;
    this.vy = vy;
    this.dead = false;
    this.life = 220;
    this.anim = 0;
  }

  update() {
    this.anim++;
    this.life--;
    this.x += this.vx;
    this.y += this.vy;
    if (this.life <= 0) this.dead = true;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const cx = this.x - cam.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const t = Math.floor(this.anim / 4) % 2;
    // Outer glow
    ctx.fillStyle = t ? '#ffee00' : '#ffcc00';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
    // Inner white core
    ctx.fillStyle = '#ffffcc';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    // Rim
    ctx.strokeStyle = '#cc8800'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, this.w / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
