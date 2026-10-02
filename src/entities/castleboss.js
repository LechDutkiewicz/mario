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

    // Gengar — pear-shaped purple ghost seen from the front: two big ears with
    // a jagged fringe between them, angry red eyes and the wide toothy grin
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
    const BODY = '#7b5ea7', DARK = '#513c82', OL = '#2a1d4a';
    const RED = '#e8262a', RED2 = '#b8181f', MOUTH = '#1a1030', TOOTH = '#f4f4f8';
    const cx = x + w / 2;
    const T = y + 13 + bob;              // top of the head dome (ears rise above)
    const B = y + 53 + bob;              // bottom of the body (legs sit below)
    const LW = { sh: 0, lw: 1.6 };

    // Legs: short stubs under the body with three claw toes each (bob damped)
    const ly = y + 54 + bob * 0.3;
    for (const s of [-1, 1]) {
      const lx = cx + s * 11;
      for (const t of [-1, 0, 1]) {
        const tx = lx + t * 4 + s * 0.5;
        poly(ctx, [tx - 2.2, ly + 2.5, tx + t * 1.2 + s * 0.6, ly + 6.5, tx + 2.2, ly + 2.5], BODY, OL, { sh: 0, lw: 1.1 });
      }
      ell(ctx, lx, ly, 6.5, 5, 0, DARK, OL, { sh: 0.7, shade: BODY, dx: -s * 1.5, dy: -2.5, lw: 1.5 });
    }

    // Body silhouette: rounded pear (wider toward the bottom), two big pointed
    // ears at the top corners and a 4-spike fringe between them. Fill is the
    // shade colour; the lit body colour is the same path shifted up-left, so a
    // dark crescent stays along the right side and underside.
    shape(ctx, () => {
      ctx.moveTo(cx - 24, B - 7);
      ctx.bezierCurveTo(cx - 26.5, B - 22, cx - 24, T + 8, cx - 19.5, T + 8); // left flank up to the ear
      ctx.lineTo(cx - 22, T - 15);                                              // left ear tip
      ctx.lineTo(cx - 12, T + 1);
      for (const [fx, fy] of [[-9, -4], [-6, 1], [-3, -5], [0, 1], [3, -5], [6, 1], [9, -4], [12, 1]])
        ctx.lineTo(cx + fx, T + fy);                                            // fringe
      ctx.lineTo(cx + 22, T - 15);                                              // right ear tip
      ctx.lineTo(cx + 19.5, T + 8);
      ctx.bezierCurveTo(cx + 24, T + 8, cx + 26.5, B - 22, cx + 24, B - 7);   // right flank
      ctx.bezierCurveTo(cx + 24, B + 1, cx + 12, B, cx, B);                     // rounded, nearly flat seat
      ctx.bezierCurveTo(cx - 12, B, cx - 24, B + 1, cx - 24, B - 7);
      ctx.closePath();
    }, DARK, OL, { sh: 0.7, shade: BODY, dx: -3, dy: -4, lw: 1.6 });
    hilite(ctx, cx - 9, T + 9, 6.5, 2.8, 0.18);

    // Arms: short and stubby, hanging at the sides from about shoulder height,
    // three claw-points on each hand (claws first so their bases tuck under)
    const aw = Math.sin(this.anim * 0.12) * 2;
    for (const s of [-1, 1]) {
      const hy = B - 8 + aw * s;                      // hand bottom
      // Small shoulder tuft, tucked under the arm's outer edge
      poly(ctx, [cx + s * 21, T + 16.5, cx + s * 26.5, T + 12.5, cx + s * 25, T + 20], BODY, OL, LW);
      for (const i of [0, 1, 2]) {
        const px = cx + s * (21.5 + i * 3);
        poly(ctx, [px - 1.8, hy - 1, px + s * (i - 1) * 0.9, hy + 4, px + 1.8, hy - 1], DARK, OL, { sh: 0, lw: 1.1 });
      }
      poly(ctx, [cx + s * 15, T + 14, cx + s * 23, T + 18, cx + s * 27.5, hy - 3, cx + s * 21, hy, cx + s * 17.5, T + 24],
           DARK, OL, { sh: 0.7, shade: BODY, dx: -s * 2, dy: -2, lw: 1.5 });
    }

    // Eyes: bright red wedges, no sclera, inner corners pointing down toward the
    // nose; darker lower half + a small glint. Thick brows ride the top edge and
    // meet above the nose for the angry look.
    const ey = T + 14;
    for (const s of [-1, 1]) {
      const ex = cx + s * 10.5;
      const eyePath = () => {
        ctx.moveTo(ex + s * 8, ey - 4.5);
        ctx.lineTo(ex - s * 6, ey + 1);
        ctx.quadraticCurveTo(ex - s * 2, ey + 6.5, ex + s * 4, ey + 5);
        ctx.quadraticCurveTo(ex + s * 10, ey + 3, ex + s * 8, ey - 4.5);
        ctx.closePath();
      };
      shape(ctx, eyePath, RED, null, { sh: 0 });
      ctx.save(); ctx.beginPath(); eyePath(); ctx.clip();
      ctx.fillStyle = RED2; ctx.fillRect(ex - 12, ey + 1.6, 24, 8);
      ctx.restore();
      ell(ctx, ex + s * 0.5, ey + 2.2, 1.3, 1.3, 0, '#6e0a10', null, { sh: 0 });
      hilite(ctx, ex - 2.5, ey - 1.5 + s * 0.6, 1.6, 1.1, 0.95);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
      ctx.beginPath(); eyePath(); ctx.stroke();
    }
    ctx.strokeStyle = OL; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 19.5, ey - 6); ctx.lineTo(cx - 1.5, ey + 2.5);
    ctx.moveTo(cx + 19.5, ey - 6); ctx.lineTo(cx + 1.5, ey + 2.5);
    ctx.stroke();

    // Mouth: the signature grin, nearly ear to ear
    const my = T + 22, mw = 20;
    if (this.windup > 0) {
      // Closed smirk while winding up a flame
      ctx.strokeStyle = OL; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - mw, my - 3); ctx.quadraticCurveTo(cx, my + 5, cx + mw, my - 3); ctx.stroke();
      return;
    }
    const mouthPath = () => {
      ctx.moveTo(cx - mw, my - 3);
      ctx.quadraticCurveTo(cx, my + 4, cx + mw, my - 3);
      ctx.quadraticCurveTo(cx, my + 23, cx - mw, my - 3);
      ctx.closePath();
    };
    shape(ctx, mouthPath, MOUTH, OL, { sh: 0, lw: 1.6 });
    // Upper row of flat rectangular teeth hanging from the lip, thin dark gaps
    const lipY = (t) => { const u = 1 - t; return u * u * (my - 3) + 2 * u * t * (my + 4) + t * t * (my - 3); };
    ctx.save(); ctx.beginPath(); mouthPath(); ctx.clip();
    ctx.fillStyle = TOOTH;
    const n = 7, gap = 0.45;
    for (let i = 0; i < n; i++) {
      const x0 = cx - mw + 2 * mw * (i / n) + gap, x1 = cx - mw + 2 * mw * ((i + 1) / n) - gap;
      const t0 = (x0 - (cx - mw)) / (2 * mw), t1 = (x1 - (cx - mw)) / (2 * mw);
      const d = 6;
      ctx.beginPath();
      ctx.moveTo(x0, lipY(t0) - 1); ctx.lineTo(x1, lipY(t1) - 1);
      ctx.lineTo(x1, lipY(t1) + d); ctx.lineTo(x0, lipY(t0) + d);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // Re-ink the upper lip so the teeth tuck under it
    ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - mw, my - 3); ctx.quadraticCurveTo(cx, my + 4, cx + mw, my - 3); ctx.stroke();
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
