import { GRAVITY, MAX_FALL_SPEED, GROUND_Y, TILE } from '../constants.js';
import { TAU, shape, ell, poly, hilite, shadow } from './sprite-utils.js';
import { resolveCollisions } from '../physics.js';
import { BossShot } from './projectile.js';

// Castle boss — Gengar (Bowser equivalent)
// Defeated by touching the axe (collapses bridge) OR 5 fireballs
// Mechanics ported 1:1 from FSM Bowser:
// - moveBowser: sinusoidal drift while facing the player, chase when passed
// - bowserJumps: jump (yvel -1.4u) every 117 frames, gravity/2.8
// - bowserFires: three interleaved fire intervals (280/350/490 frames) with a
//   14-frame windup; each flame homes down to the player's height level
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
    this.onGround   = false;
    this._hp = 5;
    // FSM Bowser state
    this.lookleft   = true;
    this.counter    = -0.7;                 // phase of the sinusoidal drift
    this.jumpTimer  = 117;
    this.fireTimers = [280, 350, 490];      // three independent countdowns
    this.fireDelays = [280, 350, 490];
    this.windup     = 0;                    // frames until the pending flame fires
    this.windupTarget = 0;
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

    // FSM: Bowser gravity is gravity / 2.8 (floaty jumps)
    this.vy += GRAVITY / 2.8;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Face the player (FSM lookTowardPlayer)
    this.lookleft = player.x + player.w / 2 < this.x + this.w / 2;

    // FSM moveBowser: sinusoidal drift while looking left, chase right otherwise
    if (this.lookleft) {
      this.counter += 0.007;
      this.vx = Math.sin(Math.PI * this.counter) / 1.4;
    } else {
      this.vx = Math.min(this.vx + 0.07, 0.84);
    }

    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;

    // Stay on the bridge
    if (this.x <= this.leftBound)  this.x = this.leftBound;
    if (this.x + this.w >= this.rightBound) this.x = this.rightBound - this.w;

    // FSM bowserJumps: every 117 frames, only when resting and facing the player
    this.jumpTimer--;
    if (this.jumpTimer <= 0) {
      this.jumpTimer = 117;
      if (this.onGround && this.lookleft) {
        this.vy = -5.6;   // unitsize * -1.4
        this.onGround = false;
      }
    }

    // FSM bowserFires: three interleaved intervals — short bursts, longer gaps
    for (let i = 0; i < 3; i++) {
      this.fireTimers[i]--;
      if (this.fireTimers[i] <= 0) {
        this.fireTimers[i] = this.fireDelays[i];
        if (this.lookleft && this.windup <= 0) {
          this.windup = 14;   // mouth closes, flame comes 14 frames later
          // roundDigit(player.bottom, unitsizet8) — target level rounded to 32px
          this.windupTarget = Math.round((player.y + player.h) / 32) * 32;
        }
      }
    }
    if (this.windup > 0) {
      this.windup--;
      if (this.windup === 0) {
        // FSM: flame spawns at left - 32, top + 16, xvel -0.63u = -2.52
        game.bossShots.push(new BossShot(this.x - 32, this.y + 16, -2.52, 0, this.windupTarget));
      }
    }

    // FSM hard mode (worlds 6+): the boss also throws hammers/bones
    if (this.hard) {
      this.hammerTimer = (this.hammerTimer ?? 60) - 1;
      if (this.hammerTimer <= 0) {
        this.hammerTimer = 100;
        game.spawnBone(this.x + this.w / 2, this.y, this.lookleft ? -1 : 1);
      }
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
    const BODY  = '#6e3ca0';
    const DARK  = '#3a1a60';
    const OL    = '#1a0a30';

    const cx = x + w / 2;
    const cy = y + h * 0.5;
    const bob = Math.sin(this.anim * 0.08) * 3;

    // Shadow under Gengar
    shadow(ctx, cx, y + h + 2, w * 0.4, 5);

    // Spiky back/ears (behind body) + lower spikes
    poly(ctx, [cx - w * 0.32, cy - h * 0.2 + bob, cx - w * 0.5, cy - h * 0.58 + bob, cx - w * 0.1, cy - h * 0.3 + bob], BODY, OL, { sh: 0.72 });
    poly(ctx, [cx + w * 0.32, cy - h * 0.2 + bob, cx + w * 0.5, cy - h * 0.58 + bob, cx + w * 0.1, cy - h * 0.3 + bob], BODY, OL, { sh: 0.72 });
    for (let i = -1; i <= 1; i++) {
      poly(ctx, [cx + i * w * 0.3 - 7, cy + h * 0.3 + bob, cx + i * w * 0.3, cy + h * 0.5 + bob, cx + i * w * 0.3 + 7, cy + h * 0.3 + bob], BODY, OL, { sh: 0.72 });
    }
    // Stubby legs
    ell(ctx, cx - w * 0.22, y + h * 0.94 + bob * 0.3, 7, 4.5, 0, BODY, OL, { sh: 0.72, lw: 1.4 });
    ell(ctx, cx + w * 0.22, y + h * 0.94 + bob * 0.3, 7, 4.5, 0, BODY, OL, { sh: 0.72, lw: 1.4 });

    // Main body — big round sphere with scalloped head spikes on the silhouette
    shape(ctx, () => {
      ctx.ellipse(cx, cy + bob, w * 0.46, h * 0.42, 0, 0, TAU);
      for (const [sx, sy, tx, ty] of [[-0.22, -0.36, -0.3, -0.56], [0, -0.42, 0.02, -0.6], [0.22, -0.36, 0.3, -0.56]]) {
        ctx.moveTo(cx + sx * w - 6, cy + sy * h + bob + 2);
        ctx.lineTo(cx + tx * w, cy + ty * h + bob);
        ctx.lineTo(cx + sx * w + 6, cy + sy * h + bob + 2);
        ctx.closePath();
      }
    }, BODY, OL, { sh: 0.72, dy: 6, lw: 1.6 });
    hilite(ctx, cx - w * 0.18, cy - h * 0.2 + bob, 7, 3.5, 0.28);

    // Stubby arms with claws
    const aw = Math.sin(this.anim * 0.12) * 3;
    for (const side of [-1, 1]) {
      const ay = cy + h * 0.05 + bob + aw * -side;
      ell(ctx, cx + side * w * 0.5, ay, w * 0.15, h * 0.1, side * 0.4, BODY, OL, { sh: 0.72, lw: 1.4 });
      for (let i = -1; i <= 1; i++) {
        poly(ctx, [cx + side * w * 0.58 + i * 4, ay - 2, cx + side * w * 0.68 + i * 4, ay + i * 2, cx + side * w * 0.58 + i * 4, ay + 3], DARK, OL, { sh: 0, lw: 1 });
      }
    }

    // Red eyes — angled, with brows and glints
    ell(ctx, cx - w * 0.17, cy - h * 0.1 + bob, 8, 9, 0.3, '#d81818', OL, { sh: 0.7, lw: 1.3 });
    ell(ctx, cx + w * 0.17, cy - h * 0.1 + bob, 8, 9, -0.3, '#d81818', OL, { sh: 0.7, lw: 1.3 });
    ell(ctx, cx - w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, '#1a0808', null, { sh: 0 });
    ell(ctx, cx + w * 0.17, cy - h * 0.08 + bob, 4, 5, 0, '#1a0808', null, { sh: 0 });
    hilite(ctx, cx - w * 0.21, cy - h * 0.16 + bob, 2.4, 1.4, 0.8);
    hilite(ctx, cx + w * 0.13, cy - h * 0.16 + bob, 2.4, 1.4, 0.8);
    ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w * 0.3, cy - h * 0.26 + bob); ctx.lineTo(cx - w * 0.06, cy - h * 0.18 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + w * 0.3, cy - h * 0.26 + bob); ctx.lineTo(cx + w * 0.06, cy - h * 0.18 + bob); ctx.stroke();

    // Mouth — closed while winding up a flame (FSM "firing" class), wide grin otherwise
    const mouthY = cy + h * 0.12 + bob;
    if (this.windup > 0) {
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.26, mouthY + 2);
      ctx.quadraticCurveTo(cx, mouthY + 6, cx + w * 0.26, mouthY + 2);
      ctx.stroke();
    } else {
      shape(ctx, () => { ctx.arc(cx, mouthY, w * 0.32, 0.1, Math.PI - 0.1); ctx.closePath(); }, '#1a0828', OL, { sh: 0, lw: 1.5 });
      // Tongue
      ell(ctx, cx + w * 0.08, mouthY + 7, 7, 5, 0.2, '#e04080', '#7a1040', { sh: 0.8, lw: 1 });
      ctx.fillStyle = '#f4f4f4';
      const toothW = (w * 0.6) / 5;
      for (let i = 0; i < 5; i++) {
        const tx = cx - w * 0.3 + i * toothW;
        ctx.beginPath();
        ctx.moveTo(tx, mouthY);
        ctx.lineTo(tx + toothW * 0.5, mouthY + 7);
        ctx.lineTo(tx + toothW, mouthY);
        ctx.closePath(); ctx.fill();
      }
    }
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

    // Glow
    const glow = ctx.createRadialGradient(ax + 14, ay + 12, 2, ax + 14, ay + 12, 20);
    glow.addColorStop(0, 'rgba(255,220,80,0.4)'); glow.addColorStop(1, 'rgba(255,220,80,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ax + 14, ay + 12, 20, 0, TAU); ctx.fill();

    // Handle (dark brown vertical bar)
    shape(ctx, () => { ctx.rect(ax + 10, ay + 10, 5, 22); }, '#7a4414', '#2e1808', { sh: 0.7, dx: 2, dy: 0, lw: 1.3 });
    ctx.fillStyle = '#a06828'; ctx.fillRect(ax + 11, ay + 11, 1.5, 20);

    // Blade (golden, curved crescent shape)
    shape(ctx, () => {
      ctx.moveTo(ax + 12, ay + 4);
      ctx.bezierCurveTo(ax + 24, ay + 0, ax + 26, ay + 16, ax + 12, ay + 14);
      ctx.closePath();
    }, '#e0b020', '#5a3c00', { sh: 0.72, dy: 4, lw: 1.4 });
    hilite(ctx, ax + 17, ay + 6, 3.5, 1.5, 0.6);
  }
}
