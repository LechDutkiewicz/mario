import {
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED, PLAYER_RUN_SPEED,
  JUMP_VELOCITY, FRICTION, AIR_FRICTION,
  PLAYER_SMALL_W, PLAYER_SMALL_H, PLAYER_BIG_W, PLAYER_BIG_H,
  INVINCIBLE_TIME, POWER, COLORS, GROUND_Y,
} from '../constants.js';
import { resolveCollisions } from '../physics.js';

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
    if (kind === 'mushroom') {
      if (this.power === POWER.SMALL) { this.power = POWER.BIG; this._applySize(); }
    } else if (kind === 'flower') {
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

    // Jump
    if (input.jumpPressed && this.onGround) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
    }
    // Variable jump height
    if (!input.jump && this.vy < -4) this.vy = -4;

    // Gravity
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // Shoot fireball
    if (input.firePressed && this.power === POWER.FIRE && this.fireCooldown <= 0) {
      game.spawnFireball(this);
      this.fireCooldown = 20;
    }

    const res = resolveCollisions(this, solids);
    this.onGround = res.onGround;

    // Question blocks hit from below
    for (const block of res.hitBelow) {
      if (block.onBump) block.onBump(game);
    }

    // Fell out of world
    if (this.y > 800) this.die();

    // Left wall clamp
    if (this.x < 0) { this.x = 0; this.vx = 0; }
  }

  draw(r, cam) {
    if (this.dead && this.deathTimer < 60 && Math.floor(this.deathTimer / 4) % 2) return;
    // blink while invincible
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2) return;

    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;
    const cap = this.power === POWER.FIRE ? COLORS.white : COLORS.red;
    const trim = this.power === POWER.FIRE ? COLORS.red : COLORS.red;
    const skin = '#ffcc99';
    const overall = COLORS.blue;

    ctx.save();
    // flip horizontally if facing left
    if (this.facing < 0) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, y);
    }

    const u = w / 14; // unit
    const v = h / 16;
    const P = (px, py, pw, ph, c) => { ctx.fillStyle = c; ctx.fillRect(px * u, py * v, pw * u, ph * v); };

    // Cap
    P(3, 0, 9, 2, cap);
    P(2, 2, 11, 2, cap);
    // Face
    P(3, 4, 9, 4, skin);
    // hair side
    P(2, 4, 1, 3, '#5a2d0c');
    // eye
    P(8, 5, 1, 2, COLORS.black);
    // mustache
    P(6, 7, 6, 1, '#5a2d0c');
    // Body / overalls
    P(3, 8, 8, 4, overall);
    P(2, 8, 1, 3, trim); // arm
    P(11, 8, 1, 3, skin); // hand
    // buttons
    P(5, 9, 1, 1, COLORS.yellow);
    P(8, 9, 1, 1, COLORS.yellow);
    if (h > 40) {
      // legs (big)
      P(4, 12, 3, 4, overall);
      P(8, 12, 3, 4, overall);
      P(3, 15, 3, 1, '#5a2d0c');
      P(8, 15, 3, 1, '#5a2d0c');
    } else {
      P(4, 12, 3, 3, overall);
      P(8, 12, 3, 3, overall);
      P(3, 14, 3, 2, '#5a2d0c');
      P(8, 14, 3, 2, '#5a2d0c');
    }

    ctx.restore();
  }
}
