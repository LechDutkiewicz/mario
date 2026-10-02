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

    // Gengar — squat purple ghost, spiky crest, red slanted eyes, huge toothy grin
    const bob = Math.sin(this.anim * 0.08) * 3;

    // Contact shadow stays put while the body bobs
    shadow(ctx, x + w / 2, y + h + 2, w * 0.42, 5);

    // Drawn facing left; mirror when looking right
    ctx.save();
    if (!this.lookleft) { ctx.translate(2 * x + w, 0); ctx.scale(-1, 1); }
    this._drawGengar(ctx, x, y, w, h, bob);
    ctx.restore();
  }

  _drawGengar(ctx, x, y, w, h, bob) {
    const BODY = '#6b4aa0', DARK = '#4a2f78', OL = '#1e0c38';
    const RED = '#e01c1c', PUPIL = '#8a0a14';
    const cx = x + w / 2;
    const cy = y + h * 0.6 + bob;         // body centre
    const rx = w * 0.52, ry = h * 0.37;   // squat blob: wider than tall

    // Stubby tail (behind, low on the back)
    poly(ctx, [cx + rx * 0.7, cy + ry * 0.55, cx + rx + 6, cy + ry * 0.75, cx + rx * 0.76, cy + ry * 0.9], BODY, OL, { sh: 0.7, shade: DARK, dx: 2, dy: 2, lw: 1.4 });

    // Legs: short stubs with two toes each (behind the body, bob damped)
    const ly = y + h - 2 + bob * 0.3;
    for (const side of [-1, 1]) {
      const lx = cx + side * w * 0.24;
      ell(ctx, lx, ly - 1, 7.5, 4.5, 0, BODY, OL, { sh: 0.7, shade: DARK, dy: 2, lw: 1.4 });
      for (const t of [-1, 1]) poly(ctx, [lx + t * 4.5 - 3, ly + 1.5, lx + t * 5, ly + 6, lx + t * 4.5 + 2.5, ly + 1.5], BODY, OL, { sh: 0, lw: 1.1 });
    }

    // Body silhouette: blob + two big outward ears + spikes along the top and back
    const spike = (ang, len, hw) => {
      const a0 = ang - hw, a1 = ang + hw;
      ctx.moveTo(cx + rx * Math.cos(a0), cy + ry * Math.sin(a0));
      ctx.lineTo(cx + (rx + len) * Math.cos(ang), cy + (ry + len) * Math.sin(ang));
      ctx.lineTo(cx + rx * Math.cos(a1), cy + ry * Math.sin(a1));
      ctx.closePath();
    };
    const D = Math.PI / 180;
    shape(ctx, () => {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      spike(-122 * D, 19, 0.24);   // front ear
      spike(-58 * D, 19, 0.24);    // back ear
      spike(-100 * D, 8, 0.13);    // crest between the ears
      spike(-83 * D, 8, 0.13);
      spike(-28 * D, 9, 0.14);     // spikes down the back
      spike(-8 * D, 9, 0.14);
      spike(12 * D, 9, 0.14);
      spike(32 * D, 8, 0.14);
    }, BODY, OL, { sh: 0.7, shade: DARK, dx: 4, dy: 7, lw: 1.6 });
    hilite(ctx, cx - rx * 0.3, cy - ry * 0.55, 8, 3.5, 0.22);

    // Arms: stubby, raised out to the sides, three claws each
    const aw = Math.sin(this.anim * 0.12) * 2;
    for (const side of [-1, 1]) {
      const ax = cx + side * rx * 0.98, ay = cy - ry * 0.15 + aw * side;
      const tipx = ax + side * 6.5, tipy = ay - 3.5;
      // Three claws fanned up-and-out from the hand (base tucked under the hand)
      for (let i = 0; i < 3; i++) {
        const a = (side > 0 ? -70 + i * 32 : 250 - i * 32) * D;
        const px = -Math.sin(a) * 2, py = Math.cos(a) * 2;
        poly(ctx, [tipx + px, tipy + py, tipx + Math.cos(a) * 7, tipy + Math.sin(a) * 7, tipx - px, tipy - py], DARK, OL, { sh: 0, lw: 1 });
      }
      ell(ctx, ax, ay, 8, 5, side * 0.55, BODY, OL, { sh: 0.7, shade: DARK, dy: 2, lw: 1.4 });
    }

    // Eyes: red, slanted sharply down toward the nose, no sclera; dark pupil + glint
    const ey = cy - ry * 0.32;
    for (const side of [-1, 1]) {
      const ex = cx + side * w * 0.2;
      ell(ctx, ex, ey, 9.5, 5.5, -side * 0.42, RED, OL, { sh: 0, lw: 1.3 });
      ell(ctx, ex + side * 1.5, ey + 1.2, 3.4, 3.4, 0, PUPIL, null, { sh: 0 });
      hilite(ctx, ex - side * 4, ey - 1.6, 2.2, 1.3, 0.9);
      // Thick angry brow: outer-high to inner-low
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - side * 9, ey - 6.5); ctx.lineTo(ex + side * 7, ey - 1.2); ctx.stroke();
    }

    // Mouth: the signature grin, almost the whole face wide
    const my = cy + ry * 0.2;
    const mw = w * 0.4;
    if (this.windup > 0) {
      // Closed smirk while winding up a flame
      ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - mw, my - 2); ctx.quadraticCurveTo(cx, my + 6, cx + mw, my - 2); ctx.stroke();
      return;
    }
    const lipY = (t) => { const u = 1 - t; return u * u * (my - 1) + 2 * u * t * (my + 4) + t * t * (my - 1); };
    shape(ctx, () => {
      ctx.moveTo(cx - mw, my - 1);
      ctx.quadraticCurveTo(cx, my + 4, cx + mw, my - 1);
      ctx.quadraticCurveTo(cx, my + 24, cx - mw, my - 1);
      ctx.closePath();
    }, '#2a1040', OL, { sh: 0, lw: 1.6 });
    // Row of small pointed teeth hanging from the upper lip
    ctx.fillStyle = '#f6f6f6';
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
      const x0 = cx - mw + 2 * mw * t0, x1 = cx - mw + 2 * mw * t1;
      ctx.beginPath();
      ctx.moveTo(x0, lipY(t0) + 0.4); ctx.lineTo((x0 + x1) / 2, lipY(tm) + 4.2); ctx.lineTo(x1, lipY(t1) + 0.4);
      ctx.closePath(); ctx.fill();
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
