import {
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED,
  PLAYER_ACCEL, PLAYER_RUN_ACCEL, FRICTION,
  JUMP_MAX_VY, JUMP_FRAMES_MAX, JUMP_MOD,
  PLAYER_SMALL_W, PLAYER_SMALL_H, PLAYER_BIG_W, PLAYER_BIG_H,
  INVINCIBLE_TIME, POWER, COLORS,
} from '../constants.js';
import { resolveCollisions, aabb } from '../physics.js';


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
        if (s.dead || s.used || !s.onBump || s.kind !== 'qblock') continue;
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

  // ── UMBREON (big, 32x56; tera = Flareon-slot with crystal) ───────────────
  _drawUmbreon(ctx, w, h, isTera = false) {
    const BODY = '#26264c', SH = '#14142e', RING = '#ffe040', EYE = '#e02020', OL = '#07071a';
    const o = { shade: SH };
    const jumping = !this.onGround;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;

    // Tail — thick, curls up behind the back; yellow band near the tip.
    // All tail points stay inside the sprite box (left edge overdraw ≤ 3px).
    const tail = () => {
      ctx.moveTo(w*0.26, h*0.58);
      ctx.bezierCurveTo(w*0.02, h*0.58, w*(-0.04), h*0.36, w*0.08, h*0.22);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 9.5; ctx.beginPath(); tail(); ctx.stroke();
    ctx.strokeStyle = BODY; ctx.lineWidth = 7; ctx.beginPath(); tail(); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.setLineDash([0, 15, 5.5, 300]);
    ctx.strokeStyle = RING; ctx.lineWidth = 7; ctx.beginPath(); tail(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';

    // Hind legs (back pair)
    const hly = h * 0.84;
    ell(ctx, w*(0.2 + step*0.04), hly, w*0.1, h*0.11, 0.1, BODY, OL, o);
    ell(ctx, w*(0.36 - step*0.04), hly, w*0.1, h*0.11, -0.1, BODY, OL, o);

    // Body
    ell(ctx, w*0.44, h*0.6, w*0.38, h*0.23, 0, BODY, OL, o);
    // Thigh ring on the rear haunch
    ctx.strokeStyle = RING; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(w*0.22, h*0.66, 3.6, 4.2, 0.2, 0, TAU); ctx.stroke();

    // Front legs with rings
    const fl1 = w*(0.62 + step*0.04), fl2 = w*(0.78 - step*0.04);
    ell(ctx, fl1, hly, w*0.1, h*0.11, 0.1, BODY, OL, o);
    ell(ctx, fl2, hly, w*0.1, h*0.11, -0.1, BODY, OL, o);
    ell(ctx, fl1, hly - 2.5, 2.9, 1.8, 0.1, RING, null, { sh: 0 });
    ell(ctx, fl2, hly - 2.5, 2.9, 1.8, -0.1, RING, null, { sh: 0 });

    // Neck
    ell(ctx, w*0.66, h*0.44, w*0.16, h*0.1, 0, BODY, null, o);

    // Ears — tall, with yellow bands
    const tilt = jumping ? 0.05 : 0;
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, { lw: 1.3, shade: SH });
      band(ctx, ax, ay, bx, by, tx, ty, 0.38, 0.6, RING);
    };
    ear(w*0.58, h*0.22, w*0.74, h*0.16, w*(0.52 + tilt), h*(-0.04));
    ear(w*0.8, h*0.16, w*0.94, h*0.22, w*(0.96 - tilt), h*(-0.04));

    // Head
    ell(ctx, w*0.75, h*0.3, w*0.23, h*0.17, 0, BODY, OL, o);
    hilite(ctx, w*0.66, h*0.24, 2.8, 1.4, 0.22);
    // Forehead ring
    ctx.strokeStyle = RING; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(w*0.74, h*0.19, 4.2, 2.2, 0, 0, TAU); ctx.stroke();

    // Eye — red, narrow pupil, shine
    ell(ctx, w*0.86, h*0.3, 3, 3.4, 0, EYE, null, { sh: 0 });
    ctx.fillStyle = '#300';
    ctx.fillRect(w*0.86 - 0.7, h*0.3 - 2, 1.4, 4);
    ctx.fillStyle = '#ffb0b0'; ctx.fillRect(w*0.845, h*0.265, 1.5, 1.5);
    // Nose
    ctx.fillStyle = OL; ctx.fillRect(w*0.95, h*0.32, 1.6, 1.4);

    // Tera crystal — purple gem on forehead, only in POWER.FIRE form
    if (isTera) {
      const cx = w * 0.74, cy = h * 0.08;
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
      glow.addColorStop(0, 'rgba(200,120,255,0.75)');
      glow.addColorStop(1, 'rgba(120,0,200,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(cx, cy, 12, 12, 0, 0, TAU); ctx.fill();

      const R = 7, r = 4.5;
      ctx.beginPath();
      ctx.moveTo(cx,     cy - R);
      ctx.lineTo(cx + r, cy - R*0.5);
      ctx.lineTo(cx + r, cy + R*0.5);
      ctx.lineTo(cx,     cy + R);
      ctx.lineTo(cx - r, cy + R*0.5);
      ctx.lineTo(cx - r, cy - R*0.5);
      ctx.closePath();
      const grad = ctx.createLinearGradient(cx - r, cy - R, cx + r, cy + R);
      grad.addColorStop(0,   '#f0c0ff');
      grad.addColorStop(0.3, '#b040e0');
      grad.addColorStop(0.7, '#7010b0');
      grad.addColorStop(1,   '#3a0060');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#2a0048'; ctx.lineWidth = 1.3; ctx.stroke();

      ctx.fillStyle = 'rgba(240,200,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(cx,     cy - R);
      ctx.lineTo(cx + r, cy - R*0.5);
      ctx.lineTo(cx,     cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ── UMBREON crouching (32x32, front view) ─────────────────────────────────
  _drawCrouchUmbreon(ctx, w, h) {
    const BODY = '#26264c', SH = '#14142e', RING = '#ffe040', EYE = '#e02020', OL = '#07071a';
    const o = { shade: SH };

    // Stub legs with rings
    ell(ctx, w*0.26, h*0.9, w*0.11, h*0.1, 0, BODY, OL, o);
    ell(ctx, w*0.74, h*0.9, w*0.11, h*0.1, 0, BODY, OL, o);
    ell(ctx, w*0.26, h*0.86, 3, 1.6, 0, RING, null, { sh: 0 });
    ell(ctx, w*0.74, h*0.86, 3, 1.6, 0, RING, null, { sh: 0 });

    // Body — wide and flat
    ell(ctx, w*0.5, h*0.64, w*0.46, h*0.3, 0, BODY, OL, o);
    // Haunch rings on both sides
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.18, h*0.7, 3, 3.6, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*0.82, h*0.7, 3, 3.6, 0, 0, TAU); ctx.stroke();

    // Ears — flattened outward, banded
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, { lw: 1.3, shade: SH });
      band(ctx, ax, ay, bx, by, tx, ty, 0.4, 0.62, RING);
    };
    ear(w*0.2, h*0.26, w*0.4, h*0.14, w*0.06, h*(-0.06));
    ear(w*0.6, h*0.14, w*0.8, h*0.26, w*0.94, h*(-0.06));

    // Head — low and wide
    ell(ctx, w*0.5, h*0.34, w*0.36, h*0.22, 0, BODY, OL, o);
    hilite(ctx, w*0.36, h*0.22, 3, 1.5, 0.22);
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.2, 4, 2, 0, 0, TAU); ctx.stroke();

    // Red eyes
    ell(ctx, w*0.36, h*0.34, 3.2, 3.6, 0, EYE, null, { sh: 0 });
    ell(ctx, w*0.64, h*0.34, 3.2, 3.6, 0, EYE, null, { sh: 0 });
    ctx.fillStyle = '#300';
    ctx.fillRect(w*0.36 - 0.7, h*0.34 - 2.2, 1.4, 4.4);
    ctx.fillRect(w*0.64 - 0.7, h*0.34 - 2.2, 1.4, 4.4);
    ctx.fillStyle = '#ffb0b0';
    ctx.fillRect(w*0.34, h*0.29, 1.5, 1.5);
    ctx.fillRect(w*0.62, h*0.29, 1.5, 1.5);
    ctx.fillStyle = OL; ctx.fillRect(w*0.5 - 1, h*0.43, 2, 1.5);
  }
  _drawCharmander(ctx, w, h) {
    const pw    = this.power;
    const step  = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const flick = Math.sin(this.animTimer * 0.28) * 1.2;

    // Tail flame — layered teardrop, flickers; outer layer inked
    const flame = (fx, fy, s) => {
      ell(ctx, fx, fy, s*3.2, s*6.5+flick*s*0.7, 0, '#c83000', '#6a1400', { sh: 0, lw: 1.2 });
      ctx.fillStyle = '#ff5500';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*2.2, s*2.2, s*4.6+flick*s*0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*3.8, s*1.3, s*2.8+flick*s*0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffee88';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*5.0, s*0.65, s*1.5, 0, 0, TAU); ctx.fill();
    };
    // Tail: inked stroke under a coloured stroke
    const tailStroke = (build, col, ol, lw) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = ol; ctx.lineWidth = lw + 2.6; ctx.beginPath(); build(); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); build(); ctx.stroke();
    };

    if (pw === POWER.SMALL) {
      // ── CHARMANDER ── round orange lizard, big head, tail flame
      const C = '#f8933c', CREAM = '#f8e0a0', OL = '#6a2a08';

      tailStroke(() => { ctx.moveTo(w*0.26, h*0.72); ctx.quadraticCurveTo(w*(-0.04), h*0.72, w*0.02, h*0.44); }, C, OL, 5);
      flame(w*0.02, h*0.36, 0.9);

      ell(ctx, w*0.5, h*0.70, w*0.34, h*0.25, 0, C, OL);
      ell(ctx, w*0.58, h*0.74, w*0.2, h*0.16, 0.1, CREAM, null, { sh: 0.9, dy: 3 });

      ell(ctx, w*(0.34+step*0.05), h*0.94, w*0.12, h*0.06, 0, C, OL, { lw: 1.2 });
      ell(ctx, w*(0.66-step*0.05), h*0.94, w*0.12, h*0.06, 0, C, OL, { lw: 1.2 });

      ell(ctx, w*0.78, h*0.64, w*0.08, h*0.06, 0.4, C, OL, { lw: 1.2 });
      ell(ctx, w*0.24, h*0.64, w*0.08, h*0.06, -0.4, C, OL, { lw: 1.2 });

      ell(ctx, w*0.54, h*0.34, w*0.39, h*0.27, 0, C, OL);
      hilite(ctx, w*0.36, h*0.2, 3.5, 1.8);

      const eye = (ex) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex, h*0.30, 3.6, 4.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a6ad8';
        ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.31, 2.3, 3.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.315, 1.3, 1.9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 0.6, h*0.272, 1.6, 1.6);
      };
      eye(w*0.40);
      eye(w*0.68);

      ctx.fillStyle = OL;
      ctx.fillRect(w*0.51, h*0.40, 1.3, 1.3);
      ctx.fillRect(w*0.58, h*0.40, 1.3, 1.3);

      ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.34, h*0.45);
      ctx.quadraticCurveTo(w*0.54, h*0.525, w*0.76, h*0.44);
      ctx.stroke();

    } else if (pw === POWER.BIG) {
      // ── CHARMELEON ── crimson, upright, single backward horn, fierce
      const C = '#e04828', D = '#a82808', CREAM = '#f8e0a0', CLAW = '#f0f0d0', OL = '#4a1008';

      tailStroke(() => { ctx.moveTo(w*0.30, h*0.72); ctx.quadraticCurveTo(w*(-0.08), h*0.74, w*(-0.02), h*0.40); }, C, OL, 7);
      flame(w*(-0.02), h*0.32, 1.1);

      ell(ctx, w*(0.36+step*0.05), h*0.90, w*0.13, h*0.09, 0, C, OL, { lw: 1.3 });
      ell(ctx, w*(0.66-step*0.05), h*0.90, w*0.13, h*0.09, 0, C, OL, { lw: 1.3 });
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.38+step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.60-step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.68-step*0.05), h*0.955, 2, 3);

      ell(ctx, w*0.5, h*0.62, w*0.32, h*0.30, 0, C, OL);
      ell(ctx, w*0.58, h*0.66, w*0.19, h*0.22, 0.05, CREAM, null, { sh: 0.9, dy: 3 });

      ell(ctx, w*0.80, h*0.58, w*0.09, h*0.06, 0.5, C, OL, { lw: 1.1 });
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.86, h*0.615, 2, 3.5);
      ctx.fillRect(w*0.90, h*0.60, 2, 3.5);

      ell(ctx, w*0.56, h*0.26, w*0.30, h*0.17, 0, C, OL);
      hilite(ctx, w*0.44, h*0.18, 3, 1.5);

      poly(ctx, [w*0.38, h*0.155, w*0.12, h*0.035, w*0.30, h*0.21], D, OL, { lw: 1.2 });

      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(w*0.70, h*0.235, 4, 4.5, 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(w*0.715, h*0.245, 1.8, 2.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.62, h*0.185); ctx.lineTo(w*0.78, h*0.20); ctx.stroke();

      ctx.fillStyle = OL;
      ctx.fillRect(w*0.82, h*0.27, 1.8, 1.8);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.335); ctx.lineTo(w*0.84, h*0.32); ctx.stroke();

    } else {
      // ── CHARIZARD ── bipedal orange dragon; angular teal wings drawn with
      // straight polygon edges (never beziers), long neck, backward horns
      const C = '#f08030', D = '#c85810', CREAM = '#f8e0a0', CLAW = '#f0f0d0', OL = '#5a2408';
      const WING_D = '#175840', WING_L = '#2a9460', WING_OL = '#082818';

      tailStroke(() => { ctx.moveTo(w*0.32, h*0.78); ctx.quadraticCurveTo(w*(-0.02), h*0.84, w*(-0.06), h*0.62); }, C, OL, 6);
      flame(w*(-0.06), h*0.54, 1.0);

      const wing = (ox, oy, fill) => {
        poly(ctx, [
          w*(0.46+ox), h*(0.42+oy),   // shoulder root
          w*(0.02+ox), h*(0.02+oy),   // apex (top tip)
          w*(0.16+ox), h*(0.22+oy),   // notch
          w*(-0.08+ox), h*(0.20+oy),  // fingertip 2
          w*(0.13+ox), h*(0.35+oy),   // notch
          w*(-0.04+ox), h*(0.44+oy),  // fingertip 3
          w*(0.34+ox), h*(0.54+oy),   // membrane back to body
        ], fill, WING_OL, { lw: 1.3, sh: 0.8, dy: 3 });
        ctx.strokeStyle = '#0e3826'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w*(0.46+ox), h*(0.42+oy));
        ctx.lineTo(w*(0.02+ox), h*(0.02+oy));
        ctx.stroke();
      };
      wing(0.14, -0.05, WING_D);   // far wing
      wing(0,     0,    WING_L);   // near wing

      ell(ctx, w*(0.36+step*0.05), h*0.90, w*0.14, h*0.09, 0, C, OL, { lw: 1.4 });
      ell(ctx, w*(0.68-step*0.05), h*0.90, w*0.14, h*0.09, 0, C, OL, { lw: 1.4 });
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.39+step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.62-step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.71-step*0.05), h*0.955, 2.5, 3.5);

      ell(ctx, w*0.52, h*0.64, w*0.33, h*0.26, 0.08, C, OL);
      ell(ctx, w*0.60, h*0.68, w*0.19, h*0.19, 0.08, CREAM, null, { sh: 0.9, dy: 3 });
      ctx.strokeStyle = '#d8b870'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.46, h*0.62); ctx.lineTo(w*0.76, h*0.60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.45, h*0.70); ctx.lineTo(w*0.77, h*0.68); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.47, h*0.78); ctx.lineTo(w*0.75, h*0.76); ctx.stroke();

      ell(ctx, w*0.82, h*0.56, w*0.09, h*0.055, 0.5, C, OL, { lw: 1.1 });
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.88, h*0.585, 2, 3.5);
      ctx.fillRect(w*0.92, h*0.57, 2, 3.5);

      ell(ctx, w*0.62, h*0.38, w*0.13, h*0.12, -0.35, C, OL, { lw: 1.4 });

      ell(ctx, w*0.64, h*0.22, w*0.20, h*0.13, 0, C, OL);
      poly(ctx, [w*0.76, h*0.16, w*0.97, h*0.19, w*0.97, h*0.26, w*0.76, h*0.29], C, OL, { lw: 1.3 });
      hilite(ctx, w*0.56, h*0.16, 2.6, 1.3);
      ctx.fillStyle = OL;
      ctx.fillRect(w*0.925, h*0.205, 1.8, 1.8);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(w*0.78, h*0.265); ctx.lineTo(w*0.95, h*0.245); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(w*0.88, h*0.25); ctx.lineTo(w*0.895, h*0.29); ctx.lineTo(w*0.91, h*0.248);
      ctx.closePath(); ctx.fill();

      poly(ctx, [w*0.56, h*0.135, w*0.34, h*0.005, w*0.49, h*0.175], D, OL, { lw: 1.1 });
      poly(ctx, [w*0.66, h*0.125, w*0.50, h*(-0.035), w*0.585, h*0.15], D, OL, { lw: 1.1 });

      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.195, 3.2, 3.8, 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#1a6ad8';
      ctx.beginPath(); ctx.ellipse(w*0.73, h*0.20, 1.7, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(w*0.73, h*0.205, 0.9, 1.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.65, h*0.15); ctx.lineTo(w*0.79, h*0.165); ctx.stroke();
    }
  }
  _drawPiplup(ctx, w, h) {
    const pw   = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;

    const eye = (ex, ey, r, iris, OL) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, r, r + 0.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      if (iris) { ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 0.5, r*0.55, r*0.62, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 0.6, r*0.4, r*0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(ex, ey - r*0.6, 1.5, 1.5);
    };

    if (pw === POWER.SMALL) {
      // Piplup — small round blue penguin
      const NAVY = '#1840a0', LIGHT = '#80c8f0', BEAK = '#f0a020', OL = '#0a1848';

      ell(ctx, w*0.5, h*0.62, w*0.34, h*0.3, 0, NAVY, OL);
      ell(ctx, w*0.62, h*0.64, w*0.2, h*0.22, 0.1, LIGHT, null, { sh: 0.86, dy: 3 });

      ell(ctx, w*0.66, h*0.32, w*0.24, h*0.24, 0, NAVY, OL);
      ell(ctx, w*0.72, h*0.34, w*0.14, h*0.16, 0.1, LIGHT, null, { sh: 0.86 });
      hilite(ctx, w*0.54, h*0.2, 2.8, 1.5);

      ell(ctx, w*(0.26+step*0.03), h*0.6, w*0.08, h*0.14, -0.3, NAVY, OL, { lw: 1.2 });
      ell(ctx, w*(0.82-step*0.03), h*0.6, w*0.08, h*0.14, 0.3, NAVY, OL, { lw: 1.2 });

      ell(ctx, w*(0.42+step*0.04), h*0.89, w*0.1, h*0.07, 0.1, BEAK, OL, { lw: 1.2 });
      ell(ctx, w*(0.62-step*0.04), h*0.89, w*0.1, h*0.07, -0.1, BEAK, OL, { lw: 1.2 });

      poly(ctx, [w*0.83, h*0.33, w*0.92, h*0.38, w*0.83, h*0.42], BEAK, OL, { lw: 1.2 });

      eye(w*0.76, h*0.29, 5, null, OL);

    } else if (pw === POWER.BIG) {
      // Prinplup — taller, darker navy, golden V-crest
      const NAVY = '#102870', LIGHT = '#a8d8f0', BEAK = '#d89010', GOLD = '#f0c020', OL = '#060e34';

      ell(ctx, w*0.5, h*0.6, w*0.32, h*0.32, 0, NAVY, OL);
      ell(ctx, w*0.6, h*0.62, w*0.22, h*0.26, 0.1, '#e8f4ff', null, { sh: 0.86, dy: 3 });
      ctx.fillStyle = LIGHT;
      ctx.beginPath(); ctx.ellipse(w*0.6, h*0.52, w*0.1, h*0.08, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.58, h*0.63, w*0.09, h*0.07, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.73, w*0.08, h*0.06, 0, 0, TAU); ctx.fill();

      ell(ctx, w*(0.22+step*0.03), h*0.58, w*0.1, h*0.18, -0.25, NAVY, OL);
      ell(ctx, w*(0.84-step*0.03), h*0.58, w*0.1, h*0.18, 0.25, NAVY, OL);

      ell(ctx, w*(0.4+step*0.04), h*0.89, w*0.1, h*0.08, 0.1, BEAK, OL, { lw: 1.2 });
      ell(ctx, w*(0.62-step*0.04), h*0.89, w*0.1, h*0.08, -0.1, BEAK, OL, { lw: 1.2 });

      ell(ctx, w*0.66, h*0.3, w*0.26, h*0.22, 0, NAVY, OL);
      ell(ctx, w*0.72, h*0.32, w*0.15, h*0.16, 0.1, LIGHT, null, { sh: 0.86 });
      hilite(ctx, w*0.52, h*0.18, 3, 1.5);

      poly(ctx, [w*0.56, h*0.12, w*0.52, h*(-0.04), w*0.62, h*0.1], GOLD, OL, { lw: 1.1 });
      poly(ctx, [w*0.66, h*0.1, w*0.62, h*(-0.06), w*0.72, h*0.08], GOLD, OL, { lw: 1.1 });

      poly(ctx, [w*0.85, h*0.3, w*0.95, h*0.34, w*0.85, h*0.38], BEAK, OL, { lw: 1.2 });

      eye(w*0.78, h*0.27, 5, null, OL);

    } else {
      // Empoleon — large, imposing, trident crown, steel armor wings
      const NAVY = '#0a1840', STEEL = '#2050a8', BEAK = '#c87800', GOLD = '#f0c020', OL = '#04091e';

      ell(ctx, w*(0.18+step*0.03), h*0.54, w*0.12, h*0.26, -0.2, STEEL, OL);
      ell(ctx, w*(0.88-step*0.03), h*0.54, w*0.12, h*0.26, 0.2, STEEL, OL);
      ctx.strokeStyle = '#4070d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.16, h*0.42); ctx.lineTo(w*0.14, h*0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.86, h*0.42); ctx.lineTo(w*0.88, h*0.7); ctx.stroke();

      ell(ctx, w*0.52, h*0.58, w*0.36, h*0.34, 0, NAVY, OL, { lw: 1.8, shade: '#040c24' });
      ell(ctx, w*0.62, h*0.6, w*0.24, h*0.28, 0.1, '#e0eeff', null, { sh: 0.86, dy: 3 });
      ctx.strokeStyle = STEEL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.52, w*0.12, h*0.06, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.62, w*0.1, h*0.05, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.72, w*0.08, h*0.04, 0, 0, TAU); ctx.stroke();

      ell(ctx, w*(0.38+step*0.04), h*0.87, w*0.12, h*0.11, 0.1, NAVY, OL, { shade: '#040c24' });
      ell(ctx, w*(0.64-step*0.04), h*0.87, w*0.12, h*0.11, -0.1, NAVY, OL, { shade: '#040c24' });
      ell(ctx, w*(0.36+step*0.04), h*0.93, w*0.12, h*0.06, 0, BEAK, OL, { lw: 1.2 });
      ell(ctx, w*(0.66-step*0.04), h*0.93, w*0.12, h*0.06, 0, BEAK, OL, { lw: 1.2 });

      ell(ctx, w*0.66, h*0.28, w*0.28, h*0.22, 0, NAVY, OL, { lw: 1.8, shade: '#040c24' });
      ell(ctx, w*0.74, h*0.3, w*0.16, h*0.18, 0.1, '#c0d8f8', null, { sh: 0.86 });
      hilite(ctx, w*0.5, h*0.16, 3, 1.5, 0.25);

      poly(ctx, [w*0.62, h*0.1, w*0.58, h*(-0.1), w*0.66, h*0.08], GOLD, OL, { lw: 1.1 });
      poly(ctx, [w*0.52, h*0.12, w*0.46, h*(-0.04), w*0.58, h*0.1], GOLD, OL, { lw: 1.1 });
      poly(ctx, [w*0.72, h*0.1, w*0.68, h*(-0.04), w*0.78, h*0.12], GOLD, OL, { lw: 1.1 });
      poly(ctx, [w*0.48, h*0.09, w*0.76, h*0.09, w*0.76, h*0.13, w*0.48, h*0.13], GOLD, OL, { lw: 1.1 });

      poly(ctx, [w*0.88, h*0.28, w*0.98, h*0.33, w*0.88, h*0.38], BEAK, OL, { lw: 1.2 });

      eye(w*0.8, h*0.25, 5.5, '#1840a0', OL);
    }
  }
  _drawPichu(ctx, w, h) {
    const pw   = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;

    const face = (lx, rx, ey, nx, ny, r) => {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(rx, ey, 3.2, 4.2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx, ey + 0.5, 3.2, 4.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx - 1.8, ey - 3, 2, 2);
      ctx.fillRect(lx - 1.8, ey - 2.5, 2, 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(nx - 1, ny, 2, 1.5);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(nx, ny + 1, r, 0.3, Math.PI - 0.3); ctx.stroke();
    };

    if (pw === POWER.SMALL) {
      // ── PICHU ── tiny pale-yellow mouse, oversized diamond ears
      const Y = '#f8e470', BLACK = '#222', CHEEK = '#f080a0', OL = '#5a4410', YS = '#d4b040';

      poly(ctx, [w*0.18, h*0.66, w*0.00, h*0.56, w*0.16, h*0.54], BLACK, OL, { lw: 1.2, sh: 0 });

      ell(ctx, w*0.5, h*0.72, w*0.32, h*0.24, 0, Y, OL, { shade: YS });

      ell(ctx, w*(0.36+step*0.04), h*0.93, w*0.11, h*0.06, 0, Y, OL, { lw: 1.2, shade: YS });
      ell(ctx, w*(0.64-step*0.04), h*0.93, w*0.11, h*0.06, 0, Y, OL, { lw: 1.2, shade: YS });

      poly(ctx, [w*0.30, h*0.16, w*0.02, h*0.00, w*0.22, h*0.30], BLACK, OL, { lw: 1.2, shade: '#0a0a0a' });
      poly(ctx, [w*0.68, h*0.14, w*0.98, h*0.00, w*0.80, h*0.28], BLACK, OL, { lw: 1.2, shade: '#0a0a0a' });

      ell(ctx, w*0.52, h*0.38, w*0.40, h*0.28, 0, Y, OL, { shade: YS });
      hilite(ctx, w*0.34, h*0.24, 3.4, 1.7);

      ctx.strokeStyle = BLACK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w*0.52, h*0.50, w*0.24, 0.35, Math.PI - 0.35); ctx.stroke();

      ell(ctx, w*0.82, h*0.44, 4, 3.5, 0, CHEEK, null, { sh: 0.9 });
      ell(ctx, w*0.24, h*0.46, 4, 3.5, 0, CHEEK, null, { sh: 0.9 });

      face(w*0.40, w*0.66, h*0.35, w*0.53, h*0.42, 4);

    } else if (pw === POWER.BIG) {
      // ── PIKACHU ── classic yellow, red cheeks, lightning-bolt tail
      const Y = '#f8d030', BROWN = '#a05a10', CHEEK = '#e03020', BLACK = '#222', OL = '#6a4a08', YS = '#d49a18';

      poly(ctx, [
        w*0.28, h*0.56,            // base at lower back
        w*0.10, h*0.50,
        w*0.22, h*0.42,
        w*0.02, h*0.34,
        w*0.16, h*0.26,
        w*(-0.06), h*0.16,
        w*0.30, h*0.12,            // wide flat top of the bolt
        w*0.16, h*0.24,
        w*0.34, h*0.32,
        w*0.20, h*0.40,
        w*0.36, h*0.48,
      ], Y, OL, { lw: 1.3, dy: 3, shade: YS });
      poly(ctx, [w*0.28, h*0.56, w*0.36, h*0.48, w*0.40, h*0.56], BROWN, null, { sh: 0 });

      ell(ctx, w*0.5, h*0.66, w*0.34, h*0.28, 0, Y, OL, { shade: YS });

      ctx.strokeStyle = BROWN; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w*0.34, h*0.58, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.34, h*0.66, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();

      ell(ctx, w*(0.36+step*0.05), h*0.94, w*0.13, h*0.05, 0, Y, OL, { lw: 1.2, shade: YS });
      ell(ctx, w*(0.66-step*0.05), h*0.94, w*0.13, h*0.05, 0, Y, OL, { lw: 1.2, shade: YS });

      ell(ctx, w*0.80, h*0.62, w*0.08, h*0.05, 0.5, Y, OL, { lw: 1.2, shade: YS });

      poly(ctx, [w*0.32, h*0.20, w*0.12, h*0.00, w*0.44, h*0.14], Y, OL, { lw: 1.2, shade: YS });
      poly(ctx, [w*0.12, h*0.00, w*0.22, h*0.095, w*0.28, h*0.045], BLACK, null, { sh: 0 });
      poly(ctx, [w*0.66, h*0.19, w*0.90, h*0.00, w*0.78, h*0.16], Y, OL, { lw: 1.2, shade: YS });
      poly(ctx, [w*0.90, h*0.00, w*0.80, h*0.085, w*0.86, h*0.06], BLACK, null, { sh: 0 });

      ell(ctx, w*0.54, h*0.30, w*0.32, h*0.18, 0, Y, OL, { shade: YS });
      hilite(ctx, w*0.4, h*0.2, 3.2, 1.6);

      ell(ctx, w*0.80, h*0.35, 4.5, 4, 0, CHEEK, null, { sh: 0.85 });
      ell(ctx, w*0.30, h*0.36, 4.5, 4, 0, CHEEK, null, { sh: 0.85 });

      face(w*0.44, w*0.68, h*0.27, w*0.56, h*0.33, 4);

    } else {
      // ── RAICHU ── orange, cream belly, long thin tail with big bolt tip
      const OR = '#f09030', CREAM = '#f8e0b0', CHEEK = '#f8d838', BROWN = '#7a4a10', OL = '#5a2c0c';

      ctx.lineCap = 'round';
      const tail = () => { ctx.moveTo(w*0.26, h*0.62); ctx.bezierCurveTo(w*0.00, h*0.56, w*(-0.10), h*0.36, w*0.02, h*0.20); };
      ctx.strokeStyle = OL; ctx.lineWidth = 5.5; ctx.beginPath(); tail(); ctx.stroke();
      ctx.strokeStyle = BROWN; ctx.lineWidth = 3.5; ctx.beginPath(); tail(); ctx.stroke();
      poly(ctx, [
        w*0.02, h*0.22,
        w*(-0.12), h*0.14,
        w*(-0.02), h*0.12,
        w*(-0.10), h*0.02,
        w*0.10, h*0.08,
        w*0.02, h*0.10,
        w*0.12, h*0.18,
      ], CHEEK, OL, { lw: 1.2 });

      ell(ctx, w*0.5, h*0.64, w*0.36, h*0.30, 0, OR, OL);
      ell(ctx, w*0.56, h*0.68, w*0.22, h*0.20, 0.05, CREAM, null, { sh: 0.9, dy: 3 });

      ell(ctx, w*(0.34+step*0.05), h*0.95, w*0.14, h*0.05, 0, OR, OL, { lw: 1.2 });
      ell(ctx, w*(0.66-step*0.05), h*0.95, w*0.14, h*0.05, 0, OR, OL, { lw: 1.2 });

      ell(ctx, w*0.82, h*0.58, w*0.08, h*0.055, 0.5, OR, OL, { lw: 1.2 });

      poly(ctx, [w*0.34, h*0.16, w*0.04, h*0.02, w*0.14, h*0.14, w*0.30, h*0.24], BROWN, OL, { lw: 1.2 });
      ell(ctx, w*0.10, h*0.055, 3, 2.5, -0.5, CHEEK, null, { sh: 0 });
      poly(ctx, [w*0.66, h*0.15, w*0.96, h*0.01, w*0.86, h*0.13, w*0.72, h*0.23], BROWN, OL, { lw: 1.2 });
      ell(ctx, w*0.90, h*0.045, 3, 2.5, 0.5, CHEEK, null, { sh: 0 });

      ell(ctx, w*0.54, h*0.28, w*0.30, h*0.17, 0, OR, OL);
      hilite(ctx, w*0.4, h*0.2, 3, 1.5);

      ell(ctx, w*0.79, h*0.33, 4.5, 4, 0, CHEEK, null, { sh: 0.88 });
      ell(ctx, w*0.30, h*0.34, 4.5, 4, 0, CHEEK, null, { sh: 0.88 });

      face(w*0.44, w*0.67, h*0.25, w*0.56, h*0.305, 4.5);
    }
  }
  _drawBulbasaur(ctx, w, h) {
    const pw = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t = Math.floor(this.animTimer / 6) % 4;
    const flick = t < 2 ? t : 4 - t;

    const redEye = (ex, ey, rx, ry, iris, OL) => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1, rx*0.6, ry*0.58, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1.2, rx*0.3, ry*0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 0.5, ey - ry*0.55, 1.8, 1.8);
    };

    if (pw === POWER.SMALL) {
      // Bulbasaur — green, round, quadruped, seed bulb on back
      const SKIN = '#78c060', DARK = '#4a8838', SPOT = '#5a9a48', BULB = '#3a6820', BULB2 = '#2a5018', CREAM = '#e8f0c8', OL = '#1e4418';

      ell(ctx, w*0.26, h*0.26, w*0.22, h*0.2, -0.1, BULB, OL, { shade: '#24480f' });
      ell(ctx, w*0.26, h*0.24, w*0.14, h*0.12, -0.1, BULB2, null, { sh: 0 });
      ctx.strokeStyle = BULB2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.26, h*0.07); ctx.lineTo(w*0.26, h*0.42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.08, h*0.18); ctx.lineTo(w*0.44, h*0.32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.44, h*0.18); ctx.lineTo(w*0.08, h*0.32); ctx.stroke();
      hilite(ctx, w*0.18, h*0.16, 2.6, 1.3, 0.22);

      ell(ctx, w*(0.18+step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);
      ell(ctx, w*(0.34-step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);

      ell(ctx, w*0.5, h*0.64, w*0.42, h*0.28, 0, SKIN, OL);
      ell(ctx, w*0.62, h*0.66, w*0.2, h*0.17, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.7, w*0.07, h*0.055, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.76, w*0.06, h*0.05, 0, 0, TAU); ctx.fill();

      ell(ctx, w*(0.6+step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);
      ell(ctx, w*(0.74-step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);

      ell(ctx, w*0.72, h*0.24, w*0.06, h*0.07, -0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.88, h*0.24, w*0.06, h*0.07, 0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.76, h*0.4, w*0.22, h*0.22, 0, SKIN, OL);
      hilite(ctx, w*0.66, h*0.3, 2.6, 1.3);
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.86, h*0.46, 4, 3, 0, 0, TAU); ctx.fill();
      redEye(w*0.82, h*0.37, 5, 6, '#8b1010', OL);

    } else if (pw === POWER.BIG) {
      // Ivysaur — larger, closed pink tulip bud on splayed leaves
      const SKIN = '#6aac58', DARK = '#3a7030', SPOT = '#4a8440', CREAM = '#d8e8b0', OL = '#1a3c16';
      const bx = w*0.27, byT = h*0.30;   // bud base center

      const leaf = (ang, len, wid) => {
        const tx = bx + Math.cos(ang)*len, ty = byT + Math.sin(ang)*len;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        shape(ctx, () => {
          ctx.moveTo(bx, byT);
          ctx.quadraticCurveTo(bx + px*wid + Math.cos(ang)*len*0.45, byT + py*wid + Math.sin(ang)*len*0.45, tx, ty);
          ctx.quadraticCurveTo(bx - px*wid + Math.cos(ang)*len*0.45, byT - py*wid + Math.sin(ang)*len*0.45, bx, byT);
          ctx.closePath();
        }, '#2a7828', OL, { lw: 1.1, sh: 0.8 });
        ctx.strokeStyle = '#68b858'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(bx, byT); ctx.lineTo(tx, ty); ctx.stroke();
      };
      leaf(Math.PI * 0.95, w*0.30, w*0.09);   // left
      leaf(Math.PI * 0.70, w*0.26, w*0.08);   // upper-left
      leaf(Math.PI * 0.28, w*0.28, w*0.08);   // upper-right
      leaf(Math.PI * 0.05, w*0.30, w*0.09);   // right

      const petal = (cxp, tipX, tipY, wid, fill) => {
        shape(ctx, () => {
          ctx.moveTo(cxp - wid, byT);
          ctx.quadraticCurveTo(cxp - wid*1.1, byT - h*0.10, tipX, tipY);
          ctx.quadraticCurveTo(cxp + wid*1.1, byT - h*0.10, cxp + wid, byT);
          ctx.closePath();
        }, fill, '#5a1a40', { lw: 1.1, sh: 0.82 });
      };
      petal(bx - w*0.07, bx - w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
      petal(bx + w*0.07, bx + w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
      petal(bx,          bx,          h*0.055 - flick*0.4, w*0.085, '#e868bc');
      shape(ctx, () => {
        ctx.moveTo(bx - w*0.15, byT - h*0.02);
        ctx.quadraticCurveTo(bx, byT + h*0.09, bx + w*0.15, byT - h*0.02);
        ctx.lineTo(bx + w*0.11, byT + h*0.06);
        ctx.quadraticCurveTo(bx, byT + h*0.12, bx - w*0.11, byT + h*0.06);
        ctx.closePath();
      }, '#2a6828', OL, { lw: 1.2, sh: 0.8 });

      ell(ctx, w*(0.16+step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);
      ell(ctx, w*(0.32-step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);

      ell(ctx, w*0.5, h*0.62, w*0.4, h*0.27, 0, SKIN, OL);
      ell(ctx, w*0.62, h*0.64, w*0.19, h*0.18, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.3, h*0.68, w*0.07, h*0.055, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.74, w*0.055, h*0.045, 0, 0, TAU); ctx.fill();

      ell(ctx, w*(0.62+step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);
      ell(ctx, w*(0.76-step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);

      ell(ctx, w*0.72, h*0.24, w*0.07, h*0.08, -0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.88, h*0.23, w*0.07, h*0.08, 0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.76, h*0.38, w*0.22, h*0.22, 0, SKIN, OL);
      hilite(ctx, w*0.66, h*0.28, 2.6, 1.3);
      redEye(w*0.82, h*0.365, 4, 5, '#7a1a20', OL);

    } else {
      // Venusaur — huge open flower on a trunk, heavy body
      const SKIN = '#5a9848', DARK = '#3a6830', SPOT = '#4a8040', CREAM = '#c8e0a0', OL = '#163214';

      const fx = w*0.30, fy = h*0.17;   // flower center

      const frond = (ang, len, wid) => {
        const ox = fx, oy = fy + h*0.10;
        const tx = ox + Math.cos(ang)*len, ty = oy + Math.sin(ang)*len;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        shape(ctx, () => {
          ctx.moveTo(ox, oy);
          ctx.quadraticCurveTo(ox + px*wid + Math.cos(ang)*len*0.45, oy + py*wid + Math.sin(ang)*len*0.45, tx, ty);
          ctx.quadraticCurveTo(ox - px*wid + Math.cos(ang)*len*0.45, oy - py*wid + Math.sin(ang)*len*0.45, ox, oy);
          ctx.closePath();
        }, '#2a6828', OL, { lw: 1.1, sh: 0.8 });
        ctx.strokeStyle = '#5aa848'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      };
      frond(Math.PI * 0.94, w*0.44, w*0.11);
      frond(Math.PI * 0.62, w*0.34, w*0.10);
      frond(Math.PI * 0.35, w*0.34, w*0.10);
      frond(Math.PI * 0.04, w*0.44, w*0.11);

      poly(ctx, [fx - w*0.09, fy + h*0.16, fx - w*0.06, fy + h*0.04, fx + w*0.06, fy + h*0.04, fx + w*0.09, fy + h*0.16], '#8a5a28', '#3a2008', { lw: 1.2 });

      const fpetal = (ang, shade) => {
        const len = w*0.38 + flick*0.4, wid = w*0.14;
        const tx = fx + Math.cos(ang)*len, ty = fy + Math.sin(ang)*len*0.85;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        shape(ctx, () => {
          ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo(fx + px*wid + Math.cos(ang)*len*0.4, fy + py*wid + Math.sin(ang)*len*0.35, tx, ty);
          ctx.quadraticCurveTo(fx - px*wid + Math.cos(ang)*len*0.4, fy - py*wid + Math.sin(ang)*len*0.35, fx, fy);
          ctx.closePath();
        }, shade, '#6a1428', { lw: 1.1, sh: 0.84 });
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(fx + Math.cos(ang)*len*0.25, fy + Math.sin(ang)*len*0.22);
        ctx.lineTo(tx - Math.cos(ang)*3, ty - Math.sin(ang)*3); ctx.stroke();
      };
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/2;
        fpetal(a, i % 2 === 0 ? '#e84868' : '#f06888');
      }
      ell(ctx, fx, fy, w*0.10, w*0.10, 0, '#f8c840', '#6a4000', { lw: 1.2, sh: 0.86 });
      ctx.fillStyle = '#c09000';
      ctx.beginPath(); ctx.arc(fx - w*0.03, fy - h*0.012, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(fx + w*0.035, fy + h*0.008, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy + h*0.02, 1.3, 0, TAU); ctx.fill();

      ell(ctx, w*(0.18+step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);
      ell(ctx, w*(0.32-step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);

      ell(ctx, w*0.5, h*0.66, w*0.47, h*0.26, 0, SKIN, OL);
      ell(ctx, w*0.64, h*0.68, w*0.22, h*0.17, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.72, w*0.08, h*0.055, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.78, w*0.06, h*0.05, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.2, h*0.58, w*0.06, h*0.05, 0.3, 0, TAU); ctx.fill();

      ell(ctx, w*(0.64+step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);
      ell(ctx, w*(0.78-step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);

      ell(ctx, w*0.74, h*0.25, w*0.07, h*0.09, -0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.9, h*0.24, w*0.07, h*0.09, 0.3, DARK, OL, { lw: 1.1 });
      ell(ctx, w*0.78, h*0.4, w*0.22, h*0.22, 0, SKIN, OL);
      hilite(ctx, w*0.68, h*0.3, 2.6, 1.3);
      redEye(w*0.84, h*0.385, 4, 4.8, '#8b1010', OL);
      ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.76, h*0.315); ctx.lineTo(w*0.90, h*0.335); ctx.stroke();
    }
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
    if (this.char === 'charmander')     this._drawCharmander(ctx, w, h);
    else if (this.char === 'piplup')    this._drawPiplup(ctx, w, h);
    else if (this.char === 'pichu')     this._drawPichu(ctx, w, h);
    else if (this.char === 'bulbasaur') this._drawBulbasaur(ctx, w, h);
    // default: eevee family
    else if (big && !this.crouching)    this._drawUmbreon(ctx, w, h, this.power === POWER.FIRE);
    else if (big && this.crouching)     this._drawCrouchUmbreon(ctx, w, h);
    else if (this.crouching)            this._drawCrouchEevee(ctx, w, h);
    else                                this._drawEevee(ctx, w, h);

    ctx.restore();
  }
}
