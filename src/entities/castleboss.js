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

    // Gengar — round purple ghost seen from the front: two big ears, a row of
    // spikes down each side, slanted red eyes and the ear-to-ear grin
    const bob = Math.sin(this.anim * 0.08) * 3;

    // Contact shadow stays put while the body bobs
    shadow(ctx, x + w / 2, y + h + 2, w * 0.42, 5);

    // The face stays front-on; facing only adds a subtle lean toward the player
    ctx.save();
    if (!this.lookleft) { ctx.translate(2 * x + w, 0); ctx.scale(-1, 1); }
    ctx.translate(x, y + h); ctx.transform(1, 0, -0.05, 1, 0, 0); ctx.translate(-x, -(y + h));
    this._drawGengar(ctx, x, y, w, h, bob);
    ctx.restore();
  }

  _drawGengar(ctx, x, y, w, h, bob) {
    const BODY = '#5d3f8f', DARK = '#3f2a66', OL = '#1c0f33';
    const RED = '#e0201c', PUPIL = '#9c0f0f', MOUTH = '#2a0f3a';
    const D = Math.PI / 180;
    const cx = x + w / 2;
    const cy = y + 35 + bob;             // body centre
    const rx = 24, ryT = 26, ryB = 21;   // near-round blob, flattened where it sits

    // Feet: stubby, three toes each (behind the body, bob damped)
    const fy = y + h - 3 + bob * 0.3;
    for (const side of [-1, 1]) {
      const fx = cx + side * 12;
      for (const t of [-1, 0, 1]) poly(ctx, [fx + t * 5 - 2.6, fy, fx + t * 5.5, fy + 4.5, fx + t * 5 + 2.6, fy], BODY, OL, { sh: 0, lw: 1.1 });
      ell(ctx, fx, fy - 1, 8, 4.5, 0, DARK, OL, { sh: 0.7, shade: BODY, dx: -1, dy: -2, lw: 1.4 });
    }

    // Body silhouette: blob + mirrored ears and side spikes (angles in degrees,
    // 0 = right, -90 = up; the left side is the exact mirror of the right)
    const ry = (a) => (Math.sin(a) > 0 ? ryB : ryT);
    const spike = (deg, len, hw) => {
      const a = deg * D, a0 = a - hw, a1 = a + hw;
      ctx.moveTo(cx + rx * Math.cos(a0), cy + ry(a0) * Math.sin(a0));
      ctx.lineTo(cx + (rx + len) * Math.cos(a), cy + (ry(a) + len) * Math.sin(a));
      ctx.lineTo(cx + rx * Math.cos(a1), cy + ry(a1) * Math.sin(a1));
      ctx.closePath();
    };
    shape(ctx, () => {
      ctx.ellipse(cx, cy, rx, ryT, 0, Math.PI, TAU);   // domed top half
      ctx.ellipse(cx, cy, rx, ryB, 0, 0, Math.PI);     // flatter bottom half
      ctx.closePath();
      for (const s of [1, -1]) {
        const m = (deg) => (s > 0 ? deg : 180 - deg);
        spike(m(-58), 16, 0.3);     // big ear, angled ~30° outward
        spike(m(-34), 9, 0.17);     // spikes running down the side/back
        spike(m(-13), 9, 0.16);
        spike(m(9), 8, 0.16);
        spike(m(32), 7, 0.15);
      }
    }, DARK, OL, { sh: 0.7, shade: BODY, dx: -3, dy: -5, lw: 1.6 });   // dark crescent stays bottom-right
    hilite(ctx, cx - 9, cy - 15, 7.5, 3.2, 0.22);

    // Arms: short, out to the sides and slightly raised, three claws each
    const aw = Math.sin(this.anim * 0.12) * 2;
    for (const side of [-1, 1]) {
      const by = cy + 7 + aw * side;                 // shoulder (just inside the body edge)
      const bx = cx + side * (rx - 3);
      const hx = cx + side * (rx + 9), hy = by - 5;  // hand
      // Claws first so their bases tuck under the hand
      for (let i = -1; i <= 1; i++) {
        const a = (side > 0 ? -25 : 205) * D + i * 34 * D;
        const px = hx - side * 1.5 + i * 0.6, py = hy + i * 2.2;
        poly(ctx, [px, py - 1.7, px + Math.cos(a) * 6.5, py + Math.sin(a) * 6.5, px, py + 1.7], DARK, OL, { sh: 0, lw: 1 });
      }
      poly(ctx, [bx, by - 4, hx, hy - 3.5, hx + side * 1.5, hy, hx, hy + 3.5, bx, by + 4], DARK, OL, { sh: 0.7, shade: BODY, dx: -side * 1.5, dy: -2, lw: 1.4 });
    }

    // Eyes: big red, slanted inward-down ("\ /"), darker inner pupil + glint, thick brows
    const ey = cy - 5;
    for (const side of [-1, 1]) {
      const ex = cx + side * 10.5;
      ell(ctx, ex, ey, 9, 5.2, -side * 0.5, RED, OL, { sh: 0, lw: 1.3 });
      ell(ctx, ex - side * 2, ey + 1.5, 3.2, 3.2, 0, PUPIL, null, { sh: 0 });
      hilite(ctx, ex - 3, ey - 1.6, 1.7, 1.1, 0.95);
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex + side * 9.5, ey - 7.5); ctx.lineTo(ex - side * 4.5, ey - 2); ctx.stroke();
    }

    // Mouth: the signature grin, nearly edge to edge, a wide U with a row of teeth
    const my = cy + 4, mw = 20;
    if (this.windup > 0) {
      // Closed smirk while winding up a flame
      ctx.strokeStyle = OL; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - mw, my - 3); ctx.quadraticCurveTo(cx, my + 6, cx + mw, my - 3); ctx.stroke();
      return;
    }
    const lipY = (t) => { const u = 1 - t; return u * u * (my - 3) + 2 * u * t * (my + 4) + t * t * (my - 3); };
    shape(ctx, () => {
      ctx.moveTo(cx - mw, my - 3);
      ctx.quadraticCurveTo(cx, my + 4, cx + mw, my - 3);
      ctx.quadraticCurveTo(cx, my + 27, cx - mw, my - 3);
      ctx.closePath();
    }, MOUTH, OL, { sh: 0, lw: 1.6 });
    // Row of small pointed teeth hanging from the upper lip
    ctx.fillStyle = '#f6f6f6';
    const n = 9;
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
