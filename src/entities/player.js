import {
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED,
  PLAYER_ACCEL, PLAYER_RUN_ACCEL, FRICTION,
  JUMP_MAX_VY, JUMP_FRAMES_MAX, JUMP_MOD,
  PLAYER_SMALL_W, PLAYER_SMALL_H, PLAYER_BIG_W, PLAYER_BIG_H,
  INVINCIBLE_TIME, POWER, COLORS,
} from '../constants.js';
import { resolveCollisions, aabb } from '../physics.js';
import { drawCharmander } from './player-charmander.js';
import { drawPichu } from './player-pichu.js';
import { drawPiplup } from './player-piplup.js';
import { drawBulbasaur } from './player-bulbasaur.js';


// ── Sprite helpers (draw-only) ───────────────────────────────────────────────
// SNES-style 2-tone shading: every solid shape is filled with its base colour,
// then the same path shifted down (clipped to itself) is filled with a darker
// shade so the underside/back reads darker, then an ink outline is stroked.
const TAU = Math.PI * 2;
const _tintCache = new Map();
// darken (f < 1) or lighten toward white (f > 1) a '#rrggbb' colour; memoised
function tint(hex, f) {
  const k = hex + f;
  const hit = _tintCache.get(k);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => { const v = (n >> s) & 255; return Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)); };
  const out = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  _tintCache.set(k, out);
  return out;
}
// build: fn that adds the path (called up to 3×, no beginPath inside)
// o: { lw: outline width, sh: shade factor (0 = none), shade: explicit shade
//      colour, dy/dx: shade offset }
function shape(ctx, build, fill, ol, o) {
  const sh = o && o.sh !== undefined ? o.sh : 0.74;
  ctx.beginPath(); build(); ctx.fillStyle = fill; ctx.fill();
  if (sh && fill[0] === '#') {
    ctx.save(); ctx.clip();
    ctx.translate(o && o.dx !== undefined ? o.dx : -0.6, o && o.dy !== undefined ? o.dy : 2.4);
    ctx.beginPath(); build(); ctx.fillStyle = (o && o.shade) || tint(fill, sh); ctx.fill();
    ctx.restore();
  }
  if (ol) {
    ctx.beginPath(); build();
    ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
function ell(ctx, x, y, rx, ry, rot, fill, ol, o) {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, rot, 0, TAU), fill, ol, o);
}
function poly(ctx, pts, fill, ol, o) {
  shape(ctx, () => {
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }, fill, ol, o);
}
// soft specular highlight (small tilted ellipse, upper-left of a shape)
function hilite(ctx, x, y, rx, ry, a = 0.32) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.6, 0, TAU); ctx.fill();
}
const L = (a, b, t) => a + (b - a) * t;
// yellow band across an ear/limb triangle (ax,ay)-(bx,by) base, (tx,ty) tip
function band(ctx, ax, ay, bx, by, tx, ty, t0, t1, col) {
  poly(ctx, [L(ax, tx, t0), L(ay, ty, t0), L(bx, tx, t0), L(by, ty, t0),
             L(bx, tx, t1), L(by, ty, t1), L(ax, tx, t1), L(ay, ty, t1)], col, null, { sh: 0 });
}

