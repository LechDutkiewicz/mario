import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

// type: 'ekans' (stompable purple snake) | 'koffing' (floating toxic ball, fireball only)
export class Enemy {
  constructor(x, y, type = 'ekans') {
    this.type = type;
    this.x = x;
    this.w = 30;
    this.h = type === 'koffing' ? 32 : 26;
    this.y = y - this.h;
    this.vx = type === 'koffing' ? -0.8 : -1.1;
    this.vy = 0;
    this.dead = false;
    this.squashTimer = 0;
    this.animTimer = Math.floor(Math.random() * 60);
    this.active = false;
    this.dying = false;
    this.deathAlpha = 1;
  }

  get stompable() { return true; }

  squash() {
    this.squashTimer = 30;
    this.vx = 0;
  }

  kill() {
    this.dead = true;
    this.dying = true;
    this.vy = -8;
    this.vx = this.vx < 0 ? -2 : 2;
  }

  update(solids, player) {
    if (this.dead && !this.dying) return;

    if (this.squashTimer > 0) {
      this.squashTimer--;
      if (this.squashTimer === 0) this.dead = true;
      return;
    }

    if (this.dying) {
      this.animTimer++;
      this.vy += GRAVITY;
      this.y += this.vy;
      this.x += this.vx;
      if (this.type === 'koffing') this.deathAlpha = Math.max(0, this.deathAlpha - 0.03);
      return;
    }

    this.animTimer++;

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 520) this.active = true;
      else return;
    }

    if (this.type === 'koffing') {
      // Koffing floats — only horizontal movement + bob
      this.x += this.vx;
      // Check wall collisions manually
      if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
      // Reverse when hitting a platform side
      for (const s of solids) {
        if (s.dead) continue;
        if (
          this.x < s.x + s.w && this.x + this.w > s.x &&
          this.y < s.y + s.h && this.y + this.h > s.y
        ) {
          this.vx = -this.vx;
          this.x += this.vx * 2;
          break;
        }
      }
      return;
    }

    // Ekans — walks on ground
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const prevVx = this.vx;
    const res = resolveCollisions(this, solids);
    const sp = 1.1;

    // If wall was hit (hitSide), reverse direction
    if (res.hitSide && prevVx !== 0) {
      this.vx = prevVx > 0 ? -sp : sp;
    }
    if (this.vx > 0) this.vx = sp; else if (this.vx < 0) this.vx = -sp;

  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.type === 'koffing') {
      this._drawKoffing(ctx, x, y, w, h);
    } else {
      this._drawEkans(ctx, x, y, w, h);
    }
  }

  _drawEkans(ctx, x, y, w, h) {
    if (this.squashTimer > 0) {
      // Flatten + X eyes
      const fh = 10;
      const fy = y + h - fh;
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(x, fy, w, fh);
      // X eyes
      ctx.strokeStyle = '#f44'; ctx.lineWidth = 2;
      for (const ex of [x + 4, x + w - 12]) {
        ctx.beginPath(); ctx.moveTo(ex, fy + 1); ctx.lineTo(ex + 7, fy + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 7, fy + 1); ctx.lineTo(ex, fy + 8); ctx.stroke();
      }
      return;
    }

    if (this.dying) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(this.animTimer * 0.2);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    // Body: purple oval / elongated shape
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.48, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck / head
    ctx.fillStyle = '#7d3c98';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.22, w * 0.3, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yellow slit eyes
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x + 7, y + h * 0.15, 5, 7);
    ctx.fillRect(x + w - 12, y + h * 0.15, 5, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 9, y + h * 0.16, 2, 6); // slit pupil
    ctx.fillRect(x + w - 10, y + h * 0.16, 2, 6);

    // Tongue flick (sine wave animation)
    const tongueOut = Math.sin(this.animTimer * 0.18) > 0.5;
    if (tongueOut) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.38);
      ctx.lineTo(x + w / 2, y + h * 0.48);
      ctx.moveTo(x + w / 2, y + h * 0.48);
      ctx.lineTo(x + w / 2 - 4, y + h * 0.54);
      ctx.moveTo(x + w / 2, y + h * 0.48);
      ctx.lineTo(x + w / 2 + 4, y + h * 0.54);
      ctx.stroke();
    }

    // Belly lighter
    ctx.fillStyle = '#c39bd3';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.28, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stub legs / slithers
    const wig = Math.floor(this.animTimer / 10) % 2;
    ctx.fillStyle = '#7d3c98';
    ctx.fillRect(x + (wig ? 4 : 8), y + h - 6, 7, 6);
    ctx.fillRect(x + w - (wig ? 11 : 15), y + h - 6, 7, 6);

    if (this.dying) ctx.restore();
  }

  _drawKoffing(ctx, x, y, w, h) {
    // Floating bob
    const bobY = Math.sin(this.animTimer * 0.06) * 4;
    const cx = x + w / 2;
    const cy = y + h / 2 + bobY;
    const r = w / 2;

    if (this.dying) {
      ctx.globalAlpha = this.deathAlpha;
      // Flash white
      const flash = Math.floor(this.animTimer / 4) % 2;
      if (flash) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
    }

    // Dark purple body
    ctx.fillStyle = '#6c3483';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Skull mark — eyes (two white circles)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();

    // Skull teeth
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx - 8 + i * 6, cy + 4, 4, 5);
    }

    // Toxic gas puffs around body
    ctx.fillStyle = 'rgba(160,80,200,0.5)';
    const puffPositions = [[-r * 0.7, -r * 0.5], [r * 0.7, -r * 0.4], [0, -r * 0.9]];
    for (const [dx, dy] of puffPositions) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy + bobY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
