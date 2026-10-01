import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';
import { shape, ell, poly, hilite, shadow } from './sprite-utils.js';

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

    // Persian palette — silver gray, cream belly, red forehead gem
    const SILVER = '#b8c0d0', DARK = '#7a8494', CREAM = '#ece4d4', GEM = '#e74c3c';
    const OL = '#2c3240';
    const look = this.vx < 0 ? -3 : 3;
    const cx = x + w / 2;

    // Contact shadow (vy is zeroed by resolveCollisions when grounded)
    if (this.vy === 0 && !this.defeated) shadow(ctx, cx, y + h + 2, w * 0.42, 4);

    // Tail (arched behind body) — outlined stroke
    ctx.lineCap = 'round';
    for (const [col, lw] of [[OL, 11], [SILVER, 8]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.85, y + h * 0.6);
      ctx.quadraticCurveTo(x + w + 30, y + h * 0.2, x + w + 10, y + h * 0.05);
      ctx.stroke();
    }
    ctx.strokeStyle = DARK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + w * 0.88, y + h * 0.62); ctx.quadraticCurveTo(x + w + 28, y + h * 0.24, x + w + 12, y + h * 0.1); ctx.stroke();
    ctx.lineWidth = 1;

    // Legs — alternate swing, outlined, cream paws
    const swing = Math.sin(this.anim * 0.12) * 3;
    for (const [lx, s] of [[0.14, 1], [0.36, -1], [0.56, 1], [0.76, -1]]) {
      const ly = y + h * 0.8 + swing * s;
      shape(ctx, () => { ctx.moveTo(x + w * lx, ly); ctx.lineTo(x + w * lx + 14, ly); ctx.lineTo(x + w * lx + 14, ly + 20); ctx.lineTo(x + w * lx, ly + 20); ctx.closePath(); },
            SILVER, OL, { sh: 0.78, dy: 6, lw: 1.5 });
      ell(ctx, x + w * lx + 7, ly + 19, 8, 3.5, 0, CREAM, OL, { sh: 0.86, lw: 1.3 });
    }

    // Body + belly
    ell(ctx, cx, y + h * 0.65, w * 0.46, h * 0.32, 0, SILVER, OL, { sh: 0.76, dy: 7 });
    ell(ctx, cx, y + h * 0.7, w * 0.28, h * 0.2, 0, CREAM, null, { sh: 0.9, dy: 3 });
    hilite(ctx, x + w * 0.3, y + h * 0.48, 10, 4);

    // Ears — pointed, pink inside
    poly(ctx, [x + w * 0.22 + look, y + h * 0.1, x + w * 0.08 + look, y - 10, x + w * 0.35 + look, y + h * 0.06], SILVER, OL);
    poly(ctx, [x + w * 0.72 + look, y + h * 0.1, x + w * 0.88 + look, y - 10, x + w * 0.62 + look, y + h * 0.06], SILVER, OL);
    poly(ctx, [x + w * 0.23 + look, y + h * 0.1, x + w * 0.14 + look, y - 4, x + w * 0.34 + look, y + h * 0.07], '#d4a0a0', null, { sh: 0 });
    poly(ctx, [x + w * 0.71 + look, y + h * 0.1, x + w * 0.80 + look, y - 4, x + w * 0.63 + look, y + h * 0.07], '#d4a0a0', null, { sh: 0 });

    // Head — large oval, muzzle
    ell(ctx, cx + look, y + h * 0.28, w * 0.36, h * 0.26, 0, SILVER, OL, { sh: 0.76, dy: 6 });
    hilite(ctx, x + w * 0.36 + look, y + h * 0.13, 8, 3.5);
    ell(ctx, cx + look, y + h * 0.4, w * 0.16, h * 0.1, 0, CREAM, null, { sh: 0.9, dy: 2 });

    // Gem on forehead
    poly(ctx, [cx + look, y + h * 0.05, cx - 7 + look, y + h * 0.14, cx + look, y + h * 0.2, cx + 7 + look, y + h * 0.14], GEM, OL, { sh: 0.7, lw: 1.3 });
    poly(ctx, [cx + look, y + h * 0.07, cx - 3 + look, y + h * 0.12, cx + 3 + look, y + h * 0.12], '#ff9999', null, { sh: 0 });

    // Eyes (slitted, regal)
    ell(ctx, x + w * 0.36 + look, y + h * 0.27, 6, 7, 0, '#6a5030', OL, { sh: 0, lw: 1.2 });
    ell(ctx, x + w * 0.64 + look, y + h * 0.27, 6, 7, 0, '#6a5030', OL, { sh: 0, lw: 1.2 });
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w * 0.36 + look - 1.5, y + h * 0.22, 3, 10);
    ctx.fillRect(x + w * 0.64 + look - 1.5, y + h * 0.22, 3, 10);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * 0.36 + look, y + h * 0.23, 2, 2);
    ctx.fillRect(x + w * 0.64 + look, y + h * 0.23, 2, 2);
    // Nose + mouth
    poly(ctx, [cx - 3 + look, y + h * 0.36, cx + 3 + look, y + h * 0.36, cx + look, y + h * 0.4], '#3a2a2a', null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + look, y + h * 0.4); ctx.lineTo(cx + look, y + h * 0.43);
    ctx.moveTo(cx - 5 + look, y + h * 0.45); ctx.quadraticCurveTo(cx + look, y + h * 0.48, cx + 5 + look, y + h * 0.45); ctx.stroke();

    // Whiskers
    ctx.strokeStyle = DARK; ctx.lineWidth = 1.5;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const wx = cx + look + side * 8;
        const wy = y + h * (0.36 + i * 0.04);
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + side * 24, wy + (i - 1) * 4);
        ctx.stroke();
      }
    }

    // HP pips
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      ell(ctx, cx - 20 + i * 20, y - 18, 7, 7, 0, i < this.hp ? '#e23636' : '#444', '#1a1a1a', { sh: 0.75, lw: 1.3 });
      if (i < this.hp) hilite(ctx, cx - 22 + i * 20, y - 20.5, 2.5, 1.3, 0.6);
    }
    ctx.globalAlpha = 1;
  }
}
