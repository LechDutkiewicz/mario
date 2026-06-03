import { GRAVITY, MAX_FALL_SPEED, GROUND_Y, TILE } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Castle boss — Charizard (Bowser equivalent)
// Defeated ONLY by touching the axe — fireballs/stomp do nothing
// Mechanics: walks left/right, jumps every ~3s, shoots one fireball LEFT every ~2s
export class CastleBoss {
  constructor(x, y, leftBound, rightBound) {
    this.w = 56;
    this.h = 60;
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

  // Called when player touches the Ultra Ball — starts catch sequence
  startCatch(ballX, ballY, bridgeX, bridgeW, bridgeY) {
    if (this.defeated) return;
    this.defeated  = true;
    this.catching  = true;    // phase 1: ball flies toward boss
    this.catchTimer = 0;
    this.catchBallX = ballX;
    this.catchBallY = ballY;
    this.catchTargetX = this.x + this.w / 2;
    this.catchTargetY = this.y + this.h / 2;
    this.vx = 0; this.vy = 0;
    this._bridgeX = bridgeX;
    this._bridgeW = bridgeW;
    this._bridgeY = bridgeY;
  }

  defeatByAxe(bridgeX, bridgeW) { this.startCatch(0, 0, bridgeX, bridgeW); }

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

    if (this.catching) {
      this.catchTimer++;
      const t = this.catchTimer;
      // Phase 1 (0-40): ball flies from ball position to boss center
      if (t < 40) {
        const prog = t / 40;
        this.catchBallX += (this.catchTargetX - this.catchBallX) * 0.12;
        this.catchBallY += (this.catchTargetY - this.catchBallY) * 0.12;
      }
      // Phase 2 (40-100): boss shrinks/flashes into ball
      // Phase 3 (100-160): ball wobbles 3 times on ground
      // Phase 4 (160): bridge collapses, boss gone
      if (t === 160) {
        this.catching = false;
        this._beginBridgeCollapse();
      }
      return;
    }

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

    // Draw catch animation
    if (this.catching) {
      const t = this.catchTimer;
      const bx = Math.floor(this.catchBallX - cam.x);
      const by = Math.floor(this.catchBallY);
      // Phase 1: flying ball
      if (t < 40) {
        _drawUltraBallShape(ctx, bx, by, 14);
      }
      // Phase 2 (40-100): boss shrinks while flashing, ball stays on boss
      if (t >= 40 && t < 100) {
        const scale = 1 - (t - 40) / 60;
        const bossX = Math.floor(this.x + this.w / 2 - cam.x);
        const bossY = Math.floor(this.y + this.h / 2);
        ctx.globalAlpha = scale;
        ctx.fillStyle = '#e8642a';
        ctx.beginPath();
        ctx.arc(bossX, bossY, 40 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        _drawUltraBallShape(ctx, bossX, bossY, 14);
      }
      // Phase 3 (100-160): ball wobbles on ground at boss x
      if (t >= 100) {
        const groundBallX = Math.floor(this.catchTargetX - cam.x);
        const wobble = Math.sin((t - 100) * 0.25) * 8 * Math.max(0, 1 - (t - 100) / 60);
        _drawUltraBallShape(ctx, groundBallX + wobble, GROUND_Y - 14, 14);
        // Exclamation marks
        if (t < 130) {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', groundBallX, GROUND_Y - 34);
          ctx.textAlign = 'left';
        }
      }
      return; // don't draw the boss normally during catch
    }

    if (this.dead) return;

    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    // Gengar — round ghost, dark purple, wide grin, red eyes
    const BODY  = '#6a3898';  // dark purple body
    const DARK  = '#3a1a60';  // deeper shadow
    const LIGHT = '#8858b8';  // highlight

    const cx = x + w / 2;
    const cy = y + h * 0.5;
    const bob = Math.sin(this.anim * 0.08) * 3; // gentle floating bob

    // Shadow under Gengar
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, y + h + 2, w * 0.4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Spiky back/ears (behind body)
    ctx.fillStyle = DARK;
    // Left ear spike
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, cy - h * 0.2 + bob);
    ctx.lineTo(cx - w * 0.48, cy - h * 0.56 + bob);
    ctx.lineTo(cx - w * 0.12, cy - h * 0.28 + bob);
    ctx.closePath(); ctx.fill();
    // Right ear spike
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.32, cy - h * 0.2 + bob);
    ctx.lineTo(cx + w * 0.48, cy - h * 0.56 + bob);
    ctx.lineTo(cx + w * 0.12, cy - h * 0.28 + bob);
    ctx.closePath(); ctx.fill();
    // Back spikes (jagged lower edge)
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
    // Body highlight
    ctx.fillStyle = LIGHT;
    ctx.beginPath(); ctx.ellipse(cx - w * 0.1, cy - h * 0.1 + bob, w * 0.18, h * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();

    // Stubby arms
    const aw = Math.sin(this.anim * 0.12) * 3;
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(cx - w * 0.5, cy + h * 0.05 + bob + aw, w * 0.15, h * 0.1, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.5, cy + h * 0.05 + bob - aw, w * 0.15, h * 0.1, -0.4, 0, Math.PI * 2); ctx.fill();
    // Claw nubs
    ctx.fillStyle = DARK;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(cx - w * 0.62 + i * 4, cy + h * 0.04 + bob + aw, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + w * 0.62 + i * 4, cy + h * 0.04 + bob - aw, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Red eyes — big, slightly angry tilt
    ctx.fillStyle = '#cc1010';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.17, cy - h * 0.1 + bob, 8, 9, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.17, cy - h * 0.1 + bob, 8, 9, -0.3, 0, Math.PI * 2); ctx.fill();
    // Eye highlights
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(cx - w * 0.19, cy - h * 0.14 + bob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + w * 0.15, cy - h * 0.14 + bob, 3, 0, Math.PI * 2); ctx.fill();
    // Pupils
    ctx.fillStyle = '#1a0808';
    ctx.beginPath(); ctx.ellipse(cx - w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Wide grinning mouth
    const mouthY = cy + h * 0.12 + bob;
    ctx.fillStyle = '#1a0828';
    ctx.beginPath();
    ctx.arc(cx, mouthY, w * 0.32, 0.1, Math.PI - 0.1);
    ctx.fill();
    // Teeth (pointed)
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

    // Tongue (pink, curling out of mouth)
    ctx.fillStyle = '#e04080';
    ctx.beginPath(); ctx.ellipse(cx + w * 0.08, mouthY + 6, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill();

    // Hint above boss
    if (!this.defeated) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GRAB THE ULTRA BALL!', x + w / 2, y - 10);
      ctx.textAlign = 'left';
    }
  }
}

// Helper — draws an Ultra Ball shape at (cx, cy) with radius r
function _drawUltraBallShape(ctx, cx, cy, r) {
  // Top half: black with yellow stripe
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(cx - r * 0.5, cy - r * 0.6, r, r * 0.25);

  // Bottom half: white
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();

  // Center line + button
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
}

// Ultra Ball — replaces the axe; touch it to trigger boss catch sequence
export class BossAxe {
  constructor(x, y) {
    this.x = x;
    this.y = y - 28;
    this.w = 28;
    this.h = 28;
    this.taken = false;
    this.anim = 0;
  }

  update() { this.anim++; }

  draw(r, cam) {
    if (this.taken) return;
    const ctx = r.ctx;
    const cx = Math.floor(this.x - cam.x) + this.w / 2;
    const bob = Math.sin(this.anim * 0.07) * 5;
    const cy = Math.floor(this.y) + bob + 14;
    const R  = 14;

    _drawUltraBallShape(ctx, cx, cy, R);

    // Pulsing glow
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(this.anim * 0.05)) * 0.25;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ULTRA', cx, cy - R - 4);
    ctx.fillText('BALL', cx, cy - R + 5);
    ctx.textAlign = 'left';
  }
}
