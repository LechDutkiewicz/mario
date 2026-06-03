import { GRAVITY, MAX_FALL_SPEED, GROUND_Y, TILE } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Castle boss — Charizard (Bowser equivalent)
// Defeated ONLY by touching the axe — fireballs/stomp do nothing
// Mechanics: walks left/right, jumps every ~3s, shoots one fireball LEFT every ~2s
export class CastleBoss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 72;
    this.h = 80;
    this.x = x;
    this.y = y - this.h;
    this.vx = -1.5;
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
    // Bridge collapse state
    this.bridgeCollapsing = false;
    this.bridgeSegments   = null; // filled on defeat
    this.deathTimer = 180;
  }

  get stompable() { return false; }

  defeatByAxe(bridgeX, bridgeW) {
    if (this.defeated) return;
    this.defeated = true;
    this.vx = 0;
    this.vy = 0;
    this.bridgeCollapsing = true;
    // Create falling bridge segment list
    const segCount = Math.ceil(bridgeW / TILE);
    this.bridgeSegments = Array.from({ length: segCount }, (_, i) => ({
      x: bridgeX + i * TILE,
      y: GROUND_Y,
      vy: 0,
      delay: i * 4,  // staggered collapse left→right
      gone: false,
    }));
  }

  update(solids, player, game) {
    if (this.dead) return;
    this.anim++;

    if (this.defeated) {
      // Wait for bridge to open, then fall
      this.deathTimer--;
      const allGone = !this.bridgeSegments ||
        this.bridgeSegments.every(s => s.gone);
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
      this.vy = -8;
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

    // Draw falling bridge segments (below the boss)
    if (this.bridgeSegments) {
      ctx.fillStyle = '#8b7355';
      for (const s of this.bridgeSegments) {
        if (s.gone) continue;
        const bx = Math.floor(s.x - cam.x);
        ctx.fillRect(bx, Math.floor(s.y), TILE, TILE / 4);
        ctx.strokeStyle = '#5a4830'; ctx.lineWidth = 1;
        ctx.strokeRect(bx, Math.floor(s.y), TILE, TILE / 4);
      }
    }

    if (this.dead) return;

    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    const facing = this.vx <= 0 ? -1 : 1;
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
    ctx.fillStyle = '#ff9900';
    ctx.beginPath(); ctx.arc(x + w + 14, y + h * 0.63, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath(); ctx.arc(x + w + 14, y + h * 0.63, 5, 0, Math.PI * 2); ctx.fill();
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
    ctx.moveTo(hx - 14, y + h * 0.06); ctx.lineTo(hx - 20, y - 14); ctx.lineTo(hx - 8, y + h * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 14, y + h * 0.06); ctx.lineTo(hx + 20, y - 14); ctx.lineTo(hx + 8, y + h * 0.06);
    ctx.closePath(); ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath(); ctx.ellipse(hx + facing * 8, y + h * 0.18, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath(); ctx.ellipse(hx + facing * 9, y + h * 0.18, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Nostrils
    ctx.fillStyle = DARK;
    ctx.fillRect(hx + facing * 18, y + h * 0.25, 4, 3);
    ctx.fillRect(hx + facing * 13, y + h * 0.25, 4, 3);

    // Legs
    ctx.fillStyle = DARK;
    const sw = Math.sin(this.anim * 0.1) * 4;
    ctx.fillRect(x + w * 0.18, y + h * 0.82 + sw, 16, 18);
    ctx.fillRect(x + w * 0.54, y + h * 0.82 - sw, 16, 18);

    // "Defeat with axe" hint — chain between boss and axe position
    if (!this.defeated) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GRAB THE AXE!', x + w / 2, y - 10);
      ctx.textAlign = 'left';
    }
  }
}

// The axe at the far end of the castle bridge — touching it defeats boss
export class BossAxe {
  constructor(x, y) {
    this.x = x;
    this.y = y - 36;
    this.w = 24;
    this.h = 36;
    this.taken = false;
    this.anim = 0;
  }

  update() { this.anim++; }

  draw(r, cam) {
    if (this.taken) return;
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x) + 12;
    const bob = Math.sin(this.anim * 0.08) * 4;
    const y = Math.floor(this.y) + bob;

    // Handle
    ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y + 34); ctx.lineTo(x, y + 8); ctx.stroke();
    ctx.lineWidth = 1;

    // Axe blade
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(x, y + 8); ctx.lineTo(x - 12, y - 6); ctx.lineTo(x - 12, y + 12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + 8); ctx.lineTo(x + 12, y - 6); ctx.lineTo(x + 12, y + 12);
    ctx.closePath(); ctx.fill();

    // Shine
    ctx.fillStyle = '#fffaaa';
    ctx.beginPath();
    ctx.moveTo(x, y + 6); ctx.lineTo(x - 5, y - 2); ctx.lineTo(x - 5, y + 8);
    ctx.closePath(); ctx.fill();

    // Glow pulse
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(this.anim * 0.05)) * 0.3;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(x, y + 4, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
