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
    // kind: 'candy' (Rare Candy = grow) | 'tm' (TM Fire = fire power)
    if (kind === 'candy' || kind === 'mushroom') {
      if (this.power === POWER.SMALL) { this.power = POWER.BIG; this._applySize(); }
    } else if (kind === 'tm' || kind === 'flower') {
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
        if (s.dead || s.used || !s.onBump) continue;
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
    // Fire power tints the ruff orange
    const ruffCol = this.power === POWER.FIRE ? '#ffc060' : RUFF;

    ctx.save();
    if (this.facing < 0) {
      ctx.translate(sx + w, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }

    const big = h > PLAYER_SMALL_H + 2;

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
    } else if (big) {
      // BIG Eevee (32x56)
      const jumping = !this.onGround;
      // Tail (extends right opposite facing — since we flip, always draw right)
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.moveTo(w * 0.7, h * 0.42);
      ctx.quadraticCurveTo(w * 1.3, h * 0.3, w * 1.1, h * 0.55);
      ctx.lineWidth = 7;
      ctx.strokeStyle = BODY;
      ctx.stroke();
      ctx.fillStyle = TAIL;
      ctx.beginPath();
      ctx.ellipse(w * 1.12, h * 0.52, 8, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Body oval
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.62, w * 0.44, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Large ruff
      ctx.fillStyle = ruffCol;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.38, w * 0.42, Math.PI * 0.15, Math.PI * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.4, w * 0.4, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = BODY;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.24, w * 0.34, h * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears — swept back if jumping
      const earTilt = jumping ? 0.5 : 0;
      ctx.fillStyle = BODY;
      // Left ear
      ctx.beginPath();
      ctx.moveTo(w * 0.22, h * 0.15);
      ctx.lineTo(w * (0.1 + earTilt * 0.1), h * (0.0 - earTilt * 0.03));
      ctx.lineTo(w * 0.36, h * 0.12);
      ctx.closePath(); ctx.fill();
      // Right ear
      ctx.beginPath();
      ctx.moveTo(w * 0.62, h * 0.15);
      ctx.lineTo(w * (0.78 - earTilt * 0.1), h * (0.0 - earTilt * 0.03));
      ctx.lineTo(w * 0.72, h * 0.12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = EAR_I;
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.14);
      ctx.lineTo(w * (0.16 + earTilt * 0.1), h * 0.04);
      ctx.lineTo(w * 0.35, h * 0.13);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.63, h * 0.14);
      ctx.lineTo(w * (0.74 - earTilt * 0.1), h * 0.04);
      ctx.lineTo(w * 0.70, h * 0.13);
      ctx.closePath(); ctx.fill();

      // Eyes
      ctx.fillStyle = EYE;
      ctx.beginPath(); ctx.ellipse(w * 0.37, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.63, h * 0.23, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SHINE;
      ctx.fillRect(w * 0.36, h * 0.19, 2, 2);
      ctx.fillRect(w * 0.62, h * 0.19, 2, 2);

      // Legs — tuck up if jumping
      ctx.fillStyle = BODY;
      if (jumping) {
        ctx.fillRect(w * 0.18, h * 0.78, w * 0.2, h * 0.12);
        ctx.fillRect(w * 0.56, h * 0.72, w * 0.2, h * 0.12);
      } else {
        const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
        ctx.fillRect(w * (0.16 + step * 0.06), h * 0.78, w * 0.2, h * 0.18);
        ctx.fillRect(w * (0.54 - step * 0.06), h * 0.78, w * 0.2, h * 0.18);
      }

      // Fire sparkle on ruff
      if (this.power === POWER.FIRE) {
        const t = Math.floor(this.animTimer / 5) % 2;
        ctx.fillStyle = t ? '#ff6600' : '#ffcc00';
        ctx.beginPath(); ctx.arc(w * 0.22, h * 0.38, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.78, h * 0.38, 5, 0, Math.PI * 2); ctx.fill();
      }
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
