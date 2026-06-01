import {
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED, PLAYER_RUN_SPEED,
  JUMP_VELOCITY, FRICTION, AIR_FRICTION,
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

    const speed = input.run ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    if (input.left) { this.vx -= 0.8; this.facing = -1; }
    if (input.right) { this.vx += 0.8; this.facing = 1; }
    if (this.vx > speed) this.vx = speed;
    if (this.vx < -speed) this.vx = -speed;

    if (!input.left && !input.right) {
      this.vx *= this.onGround ? FRICTION : AIR_FRICTION;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

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

    // Jump
    if (input.jumpPressed && this.onGround && !this.crouching) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
    }
    // Variable jump height
    if (!input.jump && this.vy < -4) this.vy = -4;

    // Gravity
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Shoot flamethrower
    if (!this.crouching && input.firePressed && this.power === POWER.FIRE && this.fireCooldown <= 0) {
      game.spawnFireball(this);
      this.fireCooldown = 20;
    }

    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;

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
    // Umbreon: black body, yellow ring markings, red eyes
    const BODY  = '#2e2e52';
    const RING  = '#ffe040';
    const EYE   = '#cc0000';
    const SHINE = '#ff6666';
    const jumping = !this.onGround;

    ctx.save();

    // Tail (sweeping back)
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(w * 0.7, h * 0.42);
    ctx.quadraticCurveTo(w * 1.3, h * 0.28, w * 1.15, h * 0.52);
    ctx.stroke();
    // Yellow ring on tail tip
    ctx.strokeStyle = RING;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 1.12, h * 0.5, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.44, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Yellow ring on body
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.3, h * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Neck/chest
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.44, w * 0.3, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Yellow ring on neck
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.44, w * 0.22, h * 0.09, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Head
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.24, w * 0.34, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears — pointed and upright
    const earTilt = jumping ? 0.4 : 0;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.16);
    ctx.lineTo(w * (0.1 + earTilt * 0.08), h * (-0.02 - earTilt * 0.02));
    ctx.lineTo(w * 0.36, h * 0.13);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.16);
    ctx.lineTo(w * (0.78 - earTilt * 0.08), h * (-0.02 - earTilt * 0.02));
    ctx.lineTo(w * 0.72, h * 0.13);
    ctx.closePath(); ctx.fill();
    // Yellow ear rings
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.14);
    ctx.lineTo(w * 0.19, h * 0.06);
    ctx.lineTo(w * 0.33, h * 0.13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.63, h * 0.14);
    ctx.lineTo(w * 0.72, h * 0.06);
    ctx.lineTo(w * 0.69, h * 0.13);
    ctx.stroke();

    // Red eyes
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w * 0.37, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.63, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SHINE;
    ctx.fillRect(w * 0.36, h * 0.19, 2, 2);
    ctx.fillRect(w * 0.62, h * 0.19, 2, 2);

    // Legs
    ctx.fillStyle = BODY;
    if (jumping) {
      ctx.fillRect(w * 0.18, h * 0.78, w * 0.2, h * 0.12);
      ctx.fillRect(w * 0.56, h * 0.72, w * 0.2, h * 0.12);
    } else {
      const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
      ctx.fillRect(w * (0.16 + step * 0.06), h * 0.78, w * 0.2, h * 0.18);
      ctx.fillRect(w * (0.54 - step * 0.06), h * 0.78, w * 0.2, h * 0.18);
    }
    // Yellow leg rings
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2;
    const legX1 = w * (0.16 + (Math.abs(this.vx) > 0.3 ? (Math.floor(this.animTimer / 8) % 2) * 0.06 : 0));
    const legX2 = w * (0.54 - (Math.abs(this.vx) > 0.3 ? (Math.floor(this.animTimer / 8) % 2) * 0.06 : 0));
    ctx.strokeRect(legX1 + 1, h * 0.82, w * 0.18, h * 0.1);
    ctx.strokeRect(legX2 + 1, h * 0.82, w * 0.18, h * 0.1);

    ctx.restore();
  }

  _drawFlareon(ctx, w, h) {
    // Flareon: cream/orange body, fiery red mane, bushy flame tail
    const BODY  = '#f5d090';
    const MANE  = '#e84a0c';
    const MANE2 = '#ff8c00';
    const EYE   = '#2a1a0a';
    const SHINE = '#fff';
    const jumping = !this.onGround;
    const t = Math.floor(this.animTimer / 4) % 3;

    ctx.save();

    // Flame tail (animated)
    for (let i = 0; i < 3; i++) {
      const flicker = (t === i) ? 0.08 : 0;
      ctx.fillStyle = i === 0 ? MANE : i === 1 ? MANE2 : '#ffcc00';
      ctx.beginPath();
      ctx.ellipse(w * (1.1 + flicker), h * (0.45 - i * 0.04), 9 - i * 2, 11 - i * 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.44, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chest mane (large fluffy collar)
    ctx.fillStyle = MANE;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.4, w * 0.44, Math.PI * 0.1, Math.PI * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MANE2;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, w * 0.36, h * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    // Flame flicker on mane
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.38, w * 0.2 + (t === 0 ? 3 : 0), h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.24, w * 0.34, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (flame-tipped)
    const earTilt = jumping ? 0.5 : 0;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.15);
    ctx.lineTo(w * (0.1 + earTilt * 0.1), h * (0.0 - earTilt * 0.03));
    ctx.lineTo(w * 0.36, h * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.15);
    ctx.lineTo(w * (0.78 - earTilt * 0.1), h * (0.0 - earTilt * 0.03));
    ctx.lineTo(w * 0.72, h * 0.12);
    ctx.closePath(); ctx.fill();
    // Flame ear tips
    ctx.fillStyle = MANE;
    ctx.beginPath();
    ctx.moveTo(w * (0.1 + earTilt * 0.1), h * (0.0 - earTilt * 0.03));
    ctx.lineTo(w * (0.08 + earTilt * 0.1), h * (-0.05 - earTilt * 0.02));
    ctx.lineTo(w * 0.24, h * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * (0.78 - earTilt * 0.1), h * (0.0 - earTilt * 0.03));
    ctx.lineTo(w * (0.8 - earTilt * 0.1), h * (-0.05 - earTilt * 0.02));
    ctx.lineTo(w * 0.7, h * 0.1);
    ctx.closePath(); ctx.fill();

    // Eyes
    ctx.fillStyle = EYE;
    ctx.beginPath(); ctx.ellipse(w * 0.37, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.63, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SHINE;
    ctx.fillRect(w * 0.36, h * 0.19, 2, 2);
    ctx.fillRect(w * 0.62, h * 0.19, 2, 2);

    // Legs
    ctx.fillStyle = BODY;
    if (jumping) {
      ctx.fillRect(w * 0.18, h * 0.78, w * 0.2, h * 0.12);
      ctx.fillRect(w * 0.56, h * 0.72, w * 0.2, h * 0.12);
    } else {
      const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
      ctx.fillRect(w * (0.16 + step * 0.06), h * 0.78, w * 0.2, h * 0.18);
      ctx.fillRect(w * (0.54 - step * 0.06), h * 0.78, w * 0.2, h * 0.18);
    }

    ctx.restore();
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
    const pw = this.power;
    const jumping = !this.onGround;
    const t = Math.floor(this.animTimer / 4) % 3;

    if (pw === POWER.FIRE) {
      // Charizard
      const BODY = '#f06030'; const WING = '#8040c0'; const BELLY = '#f8e0b0';
      // Wings (behind body)
      ctx.fillStyle = WING;
      ctx.beginPath();
      ctx.moveTo(w*0.1, h*0.35);
      ctx.lineTo(w*(-0.2), h*0.1);
      ctx.lineTo(w*0.05, h*0.55);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w*0.9, h*0.35);
      ctx.lineTo(w*1.2, h*0.1);
      ctx.lineTo(w*0.95, h*0.55);
      ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.55, w*0.42, h*0.3, 0, 0, Math.PI*2); ctx.fill();
      // Belly
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.58, w*0.28, h*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.22, w*0.34, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      // Horn/crest
      ctx.fillStyle = '#c04020';
      ctx.beginPath(); ctx.moveTo(w*0.38, h*0.08); ctx.lineTo(w*0.3, h*(-0.05)); ctx.lineTo(w*0.48, h*0.12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w*0.62, h*0.08); ctx.lineTo(w*0.7, h*(-0.05)); ctx.lineTo(w*0.52, h*0.12); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.2, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.63, h*0.2, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(w*0.38, h*0.21, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.21, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.fillStyle = BODY;
      ctx.fillRect(w*0.18, h*0.78, w*0.22, h*0.2);
      ctx.fillRect(w*0.56, h*0.78, w*0.22, h*0.2);
      // Flame tail
      const flameX = w * (this.facing > 0 ? 0.95 : 0.05);
      ctx.fillStyle = '#ff4400';
      ctx.beginPath(); ctx.ellipse(flameX, h*0.7, 8+t*2, 14+t*2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.ellipse(flameX, h*0.68, 5+t, 10+t, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.ellipse(flameX, h*0.66, 3, 6, 0, 0, Math.PI*2); ctx.fill();
    } else if (pw === POWER.BIG) {
      // Charmeleon
      const BODY = '#e05528'; const BELLY = '#f8d888'; const CLAW = '#f8f8c0';
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.56, w*0.42, h*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.26, h*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.25, w*0.32, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      // Head crest
      ctx.fillStyle = '#c04020';
      ctx.beginPath(); ctx.moveTo(w*0.42, h*0.1); ctx.lineTo(w*0.34, h*(-0.04)); ctx.lineTo(w*0.52, h*0.14); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.23, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.63, h*0.23, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c00'; ctx.beginPath(); ctx.ellipse(w*0.38, h*0.24, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.24, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      // Claws
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.18, h*0.78, 5, 8); ctx.fillRect(w*0.26, h*0.78, 5, 8);
      ctx.fillRect(w*0.64, h*0.78, 5, 8); ctx.fillRect(w*0.72, h*0.78, 5, 8);
      ctx.fillStyle = BODY;
      ctx.fillRect(w*0.15, h*0.72, w*0.22, h*0.14);
      ctx.fillRect(w*0.6, h*0.72, w*0.22, h*0.14);
      // Flame tail
      const ftx = w * (this.facing > 0 ? 0.9 : 0.1);
      ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.ellipse(ftx, h*0.75, 6+t*2, 10+t, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.ellipse(ftx, h*0.73, 3, 6, 0, 0, Math.PI*2); ctx.fill();
    } else {
      // Charmander (small)
      const BODY = '#f07840'; const BELLY = '#f8e8b8';
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.65, w*0.42, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.67, w*0.26, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.3, w*0.32, h*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.27, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.27, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.28, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.28, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer/8)%2 : 0;
      ctx.fillStyle = BODY;
      ctx.fillRect(w*(0.18+step*0.06), h*0.82, w*0.2, h*0.16);
      ctx.fillRect(w*(0.56-step*0.06), h*0.82, w*0.2, h*0.16);
      // Flame tail
      const ftx2 = w * (this.facing > 0 ? 0.88 : 0.12);
      ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.ellipse(ftx2, h*0.78, 5+t*1.5, 8+t, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.ellipse(ftx2, h*0.76, 3, 5, 0, 0, Math.PI*2); ctx.fill();
    }
  }

  _drawBulbasaur(ctx, w, h) {
    const pw = this.power;
    const t = Math.floor(this.animTimer / 4) % 3;

    if (pw === POWER.FIRE) {
      // Venusaur
      const BODY = '#4a8840'; const SKIN = '#6ab060'; const FLOWER = '#e84888'; const LEAFG = '#2a6830';
      // Big flower bloom (petals around)
      ctx.fillStyle = FLOWER;
      for (let i=0; i<6; i++) {
        const angle = (i/6)*Math.PI*2;
        ctx.beginPath(); ctx.ellipse(w*0.5+Math.cos(angle)*w*0.3, h*0.15+Math.sin(angle)*h*0.12, w*0.12+t*2, h*0.1, angle, 0, Math.PI*2); ctx.fill();
      }
      // Center
      ctx.fillStyle = '#f8d040'; ctx.beginPath(); ctx.arc(w*0.5, h*0.15, w*0.14, 0, Math.PI*2); ctx.fill();
      // Bulb/stalk
      ctx.fillStyle = LEAFG; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.32, w*0.22, h*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.62, w*0.46, h*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BODY; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.55, w*0.3, h*0.12, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.28, w*0.36, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.25, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.25, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.26, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.26, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SKIN; ctx.fillRect(w*0.15, h*0.78, w*0.24, h*0.2); ctx.fillRect(w*0.58, h*0.78, w*0.24, h*0.2);
    } else if (pw === POWER.BIG) {
      // Ivysaur
      const BODY = '#5a9850'; const SKIN = '#78b868'; const BUD = '#d060a0'; const LEAFG = '#386840';
      // Large bud
      ctx.fillStyle = LEAFG; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.26, w*0.26, h*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BUD; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.2, w*0.18, h*0.14, 0, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.44, h*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BODY; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.53, w*0.28, h*0.1, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.28, w*0.34, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.25, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.25, 4, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.26, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.26, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SKIN; ctx.fillRect(w*0.16, h*0.78, w*0.22, h*0.2); ctx.fillRect(w*0.58, h*0.78, w*0.22, h*0.2);
    } else {
      // Bulbasaur (small)
      const BODY = '#68a858'; const SKIN = '#88c878'; const BULB = '#5a7840';
      // Small bulb on back
      ctx.fillStyle = BULB; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.28, w*0.18, h*0.14, 0, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.66, w*0.44, h*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BODY; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.3, h*0.1, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(w*0.5, h*0.32, w*0.34, h*0.24, 0, 0, Math.PI*2); ctx.fill();
      // Big eyes
      ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(w*0.34, h*0.28, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.28, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.33, h*0.26, 2, 2, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.26, 2, 2, 0, 0, Math.PI*2); ctx.fill();
      const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer/8)%2 : 0;
      ctx.fillStyle = SKIN;
      ctx.fillRect(w*(0.16+step*0.06), h*0.82, w*0.22, h*0.16);
      ctx.fillRect(w*(0.56-step*0.06), h*0.82, w*0.22, h*0.16);
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
