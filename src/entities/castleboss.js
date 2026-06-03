import { GRAVITY, MAX_FALL_SPEED, GROUND_Y, TILE } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Castle boss — Gengar (Bowser equivalent)
// Defeated by touching the axe (collapses bridge) OR 5 fireballs
// Mechanics: walks left/right, jumps every ~3s, shoots one fireball LEFT every ~2s
export class CastleBoss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 56;
    this.h = 60;
    this.x = x;
    this.y = y - this.h;
    this.vx = -1.0;
    this.vy = 0;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.dead = false;
    this.defeated = false;
    this.anim = 0;
    this.active = false;
    this.shootTimer = 100;
    this.jumpTimer  = 160;
    this.onGround   = false;
    this._hp = 5;
    // Bridge collapse state
    this.bridgeCollapsing = false;
    this.bridgeSegments   = null;
    this.deathTimer = 180;
  }

  get stompable() { return false; }

  // Returns true if this hit was the killing blow (fireballs — bridge stays intact)
  takeHit() {
    if (this.defeated) return false;
    this._hp--;
    if (this._hp <= 0) {
      this.defeated = true;
      this.bridgeCollapsing = true; // triggers fall physics; bridgeDestroyed=false → bridge stays
      this.bridgeDestroyed = false;
      this.deathTimer = 180;
      return true;
    }
    return false;
  }

  // Called when player touches the axe — collapses the bridge
  defeatByAxe(bridgeX, bridgeW, bridgeY) {
    if (this.defeated) return;
    this.defeated = true;
    this.bridgeDestroyed = true; // signal game.js to remove bridge from solids
    this._bridgeX = bridgeX;
    this._bridgeW = bridgeW;
    this._bridgeY = bridgeY;
    this._beginBridgeCollapse();
  }

  // Store bridge coords so takeHit() can reference them
  setBridgeCoords(bridgeX, bridgeW, bridgeY) {
    this._bridgeX = bridgeX;
    this._bridgeW = bridgeW;
    this._bridgeY = bridgeY;
  }

  _beginBridgeCollapse() {
    this.bridgeCollapsing = true;
    this.deathTimer = 180;
    const segCount = Math.ceil(this._bridgeW / TILE);
    this.bridgeSegments = Array.from({ length: segCount }, (_, i) => ({
      x: this._bridgeX + i * TILE,
      y: this._bridgeY ?? GROUND_Y,
      vy: 0,
      delay: i * 4,
      gone: false,
    }));
  }

  update(solids, player, game) {
    if (this.dead) return;
    this.anim++;

    if (this.bridgeCollapsing) {
      this.deathTimer--;
      const allGone = !this.bridgeSegments || this.bridgeSegments.every(s => s.gone);
      if (allGone || this.deathTimer < 120) {
        this.vy += GRAVITY * 1.5;
        this.y  += this.vy;
        if (this.y > GROUND_Y + 300) this.dead = true;
      }
      return;
    }

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 700) this.active = true;
      else return;
    }

    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;

    // Bounce off bridge bounds
    if (this.x <= this.leftBound)  { this.x = this.leftBound;            this.vx =  Math.abs(this.vx); }
    if (this.x + this.w >= this.rightBound) { this.x = this.rightBound - this.w; this.vx = -Math.abs(this.vx); }

    // Periodic jump
    this.jumpTimer--;
    if (this.jumpTimer <= 0 && this.onGround) {
      this.vy = -6.5;
      this.jumpTimer = 150 + Math.floor(Math.random() * 60);
    }

    // Shoot ONE fireball to the left every ~2 seconds
    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shootTimer = 110 + Math.floor(Math.random() * 40);
      const sx = this.x;
      const sy = this.y + this.h * 0.55;
      game.bossShots.push(new BossShot(sx, sy, -4.5, 0));
    }
  }

  updateBridge() {
    if (!this.bridgeSegments) return;
    for (const s of this.bridgeSegments) {
      if (s.gone) continue;
      if (s.delay > 0) { s.delay--; continue; }
      s.vy += GRAVITY * 0.6;
      s.y  += s.vy;
      if (s.y > GROUND_Y + 400) s.gone = true;
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;

    // Draw falling/standing bridge segments as wooden planks
    if (this.bridgeSegments) {
      for (const s of this.bridgeSegments) {
        if (s.gone) continue;
        const bx = Math.floor(s.x - cam.x);
        const by = Math.floor(s.y);
        const pw = TILE, ph = 10;
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(bx, by, pw, ph);
        ctx.fillStyle = '#a07820';
        ctx.fillRect(bx + 2, by + 1, pw - 4, 3);
        ctx.strokeStyle = '#5a4010'; ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, pw, ph);
      }
    }

    if (this.dead) return;

    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    // Gengar — round ghost, dark purple, wide grin, red eyes
    const BODY  = '#6a3898';
    const DARK  = '#3a1a60';
    const LIGHT = '#8858b8';

    const cx = x + w / 2;
    const cy = y + h * 0.5;
    const bob = Math.sin(this.anim * 0.08) * 3;

    // Shadow under Gengar
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, y + h + 2, w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Spiky back/ears (behind body)
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, cy - h * 0.2 + bob);
    ctx.lineTo(cx - w * 0.48, cy - h * 0.56 + bob);
    ctx.lineTo(cx - w * 0.12, cy - h * 0.28 + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.32, cy - h * 0.2 + bob);
    ctx.lineTo(cx + w * 0.48, cy - h * 0.56 + bob);
    ctx.lineTo(cx + w * 0.12, cy - h * 0.28 + bob);
    ctx.closePath(); ctx.fill();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * w * 0.3, cy + h * 0.32 + bob);
      ctx.lineTo(cx + i * w * 0.3 - 6, cy + h * 0.46 + bob);
      ctx.lineTo(cx + i * w * 0.3 + 6, cy + h * 0.46 + bob);
      ctx.closePath(); ctx.fill();
    }

    // Main body — big round sphere
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(cx, cy + bob, w * 0.46, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIGHT;
    ctx.beginPath(); ctx.ellipse(cx - w * 0.1, cy - h * 0.1 + bob, w * 0.18, h * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();

    // Stubby arms
    const aw = Math.sin(this.anim * 0.12) * 3;
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(cx - w * 0.5, cy + h * 0.05 + bob + aw, w * 0.15, h * 0.1, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.5, cy + h * 0.05 + bob - aw, w * 0.15, h * 0.1, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DARK;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(cx - w * 0.62 + i * 4, cy + h * 0.04 + bob + aw, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + w * 0.62 + i * 4, cy + h * 0.04 + bob - aw, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Red eyes
    ctx.fillStyle = '#cc1010';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.17, cy - h * 0.1 + bob, 8, 9, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.17, cy - h * 0.1 + bob, 8, 9, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(cx - w * 0.19, cy - h * 0.14 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + w * 0.15, cy - h * 0.14 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Wide grinning mouth
    const mouthY = cy + h * 0.12 + bob;
    ctx.fillStyle = '#1a0828';
    ctx.beginPath();
    ctx.arc(cx, mouthY, w * 0.32, 0.1, Math.PI - 0.1);
    ctx.fill();
    ctx.fillStyle = '#f0f0f0';
    const toothW = (w * 0.6) / 5;
    for (let i = 0; i < 5; i++) {
      const tx = cx - w * 0.3 + i * toothW;
      ctx.beginPath();
      ctx.moveTo(tx, mouthY);
      ctx.lineTo(tx + toothW * 0.5, mouthY + 7);
      ctx.lineTo(tx + toothW, mouthY);
      ctx.closePath(); ctx.fill();
    }

    // Tongue
    ctx.fillStyle = '#e04080';
    ctx.beginPath(); ctx.ellipse(cx + w * 0.08, mouthY + 6, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill();
  }
}

// Golden axe — player touches it to collapse the bridge
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
    const bob = Math.sin(this.anim * 0.07) * 4;
    const ax = Math.floor(this.x - cam.x);
    const ay = Math.floor(this.y) + bob;

    // Handle (dark brown vertical bar)
    ctx.fillStyle = '#6b3a10';
    ctx.fillRect(ax + 10, ay + 10, 5, 22);
    ctx.fillStyle = '#8b5520';
    ctx.fillRect(ax + 11, ay + 10, 2, 22);

    // Blade (golden, curved crescent shape)
    ctx.fillStyle = '#d4a000';
    ctx.beginPath();
    ctx.moveTo(ax + 12, ay + 4);
    ctx.bezierCurveTo(ax + 24, ay + 0, ax + 26, ay + 16, ax + 12, ay + 14);
    ctx.closePath();
    ctx.fill();

    // Blade highlight
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(ax + 13, ay + 6);
    ctx.bezierCurveTo(ax + 21, ay + 3, ax + 22, ay + 12, ax + 13, ay + 12);
    ctx.closePath();
    ctx.fill();

    // Blade outline
    ctx.strokeStyle = '#a07800';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax + 12, ay + 4);
    ctx.bezierCurveTo(ax + 24, ay + 0, ax + 26, ay + 16, ax + 12, ay + 14);
    ctx.closePath();
    ctx.stroke();
  }
}
