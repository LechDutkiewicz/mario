import {
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED,
  PLAYER_ACCEL, PLAYER_RUN_ACCEL, FRICTION,
  JUMP_MAX_VY, JUMP_FRAMES_MAX, JUMP_MOD,
  PLAYER_SMALL_W, PLAYER_SMALL_H, PLAYER_BIG_W, PLAYER_BIG_H,
  INVINCIBLE_TIME, POWER, COLORS,
} from '../constants.js';
import { resolveCollisions, aabb } from '../physics.js';


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

    // Ground pound — big form, mid-air, holding down: slam straight down
    // and smash bricks beneath (newer-Mario mechanic, added for fun)
    if (!this.underwater && this.big && !this.onGround && input.down && this.vy > -2) {
      this.pounding = true;
    }
    if (this.pounding) {
      this.vy = Math.max(this.vy, 12);
      this.vx *= 0.8;
      this.isJumping = false;
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

    // Ground pound landing — smash the bricks directly under the feet
    if (this.pounding && this.onGround) {
      const feetY = this.y + this.h;
      let broke = false;
      for (const s2 of solids) {
        if (s2.dead || s2.kind !== 'brick') continue;
        if (Math.abs(s2.y - feetY) < 5 &&
            this.x + this.w > s2.x + 2 && this.x < s2.x + s2.w - 2) {
          game.onBlockBumped(s2);
          if (s2.dead) broke = true;
        }
      }
      this.pounding = false;
      if (broke) {
        // Fall through the freshly made hole
        this.onGround = false;
        this.vy = 2;
      }
    }
    if (this.onGround) this.pounding = false;

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

  _drawUmbreon(ctx, w, h, isTera = false) {
    const BODY = '#1c1c38';
    const RING = '#ffe040';
    const EYE  = '#cc2200';
    const OL   = '#111';
    const jumping = !this.onGround;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;

    // Tail — curves left then up from body's left side
    ctx.strokeStyle = BODY; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w*0.22, h*0.48);
    ctx.bezierCurveTo(w*(-0.1), h*0.42, w*(-0.18), h*0.18, w*(-0.06), h*0.12);
    ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w*0.22, h*0.48);
    ctx.bezierCurveTo(w*(-0.1), h*0.42, w*(-0.18), h*0.18, w*(-0.06), h*0.12);
    ctx.stroke();
    // Ring at tail tip
    ctx.strokeStyle = RING; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(w*(-0.06), h*0.1, 4.5, 0, Math.PI*2); ctx.stroke();

    // Hind legs (back pair — left side of sprite)
    const hly = h * 0.82;
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*(0.2+step*0.04), hly, w*0.1, h*0.12, 0.1, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.36-step*0.04), hly, w*0.1, h*0.12, -0.1, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    // Hind leg rings
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*(0.2+step*0.04), hly-4, w*0.07, 2.5, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.36-step*0.04), hly-4, w*0.07, 2.5, 0, 0, Math.PI*2); ctx.stroke();

    // Body — main oval
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.44, h*0.58, w*0.38, h*0.24, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    // Body ring
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.44, h*0.58, w*0.22, h*0.12, 0, 0, Math.PI*2); ctx.stroke();

    // Front legs (right side of sprite)
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*(0.62+step*0.04), hly, w*0.1, h*0.12, 0.1, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.76-step*0.04), hly, w*0.1, h*0.12, -0.1, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.strokeStyle = RING; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*(0.62+step*0.04), hly-4, w*0.07, 2.5, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.76-step*0.04), hly-4, w*0.07, 2.5, 0, 0, Math.PI*2); ctx.stroke();

    // Neck
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.66, h*0.42, w*0.16, h*0.1, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

    // Head
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.76, h*0.28, w*0.22, h*0.18, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    // Forehead ring
    ctx.strokeStyle = RING; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(w*0.76, h*0.16, w*0.12, h*0.04, 0, 0, Math.PI*2); ctx.stroke();

    // Ears — pointed, on top of head
    const tilt = jumping ? 0.05 : 0;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w*0.66, h*0.18); ctx.lineTo(w*(0.58+tilt), h*0.02); ctx.lineTo(w*0.74, h*0.14);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w*0.82, h*0.17); ctx.lineTo(w*(0.9-tilt), h*0.02); ctx.lineTo(w*0.92, h*0.14);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();

    // Eye — red
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w*0.86, h*0.27, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff9999'; ctx.fillRect(w*0.855, h*0.24, 1.5, 1.5);

    // Tera crystal — purple gem on forehead, only in POWER.FIRE form
    if (isTera) {
      const cx = w * 0.76, cy = h * 0.09;
      // Outer glow
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 12);
      glow.addColorStop(0, 'rgba(200,120,255,0.75)');
      glow.addColorStop(1, 'rgba(120,0,200,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(cx, cy, 12, 12, 0, 0, Math.PI*2); ctx.fill();

      // Crystal — hexagonal gem
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
      ctx.strokeStyle = '#cc66ff'; ctx.lineWidth = 1.2; ctx.stroke();

      // Inner highlight facet
      ctx.fillStyle = 'rgba(240,200,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(cx,     cy - R);
      ctx.lineTo(cx + r, cy - R*0.5);
      ctx.lineTo(cx,     cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawCrouchUmbreon(ctx, w, h) {
    // Squashed Umbreon — compact crouching form
    const BODY  = '#2e2e52';
    const RING  = '#ffe040';
    const EYE   = '#cc0000';
    const SHINE = '#ff6666';

    ctx.save();

    // Body — wider and flatter
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.46, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // Yellow ring on body
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.32, h * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Head — lower, merged into body
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.3, w * 0.36, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Short flattened ears
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.18);
    ctx.lineTo(w * 0.14, h * 0.04);
    ctx.lineTo(w * 0.36, h * 0.14);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.18);
    ctx.lineTo(w * 0.76, h * 0.04);
    ctx.lineTo(w * 0.72, h * 0.14);
    ctx.closePath(); ctx.fill();
    // Yellow ear rings
    ctx.strokeStyle = RING;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.16);
    ctx.lineTo(w * 0.19, h * 0.08);
    ctx.lineTo(w * 0.34, h * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.63, h * 0.16);
    ctx.lineTo(w * 0.72, h * 0.08);
    ctx.lineTo(w * 0.69, h * 0.14);
    ctx.stroke();

    // Red eyes (visible, wide-set)
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w * 0.35, h * 0.28, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.65, h * 0.28, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SHINE;
    ctx.fillRect(w * 0.34, h * 0.24, 2, 2);
    ctx.fillRect(w * 0.64, h * 0.24, 2, 2);

    // Stub legs barely visible below body
    ctx.fillStyle = BODY;
    ctx.fillRect(w * 0.18, h * 0.82, w * 0.2, h * 0.16);
    ctx.fillRect(w * 0.56, h * 0.82, w * 0.2, h * 0.16);
    // Leg rings
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.19, h * 0.84, w * 0.18, h * 0.08);
    ctx.strokeRect(w * 0.57, h * 0.84, w * 0.18, h * 0.08);

    ctx.restore();
  }

  _drawCharmander(ctx, w, h) {
    const pw    = this.power;
    const step  = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const flick = Math.sin(this.animTimer * 0.28) * 1.2;
    const OL    = '#111';

    // Tail flame — layered teardrop, flickers
    const flame = (fx, fy, s) => {
      ctx.fillStyle = '#c83000';
      ctx.beginPath(); ctx.ellipse(fx, fy, s*3.2, s*6.5+flick*s*0.7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff5500';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*2.2, s*2.2, s*4.6+flick*s*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*3.8, s*1.3, s*2.8+flick*s*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffee88';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*5.0, s*0.65, s*1.5, 0, 0, Math.PI*2); ctx.fill();
    };

    if (pw === POWER.SMALL) {
      // ── CHARMANDER ── round orange lizard, big head, tail flame
      const C = '#f8933c', D = '#d86818', CREAM = '#f8e0a0';

      // Tail — curves from lower back up to the left, flame at tip
      ctx.strokeStyle = C; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.26, h*0.72);
      ctx.quadraticCurveTo(w*(-0.04), h*0.72, w*0.02, h*0.44);
      ctx.stroke();
      ctx.strokeStyle = OL; ctx.lineWidth = 1;
      flame(w*0.02, h*0.36, 0.9);

      // Body — small, low
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.70, w*0.34, h*0.25, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Cream belly
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.58, h*0.74, w*0.2, h*0.16, 0.1, 0, Math.PI*2); ctx.fill();

      // Feet
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*(0.34+step*0.05), h*0.94, w*0.12, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.66-step*0.05), h*0.94, w*0.12, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Both arms — small stubs at body sides
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.64, w*0.08, h*0.06, 0.4, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.24, h*0.64, w*0.08, h*0.06, -0.4, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Head — big, gently rounded
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.54, h*0.34, w*0.39, h*0.27, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Eyes — IDENTICAL pair, soft white sclera (no heavy outline), blue iris
      const eye = (ex) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex, h*0.30, 3.6, 4.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a6ad8';
        ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.31, 2.3, 3.1, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.315, 1.3, 1.9, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 0.6, h*0.272, 1.6, 1.6);
      };
      eye(w*0.40);
      eye(w*0.68);

      // Tiny nostrils
      ctx.fillStyle = '#111';
      ctx.fillRect(w*0.51, h*0.40, 1.3, 1.3);
      ctx.fillRect(w*0.58, h*0.40, 1.3, 1.3);

      // Wide happy smile
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.34, h*0.45);
      ctx.quadraticCurveTo(w*0.54, h*0.525, w*0.76, h*0.44);
      ctx.stroke();

    } else if (pw === POWER.BIG) {
      // ── CHARMELEON ── crimson, upright, single backward horn, fierce
      const C = '#e04828', D = '#a82808', CREAM = '#f8e0a0', CLAW = '#f0f0d0';

      // Tail — thick, sweeps left and up, big flame
      ctx.strokeStyle = C; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.30, h*0.72);
      ctx.quadraticCurveTo(w*(-0.08), h*0.74, w*(-0.02), h*0.40);
      ctx.stroke();
      flame(w*(-0.02), h*0.32, 1.1);

      // Legs
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*(0.36+step*0.05), h*0.90, w*0.13, h*0.09, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.66-step*0.05), h*0.90, w*0.13, h*0.09, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      // Claws
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.38+step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.60-step*0.05), h*0.955, 2, 3);
      ctx.fillRect(w*(0.68-step*0.05), h*0.955, 2, 3);

      // Body — upright oval
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.62, w*0.32, h*0.30, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Cream belly
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.58, h*0.66, w*0.19, h*0.22, 0.05, 0, Math.PI*2); ctx.fill();

      // Arm with claws
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.80, h*0.58, w*0.09, h*0.06, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.86, h*0.615, 2, 3.5);
      ctx.fillRect(w*0.90, h*0.60, 2, 3.5);

      // Head — narrower than Charmander, snout hint
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.56, h*0.26, w*0.30, h*0.17, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Single horn — points BACKWARD from the rear of the skull
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.moveTo(w*0.38, h*0.155);
      ctx.lineTo(w*0.12, h*0.035);
      ctx.lineTo(w*0.30, h*0.21);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();

      // Fierce eye — white slit with dark pupil, angled brow
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(w*0.70, h*0.235, 4, 4.5, 0.1, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(w*0.715, h*0.245, 1.8, 2.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.62, h*0.185); ctx.lineTo(w*0.78, h*0.20); ctx.stroke();

      // Nostril + mouth line
      ctx.fillStyle = '#111';
      ctx.fillRect(w*0.82, h*0.27, 1.8, 1.8);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.335); ctx.lineTo(w*0.84, h*0.32); ctx.stroke();

    } else {
      // ── CHARIZARD ── bipedal orange dragon; angular teal wings drawn with
      // straight polygon edges (never beziers), long neck, backward horns
      const C = '#f08030', D = '#c85810', CREAM = '#f8e0a0', CLAW = '#f0f0d0';
      const WING_D = '#175840', WING_L = '#2a9460';

      // Tail — sweeps down-left along the ground, flame at tip
      ctx.strokeStyle = C; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.32, h*0.78);
      ctx.quadraticCurveTo(w*(-0.02), h*0.84, w*(-0.06), h*0.62);
      ctx.stroke();
      flame(w*(-0.06), h*0.54, 1.0);

      // Wing — far one first (darker, offset), then near one. Angular
      // bat-wing silhouette: shoulder root, apex, two notched fingertips.
      const wing = (ox, oy, fill) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(w*(0.46+ox), h*(0.42+oy));   // shoulder root
        ctx.lineTo(w*(0.02+ox), h*(0.02+oy));   // apex (top tip)
        ctx.lineTo(w*(0.16+ox), h*(0.22+oy));   // notch
        ctx.lineTo(w*(-0.08+ox), h*(0.20+oy));  // fingertip 2
        ctx.lineTo(w*(0.13+ox), h*(0.35+oy));   // notch
        ctx.lineTo(w*(-0.04+ox), h*(0.44+oy));  // fingertip 3
        ctx.lineTo(w*(0.34+ox), h*(0.54+oy));   // membrane back to body
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
        // Leading-edge bone
        ctx.strokeStyle = '#0e3826'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w*(0.46+ox), h*(0.42+oy));
        ctx.lineTo(w*(0.02+ox), h*(0.02+oy));
        ctx.stroke();
      };
      wing(0.14, -0.05, WING_D);   // far wing
      wing(0,     0,    WING_L);   // near wing

      // Legs — thick, bipedal
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*(0.36+step*0.05), h*0.90, w*0.14, h*0.09, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.68-step*0.05), h*0.90, w*0.14, h*0.09, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.39+step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.62-step*0.05), h*0.955, 2.5, 3.5);
      ctx.fillRect(w*(0.71-step*0.05), h*0.955, 2.5, 3.5);

      // Body — stocky, leaning slightly forward
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.64, w*0.33, h*0.26, 0.08, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Cream belly plates
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.60, h*0.68, w*0.19, h*0.19, 0.08, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d8b870'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.46, h*0.62); ctx.lineTo(w*0.76, h*0.60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.45, h*0.70); ctx.lineTo(w*0.77, h*0.68); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.47, h*0.78); ctx.lineTo(w*0.75, h*0.76); ctx.stroke();

      // Small arm with claws
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.82, h*0.56, w*0.09, h*0.055, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.88, h*0.585, 2, 3.5);
      ctx.fillRect(w*0.92, h*0.57, 2, 3.5);

      // Neck — rises from body to head
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.38, w*0.13, h*0.12, -0.35, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.4; ctx.stroke();

      // Head — compact, with a clear snout block to the right
      ctx.fillStyle = C;
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.22, w*0.20, h*0.13, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Snout
      ctx.fillStyle = C;
      ctx.beginPath();
      ctx.moveTo(w*0.76, h*0.16);
      ctx.lineTo(w*0.97, h*0.19);
      ctx.lineTo(w*0.97, h*0.26);
      ctx.lineTo(w*0.76, h*0.29);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
      // Nostril + mouth line
      ctx.fillStyle = '#111';
      ctx.fillRect(w*0.925, h*0.205, 1.8, 1.8);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(w*0.78, h*0.265); ctx.lineTo(w*0.95, h*0.245); ctx.stroke();
      // Fang
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(w*0.88, h*0.25); ctx.lineTo(w*0.895, h*0.29); ctx.lineTo(w*0.91, h*0.248);
      ctx.closePath(); ctx.fill();

      // Two horns — point BACKWARD-UP from the rear of the skull
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.moveTo(w*0.56, h*0.135);
      ctx.lineTo(w*0.34, h*0.005);
      ctx.lineTo(w*0.49, h*0.175);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w*0.66, h*0.125);
      ctx.lineTo(w*0.50, h*(-0.035));
      ctx.lineTo(w*0.585, h*0.15);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();

      // Eye — small, fierce, high on the head
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.195, 3.2, 3.8, 0.1, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#1a6ad8';
      ctx.beginPath(); ctx.ellipse(w*0.73, h*0.20, 1.7, 2.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(w*0.73, h*0.205, 0.9, 1.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.65, h*0.15); ctx.lineTo(w*0.79, h*0.165); ctx.stroke();
    }
  }

  _drawPiplup(ctx, w, h) {
    const pw   = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t    = Math.floor(this.animTimer / 5) % 4;
    const flick = t < 2 ? t : 4 - t;
    const OL   = '#111';

    if (pw === POWER.SMALL) {
      // Piplup — small round blue penguin
      const NAVY = '#1840a0'; const LIGHT = '#80c8f0'; const BEAK = '#f0a020';

      // Body — round navy blue
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.62, w*0.34, h*0.3, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Light blue face/belly oval
      ctx.fillStyle = LIGHT;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.64, w*0.2, h*0.22, 0.1, 0, Math.PI*2); ctx.fill();

      // Head — round, navy
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.32, w*0.24, h*0.24, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Light face patch on head
      ctx.fillStyle = LIGHT;
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.34, w*0.14, h*0.16, 0.1, 0, Math.PI*2); ctx.fill();

      // Left flipper wing (stub, navy)
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*(0.26+step*0.03), h*0.6, w*0.08, h*0.14, -0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Right flipper wing
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*(0.82-step*0.03), h*0.6, w*0.08, h*0.14, 0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Feet — small yellow-orange ovals
      ctx.fillStyle = BEAK;
      ctx.beginPath(); ctx.ellipse(w*(0.42+step*0.04), h*0.89, w*0.1, h*0.07, 0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.62-step*0.04), h*0.89, w*0.1, h*0.07, -0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Beak — small triangle pointing right
      ctx.fillStyle = BEAK;
      ctx.beginPath();
      ctx.moveTo(w*0.83, h*0.33);
      ctx.lineTo(w*0.92, h*0.38);
      ctx.lineTo(w*0.83, h*0.42);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Eyes — big white with black pupils
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.76, h*0.29, 5, 5.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.77, h*0.3, 2.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.76, h*0.26, 1.5, 1.5);

    } else if (pw === POWER.BIG) {
      // Prinplup — taller, darker navy, golden V-crest
      const NAVY = '#102870'; const LIGHT = '#a8d8f0'; const BEAK = '#d89010'; const GOLD = '#f0c020';

      // Body — taller, upright
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.32, h*0.32, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Wide white belly with oval patches
      ctx.fillStyle = '#e8f4ff';
      ctx.beginPath(); ctx.ellipse(w*0.6, h*0.62, w*0.22, h*0.26, 0.1, 0, Math.PI*2); ctx.fill();
      // Oval patches on belly
      ctx.fillStyle = LIGHT;
      ctx.beginPath(); ctx.ellipse(w*0.6, h*0.52, w*0.1, h*0.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.58, h*0.63, w*0.09, h*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.73, w*0.08, h*0.06, 0, 0, Math.PI*2); ctx.fill();

      // Flipper arms — wider, at sides
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*(0.22+step*0.03), h*0.58, w*0.1, h*0.18, -0.25, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.84-step*0.03), h*0.58, w*0.1, h*0.18, 0.25, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Legs
      ctx.fillStyle = BEAK;
      ctx.beginPath(); ctx.ellipse(w*(0.4+step*0.04), h*0.89, w*0.1, h*0.08, 0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.62-step*0.04), h*0.89, w*0.1, h*0.08, -0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Head — taller
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.3, w*0.26, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Light face patch
      ctx.fillStyle = LIGHT;
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.32, w*0.15, h*0.16, 0.1, 0, Math.PI*2); ctx.fill();

      // Golden V-shaped crest — 2 gold spikes pointing up
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.moveTo(w*0.56, h*0.12); ctx.lineTo(w*0.52, h*(-0.04)); ctx.lineTo(w*0.62, h*0.1); ctx.closePath();
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.66, h*0.1); ctx.lineTo(w*0.62, h*(-0.06)); ctx.lineTo(w*0.72, h*0.08); ctx.closePath();
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Beak
      ctx.fillStyle = BEAK;
      ctx.beginPath();
      ctx.moveTo(w*0.85, h*0.3);
      ctx.lineTo(w*0.95, h*0.34);
      ctx.lineTo(w*0.85, h*0.38);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.78, h*0.27, 5, 5.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.79, h*0.275, 2.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.78, h*0.24, 1.5, 1.5);

    } else {
      // Empoleon — large, imposing, trident crown, steel armor wings
      const NAVY = '#0a1840'; const STEEL = '#2050a8'; const BEAK = '#c87800'; const GOLD = '#f0c020';

      // Steel armor wing plates — left
      ctx.fillStyle = STEEL;
      ctx.beginPath(); ctx.ellipse(w*(0.18+step*0.03), h*0.54, w*0.12, h*0.26, -0.2, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      // Steel armor wing plates — right
      ctx.beginPath(); ctx.ellipse(w*(0.88-step*0.03), h*0.54, w*0.12, h*0.26, 0.2, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      // Wing highlights
      ctx.strokeStyle = '#4070d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.16, h*0.42); ctx.lineTo(w*0.14, h*0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.86, h*0.42); ctx.lineTo(w*0.88, h*0.7); ctx.stroke();

      // Body — large, dark navy
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.58, w*0.36, h*0.34, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=2; ctx.stroke();

      // White oval belly with blue markings
      ctx.fillStyle = '#e0eeff';
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.6, w*0.24, h*0.28, 0.1, 0, Math.PI*2); ctx.fill();
      // Blue markings on belly
      ctx.strokeStyle = STEEL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.52, w*0.12, h*0.06, 0, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.62, w*0.1, h*0.05, 0, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.72, w*0.08, h*0.04, 0, 0, Math.PI*2); ctx.stroke();

      // Strong legs
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*(0.38+step*0.04), h*0.87, w*0.12, h*0.11, 0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.64-step*0.04), h*0.87, w*0.12, h*0.11, -0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = BEAK;
      ctx.beginPath(); ctx.ellipse(w*(0.36+step*0.04), h*0.93, w*0.12, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.66-step*0.04), h*0.93, w*0.12, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Head
      ctx.fillStyle = NAVY;
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.28, w*0.28, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=2; ctx.stroke();

      // Light face patch
      ctx.fillStyle = '#c0d8f8';
      ctx.beginPath(); ctx.ellipse(w*0.74, h*0.3, w*0.16, h*0.18, 0.1, 0, Math.PI*2); ctx.fill();

      // Golden trident crown — 3 upward spikes
      ctx.fillStyle = GOLD;
      // Center spike (tallest)
      ctx.beginPath(); ctx.moveTo(w*0.62, h*0.1); ctx.lineTo(w*0.58, h*(-0.1)); ctx.lineTo(w*0.66, h*0.08); ctx.closePath();
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      // Left spike
      ctx.beginPath(); ctx.moveTo(w*0.52, h*0.12); ctx.lineTo(w*0.46, h*(-0.04)); ctx.lineTo(w*0.58, h*0.1); ctx.closePath();
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      // Right spike
      ctx.beginPath(); ctx.moveTo(w*0.72, h*0.1); ctx.lineTo(w*0.68, h*(-0.04)); ctx.lineTo(w*0.78, h*0.12); ctx.closePath();
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      // Trident base bar
      ctx.fillStyle = GOLD;
      ctx.fillRect(w*0.48, h*0.09, w*0.28, h*0.04);
      ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.strokeRect(w*0.48, h*0.09, w*0.28, h*0.04);

      // Beak — strong, orange
      ctx.fillStyle = BEAK;
      ctx.beginPath();
      ctx.moveTo(w*0.88, h*0.28);
      ctx.lineTo(w*0.98, h*0.33);
      ctx.lineTo(w*0.88, h*0.38);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.8, h*0.25, 5.5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle = '#1840a0'; ctx.beginPath(); ctx.ellipse(w*0.81, h*0.255, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.81, h*0.258, 1.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.8, h*0.22, 1.5, 1.5);
    }
  }

  _drawPichu(ctx, w, h) {
    const pw   = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const OL   = '#111';

    if (pw === POWER.SMALL) {
      // ── PICHU ── tiny pale-yellow mouse, oversized diamond ears
      const Y = '#f8e470', BLACK = '#222', CHEEK = '#f080a0';

      // Tail — small black stub triangle at lower back
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.moveTo(w*0.18, h*0.66);
      ctx.lineTo(w*0.00, h*0.56);
      ctx.lineTo(w*0.16, h*0.54);
      ctx.closePath(); ctx.fill();

      // Body — small, below the big head
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.72, w*0.32, h*0.24, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Feet
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*(0.36+step*0.04), h*0.93, w*0.11, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.64-step*0.04), h*0.93, w*0.11, h*0.06, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Ears — big diamonds, upper halves black
      // left ear
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.moveTo(w*0.30, h*0.16);
      ctx.lineTo(w*0.02, h*0.00);
      ctx.lineTo(w*0.22, h*0.30);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      // right ear
      ctx.beginPath();
      ctx.moveTo(w*0.68, h*0.14);
      ctx.lineTo(w*0.98, h*0.00);
      ctx.lineTo(w*0.80, h*0.28);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Head — big relative to body
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.38, w*0.40, h*0.28, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Black neck collar (Pichu's chest marking)
      ctx.strokeStyle = BLACK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w*0.52, h*0.50, w*0.24, 0.35, Math.PI - 0.35); ctx.stroke();

      // Pink cheeks
      ctx.fillStyle = CHEEK;
      ctx.beginPath(); ctx.ellipse(w*0.82, h*0.44, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.24, h*0.46, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();

      // Eyes — big black with shine
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.35, 3.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.40, h*0.36, 3.5, 4.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(w*0.64, h*0.31, 2, 2);
      ctx.fillRect(w*0.38, h*0.32, 2, 2);

      // Tiny nose + smile
      ctx.fillStyle = '#000';
      ctx.fillRect(w*0.52, h*0.42, 2, 1.5);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w*0.53, h*0.44, 4, 0.3, Math.PI - 0.3); ctx.stroke();

    } else if (pw === POWER.BIG) {
      // ── PIKACHU ── classic yellow, red cheeks, lightning-bolt tail
      const Y = '#f8d030', BROWN = '#a05a10', CHEEK = '#e03020', BLACK = '#222';

      // Tail — angular lightning bolt behind, on the left
      ctx.fillStyle = Y;
      ctx.beginPath();
      ctx.moveTo(w*0.28, h*0.56);            // base at lower back
      ctx.lineTo(w*0.10, h*0.50);
      ctx.lineTo(w*0.22, h*0.42);
      ctx.lineTo(w*0.02, h*0.34);
      ctx.lineTo(w*0.16, h*0.26);
      ctx.lineTo(w*(-0.06), h*0.16);
      ctx.lineTo(w*0.30, h*0.12);            // wide flat top of the bolt
      ctx.lineTo(w*0.16, h*0.24);
      ctx.lineTo(w*0.34, h*0.32);
      ctx.lineTo(w*0.20, h*0.40);
      ctx.lineTo(w*0.36, h*0.48);
      ctx.closePath();
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();
      // Brown base of tail
      ctx.fillStyle = BROWN;
      ctx.beginPath();
      ctx.moveTo(w*0.28, h*0.56);
      ctx.lineTo(w*0.36, h*0.48);
      ctx.lineTo(w*0.40, h*0.56);
      ctx.closePath(); ctx.fill();

      // Body — upright oval
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.66, w*0.34, h*0.28, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Brown back stripes
      ctx.strokeStyle = BROWN; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w*0.34, h*0.58, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.34, h*0.66, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();

      // Feet
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*(0.36+step*0.05), h*0.94, w*0.13, h*0.05, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.66-step*0.05), h*0.94, w*0.13, h*0.05, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Arms — short stubs
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*0.80, h*0.62, w*0.08, h*0.05, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();

      // Ears — long, pointed, black tips
      // left ear
      ctx.fillStyle = Y;
      ctx.beginPath();
      ctx.moveTo(w*0.32, h*0.20);
      ctx.lineTo(w*0.12, h*0.00);
      ctx.lineTo(w*0.44, h*0.14);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.moveTo(w*0.12, h*0.00);
      ctx.lineTo(w*0.22, h*0.095);
      ctx.lineTo(w*0.28, h*0.045);
      ctx.closePath(); ctx.fill();
      // right ear
      ctx.fillStyle = Y;
      ctx.beginPath();
      ctx.moveTo(w*0.66, h*0.19);
      ctx.lineTo(w*0.90, h*0.00);
      ctx.lineTo(w*0.78, h*0.16);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.moveTo(w*0.90, h*0.00);
      ctx.lineTo(w*0.80, h*0.085);
      ctx.lineTo(w*0.86, h*0.06);
      ctx.closePath(); ctx.fill();

      // Head
      ctx.fillStyle = Y;
      ctx.beginPath(); ctx.ellipse(w*0.54, h*0.30, w*0.32, h*0.18, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Red cheeks
      ctx.fillStyle = CHEEK;
      ctx.beginPath(); ctx.ellipse(w*0.80, h*0.35, 4.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.30, h*0.36, 4.5, 4, 0, 0, Math.PI*2); ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(w*0.68, h*0.27, 3, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.44, h*0.28, 3, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(w*0.665, h*0.245, 2, 2);
      ctx.fillRect(w*0.425, h*0.255, 2, 2);

      // Nose + mouth
      ctx.fillStyle = '#000';
      ctx.fillRect(w*0.55, h*0.33, 2, 1.5);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w*0.56, h*0.345, 4, 0.3, Math.PI - 0.3); ctx.stroke();

    } else {
      // ── RAICHU ── orange, cream belly, long thin tail with big bolt tip
      const OR = '#f09030', CREAM = '#f8e0b0', CHEEK = '#f8d838', BROWN = '#7a4a10';

      // Tail — thin dark curve sweeping up-left, bolt shape at tip
      ctx.strokeStyle = BROWN; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.26, h*0.62);
      ctx.bezierCurveTo(w*0.00, h*0.56, w*(-0.10), h*0.36, w*0.02, h*0.20);
      ctx.stroke();
      // Bolt at tail tip — angular arrow-like polygon
      ctx.fillStyle = CHEEK;
      ctx.beginPath();
      ctx.moveTo(w*0.02, h*0.22);
      ctx.lineTo(w*(-0.12), h*0.14);
      ctx.lineTo(w*(-0.02), h*0.12);
      ctx.lineTo(w*(-0.10), h*0.02);
      ctx.lineTo(w*0.10, h*0.08);
      ctx.lineTo(w*0.02, h*0.10);
      ctx.lineTo(w*0.12, h*0.18);
      ctx.closePath();
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();

      // Body
      ctx.fillStyle = OR;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.64, w*0.36, h*0.30, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Cream belly
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.56, h*0.68, w*0.22, h*0.20, 0.05, 0, Math.PI*2); ctx.fill();

      // Feet
      ctx.fillStyle = OR;
      ctx.beginPath(); ctx.ellipse(w*(0.34+step*0.05), h*0.95, w*0.14, h*0.05, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.66-step*0.05), h*0.95, w*0.14, h*0.05, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Arms
      ctx.fillStyle = OR;
      ctx.beginPath(); ctx.ellipse(w*0.82, h*0.58, w*0.08, h*0.055, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();

      // Ears — long, angled outward, curled tips (dark with yellow inner)
      // left ear
      ctx.fillStyle = BROWN;
      ctx.beginPath();
      ctx.moveTo(w*0.34, h*0.16);
      ctx.lineTo(w*0.04, h*0.02);
      ctx.lineTo(w*0.14, h*0.14);
      ctx.lineTo(w*0.30, h*0.24);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = CHEEK;
      ctx.beginPath(); ctx.ellipse(w*0.10, h*0.055, 3, 2.5, -0.5, 0, Math.PI*2); ctx.fill();
      // right ear
      ctx.fillStyle = BROWN;
      ctx.beginPath();
      ctx.moveTo(w*0.66, h*0.15);
      ctx.lineTo(w*0.96, h*0.01);
      ctx.lineTo(w*0.86, h*0.13);
      ctx.lineTo(w*0.72, h*0.23);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = CHEEK;
      ctx.beginPath(); ctx.ellipse(w*0.90, h*0.045, 3, 2.5, 0.5, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = OR;
      ctx.beginPath(); ctx.ellipse(w*0.54, h*0.28, w*0.30, h*0.17, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

      // Yellow cheeks
      ctx.fillStyle = CHEEK;
      ctx.beginPath(); ctx.ellipse(w*0.79, h*0.33, 4.5, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.30, h*0.34, 4.5, 4, 0, 0, Math.PI*2); ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(w*0.67, h*0.25, 3, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.44, h*0.26, 3, 4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(w*0.655, h*0.225, 2, 2);
      ctx.fillRect(w*0.425, h*0.235, 2, 2);

      // Nose + mouth
      ctx.fillStyle = '#000';
      ctx.fillRect(w*0.55, h*0.305, 2, 1.5);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w*0.56, h*0.32, 4.5, 0.3, Math.PI - 0.3); ctx.stroke();
    }
  }

  _drawBulbasaur(ctx, w, h) {
    const pw = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t = Math.floor(this.animTimer / 6) % 4;
    const flick = t < 2 ? t : 4 - t;
    const OL = '#111';
    const jumping = !this.onGround;

    if (pw === POWER.SMALL) {
      // Bulbasaur — green, round, quadruped, seed bulb on back
      const SKIN = '#78c060'; const DARK = '#4a8838'; const SPOT = '#5a9a48'; const BULB = '#3a6820'; const BULB2 = '#2a5018'; const CREAM = '#e8f0c8';

      // Seed bulb (left/back of sprite, on top)
      ctx.fillStyle = BULB;
      ctx.beginPath(); ctx.ellipse(w*0.26, h*0.26, w*0.22, h*0.2, -0.1, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = BULB2;
      ctx.beginPath(); ctx.ellipse(w*0.26, h*0.24, w*0.14, h*0.12, -0.1, 0, Math.PI*2); ctx.fill();
      // Bulb grooves
      ctx.strokeStyle = BULB2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.26, h*0.07); ctx.lineTo(w*0.26, h*0.42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.08, h*0.18); ctx.lineTo(w*0.44, h*0.32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.44, h*0.18); ctx.lineTo(w*0.08, h*0.32); ctx.stroke();

      // Hind legs (left/back)
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.18+step*0.04), h*0.86, w*0.1, h*0.1, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.34-step*0.04), h*0.86, w*0.1, h*0.1, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Body — round, green, spots
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.64, w*0.42, h*0.28, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      // Cream belly strip
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.66, w*0.2, h*0.17, 0.2, 0, Math.PI*2); ctx.fill();
      // Dark spots
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.7, w*0.07, h*0.055, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.76, w*0.06, h*0.05, 0, 0, Math.PI*2); ctx.fill();

      // Front legs (right side)
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.6+step*0.04), h*0.86, w*0.1, h*0.1, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.74-step*0.04), h*0.86, w*0.1, h*0.1, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Head — attached to right of body
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.76, h*0.4, w*0.22, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      // Ear nubs
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.24, w*0.06, h*0.07, -0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.88, h*0.24, w*0.06, h*0.07, 0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      // Cheek spots
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.86, h*0.42, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      // Eye — large red
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.37, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b1010'; ctx.beginPath(); ctx.ellipse(w*0.83, h*0.38, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.82, h*0.34, 2, 2);

    } else if (pw === POWER.BIG) {
      // Ivysaur — larger, closed pink tulip bud on splayed leaves
      const SKIN = '#6aac58'; const DARK = '#3a7030'; const SPOT = '#4a8440'; const CREAM = '#d8e8b0';
      const bx = w*0.27, byT = h*0.30;   // bud base center

      // Splayed leaves under the bud — 4 pointed fronds radiating out
      const leaf = (ang, len, wid) => {
        const tx = bx + Math.cos(ang)*len, ty = byT + Math.sin(ang)*len;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        ctx.fillStyle = '#2a7828';
        ctx.beginPath();
        ctx.moveTo(bx, byT);
        ctx.quadraticCurveTo(bx + px*wid + Math.cos(ang)*len*0.45, byT + py*wid + Math.sin(ang)*len*0.45, tx, ty);
        ctx.quadraticCurveTo(bx - px*wid + Math.cos(ang)*len*0.45, byT - py*wid + Math.sin(ang)*len*0.45, bx, byT);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
        // Center vein
        ctx.strokeStyle = '#68b858'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(bx, byT); ctx.lineTo(tx, ty); ctx.stroke();
      };
      leaf(Math.PI * 0.95, w*0.30, w*0.09);   // left
      leaf(Math.PI * 0.70, w*0.26, w*0.08);   // upper-left
      leaf(Math.PI * 0.28, w*0.28, w*0.08);   // upper-right
      leaf(Math.PI * 0.05, w*0.30, w*0.09);   // right

      // Closed tulip bud — three pointed petals converging upward
      const petal = (cxp, tipX, tipY, wid, fill) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(cxp - wid, byT);
        ctx.quadraticCurveTo(cxp - wid*1.1, byT - h*0.10, tipX, tipY);
        ctx.quadraticCurveTo(cxp + wid*1.1, byT - h*0.10, cxp + wid, byT);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
      };
      // Side petals lean outward, center petal on top — sway with flick
      petal(bx - w*0.07, bx - w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
      petal(bx + w*0.07, bx + w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
      petal(bx,          bx,          h*0.055 - flick*0.4, w*0.085, '#e868bc');
      // Green calyx cup wrapping the bud base
      ctx.fillStyle = '#2a6828';
      ctx.beginPath();
      ctx.moveTo(bx - w*0.15, byT - h*0.02);
      ctx.quadraticCurveTo(bx, byT + h*0.09, bx + w*0.15, byT - h*0.02);
      ctx.lineTo(bx + w*0.11, byT + h*0.06);
      ctx.quadraticCurveTo(bx, byT + h*0.12, bx - w*0.11, byT + h*0.06);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();

      // Hind legs
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.16+step*0.04), h*0.85, w*0.1, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.32-step*0.04), h*0.85, w*0.1, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Body
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.62, w*0.4, h*0.27, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.64, w*0.19, h*0.18, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.3, h*0.68, w*0.07, h*0.055, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.74, w*0.055, h*0.045, 0, 0, Math.PI*2); ctx.fill();

      // Front legs
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.62+step*0.04), h*0.85, w*0.1, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.76-step*0.04), h*0.85, w*0.1, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Head
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.76, h*0.38, w*0.22, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.24, w*0.07, h*0.08, -0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.88, h*0.23, w*0.07, h*0.08, 0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.365, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7a1a20'; ctx.beginPath(); ctx.ellipse(w*0.83, h*0.375, 2.2, 2.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.82, h*0.345, 1.8, 1.8);

    } else {
      // Venusaur — huge open flower on a trunk, heavy body
      const SKIN = '#5a9848'; const DARK = '#3a6830'; const SPOT = '#4a8040'; const CREAM = '#c8e0a0';

      const fx = w*0.30, fy = h*0.17;   // flower center

      // Big green fronds under the flower — radiating pointed leaves
      const frond = (ang, len, wid) => {
        const ox = fx, oy = fy + h*0.10;
        const tx = ox + Math.cos(ang)*len, ty = oy + Math.sin(ang)*len;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        ctx.fillStyle = '#2a6828';
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + px*wid + Math.cos(ang)*len*0.45, oy + py*wid + Math.sin(ang)*len*0.45, tx, ty);
        ctx.quadraticCurveTo(ox - px*wid + Math.cos(ang)*len*0.45, oy - py*wid + Math.sin(ang)*len*0.45, ox, oy);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = '#5aa848'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      };
      frond(Math.PI * 0.94, w*0.44, w*0.11);
      frond(Math.PI * 0.62, w*0.34, w*0.10);
      frond(Math.PI * 0.35, w*0.34, w*0.10);
      frond(Math.PI * 0.04, w*0.44, w*0.11);

      // Brown trunk supporting the flower
      ctx.fillStyle = '#8a5a28';
      ctx.beginPath();
      ctx.moveTo(fx - w*0.09, fy + h*0.16);
      ctx.lineTo(fx - w*0.06, fy + h*0.04);
      ctx.lineTo(fx + w*0.06, fy + h*0.04);
      ctx.lineTo(fx + w*0.09, fy + h*0.16);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();

      // Open flower — 6 large pointed petals, sway with flick
      const fpetal = (ang, shade) => {
        const len = w*0.38 + flick*0.4, wid = w*0.14;
        const tx = fx + Math.cos(ang)*len, ty = fy + Math.sin(ang)*len*0.85;
        const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + px*wid + Math.cos(ang)*len*0.4, fy + py*wid + Math.sin(ang)*len*0.35, tx, ty);
        ctx.quadraticCurveTo(fx - px*wid + Math.cos(ang)*len*0.4, fy - py*wid + Math.sin(ang)*len*0.35, fx, fy);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.1; ctx.stroke();
        // Petal ridge line
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(fx + Math.cos(ang)*len*0.25, fy + Math.sin(ang)*len*0.22);
        ctx.lineTo(tx - Math.cos(ang)*3, ty - Math.sin(ang)*3); ctx.stroke();
      };
      for (let i = 0; i < 6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/2;
        fpetal(a, i % 2 === 0 ? '#e84868' : '#f06888');
      }
      // Flower center — golden with dots
      ctx.fillStyle = '#f8c840';
      ctx.beginPath(); ctx.arc(fx, fy, w*0.10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#c09000';
      ctx.beginPath(); ctx.arc(fx - w*0.03, fy - h*0.012, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx + w*0.035, fy + h*0.008, 1.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy + h*0.02, 1.3, 0, Math.PI*2); ctx.fill();

      // Hind legs
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.18+step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.32-step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Body — bulkier and lower than Ivysaur's
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.66, w*0.47, h*0.26, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.68, w*0.22, h*0.17, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.72, w*0.08, h*0.055, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.78, w*0.06, h*0.05, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.2, h*0.58, w*0.06, h*0.05, 0.3, 0, Math.PI*2); ctx.fill();

      // Front legs
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.64+step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.78-step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Head
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.4, w*0.22, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.74, h*0.25, w*0.07, h*0.09, -0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.9, h*0.24, w*0.07, h*0.09, 0.3, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.84, h*0.385, 4, 4.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b1010'; ctx.beginPath(); ctx.ellipse(w*0.85, h*0.395, 2.2, 2.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.84, h*0.36, 1.8, 1.8);
      // Fierce brow
      ctx.strokeStyle = DARK; ctx.lineWidth = 2;
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

    const BODY  = COLORS.eeveeBody;  // '#c8864a'
    const RUFF  = COLORS.eeveeRuff;  // '#f5e6c8'
    const EAR_I = COLORS.eeveeEarIn; // '#e8a87c'
    const EYE   = COLORS.eeveeEye;   // '#2a1a0a'
    const SHINE = '#fff';
    const TAIL  = COLORS.eeveeRuff;
    const ruffCol = RUFF;

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

    const big = h > PLAYER_SMALL_H + 2;

    // Dispatch to character family
    if (this.char === 'charmander') {
      this._drawCharmander(ctx, w, h);
      ctx.restore();
      return;
    }
    if (this.char === 'piplup') {
      this._drawPiplup(ctx, w, h);
      ctx.restore();
      return;
    }
    if (this.char === 'pichu') {
      this._drawPichu(ctx, w, h);
      ctx.restore();
      return;
    }
    if (this.char === 'bulbasaur') {
      this._drawBulbasaur(ctx, w, h);
      ctx.restore();
      return;
    }
    // default: eevee family (existing code)

    // Dispatch big forms to dedicated drawers
    if (big && !this.crouching) {
      if (this.power === POWER.BIG || this.power === POWER.FIRE) {
        this._drawUmbreon(ctx, w, h, this.power === POWER.FIRE);
        ctx.restore();
        return;
      }
    }

    if (big && this.crouching) {
      this._drawCrouchUmbreon(ctx, w, h);
      ctx.restore();
      return;
    }

    if (this.crouching) {
      // Crouched small Eevee — squashed
      const bh = h; // currently PLAYER_SMALL_H due to crouch shrink
      // Body oval squashed
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.ellipse(w / 2, bh * 0.55, w * 0.44, bh * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ruff
      ctx.fillStyle = ruffCol;
      ctx.beginPath();
      ctx.ellipse(w / 2, bh * 0.38, w * 0.38, bh * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Flattened ears
      ctx.fillStyle = BODY;
      ctx.fillRect(w * 0.1, bh * 0.02, w * 0.22, bh * 0.22);
      ctx.fillRect(w * 0.62, bh * 0.02, w * 0.22, bh * 0.22);
      ctx.fillStyle = EAR_I;
      ctx.fillRect(w * 0.14, bh * 0.05, w * 0.14, bh * 0.14);
      ctx.fillRect(w * 0.65, bh * 0.05, w * 0.14, bh * 0.14);
      // Eyes
      ctx.fillStyle = EYE;
      ctx.beginPath(); ctx.ellipse(w * 0.34, bh * 0.32, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.66, bh * 0.32, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SHINE;
      ctx.fillRect(w * 0.33, bh * 0.28, 2, 2);
      ctx.fillRect(w * 0.65, bh * 0.28, 2, 2);
      // Little stub legs
      ctx.fillStyle = BODY;
      ctx.fillRect(w * 0.2, bh * 0.78, w * 0.15, h * 0.2);
      ctx.fillRect(w * 0.6, bh * 0.78, w * 0.15, h * 0.2);
    } else {
      // SMALL Eevee (28x32)
      const jumping = !this.onGround;

      // Body oval
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.7, w * 0.44, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ruff
      ctx.fillStyle = ruffCol;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.38, Math.PI * 0.1, Math.PI * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.52, w * 0.35, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.3, w * 0.34, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      const earTilt = jumping ? 0.4 : 0;
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.2);
      ctx.lineTo(w * (0.08 + earTilt * 0.1), h * (0.0 - earTilt * 0.02));
      ctx.lineTo(w * 0.35, h * 0.14);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.64, h * 0.2);
      ctx.lineTo(w * (0.8 - earTilt * 0.1), h * (0.0 - earTilt * 0.02));
      ctx.lineTo(w * 0.72, h * 0.14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = EAR_I;
      ctx.beginPath();
      ctx.moveTo(w * 0.23, h * 0.18);
      ctx.lineTo(w * (0.14 + earTilt * 0.08), h * 0.05);
      ctx.lineTo(w * 0.34, h * 0.15);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.65, h * 0.18);
      ctx.lineTo(w * (0.74 - earTilt * 0.08), h * 0.05);
      ctx.lineTo(w * 0.70, h * 0.15);
      ctx.closePath(); ctx.fill();

      // Eyes
      ctx.fillStyle = EYE;
      ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.28, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.28, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SHINE;
      ctx.fillRect(w * 0.35, h * 0.24, 2, 2);
      ctx.fillRect(w * 0.63, h * 0.24, 2, 2);

      // Legs
      ctx.fillStyle = BODY;
      if (jumping) {
        // tuck up
        ctx.fillRect(w * 0.2, h * 0.82, w * 0.2, h * 0.1);
        ctx.fillRect(w * 0.56, h * 0.76, w * 0.2, h * 0.1);
      } else {
        const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
        ctx.fillRect(w * (0.18 + step * 0.07), h * 0.82, w * 0.2, h * 0.16);
        ctx.fillRect(w * (0.54 - step * 0.07), h * 0.82, w * 0.2, h * 0.16);
      }
    }

    ctx.restore();
  }
}
