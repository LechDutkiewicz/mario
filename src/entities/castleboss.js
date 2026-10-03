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
    // The original round Gengar: a big purple ball with pointed ears, three
    // spikes under the body, stubby fists, big red eyes and a wide grin with
    // pointed teeth and a tongue. Same shapes and proportions as the first
    // version; what is new is the ink outline and the two-tone shading used
    // by every other sprite.
    const BODY = '#6a3898', DARK = '#3a1a60', LIGHT = '#8858b8', OL = '#1e0c38';
    const cx = x + w / 2;
    const cy = y + h * 0.5 + bob;
    const o = { shade: DARK, sh: 0.7, dx: -2, dy: -3, lw: 1.6 };

    // Ears and bottom spikes (behind the body)
    poly(ctx, [cx - w*0.32, cy - h*0.2, cx - w*0.48, cy - h*0.56, cx - w*0.12, cy - h*0.28], DARK, OL, { sh: 0, lw: 1.5 });
    poly(ctx, [cx + w*0.32, cy - h*0.2, cx + w*0.48, cy - h*0.56, cx + w*0.12, cy - h*0.28], DARK, OL, { sh: 0, lw: 1.5 });
    for (let i = -1; i <= 1; i++)
      poly(ctx, [cx + i*w*0.3 - 6, cy + h*0.46, cx + i*w*0.3, cy + h*0.3, cx + i*w*0.3 + 6, cy + h*0.46], DARK, OL, { sh: 0, lw: 1.4 });

    // Body: big sphere, lit from the upper left, with the soft highlight blob
    ell(ctx, cx, cy, w*0.46, h*0.42, 0, DARK, OL, { sh: 0.7, shade: BODY, dx: -3, dy: -4, lw: 1.7 });
    ell(ctx, cx - w*0.1, cy - h*0.1, w*0.18, h*0.14, -0.5, LIGHT, null, { sh: 0 });
    hilite(ctx, cx - w*0.2, cy - h*0.24, 5, 2.4, 0.22);

    // Stubby arms with three knuckles, bobbing up and down alternately
    const aw = Math.sin(this.anim * 0.12) * 3;
    for (const s of [-1, 1]) {
      const ay = cy + h*0.05 - s*aw;
      ell(ctx, cx + s*w*0.5, ay, w*0.15, h*0.1, s*0.4, BODY, OL, { shade: DARK, sh: 0.7, dx: -2, dy: -2, lw: 1.5 });
      for (let i = -1; i <= 1; i++)
        ell(ctx, cx + s*w*0.62 + i*4, ay - h*0.01, 3.2, 3.2, 0, DARK, null, { sh: 0 });
    }

    // Red eyes: tilted ovals, light glint, dark pupil
    for (const s of [-1, 1]) {
      const ex = cx + s*w*0.17, ey = cy - h*0.1;
      ell(ctx, ex, ey, 8, 9, s*0.3, '#cc1010', OL, { sh: 0.75, shade: '#8c0a0a', dy: 3, lw: 1.4 });
      ell(ctx, ex - 2, ey - 4, 3, 3, 0, '#ff4444', null, { sh: 0 });
      ell(ctx, ex, ey + 2, 4, 5, 0, '#1a0808', null, { sh: 0 });
    }

    // Mouth: closed smirk while winding up a flame, wide grin otherwise
    const mouthY = cy + h*0.12;
    if (this.windup > 0) {
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w*0.26, mouthY + 2);
      ctx.quadraticCurveTo(cx, mouthY + 6, cx + w*0.26, mouthY + 2);
      ctx.stroke();
      return;
    }
    const mouth = () => { ctx.arc(cx, mouthY, w*0.32, 0.1, Math.PI - 0.1); ctx.closePath(); };
    shape(ctx, mouth, '#1a0828', OL, { sh: 0, lw: 1.6 });
    // Pointed teeth hanging from the upper lip, then the tongue lolling out
    // over the lower lip like the original
    const toothW = (w*0.6) / 5;
    ctx.fillStyle = '#f0f0f0';
    for (let i = 0; i < 5; i++) {
      const tx = cx - w*0.3 + i*toothW;
      ctx.beginPath(); ctx.moveTo(tx, mouthY); ctx.lineTo(tx + toothW*0.5, mouthY + 7); ctx.lineTo(tx + toothW, mouthY); ctx.closePath(); ctx.fill();
    }
    ell(ctx, cx + w*0.08, mouthY + 6, 7, 5, 0.2, '#e04080', '#7a1a44', { sh: 0, lw: 1.2 });
    // Re-ink the lip over the teeth roots
    ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w*0.32 + 1, mouthY); ctx.lineTo(cx + w*0.32 - 1, mouthY); ctx.stroke();
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
