import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Giovanni's Persian — large silver/gray cat, 3 HP, shoots Hyper Beam orbs
export class Boss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 88;
    this.h = 80;
    this.x = x;
    this.y = y - this.h;
    this.vx = -1.4;
    this.vy = 0;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.hp = 3;
    this.dead = false;
    this.defeated = false;
    this.hitFlash = 0;
    this.shootTimer = 100;
    this.anim = 0;
    this.active = false;
    this.deathTimer = 0;
  }

  get stompable() { return true; }

  takeHit() {
    if (this.hitFlash > 0 || this.defeated) return false;
    this.hp--;
    this.hitFlash = 60;
    if (this.hp <= 0) {
      this.defeated = true;
      this.deathTimer = 120;
      this.vx = 0;
    }
    return this.defeated;
  }

  update(solids, player, game) {
    if (this.dead) return;
    this.anim++;
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.defeated) {
      this.deathTimer--;
      this.vy += GRAVITY;
      this.y += this.vy;
      this.x += Math.sin(this.anim * 0.25) * 3;
      if (this.deathTimer <= 0) this.dead = true;
      return;
    }

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 600) this.active = true;
      else return;
    }

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    resolveCollisions(this, solids);

    if (this.x <= this.leftBound) { this.x = this.leftBound; this.vx = Math.abs(this.vx); }
    if (this.x + this.w >= this.rightBound) { this.x = this.rightBound - this.w; this.vx = -Math.abs(this.vx); }

    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = 110;
      const dir = player.x < this.x ? -1 : 1;
      const sx = this.x + this.w / 2;
      const sy = this.y + 28;
      // Hyper Beam: yellow orbs
      game.bossShots.push(new BossShot(sx, sy, dir * 5, -1));
      game.bossShots.push(new BossShot(sx, sy, dir * 4, 1.5));
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.hitFlash > 0 && Math.floor(this.hitFlash / 4) % 2) ctx.globalAlpha = 0.5;

    // Persian color palette — silver gray
    const SILVER  = '#b0b8c8';
    const DARK    = '#7a8494';
    const CREAM   = '#e8e0d0';
    const GEM     = '#e74c3c'; // red gem on forehead
    const look = this.vx < 0 ? -3 : 3;

    // Tail (arched behind body)
    ctx.strokeStyle = SILVER; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.85, y + h * 0.6);
    ctx.quadraticCurveTo(x + w + 30, y + h * 0.2, x + w + 10, y + h * 0.05);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Body oval
    ctx.fillStyle = SILVER;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.65, w * 0.46, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.68, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head — large oval
    ctx.fillStyle = SILVER;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + look, y + h * 0.28, w * 0.36, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pointed ears
    ctx.fillStyle = SILVER;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.22 + look, y + h * 0.1);
    ctx.lineTo(x + w * 0.08 + look, y - 10);
    ctx.lineTo(x + w * 0.35 + look, y + h * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.72 + look, y + h * 0.1);
    ctx.lineTo(x + w * 0.88 + look, y - 10);
    ctx.lineTo(x + w * 0.62 + look, y + h * 0.06);
    ctx.closePath(); ctx.fill();
    // Inner ear
    ctx.fillStyle = '#d4a0a0';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.23 + look, y + h * 0.1);
    ctx.lineTo(x + w * 0.14 + look, y - 4);
    ctx.lineTo(x + w * 0.34 + look, y + h * 0.07);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.71 + look, y + h * 0.1);
    ctx.lineTo(x + w * 0.80 + look, y - 4);
    ctx.lineTo(x + w * 0.63 + look, y + h * 0.07);
    ctx.closePath(); ctx.fill();

    // Gem on forehead
    ctx.fillStyle = GEM;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + look, y + h * 0.06);
    ctx.lineTo(x + w / 2 - 6 + look, y + h * 0.14);
    ctx.lineTo(x + w / 2 + look, y + h * 0.18);
    ctx.lineTo(x + w / 2 + 6 + look, y + h * 0.14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9999';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + look, y + h * 0.07);
    ctx.lineTo(x + w / 2 - 3 + look, y + h * 0.12);
    ctx.lineTo(x + w / 2 + 3 + look, y + h * 0.12);
    ctx.closePath(); ctx.fill();

    // Eyes (slitted, regal)
    ctx.fillStyle = '#4a3820';
    ctx.beginPath(); ctx.ellipse(x + w * 0.36 + look, y + h * 0.27, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.64 + look, y + h * 0.27, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Slit pupils
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w * 0.35 + look, y + h * 0.22, 3, 10);
    ctx.fillRect(x + w * 0.63 + look, y + h * 0.22, 3, 10);
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * 0.36 + look, y + h * 0.23, 2, 2);
    ctx.fillRect(x + w * 0.64 + look, y + h * 0.23, 2, 2);

    // Whiskers
    ctx.strokeStyle = DARK; ctx.lineWidth = 1.5;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const wx = x + w / 2 + look;
        const wy = y + h * (0.34 + i * 0.04);
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + side * 28, wy + (i - 1) * 4);
        ctx.stroke();
      }
    }

    // Legs
    ctx.fillStyle = DARK;
    const swing = Math.sin(this.anim * 0.12) * 3;
    ctx.fillRect(x + w * 0.14, y + h * 0.82 + swing, 14, 18);
    ctx.fillRect(x + w * 0.36, y + h * 0.82 - swing, 14, 18);
    ctx.fillRect(x + w * 0.56, y + h * 0.82 + swing, 14, 18);
    ctx.fillRect(x + w * 0.76, y + h * 0.82 - swing, 14, 18);

    // HP pips
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < this.hp ? '#e23636' : '#444';
      ctx.beginPath();
      ctx.arc(x + w / 2 - 20 + i * 20, y - 18, 7, 0, Math.PI * 2);
      ctx.fill();
      if (i < this.hp) {
        ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
