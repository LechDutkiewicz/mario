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
    const pw = this.power;
    const jumping = !this.onGround;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t = Math.floor(this.animTimer / 5) % 4;
    const flick = t < 2 ? t : 4 - t; // 0,1,2,1

    // Helper: draw layered flame at (fx,fy) with scale s
    const drawFlame = (fx, fy, s) => {
      ctx.fillStyle = '#c83000';
      ctx.beginPath(); ctx.ellipse(fx, fy, s*6, s*11+flick*s*0.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff5500';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*2, s*4.5, s*8+flick*s*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff9900';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*4, s*3, s*5+flick*s*0.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffee00';
      ctx.beginPath(); ctx.ellipse(fx, fy-s*6, s*1.5, s*3+flick*s*0.3, 0, 0, Math.PI*2); ctx.fill();
    };

    if (pw === POWER.FIRE) {
      // ── Charizard ──
      const BODY = '#f05020'; const BELLY = '#f8e090'; const WING = '#4a60d0'; const DARK = '#c03818';

      // Wings (membrane bat wings behind body)
      ctx.fillStyle = WING;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(w*0.18, h*0.32);
      ctx.bezierCurveTo(w*(-0.15), h*0.05, w*(-0.35), h*0.35, w*(-0.05), h*0.58);
      ctx.bezierCurveTo(w*0.06, h*0.58, w*0.14, h*0.52, w*0.18, h*0.44);
      ctx.closePath(); ctx.fill();
      // Wing membrane stripes
      ctx.strokeStyle = '#3850a8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.16, h*0.34); ctx.bezierCurveTo(w*(-0.1), h*0.12, w*(-0.25), h*0.3, w*(-0.03), h*0.52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.12, h*0.38); ctx.bezierCurveTo(w*(-0.18), h*0.25, w*(-0.3), h*0.4, w*(-0.06), h*0.56); ctx.stroke();
      // Right wing
      ctx.fillStyle = WING;
      ctx.beginPath();
      ctx.moveTo(w*0.82, h*0.32);
      ctx.bezierCurveTo(w*1.15, h*0.05, w*1.35, h*0.35, w*1.05, h*0.58);
      ctx.bezierCurveTo(w*0.94, h*0.58, w*0.86, h*0.52, w*0.82, h*0.44);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3850a8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.84, h*0.34); ctx.bezierCurveTo(w*1.1, h*0.12, w*1.25, h*0.3, w*1.03, h*0.52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.88, h*0.38); ctx.bezierCurveTo(w*1.18, h*0.25, w*1.3, h*0.4, w*1.06, h*0.56); ctx.stroke();

      // Tail — thick curved, flame at tip
      ctx.strokeStyle = BODY; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.72, h*0.72); ctx.quadraticCurveTo(w*1.1, h*0.68, w*1.08, h*0.52); ctx.stroke();
      ctx.strokeStyle = DARK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w*0.72, h*0.72); ctx.quadraticCurveTo(w*1.1, h*0.68, w*1.08, h*0.52); ctx.stroke();
      drawFlame(w*1.1, h*0.44, 1.2);

      // Body
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.57, w*0.43, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      // Belly plate
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.27, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      // Belly plate ridges
      ctx.strokeStyle = '#e8c870'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) ctx.beginPath(), ctx.ellipse(w*0.5, h*(0.52+i*0.05), w*(0.22-i*0.04), h*0.025, 0, 0, Math.PI*2), ctx.stroke();

      // Neck
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.36, w*0.22, h*0.1, 0, 0, Math.PI*2); ctx.fill();

      // Head — broad dragon head
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.22, w*0.35, h*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.29, w*0.17, h*0.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.44, h*0.28, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.56, h*0.28, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#d0c080';
      ctx.beginPath(); ctx.moveTo(w*0.34, h*0.1); ctx.lineTo(w*0.26, h*(-0.06)); ctx.lineTo(w*0.42, h*0.12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w*0.66, h*0.1); ctx.lineTo(w*0.74, h*(-0.06)); ctx.lineTo(w*0.58, h*0.12); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.2, 4, 5, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.63, h*0.2, 4, 5, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff6600'; ctx.beginPath(); ctx.ellipse(w*0.38, h*0.21, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.21, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.37, h*0.18, 1.5, 1.5); ctx.fillRect(w*0.63, h*0.18, 1.5, 1.5);

      // Legs with claws
      ctx.fillStyle = BODY;
      if (jumping) {
        ctx.fillRect(w*0.14, h*0.78, w*0.22, h*0.1); ctx.fillRect(w*0.6, h*0.74, w*0.22, h*0.1);
      } else {
        ctx.fillRect(w*(0.12+step*0.05), h*0.78, w*0.22, h*0.18); ctx.fillRect(w*(0.6-step*0.05), h*0.78, w*0.22, h*0.18);
      }
      ctx.fillStyle = '#f0f0c0';
      const cl = w*(0.12+(jumping?0:step*0.05)), cr = w*(0.6-(jumping?0:step*0.05));
      ctx.fillRect(cl+1, h*0.945, 5, 7); ctx.fillRect(cl+8, h*0.945, 5, 7); ctx.fillRect(cl+15, h*0.945, 5, 7);
      ctx.fillRect(cr+1, h*0.945, 5, 7); ctx.fillRect(cr+8, h*0.945, 5, 7); ctx.fillRect(cr+15, h*0.945, 5, 7);

    } else if (pw === POWER.BIG) {
      // ── Charmeleon ──
      const BODY = '#d84820'; const BELLY = '#f8d880'; const DARK = '#a83010'; const CLAW = '#f0f0b8';

      // Tail — thinner, curved
      ctx.strokeStyle = BODY; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.75); ctx.quadraticCurveTo(w*1.06, h*0.7, w*1.04, h*0.54); ctx.stroke();
      ctx.strokeStyle = DARK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.75); ctx.quadraticCurveTo(w*1.06, h*0.7, w*1.04, h*0.54); ctx.stroke();
      drawFlame(w*1.06, h*0.47, 0.85);

      // Body
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.58, w*0.4, h*0.27, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.61, w*0.24, h*0.19, 0, 0, Math.PI*2); ctx.fill();
      // Belly ridges
      ctx.strokeStyle = '#d8b860'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) ctx.beginPath(), ctx.ellipse(w*0.5, h*(0.54+i*0.055), w*(0.19-i*0.035), h*0.024, 0, 0, Math.PI*2), ctx.stroke();

      // Neck
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.39, w*0.2, h*0.1, 0, 0, Math.PI*2); ctx.fill();

      // Head — angular, aggressive
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.24, w*0.32, h*0.17, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.31, w*0.15, h*0.08, 0, 0, Math.PI*2); ctx.fill();
      // Nostrils
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.44, h*0.3, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.56, h*0.3, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();
      // Single curved horn on head
      ctx.fillStyle = '#d0c080';
      ctx.beginPath(); ctx.moveTo(w*0.46, h*0.11); ctx.bezierCurveTo(w*0.38, h*0.0, w*0.3, h*(-0.04), w*0.34, h*(-0.08));
      ctx.bezierCurveTo(w*0.4, h*(-0.06), w*0.48, h*0.06, w*0.52, h*0.13); ctx.closePath(); ctx.fill();
      // Eyes — narrow and angry
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.22, 4, 4.5, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.63, h*0.22, 4, 4.5, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(w*0.38, h*0.23, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.23, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.37, h*0.2, 1.5, 1.5); ctx.fillRect(w*0.63, h*0.2, 1.5, 1.5);

      // Arms with claws (visible on sides)
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.14, h*0.52, w*0.1, h*0.07, 0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.86, h*0.52, w*0.1, h*0.07, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = CLAW;
      ctx.fillRect(w*0.04, h*0.57, 4, 7); ctx.fillRect(w*0.1, h*0.57, 4, 7);
      ctx.fillRect(w*0.83, h*0.57, 4, 7); ctx.fillRect(w*0.88, h*0.57, 4, 7);

      // Legs
      ctx.fillStyle = BODY;
      if (jumping) {
        ctx.fillRect(w*0.15, h*0.79, w*0.2, h*0.1); ctx.fillRect(w*0.6, h*0.75, w*0.2, h*0.1);
      } else {
        ctx.fillRect(w*(0.13+step*0.05), h*0.79, w*0.2, h*0.17); ctx.fillRect(w*(0.62-step*0.05), h*0.79, w*0.2, h*0.17);
      }
      ctx.fillStyle = CLAW;
      const ll = w*(0.13+(jumping?0:step*0.05)), lr = w*(0.62-(jumping?0:step*0.05));
      ctx.fillRect(ll+1, h*0.95, 4, 6); ctx.fillRect(ll+7, h*0.95, 4, 6);
      ctx.fillRect(lr+1, h*0.95, 4, 6); ctx.fillRect(lr+7, h*0.95, 4, 6);

    } else {
      // ── Charmander (small) ──
      const BODY = '#f07840'; const BELLY = '#f8e8b8'; const DARK = '#c05828';

      // Tail — thin, curves behind and up
      ctx.strokeStyle = BODY; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.78); ctx.quadraticCurveTo(w*1.0, h*0.75, w*0.98, h*0.6); ctx.stroke();
      ctx.strokeStyle = DARK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(w*0.68, h*0.78); ctx.quadraticCurveTo(w*1.0, h*0.75, w*0.98, h*0.6); ctx.stroke();
      drawFlame(w*1.0, h*0.54, 0.65);

      // Body — chubby round body
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.65, w*0.4, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      // Cream belly
      ctx.fillStyle = BELLY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.68, w*0.24, h*0.2, 0, 0, Math.PI*2); ctx.fill();

      // Arms — tiny stubs
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.13, h*0.6, w*0.09, h*0.06, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.87, h*0.6, w*0.09, h*0.06, -0.4, 0, Math.PI*2); ctx.fill();

      // Head — big round friendly face
      ctx.fillStyle = BODY;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.3, w*0.35, h*0.26, 0, 0, Math.PI*2); ctx.fill();
      // Cheek blush
      ctx.fillStyle = '#f0a080';
      ctx.beginPath(); ctx.ellipse(w*0.28, h*0.34, 4, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.72, h*0.34, 4, 3, 0, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.37, w*0.14, h*0.07, 0, 0, Math.PI*2); ctx.fill();
      // Nostrils
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w*0.44, h*0.36, 1.5, 1.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.56, h*0.36, 1.5, 1.2, 0, 0, Math.PI*2); ctx.fill();
      // Eyes — big friendly
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.27, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.27, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.28, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.28, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.36, h*0.24, 2, 2); ctx.fillRect(w*0.64, h*0.24, 2, 2);

      // Legs
      ctx.fillStyle = BODY;
      if (jumping) {
        ctx.fillRect(w*0.2, h*0.86, w*0.18, h*0.1); ctx.fillRect(w*0.56, h*0.82, w*0.18, h*0.1);
      } else {
        ctx.fillRect(w*(0.18+step*0.06), h*0.84, w*0.18, h*0.15);
        ctx.fillRect(w*(0.56-step*0.06), h*0.84, w*0.18, h*0.15);
      }
    }
  }

  _drawBulbasaur(ctx, w, h) {
    const pw = this.power;
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    const t = Math.floor(this.animTimer / 6) % 4;
    const jumping = !this.onGround;

    // Helper: draw a leaf pair (two ovals fanning out)
    const drawLeafPair = (cx, cy, size) => {
      ctx.fillStyle = '#2a7828';
      ctx.beginPath(); ctx.ellipse(cx - size*0.9, cy, size*1.1, size*0.45, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + size*0.9, cy, size*1.1, size*0.45, 0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a9830';
      ctx.beginPath(); ctx.ellipse(cx - size*0.8, cy - size*0.1, size*0.7, size*0.28, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + size*0.8, cy - size*0.1, size*0.7, size*0.28, 0.5, 0, Math.PI*2); ctx.fill();
    };

    if (pw === POWER.FIRE) {
      // ── Venusaur ──
      const SKIN = '#5a9848'; const DARK = '#3a6830'; const SPOT = '#3a7838';
      const PETAL = '#e84888'; const PETAL2 = '#f070a8'; const CENTER = '#f8c840';

      // Large flower — draw petals before body
      const fx = w*0.5, fy = h*0.09;
      const pulse = t < 2 ? t : 4 - t;
      // Outer petals (7)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 - Math.PI/2;
        const pr = w*0.28 + pulse;
        ctx.fillStyle = i % 2 === 0 ? PETAL : PETAL2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a)*pr, fy + Math.sin(a)*pr*0.85, w*0.12+pulse*0.5, h*0.09, a, 0, Math.PI*2);
        ctx.fill();
      }
      // Inner petals (5, smaller, lighter)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.fillStyle = '#ffaacc';
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a)*w*0.16, fy + Math.sin(a)*h*0.07, w*0.08, h*0.06, a, 0, Math.PI*2);
        ctx.fill();
      }
      // Center disc
      ctx.fillStyle = CENTER;
      ctx.beginPath(); ctx.arc(fx, fy, w*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d09000';
      ctx.beginPath(); ctx.arc(fx, fy, w*0.07, 0, Math.PI*2); ctx.fill();

      // Leaf pairs around plant stalk
      drawLeafPair(w*0.5, h*0.3, 10);
      drawLeafPair(w*0.5, h*0.38, 8);

      // Plant bulb/stalk base
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.38, w*0.2, h*0.12, 0, 0, Math.PI*2); ctx.fill();

      // Body — wide, heavy Venusaur
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.64, w*0.46, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      // Dark spots on body
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.24, h*0.58, w*0.07, h*0.06, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.76, h*0.58, w*0.07, h*0.06, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.72, w*0.06, h*0.05, 0, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.3, w*0.38, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      // Ear nubs
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.22, h*0.22, w*0.07, h*0.06, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.22, w*0.07, h*0.06, 0.4, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.28, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.28, 5, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b2020'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.29, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.29, 2.5, 3, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.36, h*0.25, 2, 2); ctx.fillRect(w*0.64, h*0.25, 2, 2);

      // Four legs
      ctx.fillStyle = SKIN;
      if (jumping) {
        ctx.fillRect(w*0.1, h*0.8, w*0.2, h*0.1); ctx.fillRect(w*0.34, h*0.8, w*0.2, h*0.1);
        ctx.fillRect(w*0.56, h*0.8, w*0.2, h*0.1); ctx.fillRect(w*0.7, h*0.8, w*0.2, h*0.1);
      } else {
        ctx.fillRect(w*(0.08+step*0.04), h*0.8, w*0.2, h*0.18);
        ctx.fillRect(w*(0.32+step*0.04), h*0.8, w*0.2, h*0.18);
        ctx.fillRect(w*(0.54-step*0.04), h*0.8, w*0.2, h*0.18);
        ctx.fillRect(w*(0.7-step*0.04),  h*0.8, w*0.2, h*0.18);
      }

    } else if (pw === POWER.BIG) {
      // ── Ivysaur ──
      const SKIN = '#6aac58'; const DARK = '#3a7030'; const SPOT = '#4a8440';
      const BUD_G = '#2a6828'; const BUD = '#c050a0'; const BUD2 = '#e070c0';

      // Flower bud with leaves
      drawLeafPair(w*0.5, h*0.24, 8);
      // Bud
      ctx.fillStyle = BUD_G;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.25, w*0.18, h*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BUD;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.19, w*0.13, h*0.13, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BUD2;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.16, w*0.08, h*0.08, 0, 0, Math.PI*2); ctx.fill();
      // Petal tips peeking out
      for (let i = 0; i < 5; i++) {
        const a = (i/5)*Math.PI*2 - Math.PI/2;
        ctx.fillStyle = i%2===0 ? '#e868b8' : '#f090d0';
        ctx.beginPath(); ctx.ellipse(w*0.5+Math.cos(a)*w*0.13, h*0.14+Math.sin(a)*h*0.06, 3+t*0.3, 5+t*0.2, a, 0, Math.PI*2); ctx.fill();
      }

      // Body
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.62, w*0.44, h*0.27, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.22, h*0.57, w*0.07, h*0.055, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.57, w*0.07, h*0.055, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.7, w*0.055, h*0.045, 0, 0, Math.PI*2); ctx.fill();

      // Head
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.3, w*0.36, h*0.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.22, h*0.22, w*0.07, h*0.06, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.22, w*0.07, h*0.06, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.28, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.64, h*0.28, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7a1a20'; ctx.beginPath(); ctx.ellipse(w*0.37, h*0.29, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.29, 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.36, h*0.25, 2, 2); ctx.fillRect(w*0.64, h*0.25, 2, 2);

      // Four legs
      ctx.fillStyle = SKIN;
      if (jumping) {
        ctx.fillRect(w*0.1, h*0.79, w*0.19, h*0.1); ctx.fillRect(w*0.33, h*0.79, w*0.19, h*0.1);
        ctx.fillRect(w*0.54, h*0.79, w*0.19, h*0.1); ctx.fillRect(w*0.71, h*0.79, w*0.19, h*0.1);
      } else {
        ctx.fillRect(w*(0.08+step*0.04), h*0.79, w*0.19, h*0.19);
        ctx.fillRect(w*(0.32+step*0.04), h*0.79, w*0.19, h*0.19);
        ctx.fillRect(w*(0.52-step*0.04), h*0.79, w*0.19, h*0.19);
        ctx.fillRect(w*(0.7-step*0.04),  h*0.79, w*0.19, h*0.19);
      }

    } else {
      // ── Bulbasaur (small) ──
      const SKIN = '#80c070'; const DARK = '#50904a'; const SPOT = '#5a9850';
      const BULB = '#3a6830'; const BULB2 = '#2a5020';

      // Seed bulb on back — ridged, with darker grooves
      ctx.fillStyle = BULB;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.3, w*0.22, h*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = BULB2;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.28, w*0.14, h*0.1, 0, 0, Math.PI*2); ctx.fill();
      // Bulb ridges
      ctx.strokeStyle = BULB2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w*0.5, h*0.13); ctx.lineTo(w*0.5, h*0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.3, h*0.2); ctx.lineTo(w*0.7, h*0.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w*0.7, h*0.2); ctx.lineTo(w*0.3, h*0.38); ctx.stroke();

      // Body — compact quadruped
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.68, w*0.43, h*0.28, 0, 0, Math.PI*2); ctx.fill();
      // Body spots (Bulbasaur's characteristic spots)
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.22, h*0.65, w*0.08, h*0.065, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.78, h*0.65, w*0.08, h*0.065, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.48, h*0.74, w*0.065, h*0.055, 0, 0, Math.PI*2); ctx.fill();

      // Head — wide, round, dino-ish
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.ellipse(w*0.5, h*0.36, w*0.37, h*0.25, 0, 0, Math.PI*2); ctx.fill();
      // Ear nubs
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(w*0.2, h*0.24, w*0.07, h*0.06, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.8, h*0.24, w*0.07, h*0.06, 0.5, 0, Math.PI*2); ctx.fill();
      // Cheek spots
      ctx.fillStyle = SPOT;
      ctx.beginPath(); ctx.ellipse(w*0.26, h*0.38, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.74, h*0.38, 4, 3.5, 0, 0, Math.PI*2); ctx.fill();
      // Eyes — large red (characteristic Bulbasaur)
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w*0.35, h*0.32, 5.5, 6.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.65, h*0.32, 5.5, 6.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8b1010'; ctx.beginPath(); ctx.ellipse(w*0.36, h*0.33, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*0.66, h*0.33, 3, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(w*0.35, h*0.29, 2, 2); ctx.fillRect(w*0.65, h*0.29, 2, 2);

      // Four short legs
      ctx.fillStyle = SKIN;
      if (jumping) {
        ctx.fillRect(w*0.12, h*0.84, w*0.19, h*0.1); ctx.fillRect(w*0.34, h*0.84, w*0.19, h*0.1);
        ctx.fillRect(w*0.55, h*0.84, w*0.19, h*0.1); ctx.fillRect(w*0.7,  h*0.84, w*0.19, h*0.1);
      } else {
        ctx.fillRect(w*(0.1+step*0.05),  h*0.84, w*0.19, h*0.15);
        ctx.fillRect(w*(0.33+step*0.05), h*0.84, w*0.19, h*0.15);
        ctx.fillRect(w*(0.54-step*0.05), h*0.84, w*0.19, h*0.15);
        ctx.fillRect(w*(0.7-step*0.05),  h*0.84, w*0.19, h*0.15);
      }
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
