import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// Flamethrower arc — orange/red elongated arc shape, bounces on ground
export class Fireball {
  constructor(x, y, dir) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 10;
    this.vx = 6.5 * dir;
    this.vy = -1;
    this.dir = dir;
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
    const bx = this.x - cam.x;
    const by = this.y;
    const t = Math.floor(this.anim / 3) % 3;
    const colors = ['#ff4400', '#ff8800', '#ffcc00'];
    // Draw arc shape (elongated teardrop in direction of travel)
    ctx.save();
    ctx.translate(bx + this.w / 2, by + this.h / 2);
    ctx.rotate(this.dir > 0 ? 0.3 : -0.3 + Math.PI);
    ctx.fillStyle = colors[t];
    ctx.beginPath();
    ctx.ellipse(0, 0, this.w * 0.55, this.h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner brighter core
    ctx.fillStyle = colors[(t + 1) % 3];
    ctx.beginPath();
    ctx.ellipse(-3, 0, this.w * 0.28, this.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
