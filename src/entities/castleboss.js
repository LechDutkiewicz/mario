import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Castle boss — Charizard (fire-breathing dragon = Bowser equivalent)
// Defeated by: touching the axe at the far end, OR 5 fireball hits
export class CastleBoss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 72;
    this.h = 80;
    this.x = x;
    this.y = y - this.h;
    this.vx = -1.2;
    this.vy = 0;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.hp = 5;
    this.dead = false;
    this.defeated = false;
    this.hitFlash = 0;
    this.shootTimer = 90;
    this.anim = 0;
    this.active = false;
    this.deathTimer = 120;
  }

  get stompable() { return false; }

  takeHit() {
    if (this.hitFlash > 0 || this.defeated) return false;
    this.hp--;
    this.hitFlash = 60;
    if (this.hp <= 0) this._beginDefeat();
    return this.defeated;
  }

  defeatByAxe() {
    if (this.defeated) return;
    this.hp = 0;
    this._beginDefeat();
  }

  _beginDefeat() {
    this.defeated = true;
    this.deathTimer = 120;
    this.vx = 0;
    this.vy = -4;
  }

  update(solids, player, game) {
    if (this.dead) return;
    this.anim++;
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.defeated) {
      this.deathTimer--;
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.deathTimer <= 0) this.dead = true;
      return;
    }

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 700) this.active = true;
      else return;
    }

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    resolveCollisions(this, solids);

    if (this.x <= this.leftBound)  { this.x = this.leftBound;            this.vx =  Math.abs(this.vx); }
    if (this.x + this.w >= this.rightBound) { this.x = this.rightBound - this.w; this.vx = -Math.abs(this.vx); }

    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = 90 + Math.floor(Math.random() * 30);
      const dir = player.x < this.x ? -1 : 1;
      const sx = this.x + this.w / 2;
      const sy = this.y + this.h * 0.55;
      game.bossShots.push(new BossShot(sx, sy, dir * 4.5, 0));
      game.bossShots.push(new BossShot(sx, sy, dir * 3.5, -1.5));
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.hitFlash > 0 && Math.floor(this.hitFlash / 4) % 2) ctx.globalAlpha = 0.4;

    const facing = this.vx < 0 ? -1 : 1;
    const ORANGE = '#e8642a';
    const DARK   = '#9e3010';
    const CREAM  = '#f0c060';
    const WING   = '#c04020';

    // Wings
    ctx.fillStyle = WING;
    if (facing < 0) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.7, y + h * 0.15);
      ctx.lineTo(x + w + 28, y - 20);
      ctx.lineTo(x + w + 18, y + h * 0.35);
      ctx.lineTo(x + w * 0.75, y + h * 0.35);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + h * 0.15);
      ctx.lineTo(x - 28, y - 20);
      ctx.lineTo(x - 18, y + h * 0.35);
      ctx.lineTo(x + w * 0.25, y + h * 0.35);
      ctx.closePath(); ctx.fill();
    }

    // Body
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.66, w * 0.26, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.85, y + h * 0.75);
    ctx.quadraticCurveTo(x + w + 24, y + h * 0.85, x + w + 14, y + h * 0.65);
    ctx.stroke();
    // Tail flame
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.arc(x + w + 14, y + h * 0.63, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(x + w + 14, y + h * 0.63, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;

    // Head
    const hx = x + w / 2 + facing * 6;
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.ellipse(hx, y + h * 0.22, w * 0.35, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(hx + facing * 14, y + h * 0.26, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.moveTo(hx - 14, y + h * 0.06);
    ctx.lineTo(hx - 20, y - 14);
    ctx.lineTo(hx - 8, y + h * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 14, y + h * 0.06);
    ctx.lineTo(hx + 20, y - 14);
    ctx.lineTo(hx + 8, y + h * 0.06);
    ctx.closePath(); ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.ellipse(hx + facing * 8, y + h * 0.18, 7, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath();
    ctx.ellipse(hx + facing * 9, y + h * 0.18, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nostrils
    ctx.fillStyle = DARK;
    ctx.fillRect(hx + facing * 18, y + h * 0.25, 4, 3);
    ctx.fillRect(hx + facing * 13, y + h * 0.25, 4, 3);

    // Legs
    ctx.fillStyle = DARK;
    const sw = Math.sin(this.anim * 0.1) * 4;
    ctx.fillRect(x + w * 0.18, y + h * 0.82 + sw, 16, 18);
    ctx.fillRect(x + w * 0.54, y + h * 0.82 - sw, 16, 18);

    // HP pips above head
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < this.hp ? '#e03030' : '#444';
      ctx.beginPath();
      ctx.arc(x + w / 2 - 40 + i * 20, y - 16, 7, 0, Math.PI * 2);
      ctx.fill();
      if (i < this.hp) {
        ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 1.5;
        ctx.stroke(); ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;
  }
}

// The axe at the far end of the castle bridge — touch it to defeat the boss
export class BossAxe {
  constructor(x, y) {
    this.x = x;
    this.y = y - 32;
    this.w = 24;
    this.h = 32;
    this.taken = false;
    this.anim = 0;
  }

  update() { this.anim++; }

  draw(r, cam) {
    if (this.taken) return;
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x) + 12;
    const y = Math.floor(this.y) + Math.sin(this.anim * 0.08) * 4;

    // Handle
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 30);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Axe blade
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x - 10, y - 6);
    ctx.lineTo(x - 10, y + 10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x + 10, y - 6);
    ctx.lineTo(x + 10, y + 10);
    ctx.closePath(); ctx.fill();

    // Shine
    ctx.fillStyle = '#fffaaa';
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x - 4, y - 2);
    ctx.lineTo(x - 4, y + 6);
    ctx.closePath(); ctx.fill();
  }
}
