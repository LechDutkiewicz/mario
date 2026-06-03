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
    if (this.invincible > 0 || this.dead) return false;
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
    if (this.fireCooldown > 0) this.fireCooldown--;
    this.animTimer++;

    // FSM-accurate movement: friction always applied, then accel added
    this.vx *= FRICTION;
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    const accel = input.run ? PLAYER_RUN_ACCEL : PLAYER_ACCEL;
    if (input.left)  { this.vx -= accel; this.facing = -1; }
    if (input.right) { this.vx += accel; this.facing  =  1; }
    if (this.vx >  PLAYER_SPEED) this.vx =  PLAYER_SPEED;
    if (this.vx < -PLAYER_SPEED) this.vx = -PLAYER_SPEED;

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

    // Gravity
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Shoot flamethrower
    if (input.firePressed && this.power === POWER.FIRE && this.fireCooldown <= 0) {
      game.spawnFireball(this);
      this.fireCooldown = 20;
    }

    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;
    if (this.onGround) this.isJumping = false;

    for (const block of res.hitBelow) {
      if (block.onBump) block.onBump(game);
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
          s.onBump(game);
        }
      }
    }

    if (this.y > 800) this.die();
    if (this.x < 0) { this.x = 0; this.vx = 0; }
  }

  _drawUmbreon(ctx, w, h) {
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
  }

  _drawFlareon(ctx, w, h) {
    const BODY  = '#f5d890';
    const MANE  = '#d03800';
    const MANE2 = '#f06000';
    const MANE3 = '#ff9900';
    const EYE   = '#2a1a0a';
    const OL    = '#111';
    const jumping = !this.onGround;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t = Math.floor(this.animTimer / 5) % 4;
    const flick = t < 2 ? t : 4 - t;

    // Bushy tail — left side, cream with flame tips
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.1, h*0.5, w*0.14, h*0.22, -0.2, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle = MANE2;
    ctx.beginPath(); ctx.ellipse(w*0.04, h*0.34, 5+flick, 8+flick, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*(-0.02), h*0.46, 4+flick, 7+flick, 0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = MANE3;
    ctx.beginPath(); ctx.ellipse(w*0.04, h*0.32, 3, 5+flick*0.7, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*(-0.02), h*0.44, 2.5, 4+flick*0.7, 0.2, 0, Math.PI*2); ctx.fill();

    // Main body
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.35, h*0.24, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

    // Legs — two pairs
    const ly = h * 0.82;
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*(0.28+step*0.05), ly, w*0.09, h*0.1, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.44-step*0.05), ly, w*0.09, h*0.1, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.6+step*0.05), ly, w*0.09, h*0.1, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*(0.74-step*0.05), ly, w*0.09, h*0.1, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

    // Fluffy mane — large, multi-layer, fills left+center of top half
    const maneBlobs = [
      [w*0.18, h*0.32, w*0.16, h*0.18, 0],
      [w*0.3,  h*0.24, w*0.16, h*0.2,  0],
      [w*0.44, h*0.2,  w*0.16, h*0.2,  0],
      [w*0.56, h*0.26, w*0.14, h*0.18, 0],
      [w*0.22, h*0.44, w*0.14, h*0.16, 0],
      [w*0.36, h*0.42, w*0.14, h*0.16, 0],
    ];
    for (const [mx,my,mrx,mry] of maneBlobs) {
      ctx.fillStyle = MANE;
      ctx.beginPath(); ctx.ellipse(mx, my, mrx, mry, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
    }
    const maneBlobs2 = [
      [w*0.28, h*0.3,  w*0.13, h*0.15, 0],
      [w*0.44, h*0.26, w*0.13, h*0.16, 0],
      [w*0.56, h*0.32, w*0.11, h*0.14, 0],
    ];
    for (const [mx,my,mrx,mry] of maneBlobs2) {
      ctx.fillStyle = MANE2;
      ctx.beginPath(); ctx.ellipse(mx, my, mrx, mry, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = MANE3;
      ctx.beginPath(); ctx.ellipse(mx, my, mrx*0.55, mry*0.55, 0, 0, Math.PI*2); ctx.fill();
    }

    // Head — visible above/right of mane
    ctx.fillStyle = BODY;
    ctx.beginPath(); ctx.ellipse(w*0.78, h*0.26, w*0.2, h*0.16, 0, 0, Math.PI*2);
    ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

    // Ears — pointed, flame-tipped
    const tilt = jumping ? 0.05 : 0;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w*0.7, h*0.17); ctx.lineTo(w*(0.64+tilt), h*0.02); ctx.lineTo(w*0.76, h*0.14);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w*0.84, h*0.16); ctx.lineTo(w*(0.9-tilt), h*0.02); ctx.lineTo(w*0.93, h*0.14);
    ctx.closePath(); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
    ctx.fillStyle = MANE2;
    ctx.beginPath(); ctx.moveTo(w*(0.64+tilt), h*0.02); ctx.lineTo(w*(0.62+tilt), h*-0.04); ctx.lineTo(w*0.73, h*0.12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w*(0.9-tilt), h*0.02); ctx.lineTo(w*(0.93-tilt), h*-0.04); ctx.lineTo(w*0.87, h*0.12); ctx.closePath(); ctx.fill();

    // Eye
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w*0.87, h*0.25, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(w*0.865, h*0.22, 1.5, 1.5);
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

  _drawCrouchFlareon(ctx, w, h) {
    // Squashed Flareon — compact crouching form
    const BODY  = '#f5d090';
    const MANE  = '#e84a0c';
    const MANE2 = '#ff8c00';
    const EYE   = '#2a1a0a';
    const SHINE = '#fff';
    const t = Math.floor(this.animTimer / 4) % 3;

    ctx.save();

    // Body — wide and squat
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.64, w * 0.46, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Compressed mane/collar — wider, shorter
    ctx.fillStyle = MANE;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.42, w * 0.46, Math.PI * 0.05, Math.PI * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MANE2;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.44, w * 0.38, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Flame flicker — shorter peaks
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.38, w * 0.22 + (t === 0 ? 3 : 0), h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head — low and wide
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.24, w * 0.35, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Short flat ears
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.16);
    ctx.lineTo(w * 0.12, h * 0.04);
    ctx.lineTo(w * 0.36, h * 0.13);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.16);
    ctx.lineTo(w * 0.78, h * 0.04);
    ctx.lineTo(w * 0.72, h * 0.13);
    ctx.closePath(); ctx.fill();
    // Flame ear tips
    ctx.fillStyle = MANE;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.04);
    ctx.lineTo(w * 0.1, h * (-0.02));
    ctx.lineTo(w * 0.24, h * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.78, h * 0.04);
    ctx.lineTo(w * 0.8, h * (-0.02));
    ctx.lineTo(w * 0.7, h * 0.1);
    ctx.closePath(); ctx.fill();

    // Eyes
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.24, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.24, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SHINE;
    ctx.fillRect(w * 0.35, h * 0.2, 2, 2);
    ctx.fillRect(w * 0.63, h * 0.2, 2, 2);

    // Stub legs
    ctx.fillStyle = BODY;
    ctx.fillRect(w * 0.18, h * 0.82, w * 0.2, h * 0.16);
    ctx.fillRect(w * 0.56, h * 0.82, w * 0.2, h * 0.16);

    ctx.restore();
  }

  _drawCharmander(ctx, w, h) {
    const pw     = this.power;
    const anim   = this.animTimer;
    const moving = Math.abs(this.vx) > 0.3;
    const lp     = moving ? Math.sin(anim * 0.35) : 0; // leg phase
    const flick  = Math.sin(anim * 0.28) * 1.2;
    const OL     = '#222';

    const flame = (fx, fy, s) => {
      ctx.fillStyle = '#c83000';
      ctx.beginPath(); ctx.ellipse(fx, fy, s*3.5, s*7+flick*s*0.7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff5500';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*2.5, s*2.4, s*5+flick*s*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*4.2, s*1.4, s*3+flick*s*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffee88';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*5.5, s*0.7, s*1.6, 0, 0, Math.PI*2); ctx.fill();
    };

    if (pw === POWER.SMALL) {
      // ── CHARMANDER ── small orange lizard, round and cute
      const C = '#f07030', D = '#c84808', CREAM = '#f8e890', CLAW = '#f0f0c0';

      // Tail: starts mid-left of body, curves left then hooks UP
      // This S-curve reads clearly as a tail
      ctx.strokeStyle = D; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.28, h*0.70);
      ctx.bezierCurveTo(w*0.02, h*0.74, w*(-0.06), h*0.58, w*0.04, h*0.42);
      ctx.stroke();
      flame(w*0.04, h*0.35, 0.68);

      // Legs
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(w*(0.40+lp*0.04), h*0.87, w*0.095, h*0.082, lp*0.15, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.60-lp*0.04), h*0.87, w*0.095, h*0.082, -lp*0.15, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CLAW;
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*(0.40+lp*0.04)+i*4, h*0.935, 2.2, 3.2, 0, 0, Math.PI*2); ctx.fill(); }
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*(0.60-lp*0.04)+i*4, h*0.935, 2.2, 3.2, 0, 0, Math.PI*2); ctx.fill(); }

      // Body
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.63, w*0.33, h*0.24, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.62, h*0.65, w*0.17, h*0.18, 0.15, 0, Math.PI*2); ctx.fill();

      // Arm stub
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(w*0.82, h*0.60, w*0.09, h*0.06, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Head
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(w*0.70, h*0.32, w*0.27, h*0.26, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.80, h*0.27, 5.2, 5.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3070e8'; ctx.beginPath(); ctx.ellipse(w*0.81, h*0.28, 3.0, 3.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.81, h*0.285, 1.6, 2.0, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.795, h*0.265, 1.3, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = D; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(w*0.81, h*0.38, w*0.065, 0.1, Math.PI-0.1); ctx.stroke();
      ctx.fillStyle = D; ctx.beginPath(); ctx.ellipse(w*0.92, h*0.345, 1.6, 1.2, 0, 0, Math.PI*2); ctx.fill();

    } else if (pw === POWER.BIG) {
      // ── CHARMELEON ── taller, dark red, single horn, red eyes
      const C = '#c82808', D = '#8c1a04', CREAM = '#f8d870', CLAW = '#f0f0b0';

      // Tail: emerges from lower-back, swings LEFT then curves UP
      // Key: tail tip ends HIGH and LEFT so flame is clearly up in the air
      ctx.strokeStyle = D; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.24, h*0.78);
      ctx.bezierCurveTo(w*(-0.02), h*0.82, w*(-0.12), h*0.64, w*(-0.06), h*0.44);
      ctx.stroke();
      // Flame goes UP from tail tip — clearly separated from body
      flame(w*(-0.06), h*0.36, 0.82);

      // Legs
      const la = lp * 0.05, lb = -lp * 0.05;
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
      // Back leg
      ctx.beginPath(); ctx.roundRect(w*(0.22+la)-8, h*0.76, 16, h*0.22, 5);
      ctx.fill(); ctx.stroke();
      // Front leg
      ctx.beginPath(); ctx.roundRect(w*(0.56+lb)-8, h*0.76, 16, h*0.22, 5);
      ctx.fill(); ctx.stroke();
      // Claws
      ctx.fillStyle = CLAW;
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*(0.22+la)+i*5, h*0.975, 2.5, 3.8, 0, 0, Math.PI*2); ctx.fill(); }
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*(0.56+lb)+i*5, h*0.975, 2.5, 3.8, 0, 0, Math.PI*2); ctx.fill(); }

      // Body — upright oval
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(w*0.46, h*0.58, w*0.28, h*0.26, -0.05, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.57, h*0.60, w*0.15, h*0.20, 0.1, 0, Math.PI*2); ctx.fill();

      // Arm
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(w*0.75, h*0.55, w*0.10, h*0.07, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CLAW;
      ctx.beginPath(); ctx.ellipse(w*0.84, h*0.59, 2.8, 4.2, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.88, h*0.57, 2.8, 4.2, -0.2, 0, Math.PI*2); ctx.fill();

      // Neck — connects body to head
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(w*0.61, h*0.37, w*0.12, h*0.10, -0.2, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // Head — simple rounded rectangle shape, clearly lizard-like
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(w*0.48, h*0.15); ctx.lineTo(w*0.80, h*0.15);
      ctx.bezierCurveTo(w*0.92, h*0.15, w*0.96, h*0.22, w*0.96, h*0.28);
      ctx.lineTo(w*0.96, h*0.34); ctx.lineTo(w*0.48, h*0.36);
      ctx.bezierCurveTo(w*0.42, h*0.36, w*0.40, h*0.30, w*0.40, h*0.26);
      ctx.bezierCurveTo(w*0.40, h*0.20, w*0.44, h*0.15, w*0.48, h*0.15);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Lower jaw slightly darker
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.moveTo(w*0.50, h*0.30); ctx.lineTo(w*0.96, h*0.30); ctx.lineTo(w*0.96, h*0.36);
      ctx.lineTo(w*0.50, h*0.36); ctx.closePath(); ctx.fill();

      // Horn — single, on top of head, points backward (left-up)
      ctx.fillStyle = '#b8a840'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w*0.68, h*0.15);
      ctx.lineTo(w*0.52, h*0.02);
      ctx.lineTo(w*0.72, h*0.17);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Eye — simple oval, red iris, angry slant
      ctx.fillStyle = '#d0e4f8'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.22, 4.5, 5.2, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.225, 2.5, 3.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.228, 1.2, 1.7, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.806, h*0.208, 1.2, 0, Math.PI*2); ctx.fill();
      // Brow
      ctx.strokeStyle = D; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.76, h*0.155); ctx.lineTo(w*0.87, h*0.145); ctx.stroke();

    } else {
      // ── CHARIZARD ── bipedal orange dragon, large teal bat wings
      const C = '#f06020', D = '#c03010', CREAM = '#f8e878', W1 = '#1e6848', W2 = '#2a9460', CLAW = '#e8e898';

      // === TAIL — curves down-left from body base, flame at tip ===
      ctx.strokeStyle = D; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w*0.38, h*0.80);
      ctx.bezierCurveTo(w*0.16, h*0.92, w*0.02, h*0.88, w*(-0.04), h*0.72);
      ctx.stroke();
      ctx.strokeStyle = C; ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(w*0.36, h*0.80);
      ctx.bezierCurveTo(w*0.16, h*0.90, w*0.03, h*0.86, w*(-0.03), h*0.73);
      ctx.stroke();
      flame(w*(-0.04), h*0.62, 1.0);

      // === LEFT WING — bat wing behind body, 3 finger-tip points at top ===
      ctx.fillStyle = W1; ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w*0.38, h*0.42);            // wing root at left shoulder
      // sweep up-left to 1st finger tip
      ctx.bezierCurveTo(w*0.10, h*0.28, w*(-0.10), h*0.10, w*(-0.18), h*0.00);
      ctx.bezierCurveTo(w*(-0.22), h*(-0.04), w*(-0.14), h*0.10, w*(-0.06), h*0.16); // finger 1 dip
      // sweep to 2nd finger tip
      ctx.bezierCurveTo(w*(-0.14), h*0.20, w*(-0.18), h*0.26, w*(-0.14), h*0.30);
      ctx.bezierCurveTo(w*(-0.10), h*0.34, w*(-0.02), h*0.36, w*0.06, h*0.38); // finger 2 base
      // lower membrane back to body
      ctx.bezierCurveTo(w*0.14, h*0.52, w*0.28, h*0.56, w*0.36, h*0.54);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // lighter inner membrane
      ctx.fillStyle = W2;
      ctx.beginPath();
      ctx.moveTo(w*0.36, h*0.50);
      ctx.bezierCurveTo(w*0.16, h*0.36, w*(-0.02), h*0.22, w*0.00, h*0.34);
      ctx.bezierCurveTo(w*0.04, h*0.44, w*0.20, h*0.52, w*0.34, h*0.50);
      ctx.closePath(); ctx.fill();
      // wing ribs
      ctx.strokeStyle = '#145030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.36,h*0.48); ctx.bezierCurveTo(w*0.10,h*0.32,w*(-0.08),h*0.32,w*(-0.04),h*0.42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.36,h*0.44); ctx.bezierCurveTo(w*0.18,h*0.18,w*(0.02),h*0.12,w*(0.04),h*0.24); ctx.stroke();

      // === RIGHT WING — smaller bat wing on right side, 2 finger tips ===
      ctx.fillStyle = W1; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w*0.62, h*0.42);
      ctx.bezierCurveTo(w*0.84, h*0.26, w*1.04, h*0.08, w*1.10, h*(-0.02));
      ctx.bezierCurveTo(w*1.14, h*(-0.06), w*1.06, h*0.10, w*0.98, h*0.16); // finger 1
      ctx.bezierCurveTo(w*1.04, h*0.22, w*1.08, h*0.30, w*1.04, h*0.36);
      ctx.bezierCurveTo(w*1.00, h*0.40, w*0.90, h*0.44, w*0.82, h*0.46); // finger 2
      ctx.bezierCurveTo(w*0.78, h*0.54, w*0.70, h*0.56, w*0.64, h*0.54);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = W2;
      ctx.beginPath();
      ctx.moveTo(w*0.64, h*0.50);
      ctx.bezierCurveTo(w*0.82, h*0.34, w*1.00, h*0.24, w*0.98, h*0.38);
      ctx.bezierCurveTo(w*0.90, h*0.48, w*0.76, h*0.52, w*0.66, h*0.50);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#145030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.64,h*0.48); ctx.bezierCurveTo(w*0.86,h*0.32,w*1.02,h*0.30,w*0.98,h*0.40); ctx.stroke();

      // === TWO BACK LEGS (bipedal — thick, like T-rex) ===
      const la = lp * 0.05, lb = -lp * 0.05;
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      // left leg
      ctx.beginPath(); ctx.roundRect(w*0.32+la*w-10, h*0.74, 20, h*0.24, 5); ctx.fill(); ctx.stroke();
      // right leg
      ctx.beginPath(); ctx.roundRect(w*0.58+lb*w-10, h*0.74, 20, h*0.24, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = CLAW;
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*0.32+la*w+i*6,h*0.97,3,5,0,0,Math.PI*2); ctx.fill(); }
      for (let i=-1;i<=1;i++) { ctx.beginPath(); ctx.ellipse(w*0.58+lb*w+i*6,h*0.97,3,5,0,0,Math.PI*2); ctx.fill(); }

      // === BODY ===
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(w*0.50, h*0.57, w*0.28, h*0.22, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      // cream belly
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.54, h*0.60, w*0.19, h*0.16, 0.1, 0, Math.PI*2); ctx.fill();

      // === SMALL T-REX ARMS (clearly above legs, mid-body height) ===
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.54, w*0.09, h*0.065, 0.5, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = CLAW;
      ctx.beginPath(); ctx.ellipse(w*0.86, h*0.58, 2.5, 4, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.90, h*0.56, 2.5, 4, -0.2, 0, Math.PI*2); ctx.fill();

      // === NECK ===
      ctx.fillStyle = C; ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(w*0.60, h*0.40, w*0.12, h*0.10, -0.15, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // === HEAD — round orange oval, snout extends right ===
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.26, w*0.22, h*0.20, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      // snout — slightly darker protrusion to the right
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.ellipse(w*0.84, h*0.30, w*0.11, h*0.08, 0.15, 0, Math.PI*2);
      ctx.fill();
      // nostril
      ctx.fillStyle = '#1a0808'; ctx.beginPath(); ctx.ellipse(w*0.91, h*0.28, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();

      // === HORNS — 2 solid triangles at BACK of head, pointing backward-upward ===
      ctx.fillStyle = '#c09040'; ctx.strokeStyle = OL; ctx.lineWidth = 1;
      // front horn (at top-back of head)
      ctx.beginPath();
      ctx.moveTo(w*0.50, h*0.14);   // tip pointing up-left
      ctx.lineTo(w*0.44, h*0.06);
      ctx.lineTo(w*0.54, h*0.20);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // rear horn (slightly behind)
      ctx.beginPath();
      ctx.moveTo(w*0.42, h*0.17);
      ctx.lineTo(w*0.34, h*0.10);
      ctx.lineTo(w*0.46, h*0.22);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // === EYE — smaller, dragon-like ===
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.74, h*0.24, 4, 4.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d05000'; ctx.beginPath(); ctx.ellipse(w*0.74, h*0.245, 2.4, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.74, h*0.247, 1.3, 1.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.726, h*0.228, 1.1, 0, Math.PI*2); ctx.fill();
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
      // Ivysaur — larger, bud with peeking petals, leaves
      const SKIN = '#6aac58'; const DARK = '#3a7030'; const SPOT = '#4a8440'; const BUDG = '#2a6828'; const BUD = '#c050a0'; const BUD2 = '#e070c0'; const CREAM = '#d8e8b0';

      // Leaf pair flanking the bud
      ctx.fillStyle = '#2a7828';
      ctx.beginPath(); ctx.ellipse(w*0.14, h*0.24, w*0.14, h*0.07, -0.6, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.38, h*0.2, w*0.14, h*0.07, 0.4, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();

      // Bud/flower base
      ctx.fillStyle = BUDG;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.26, w*0.18, h*0.18, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = BUD;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.19, w*0.12, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
      ctx.fillStyle = BUD2;
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.15, w*0.07, h*0.07, 0, 0, Math.PI*2); ctx.fill();
      // Petal tips
      for (let i=0; i<4; i++) {
        const a = (i/4)*Math.PI*2 - Math.PI/2;
        ctx.fillStyle = i%2===0 ? '#e060b0' : '#f080d0';
        ctx.beginPath(); ctx.ellipse(w*0.28+Math.cos(a)*w*0.11, h*0.14+Math.sin(a)*h*0.05, 3+flick*0.3, 4+flick*0.2, a, 0, Math.PI*2); ctx.fill();
      }

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
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.82, h*0.36, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7a1a20'; ctx.beginPath(); ctx.ellipse(w*0.83, h*0.37, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.82, h*0.33, 2, 2);

    } else {
      // Venusaur — huge flower, heavy body
      const SKIN = '#5a9848'; const DARK = '#3a6830'; const SPOT = '#4a8040'; const LEAFG = '#2a6828'; const PETAL = '#e03020'; const PETAL2 = '#f04828'; const CENTER = '#f8c840'; const CREAM = '#c8e0a0';

      // Flower — the dominant feature, left/top of sprite
      const fx = w*0.3, fy = h*0.16;
      // Outer petals (6, alternating shades)
      for (let i=0; i<6; i++) {
        const a = (i/6)*Math.PI*2 - Math.PI/2;
        const pr = w*0.24;
        ctx.fillStyle = i%2===0 ? PETAL : PETAL2;
        ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*pr, fy+Math.sin(a)*pr*0.9, w*0.1+flick*0.4, h*0.08+flick*0.2, a, 0, Math.PI*2);
        ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      }
      // Inner petals (4, pink)
      for (let i=0; i<4; i++) {
        const a = (i/4)*Math.PI*2;
        ctx.fillStyle = '#f888a8';
        ctx.beginPath(); ctx.ellipse(fx+Math.cos(a)*w*0.13, fy+Math.sin(a)*h*0.06, w*0.07, h*0.055, a, 0, Math.PI*2); ctx.fill();
      }
      // Center
      ctx.fillStyle = CENTER; ctx.beginPath(); ctx.arc(fx, fy, w*0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.2; ctx.stroke();
      ctx.fillStyle = '#c09000'; ctx.beginPath(); ctx.arc(fx, fy, w*0.05, 0, Math.PI*2); ctx.fill();

      // Leaf pairs
      ctx.fillStyle = LEAFG;
      ctx.beginPath(); ctx.ellipse(w*0.14, h*0.3, w*0.12, h*0.06, -0.6, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*0.4, h*0.26, w*0.12, h*0.06, 0.4, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1; ctx.stroke();
      // Stalk/base
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(fx, h*0.36, w*0.16, h*0.1, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Hind legs
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*(0.18+step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(w*(0.32-step*0.03), h*0.86, w*0.11, h*0.12, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();

      // Body
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.63, w*0.42, h*0.27, 0, 0, Math.PI*2);
      ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.65, w*0.2, h*0.18, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.3, h*0.7, w*0.07, h*0.055, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.52, h*0.76, w*0.06, h*0.05, 0, 0, Math.PI*2); ctx.fill();

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
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.84, h*0.38, 5.5, 6.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b1010'; ctx.beginPath(); ctx.ellipse(w*0.85, h*0.39, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.84, h*0.35, 2, 2);
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
    if (this.char === 'bulbasaur') {
      this._drawBulbasaur(ctx, w, h);
      ctx.restore();
      return;
    }
    // default: eevee family (existing code)

    // Dispatch big forms to dedicated drawers
    if (big && !this.crouching) {
      if (this.power === POWER.FIRE) {
        this._drawFlareon(ctx, w, h);
        ctx.restore();
        return;
      } else if (this.power === POWER.BIG) {
        this._drawUmbreon(ctx, w, h);
        ctx.restore();
        return;
      }
    }

    if (big && this.crouching) {
      if (this.power === POWER.FIRE) {
        this._drawCrouchFlareon(ctx, w, h);
      } else {
        this._drawCrouchUmbreon(ctx, w, h);
      }
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