export class Player {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.bumpsHidden = true;   // only the player reveals hidden blocks (physics.js)
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = PLAYER_SMALL_W;
    this.h = PLAYER_SMALL_H;
    this.facing = 1;
    this.onGround = false;
    this.power = POWER.SMALL;
    this.invincible = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.animTimer = 0;
    this.fireCooldown = 0;
    this.crouching = false;
    this.poleSliding = false;
    this.walkToPC = false;
    this.char = 'eevee';
    this.isJumping = false;
    this.jumpFrames = 0;
    this.underwater = false;   // set by game.js from level flag
    this.paddleFrames = 0;     // remaining frames of current swim stroke
    this.starTimer = 0;        // invincibility star frames remaining
  }

  get big() { return this.power !== POWER.SMALL; }

  _applySize() {
    const wasBig = this.h > PLAYER_SMALL_H;
    const big = this.big;
    if (big && !wasBig) {
      // grow: keep feet at same position
      const feet = this.y + this.h;
      this.w = PLAYER_BIG_W;
      this.h = PLAYER_BIG_H;
      this.y = feet - this.h;
    } else if (!big && wasBig) {
      const feet = this.y + this.h;
      this.w = PLAYER_SMALL_W;
      this.h = PLAYER_SMALL_H;
      this.y = feet - this.h;
    }
  }

  powerUp(kind) {
    // kind: 'candy' (Rare Candy → Umbreon) | 'firestone' (Fire Stone → Flareon)
    if (kind === 'candy' || kind === 'mushroom' || kind === 'grow') {
      if (this.power === POWER.SMALL) { this.power = POWER.BIG; this._applySize(); }
    } else if (kind === 'firestone' || kind === 'tm' || kind === 'flower' || kind === 'fire') {
      this.power = POWER.FIRE;
      this._applySize();
    }
  }

  // returns true if player died from this hit
  takeDamage() {
    if (this.invincible > 0 || this.starTimer > 0 || this.dead) return false;
    if (this.power === POWER.FIRE) {
      this.power = POWER.BIG;
      this.invincible = INVINCIBLE_TIME;
    } else if (this.power === POWER.BIG) {
      this.power = POWER.SMALL;
      this._applySize();
      this.invincible = INVINCIBLE_TIME;
    } else {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.dead = true;
    this.deathTimer = 90;
    this.vy = -12;
    this.vx = 0;
  }

  update(input, solids, game) {
    if (this.dead) {
      this.deathTimer--;
      this.vy += GRAVITY;
      this.y += this.vy;
      return;
    }
    if (this.poleSliding) {
      // game.js controls movement during slide
      if (this.invincible > 0) this.invincible--;
      return;
    }
    if (this.walkToPC) {
      // game.js controls movement while walking to Pokémon Center
      this.animTimer++;
      return;
    }

    if (this.invincible > 0) this.invincible--;
    if (this.starTimer > 0) this.starTimer--;
    if (this.fireCooldown > 0) this.fireCooldown--;
    this.animTimer++;

    // FSM-accurate movement: friction always applied, then accel added
    this.vx *= FRICTION;
    // FSM: no sprinting underwater
    const accel = (input.run && !this.underwater) ? PLAYER_RUN_ACCEL : PLAYER_ACCEL;
    const moving = input.left || input.right;
    if (input.left)  { this.vx -= accel; this.facing = -1; }
    if (input.right) { this.vx += accel; this.facing  =  1; }
    if (this.vx >  PLAYER_SPEED) this.vx =  PLAYER_SPEED;
    if (this.vx < -PLAYER_SPEED) this.vx = -PLAYER_SPEED;
    // FSM movePlayer: additive decel — 0.0007 while a key is held, 0.035 idle
    const decel = moving && !this.crouching ? 0.0007 : 0.035;
    if (this.vx > decel)       this.vx -= decel;
    else if (this.vx < -decel) this.vx += decel;
    else                       this.vx = 0;

    // Crouch (big only, on ground)
    const wantCrouch = input.down && this.big && this.onGround;
    if (wantCrouch && !this.crouching) {
      this.crouching = true;
      const feet = this.y + this.h;
      this.h = PLAYER_SMALL_H;
      this.y = feet - this.h;
      this.vx = 0;
    } else if (!wantCrouch && this.crouching) {
      const feet = this.y + this.h;
      const newY = feet - PLAYER_BIG_H;
      const testBox = { x: this.x, y: newY, w: this.w, h: PLAYER_BIG_H };
      const blocked = solids.some(s => !s.dead && aabb(testBox, s));
      if (!blocked) { this.crouching = false; this.y = newY; this.h = PLAYER_BIG_H; }
    }

    if (this.underwater) {
      // FSM swimming: each jump press is a paddle stroke — yvel held at
      // unitsize * -0.84 for up to 14 frames (triggers.js timer*14 clear),
      // allowed any time in the water, not only when resting.
      if (input.jumpPressed && !this.crouching) {
        this.paddleFrames = 14;
        this.onGround = false;
      }
      if (this.paddleFrames > 0 && input.jump) {
        this.vy = -3.36;   // unitsize * -0.84
        this.paddleFrames--;
      } else {
        this.paddleFrames = 0;
      }
      this.isJumping = this.paddleFrames > 0;
    } else {
      // FSM-accurate jump: continuous upward force applied each frame while holding jump
      // dy = unitsize / pow(++jumplev, jumpmod - 0.0014 * |xvel|)
      if (input.jumpPressed && this.onGround && !this.crouching) {
        this.isJumping = true;
        this.jumpFrames = 0;
        this.vy = 0;
        this.onGround = false;
      }
      if (this.isJumping) {
        if (!input.jump || (this.onGround && this.jumpFrames > 0) || this.vy > 0) {
          this.isJumping = false;
        } else if (this.jumpFrames < JUMP_FRAMES_MAX) {
          this.jumpFrames++;
          const exponent = JUMP_MOD - 0.0014 * Math.abs(this.vx);
          const dy = 4 / Math.pow(this.jumpFrames, exponent);
          this.vy -= dy;
          if (this.vy < JUMP_MAX_VY) this.vy = JUMP_MAX_VY;
        }
      }
    }

    // Gravity — FSM: underwater gravity is gravity / 2.8
    this.vy += this.underwater ? GRAVITY / 2.8 : GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Shoot flamethrower
    if (input.firePressed && this.power === POWER.FIRE && this.fireCooldown <= 0) {
      game.spawnFireball(this);
      this.fireCooldown = 20;
    }

    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;
    if (this.onGround) {
      this.isJumping = false;
      this.stompChain = 0;   // FSM jumpcount: consecutive-stomp ladder resets on landing
    }


    // FSM WaterBlock — the player cannot swim above the water surface.
    // FSM screen: floor at 416px with a 64px solid band at the top; our
    // ground sits at 540, so the surface maps to 540-416+64 = 188. This also
    // seals the gap over the end-of-level wall (its top is exactly at 188).
    if (this.underwater && this.y < 188) {
      this.y = 188;
      if (this.vy < 0) this.vy = 0;
    }

    for (const block of res.hitBelow) {
      if (block.onBump) game.onBlockBumped(block);
    }

    // Wider proximity bump check for Q-blocks when jumping up
    if (this.vy < 0) {
      for (const s of solids) {
        if (s.dead || s.used || s.hidden || !s.onBump || s.kind !== 'qblock') continue;
        const blockBottom = s.y + s.h;
        const playerTop = this.y;
        if (Math.abs(playerTop - blockBottom) < 10 &&
            this.x + this.w > s.x + 4 &&
            this.x < s.x + s.w - 4) {
          game.onBlockBumped(s);
        }
      }
    }

    if (this.y > 800) this.die();
    if (this.x < 0) { this.x = 0; this.vx = 0; }
  }

  // ── EEVEE (small, 28x32) ──────────────────────────────────────────────────
  _drawEevee(ctx, w, h) {
    const BODY = COLORS.eeveeBody, RUFF = COLORS.eeveeRuff, EAR_I = COLORS.eeveeEarIn, EYE = COLORS.eeveeEye;
    const OL = '#4a2a12', TIP = '#6a4020', RUFF_OL = '#a07840';
    const jumping = !this.onGround;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const wag = Math.abs(this.vx) > 0.3 ? Math.sin(this.animTimer * 0.4) * 0.12 : 0;
    const cx = w * 0.56;   // body/head centre, shifted right to leave room for the tail

    // Bushy tail — rises up behind the left of the body, cream tip on top
    ell(ctx, w*0.16, h*0.66, 5.5, 8.5, 0.55 + wag, BODY, OL);
    ell(ctx, w*0.07, h*0.46, 4.8, 4.4, 0.55 + wag, RUFF, RUFF_OL, { sh: 0.88 });

    // Legs
    if (jumping) {
      ell(ctx, cx - w*0.2, h*0.86, w*0.1, h*0.08, 0.3, BODY, OL, { lw: 1.3 });
      ell(ctx, cx + w*0.18, h*0.82, w*0.1, h*0.08, -0.3, BODY, OL, { lw: 1.3 });
    } else {
      ell(ctx, cx - w*(0.2 - step*0.07), h*0.9, w*0.1, h*0.1, 0, BODY, OL, { lw: 1.3 });
      ell(ctx, cx + w*(0.16 - step*0.07), h*0.9, w*0.1, h*0.1, 0, BODY, OL, { lw: 1.3 });
    }

    // Body
    ell(ctx, cx, h*0.76, w*0.36, h*0.2, 0, BODY, OL);

    // Fluffy ruff — scalloped cream collar around the neck
    const ruff = () => {
      ctx.ellipse(cx, h*0.5, w*0.41, h*0.14, 0, 0, TAU);
      for (const [bx, by, r] of [[cx - w*0.28, h*0.58, 4], [cx - w*0.1, h*0.63, 4.2], [cx + w*0.1, h*0.63, 4.2], [cx + w*0.28, h*0.58, 4]]) {
        ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU);
      }
    };
    shape(ctx, ruff, RUFF, null, { sh: 0.86, dy: 3 });
    // outline only the outer silhouette: stroke under-tufts first, then re-fill
    ctx.strokeStyle = RUFF_OL; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    ctx.beginPath(); ruff(); ctx.stroke();
    shape(ctx, ruff, RUFF, null, { sh: 0.86, dy: 3 });

    // Ears — long, tilted outward, dark tips, inner colour
    const tilt = jumping ? 0.06 : 0;
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, { lw: 1.3 });
      const mx = (ax + bx + tx) / 3, my = (ay + by + ty) / 3;
      poly(ctx, [L(mx, ax, 0.62), L(my, ay, 0.62), L(mx, tx, 0.7), L(my, ty, 0.7), L(mx, bx, 0.62), L(my, by, 0.62)], EAR_I, null, { sh: 0 });
      band(ctx, ax, ay, bx, by, tx, ty, 0.7, 1.0, TIP);
    };
    ear(cx - w*0.34, h*0.28, cx - w*0.1, h*0.12, cx - w*(0.46 - tilt), h*(-0.09));
    ear(cx + w*0.1, h*0.12, cx + w*0.34, h*0.28, cx + w*(0.46 - tilt), h*(-0.09));

    // Cheek tufts, then head
    poly(ctx, [cx - w*0.28, h*0.3, cx - w*0.46, h*0.4, cx - w*0.26, h*0.46], BODY, OL, { lw: 1.3 });
    poly(ctx, [cx + w*0.28, h*0.3, cx + w*0.46, h*0.4, cx + w*0.26, h*0.46], BODY, OL, { lw: 1.3 });
    ell(ctx, cx, h*0.31, w*0.35, h*0.21, 0, BODY, OL);
    hilite(ctx, cx - w*0.16, h*0.19, 3.2, 1.6);

    // Eyes — dark brown, with shine
    ell(ctx, cx - w*0.14, h*0.31, 2.4, 3.2, 0, EYE, null, { sh: 0 });
    ell(ctx, cx + w*0.14, h*0.31, 2.4, 3.2, 0, EYE, null, { sh: 0 });
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - w*0.14 - 1.6, h*0.265, 1.5, 1.5);
    ctx.fillRect(cx + w*0.14 - 1.6, h*0.265, 1.5, 1.5);
    // Nose + tiny mouth
    poly(ctx, [cx - w*0.04, h*0.4, cx + w*0.04, h*0.4, cx, h*0.45], EYE, null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, h*0.45); ctx.lineTo(cx, h*0.48); ctx.stroke();
  }

  // ── EEVEE crouching (28x32) ───────────────────────────────────────────────
  _drawCrouchEevee(ctx, w, h) {
    const BODY = COLORS.eeveeBody, RUFF = COLORS.eeveeRuff, EAR_I = COLORS.eeveeEarIn, EYE = COLORS.eeveeEye;
    const OL = '#4a2a12', TIP = '#6a4020', RUFF_OL = '#a07840';

    // Tail peeks out behind, low
    ell(ctx, w*0.14, h*0.74, 7, 4.6, -0.4, BODY, OL);
    ell(ctx, w*0.04, h*0.62, 4.2, 3.6, -0.4, RUFF, RUFF_OL, { sh: 0.9 });
    // Stub legs
    ell(ctx, w*0.3, h*0.92, w*0.11, h*0.08, 0, BODY, OL, { lw: 1.3 });
    ell(ctx, w*0.68, h*0.92, w*0.11, h*0.08, 0, BODY, OL, { lw: 1.3 });
    // Body
    ell(ctx, w*0.5, h*0.66, w*0.44, h*0.28, 0, BODY, OL);
    // Ruff
    ell(ctx, w*0.3, h*0.6, 3.6, 3.2, 0, RUFF, RUFF_OL, { sh: 0.9, lw: 1.2 });
    ell(ctx, w*0.5, h*0.63, 3.8, 3.4, 0, RUFF, RUFF_OL, { sh: 0.9, lw: 1.2 });
    ell(ctx, w*0.7, h*0.6, 3.6, 3.2, 0, RUFF, RUFF_OL, { sh: 0.9, lw: 1.2 });
    ell(ctx, w*0.5, h*0.5, w*0.44, h*0.14, 0, RUFF, RUFF_OL, { sh: 0.9 });
    // Flattened ears, swept sideways
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, { lw: 1.3 });
      const cx = (ax + bx + tx) / 3, cy = (ay + by + ty) / 3;
      poly(ctx, [L(cx, ax, 0.6), L(cy, ay, 0.6), L(cx, tx, 0.7), L(cy, ty, 0.7), L(cx, bx, 0.6), L(cy, by, 0.6)], EAR_I, null, { sh: 0 });
      band(ctx, ax, ay, bx, by, tx, ty, 0.72, 1.0, TIP);
    };
    ear(w*0.2, h*0.3, w*0.36, h*0.14, w*(-0.06), h*0.02);
    ear(w*0.64, h*0.14, w*0.8, h*0.3, w*1.06, h*0.02);
    // Head — wide and low
    ell(ctx, w*0.5, h*0.3, w*0.38, h*0.2, 0, BODY, OL);
    hilite(ctx, w*0.34, h*0.19, 3.2, 1.5);
    // Eyes
    ell(ctx, w*0.36, h*0.3, 2.4, 3, 0, EYE, null, { sh: 0 });
    ell(ctx, w*0.64, h*0.3, 2.4, 3, 0, EYE, null, { sh: 0 });
    ctx.fillStyle = '#fff';
    ctx.fillRect(w*0.345, h*0.26, 1.5, 1.5);
    ctx.fillRect(w*0.625, h*0.26, 1.5, 1.5);
    poly(ctx, [w*0.46, h*0.38, w*0.54, h*0.38, w*0.5, h*0.43], EYE, null, { sh: 0 });
  }

  // ── UMBREON (big, 32x56) ──────────────────────────────────────────────────
  // Front-facing like the small Eevee: sleek black-blue, long slim legs and
  // tall ears, yellow rings (outline on the forehead, bands on ears, upper
  // legs and tail), red eyes with a dark pupil.
  _drawUmbreon(ctx, w, h) {
    const BODY = '#1c1c38', SH = '#0c0c22', RING = '#ffe040', EYE = '#e02020', OL = '#06061a';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const jumping = !this.onGround;
    const moving = Math.abs(this.vx) > 0.3;
    const step = moving ? Math.floor(this.animTimer / 8) % 2 : 0;
    const sway = moving ? Math.sin(this.animTimer * 0.4) * 1.5 : 0;
    const cx = w * 0.54;

    // Tail — long and thin, rises behind the left shoulder; yellow ring near the tip
    const tail = () => {
      ctx.moveTo(cx - w*0.2, h*0.64);
      ctx.bezierCurveTo(w*0.0, h*0.62, w*(-0.1), h*0.44 + sway, w*0.08, h*0.28 + sway);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 6.6; ctx.beginPath(); tail(); ctx.stroke();
    ctx.strokeStyle = BODY; ctx.lineWidth = 4.2; ctx.beginPath(); tail(); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.setLineDash([0, 15, 4.5, 300]);
    ctx.strokeStyle = RING; ctx.lineWidth = 4.2; ctx.beginPath(); tail(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    // Legs — slim and long; a yellow band wraps each upper leg
    const leg = (x, top, len, rot, bandT) => {
      const ry = len / 2, y = top + ry;
      ell(ctx, x, y, 2.7, ry, rot, BODY, OL, oL);
      const d = ry * (1 - bandT * 2);                    // distance above centre
      ell(ctx, x + Math.sin(rot) * d, y - Math.cos(rot) * d, 3.1, 1.6, rot, RING, null, { sh: 0 });
    };
    if (jumping) {
      // tucked: hind legs drawn up under the belly, front legs angled back
      leg(cx - w*0.3, h*0.64, h*0.2, 0.55, 0.3);
      leg(cx + w*0.3, h*0.64, h*0.2, -0.55, 0.3);
    } else {
      leg(cx - w*0.29 - step*1.2, h*0.68, h*0.28, 0.1, 0.22);
      leg(cx + w*0.29 - (1 - step)*1.2, h*0.68, h*0.28, -0.1, 0.22);
    }

    // Body — slender chest, haunches at the sides
    ell(ctx, cx, h*0.62, w*0.3, h*0.2, 0, BODY, OL, o);
    ell(ctx, cx - w*0.23, h*0.68, w*0.11, h*0.1, 0.15, BODY, OL, oL);
    ell(ctx, cx + w*0.23, h*0.68, w*0.11, h*0.1, -0.15, BODY, OL, oL);
    hilite(ctx, cx - w*0.1, h*0.5, 3.4, 1.6, 0.14);
    hilite(ctx, cx - w*0.26, h*0.63, 2, 1, 0.14);
    hilite(ctx, cx + w*0.2, h*0.63, 2, 1, 0.14);

    // Front legs (in front of the body)
    if (jumping) {
      leg(cx - w*0.13, h*0.72, h*0.2, 0.25, 0.3);
      leg(cx + w*0.13, h*0.72, h*0.2, -0.25, 0.3);
    } else {
      leg(cx - w*0.13 + step*1.5, h*0.72 - step*1.5, h*0.27, 0, 0.26);
      leg(cx + w*0.13 - (1 - step)*1.5, h*0.72 - (1 - step)*1.5, h*0.27, 0, 0.26);
    }
    // Neck
    ell(ctx, cx, h*0.44, w*0.17, h*0.1, 0, BODY, null, o);

    // Ears — tall and pointed, swept back when jumping, yellow band on each
    const tilt = jumping ? 0.08 : 0;
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, oL);
      band(ctx, ax, ay, bx, by, tx, ty, 0.42, 0.6, RING);
    };
    ear(cx - w*0.3, h*0.24, cx - w*0.08, h*0.15, cx - w*(0.36 + tilt), h*(-0.07));
    ear(cx + w*0.08, h*0.15, cx + w*0.3, h*0.24, cx + w*(0.36 + tilt), h*(-0.07));

    // Head
    ell(ctx, cx, h*0.31, w*0.34, h*0.17, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.15, h*0.21, 3.2, 1.5, 0.2);
    // Forehead ring — outline only
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, h*0.21, 3.6, 2.6, 0, 0, TAU); ctx.stroke();

    // Eyes — red, dark pupil, glint
    for (const ex of [cx - w*0.15, cx + w*0.15]) {
      ell(ctx, ex, h*0.33, 2.7, 3.4, 0, EYE, null, { sh: 0 });
      ell(ctx, ex, h*0.335, 1.3, 2.2, 0, '#1a0008', null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.7, h*0.33 - 2.8, 1.5, 1.5);
    }
    // Nose + tiny mouth
    poly(ctx, [cx - w*0.04, h*0.42, cx + w*0.04, h*0.42, cx, h*0.46], OL, null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, h*0.46); ctx.lineTo(cx, h*0.485); ctx.stroke();
  }

  // ── UMBREON crouching (32x32, front view) ─────────────────────────────────
  _drawCrouchUmbreon(ctx, w, h) {
    const BODY = '#1c1c38', SH = '#0c0c22', RING = '#ffe040', EYE = '#e02020', OL = '#06061a';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };

    // Tail — thin, lying low behind the left side, ring near the tip
    const tail = () => {
      ctx.moveTo(w*0.3, h*0.72);
      ctx.bezierCurveTo(w*0.06, h*0.78, w*(-0.1), h*0.66, w*0.0, h*0.48);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 6.2; ctx.beginPath(); tail(); ctx.stroke();
    ctx.strokeStyle = BODY; ctx.lineWidth = 3.8; ctx.beginPath(); tail(); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.setLineDash([0, 11, 4, 300]);
    ctx.strokeStyle = RING; ctx.lineWidth = 3.8; ctx.beginPath(); tail(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    // Folded legs with bands
    ell(ctx, w*0.3, h*0.9, 3.4, h*0.1, 0.2, BODY, OL, oL);
    ell(ctx, w*0.7, h*0.9, 3.4, h*0.1, -0.2, BODY, OL, oL);
    ell(ctx, w*0.3, h*0.86, 3.6, 1.6, 0.2, RING, null, { sh: 0 });
    ell(ctx, w*0.7, h*0.86, 3.6, 1.6, -0.2, RING, null, { sh: 0 });

    // Body — wide and flat, haunch rings on both sides
    ell(ctx, w*0.5, h*0.66, w*0.44, h*0.27, 0, BODY, OL, o);
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.16, h*0.7, 2.6, 3.4, 0.2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*0.84, h*0.7, 2.6, 3.4, -0.2, 0, TAU); ctx.stroke();

    // Ears — flattened sideways, banded
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, oL);
      band(ctx, ax, ay, bx, by, tx, ty, 0.42, 0.62, RING);
    };
    ear(w*0.2, h*0.3, w*0.38, h*0.14, w*(-0.1), h*0.02);
    ear(w*0.62, h*0.14, w*0.8, h*0.3, w*1.1, h*0.02);

    // Head — low and wide
    ell(ctx, w*0.5, h*0.32, w*0.38, h*0.2, 0, BODY, OL, o);
    hilite(ctx, w*0.34, h*0.21, 3.2, 1.5, 0.2);
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.2, 3.6, 2.4, 0, 0, TAU); ctx.stroke();

    // Eyes — red, dark pupil, glint
    for (const ex of [w*0.36, w*0.64]) {
      ell(ctx, ex, h*0.34, 2.7, 3.2, 0, EYE, null, { sh: 0 });
      ell(ctx, ex, h*0.345, 1.3, 2.1, 0, '#1a0008', null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.7, h*0.34 - 2.7, 1.5, 1.5);
    }
    poly(ctx, [w*0.46, h*0.43, w*0.54, h*0.43, w*0.5, h*0.48], OL, null, { sh: 0 });
  }

  // ── FLAREON (big, 32x56) ──────────────────────────────────────────────────
  // Fluffy orange-red Eevee: big cream ruff, cream head tuft and a huge cream
  // tail, pointed ears with dark inner, stubby legs.
  _drawFlareon(ctx, w, h) {
    const BODY = '#f0702a', SH = '#c84a14', CREAM = '#fff1cc', TAIL = '#f8e2a8', EAR_I = '#5a2210', EYE = '#2a1a0a';
    const OL = '#6a2808', CREAM_OL = '#c09a60';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const jumping = !this.onGround;
    const moving = Math.abs(this.vx) > 0.3;
    const step = moving ? Math.floor(this.animTimer / 8) % 2 : 0;
    const wag = moving ? Math.sin(this.animTimer * 0.4) * 0.12 : 0;
    const cx = w * 0.56;

    // scalloped cream fluff: fill, stroke the silhouette, re-fill so only the
    // outer edge keeps its outline (same trick as the Eevee ruff)
    const fluff = (build, col = CREAM) => {
      shape(ctx, build, col, null, { sh: 0.88, dy: 3 });
      ctx.strokeStyle = CREAM_OL; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
      ctx.beginPath(); build(); ctx.stroke();
      shape(ctx, build, col, null, { sh: 0.88, dy: 3 });
    };

    // Tail — big fluffy plume rising behind the left shoulder, clear of the ruff
    const tr = 0.42 + wag, tx = w*0.06, ty = h*0.5;
    fluff(() => {
      ctx.ellipse(tx, ty, 5.5, 13, tr, 0, TAU);
      for (const [dx, dy, r] of [[-5, -10, 3.8], [1, -13.5, 4], [6, -9, 3.4], [-5.5, 0, 3.2], [-3, 8, 3]]) {
        const px = tx + dx * Math.cos(tr) - dy * Math.sin(tr), py = ty + dy * Math.cos(tr) + dx * Math.sin(tr);
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
      }
    }, TAIL);

    // Stubby legs
    if (jumping) {
      ell(ctx, cx - w*0.2, h*0.88, w*0.11, h*0.065, 0.35, BODY, OL, oL);
      ell(ctx, cx + w*0.2, h*0.86, w*0.11, h*0.065, -0.35, BODY, OL, oL);
    } else {
      ell(ctx, cx - w*(0.2 - step*0.06), h*0.93, w*0.11, h*0.065, 0, BODY, OL, oL);
      ell(ctx, cx + w*(0.18 - step*0.06), h*0.93, w*0.11, h*0.065, 0, BODY, OL, oL);
    }

    // Body — round and fluffy
    ell(ctx, cx, h*0.76, w*0.37, h*0.19, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.14, h*0.7, 3, 1.4, 0.18);

    // Big ruff — scalloped cream collar
    fluff(() => {
      ctx.ellipse(cx, h*0.52, w*0.42, h*0.13, 0, 0, TAU);
      for (const [bx, by, r] of [[cx - w*0.32, h*0.58, 4], [cx - w*0.16, h*0.64, 4.4], [cx, h*0.66, 4.4], [cx + w*0.16, h*0.64, 4.4], [cx + w*0.32, h*0.58, 4]]) {
        ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU);
      }
    });

    // Ears — pointed, dark inner, tilt back when jumping
    const tilt = jumping ? 0.08 : 0;
    const ear = (ax, ay, bx, by, tx2, ty2) => {
      poly(ctx, [ax, ay, tx2, ty2, bx, by], BODY, OL, oL);
      const mx = (ax + bx + tx2) / 3, my = (ay + by + ty2) / 3;
      poly(ctx, [L(mx, ax, 0.58), L(my, ay, 0.58), L(mx, tx2, 0.72), L(my, ty2, 0.72), L(mx, bx, 0.58), L(my, by, 0.58)], EAR_I, null, { sh: 0 });
    };
    ear(cx - w*0.32, h*0.27, cx - w*0.08, h*0.14, cx - w*(0.4 + tilt), h*(-0.06));
    ear(cx + w*0.08, h*0.14, cx + w*0.32, h*0.27, cx + w*(0.4 + tilt), h*(-0.06));

    // Head
    ell(ctx, cx, h*0.33, w*0.36, h*0.19, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.23, 3.2, 1.6);
    // Cream head tuft on the forehead
    fluff(() => {
      ctx.ellipse(cx, h*0.15, w*0.2, h*0.055, 0, 0, TAU);
      for (const [bx, by, r] of [[cx - w*0.14, h*0.12, 3.4], [cx, h*0.09, 3.9], [cx + w*0.14, h*0.12, 3.4]]) {
        ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU);
      }
    });

    // Eyes — dark, with shine (same as Eevee)
    for (const ex of [cx - w*0.15, cx + w*0.15]) {
      ell(ctx, ex, h*0.34, 2.5, 3.3, 0, EYE, null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.6, h*0.34 - 2.6, 1.5, 1.5);
    }
    // Nose + tiny mouth
    poly(ctx, [cx - w*0.04, h*0.43, cx + w*0.04, h*0.43, cx, h*0.47], EYE, null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, h*0.47); ctx.lineTo(cx, h*0.495); ctx.stroke();
  }

  // ── FLAREON crouching (32x32, front view) ─────────────────────────────────
  _drawCrouchFlareon(ctx, w, h) {
    const BODY = '#f0702a', SH = '#c84a14', CREAM = '#fff1cc', EAR_I = '#5a2210', EYE = '#2a1a0a';
    const OL = '#6a2808', CREAM_OL = '#c09a60';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const fluff = (build, col = CREAM) => {
      shape(ctx, build, col, null, { sh: 0.88, dy: 2.5 });
      ctx.strokeStyle = CREAM_OL; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
      ctx.beginPath(); build(); ctx.stroke();
      shape(ctx, build, col, null, { sh: 0.88, dy: 2.5 });
    };

    // Tail — fluffy plume lying low behind the left side
    fluff(() => {
      ctx.ellipse(w*0.12, h*0.7, 8.5, 5, -0.35, 0, TAU);
      for (const [px, py, r] of [[w*(-0.02), h*0.56, 3.6], [w*0.1, h*0.5, 3.4], [w*(-0.08), h*0.72, 3.2]]) {
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
      }
    }, '#f8e2a8');
    // Stub legs
    ell(ctx, w*0.3, h*0.92, w*0.11, h*0.08, 0, BODY, OL, oL);
    ell(ctx, w*0.7, h*0.92, w*0.11, h*0.08, 0, BODY, OL, oL);
    // Body
    ell(ctx, w*0.5, h*0.68, w*0.44, h*0.27, 0, BODY, OL, o);
    // Ruff
    fluff(() => {
      ctx.ellipse(w*0.5, h*0.52, w*0.46, h*0.13, 0, 0, TAU);
      for (const [bx, by, r] of [[w*0.22, h*0.6, 3.6], [w*0.5, h*0.64, 3.8], [w*0.78, h*0.6, 3.6]]) {
        ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU);
      }
    });
    // Flattened ears, dark inner
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, oL);
      const mx = (ax + bx + tx) / 3, my = (ay + by + ty) / 3;
      poly(ctx, [L(mx, ax, 0.58), L(my, ay, 0.58), L(mx, tx, 0.72), L(my, ty, 0.72), L(mx, bx, 0.58), L(my, by, 0.58)], EAR_I, null, { sh: 0 });
    };
    ear(w*0.2, h*0.3, w*0.38, h*0.14, w*(-0.1), h*0.02);
    ear(w*0.62, h*0.14, w*0.8, h*0.3, w*1.1, h*0.02);
    // Head — wide and low
    ell(ctx, w*0.5, h*0.32, w*0.38, h*0.2, 0, BODY, OL, o);
    hilite(ctx, w*0.34, h*0.21, 3.2, 1.5);
    // Head tuft
    fluff(() => {
      ctx.ellipse(w*0.5, h*0.15, w*0.18, h*0.06, 0, 0, TAU);
      for (const [bx, by, r] of [[w*0.38, h*0.12, 3], [w*0.5, h*0.09, 3.4], [w*0.62, h*0.12, 3]]) {
        ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU);
      }
    });
    // Eyes
    for (const ex of [w*0.36, w*0.64]) {
      ell(ctx, ex, h*0.34, 2.5, 3.1, 0, EYE, null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.6, h*0.34 - 2.5, 1.5, 1.5);
    }
    poly(ctx, [w*0.46, h*0.43, w*0.54, h*0.43, w*0.5, h*0.48], EYE, null, { sh: 0 });
  }
  draw(r, cam) {
    if (this.dead && this.deathTimer < 60 && Math.floor(this.deathTimer / 4) % 2) return;
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2) return;

    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const w = this.w;
    const h = this.h;

    ctx.save();
    // Star power — rainbow hue cycling (faster in the final 2 seconds);
    // cleared automatically by ctx.restore()
    if (this.starTimer > 0) {
      const fast = this.starTimer < 120;
      ctx.filter = `hue-rotate(${(this.animTimer * (fast ? 60 : 25)) % 360}deg) saturate(1.8) brightness(1.15)`;
    }
    if (this.facing < 0) {
      ctx.translate(sx + w, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }

    // Soft contact shadow under the feet so the sprite sits on the ground
    if (this.onGround && !this.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(w * 0.5, h + 1, w * 0.42, 2.6, 0, 0, TAU); ctx.fill();
    }

    // Use the power-based flag: while crouching the hitbox shrinks to
    // PLAYER_SMALL_H, so a height test would wrongly report "small" and
    // fall through to the small-Eevee sprite
    const big = this.big;

    // Dispatch to character family
    if (this.char === 'charmander')     drawCharmander(this, ctx, w, h);
    else if (this.char === 'piplup')    drawPiplup(this, ctx, w, h);
    else if (this.char === 'pichu')     drawPichu(this, ctx, w, h);
    else if (this.char === 'bulbasaur') drawBulbasaur(this, ctx, w, h);
    // default: eevee family
    else if (big && !this.crouching)    (this.power === POWER.FIRE ? this._drawFlareon(ctx, w, h) : this._drawUmbreon(ctx, w, h));
    else if (big && this.crouching)     (this.power === POWER.FIRE ? this._drawCrouchFlareon(ctx, w, h) : this._drawCrouchUmbreon(ctx, w, h));
    else if (this.crouching)            this._drawCrouchEevee(ctx, w, h);
    else                                this._drawEevee(ctx, w, h);

    ctx.restore();
  }
}
