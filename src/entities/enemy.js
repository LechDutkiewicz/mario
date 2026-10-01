import { GRAVITY, MAX_FALL_SPEED, GROUND_Y } from '../constants.js';
import { resolveCollisions } from '../physics.js';
import { TAU, tint, shape, ell, poly, hilite, shadow, eye } from './sprite-utils.js';

// type: 'ekans' (stompable purple snake) | 'koffing' (floating toxic ball, fireball only) | 'squirtle' (shell mechanic)
export class Enemy {
  constructor(x, y, type = 'ekans', smart = false, flying = false, flyMinY = 0, flyMaxY = 0) {
    this.type  = type;
    this.smart = smart;
    this.flying = flying;
    this.flyMinY = flyMinY;
    this.flyMaxY = flyMaxY;
    this.flyDir = 1;
    this.x = x;
    this.w = 30;
    this.h = type === 'koffing' ? 32 : 26;
    this.y = flying ? flyMinY : y - this.h;
    // FSM: Goomba and Koopa both walk at 0.21 * unitsize = 0.84
    this.vx = type === 'koffing' ? -0.8 : -0.84;
    this.vy = 0;
    this.shellCounter = 0;    // FSM moveShell: peek at 350, revive at 490
    this.hopper = false;      // jumping Paratroopa (moveJumping)
    // FSM Blooper: speed=unitsized2 (right cap 2), speedinv=-unitsized4 (start/left cap -1)
    if (type === 'blooper') { this.w = 26; this.h = 26; this.vx = -1; this.vy = 0; this.y = y - this.h; this.counter = 0; this.squeeze = 0; }
    // FSM CheepCheep: red (smart) xvel -1, yvel -1/6; normal xvel -2/3, yvel -1/8
    if (type === 'cheepcheep') {
      this.w = 26; this.h = 20; this.y = y - this.h;
      this.vx = smart ? -1 : -4 / 6;
      this.vy = smart ? -4 / 24 : -0.125;
      this.cheepInit = true;
    }
    // FSM Podoboo: betweentime 70, launch -maxyvel (-7), gravity / 2.1
    if (type === 'podoboo') { this.w = 20; this.h = 20; this.vx = 0; this.baseY = y - this.h; this.y = y - this.h; this.vy = 0; this.jumpTimer = Math.floor(Math.random() * 70) + 30; this.isJumping = false; }
    // FSM Lakitu → Zubat: hovers, orbits the player, drops Pineco eggs every 140f
    if (type === 'zubat') { this.w = 30; this.h = 26; this.vx = 0; this.vy = 0; this.y = Math.min(y - this.h, 240); this.counter = 0; this.throwTimer = 140; }
    // FSM HammerBro → Cubone: slides on a sine, throws bone bursts, hops
    if (type === 'cubone') { this.w = 28; this.h = 34; this.vx = 0; this.vy = 0; this.y = y - this.h; this.counter = 0; this.boneTimer = 35; this.boneBurst = 3; this.hopTimer = 140; }
    // FSM Spiny → Pineco: walking spiky ball, hurts to stomp
    if (type === 'pineco') { this.w = 24; this.h = 22; this.vx = -0.84; this.y = y - this.h; }
    // Spiny egg — falls from Zubat, becomes a walking Pineco on landing
    if (type === 'pinecoegg') { this.w = 22; this.h = 22; this.vx = 0; this.vy = -8.4; this.y = y; }
    // FSM BulletBill → Beldum: flies straight, ignores gravity and solids
    if (type === 'bulletbill') { this.w = 32; this.h = 28; this.vx = -2; this.y = y - this.h; this.active = true; }
    // Leaping Magikarp (FSM startCheepSpawn) — rockets up, then arcs down
    if (type === 'cheepjump') { this.w = 26; this.h = 20; this.y = y; this.active = true; this.rising = true; }
    this.dead = false;
    this.squashTimer = 0;
    this.animTimer = Math.floor(Math.random() * 60);
    this.active = false;
    this.dying = false;
    this.deathAlpha = 1;
    this.inShell = false;
    this.shellSliding = false;
  }

  get stompable() {
    return this.type !== 'blooper' && this.type !== 'podoboo' &&
           this.type !== 'cheepcheep' &&
           this.type !== 'pineco' && this.type !== 'pinecoegg';
  }

  squash() {
    if (this.type === 'squirtle') {
      if (this.shellSliding) {
        this.shellSliding = false;
        this.vx = 0;
        this.shellCounter = 0;
      } else if (!this.inShell) {
        this.inShell = true;
        this.vx = 0;
        this.shellCounter = 0;
      }
      return;
    }
    this.squashTimer = 21;   // FSM DeadGoomba lives 21 frames
    this.vx = 0;
  }

  kickShell(dir) {
    this.shellSliding = true;
    this.shellCounter = 0;
    this.vx = dir * 8;       // FSM shell slide speed: unitsize * 2
  }

  kill() {
    this.dead = true;
    this.dying = true;
    this.vy = -8;
    this.vx = this.vx < 0 ? -2 : 2;
  }

  update(solids, player, game) {
    if (this.dead && !this.dying) return;

    if (this.squashTimer > 0) {
      this.squashTimer--;
      if (this.squashTimer === 0) this.dead = true;
      return;
    }

    // Squirtle shell states — handled after squashTimer block
    if (this.type === 'squirtle' && this.inShell && !this.shellSliding) {
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      resolveCollisions(this, solids);
      this.vx = 0;
      // FSM moveShell: shell starts peeking at 350 and revives at 490
      this.animTimer++;
      this.shellCounter++;
      if (this.shellCounter >= 490) {
        this.inShell = false;
        this.shellCounter = 0;
        this.vx = player.x < this.x ? 0.84 : -0.84;   // walk away from the player
      }
      return;
    }
    if (this.type === 'squirtle' && this.inShell && this.shellSliding) {
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      const prevVx = this.vx;
      const res = resolveCollisions(this, solids);
      if (res.hitSide) {
        this.vx = prevVx > 0 ? -9 : 9;
      } else {
        this.vx = prevVx > 0 ? 9 : -9;
      }
      return;
    }

    if (this.dying) {
      this.animTimer++;
      this.vy += GRAVITY;
      this.y += this.vy;
      this.x += this.vx;
      if (this.type === 'koffing') this.deathAlpha = Math.max(0, this.deathAlpha - 0.03);
      return;
    }

    this.animTimer++;

    if (!this.active && this.type !== 'zubat') {
      if (Math.abs(this.x - player.x) < 520) this.active = true;
      else return;
    }

    // Beldum bullet — constant horizontal flight, no gravity, no collisions
    if (this.type === 'bulletbill') {
      this.x += this.vx;
      if (this.x < -300 || this.x > 200000) this.dead = true;
      return;
    }

    // Flying Paratroopa — FSM moveFloating: oscillates vertically ONLY
    // (no horizontal drift), ignores gravity
    if (this.flying && !this.inShell) {
      this.y += 1.2 * this.flyDir;
      if (this.y >= this.flyMaxY) { this.y = this.flyMaxY; this.flyDir = -1; }
      if (this.y <= this.flyMinY) { this.y = this.flyMinY; this.flyDir  =  1; }
      return;
    }

    if (this.type === 'koffing') {
      // Koffing floats — only horizontal movement + bob
      this.x += this.vx;
      // Check wall collisions manually
      if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
      // Reverse when hitting a platform side
      for (const s of solids) {
        if (s.dead) continue;
        if (
          this.x < s.x + s.w && this.x + this.w > s.x &&
          this.y < s.y + s.h && this.y + this.h > s.y
        ) {
          this.vx = -this.vx;
          this.x += this.vx * 2;
          break;
        }
      }
      return;
    }

    // Zubat (FSM Lakitu): hovers above, orbits the player on a ±117px sine,
    // drops a Pineco egg every 140 frames
    if (this.type === 'zubat') {
      // FSM zoneDisableLakitu — flies away off the top of the screen
      if (this.fleeing) {
        this.y -= 3;
        this.x -= 2;
        if (this.y < -80) this.dead = true;
        return;
      }
      // FSM moveLakituInit2 approach phase: when far away (e.g. after a
      // checkpoint respawn) Lakitu flies back in from off-screen instead of
      // idling forever out of range
      const dxFar = player.x - this.x;
      if (Math.abs(dxFar) > 700) {
        this.x += Math.sign(dxFar) * 12;
        this.y += Math.sin(this.animTimer * 0.05) * 0.4;
        return;
      }
      this.active = true;
      // FSM moveLakitu: when the player sprints right, slide IN FRONT of them
      // at maxspeed*1.4; otherwise orbit on the ±117px sine at maxspeed*0.7
      let targetX, maxStep;
      if (player.vx > 0.5) {
        targetX = player.x + player.w + 128 + player.vx;
        maxStep = 7.56;   // player.maxspeed * 1.4
        this.counter = 0;
      } else {
        this.counter += 0.007;
        targetX = player.x + player.vx + Math.sin(Math.PI * this.counter) * 117;
        maxStep = 3.8;    // player.maxspeed * 0.7
      }
      const dx = targetX - this.x;
      this.x += Math.max(-maxStep, Math.min(maxStep, dx * 0.05));
      this.y += Math.sin(this.animTimer * 0.05) * 0.4;   // gentle hover bob
      // FSM throwSpiny: hide for 21 frames, THEN drop the egg
      if (this.hiding > 0) {
        this.hiding--;
        if (this.hiding === 0 && game) {
          const egg = new Enemy(this.x + this.w / 2 - 11, this.y + this.h, 'pinecoegg');
          game.level.enemies.push(egg);
        }
      }
      this.throwTimer--;
      if (this.throwTimer <= 0) {
        this.throwTimer = 140;
        this.hiding = 21;
      }
      return;
    }

    // Cubone (FSM HammerBro): sine slide, faces player, throws bone bursts, hops
    if (this.type === 'cubone') {
      if (!this.active) {
        if (Math.abs(this.x - player.x) < 560) this.active = true;
        else return;
      }
      this.vy += GRAVITY / 2;   // FSM: gravity / 2
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      this.counter += 0.007;
      this.vx = Math.sin(Math.PI * this.counter) / 2.1;
      // FSM jumpHammerBro: falling-through window disables solid collision
      if (this.dropThrough > 0) {
        this.dropThrough--;
        this.x += this.vx;
        this.y += this.vy;
      } else {
        resolveCollisions(this, solids);
      }
      // FSM: every 140 frames — jump up (-8.4) or randomly drop down through
      // the platform (only when standing above ground level)
      this.hopTimer--;
      if (this.hopTimer <= 0) {
        this.hopTimer = 140;
        if (this.vy === 0) {
          const onPlatformHigh = this.y + this.h < GROUND_Y - 8;
          if (onPlatformHigh && Math.random() < 0.5) {
            this.vy = -2.8;          // small hop off the edge (unitsize * -0.7)
            this.dropThrough = 42;   // 42-frame no-collide window
          } else {
            this.vy = -8.4;          // unitsize * -2.1
          }
        }
      }
      // FSM throwHammer: burst of 7 bones at 7-frame gaps, then a 70-frame pause
      this.boneTimer--;
      if (this.boneTimer <= 0 && game) {
        this.boneBurst--;
        this.boneTimer = this.boneBurst > 0 ? 7 : 70;
        if (this.boneBurst <= 0) this.boneBurst = 7;
        const dir = player.x < this.x ? -1 : 1;
        game.spawnBone(this.x + this.w / 2, this.y + 4, dir);
      }
      return;
    }

    // Pineco egg — tossed up, falls, becomes a walking Pineco on landing
    if (this.type === 'pinecoegg') {
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      const res = resolveCollisions(this, solids);
      if (res.onGround) {
        this.type = 'pineco';
        this.vx = player.x < this.x ? -0.84 : 0.84;
      }
      if (this.y > 800) this.dead = true;
      return;
    }

    // Leaping Magikarp — FSM: rises at constant speed (no gravity) until near
    // the top of the screen (ceilmax), only then arcs down with gravity
    if (this.type === 'cheepjump') {
      if (this.rising && this.y > 150) {
        this.y += this.vy;          // constant rocket ascent
      } else {
        this.rising = false;
        this.vy += 0.286;           // FSM moveCheepJumping: unitsize / 14
        this.y += this.vy;
      }
      this.x += this.vx;
      if (this.y > 800) this.dead = true;
      return;
    }

    if (this.type === 'blooper') {
      if (!this.active) {
        if (Math.abs(this.x - player.x) < 520) this.active = true;
        else return;
      }
      // FSM moveBlooper: rises at increasing rate; every ~1s squeezes and sinks
      // until it's below the player or near the floor, then unsqueezes.
      const squeezeStep = () => {
        this.squeeze = 2;
        this.vx /= 1.17;
        // FSM: me.top > player.bottom || me.bottom > (floor - 14u)
        if (this.y > player.y + player.h || this.y + this.h > GROUND_Y - 56) {
          this.squeeze = 0;
          this.counter = 0;
        }
      };
      if (this.counter === 56)      { this.squeeze = 1; this.counter++; }
      else if (this.counter === 63) { squeezeStep(); }
      else                          { this.counter++; }
      if (this.y < 74) squeezeStep();   // too high — force squeeze (unitsizet16 + 10)

      if (this.squeeze) this.vy = Math.max(this.vy + 0.021, 0.7);   // sinking
      else              this.vy = Math.min(this.vy - 0.035, -0.7);  // rising, accelerating
      this.y += this.vy;

      // Horizontal homing only while rising (FSM: !squeeze)
      if (!this.squeeze) {
        if (player.x > this.x + this.w + 32)          this.vx = Math.min(2, this.vx + 0.125);
        else if (player.x + player.w < this.x - 32)   this.vx = Math.max(-1, this.vx - 0.125);
      }
      this.x += this.vx;
      return;
    }
    if (this.type === 'cheepcheep') {
      if (!this.active) {
        if (Math.abs(this.x - player.x) < 520) this.active = true;
        else return;
      }
      // FSM moveCheepInit: flip vertical drift if spawned above the player
      if (this.cheepInit) {
        this.cheepInit = false;
        if (this.y < player.y) this.vy *= -1;
      }
      // FSM moveCheep: constant slow drift — no homing
      this.x += this.vx;
      this.y += this.vy;
      return;
    }
    if (this.type === 'podoboo') {
      if (this.dying) {
        this.vy += 0.4;
        this.y += this.vy;
        return;
      }
      // FSM: constant ascent at -maxyvel (-7) for jumpheight (256px), then
      // gravity/2.1 takes over and it arcs back down into the lava
      if (this.jumpTimer > 0) { this.jumpTimer--; return; }
      if (!this.isJumping) { this.isJumping = true; this.vy = -7; this.podoRising = true; }
      if (this.podoRising) {
        this.y += this.vy;
        if (this.baseY - this.y >= 256) this.podoRising = false;
      } else {
        this.vy += GRAVITY / 2.1;
        this.y += this.vy;
      }
      if (!this.podoRising && this.y >= this.baseY) {
        this.y = this.baseY;
        this.vy = 0;
        this.isJumping = false;
        this.jumpTimer = 70;      // FSM betweentime
      }
      return;
    }

    // Ekans / Squirtle — walks on ground (hopping Paratroopa: gravity / 2.8)
    this.vy += this.hopper ? GRAVITY / 2.8 : GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const prevVx = this.vx;
    const res = resolveCollisions(this, solids);
    // FSM: Goomba, Koopa and Spiny all walk at 0.84 (0.21 * unitsize)
    const sp = 0.84;

    // Jumping Paratroopa (FSM moveJumping): hops whenever it lands
    if (this.hopper && res.onGround) {
      this.vy = -4.68;   // unitsize * -1.17
    }

    // If wall was hit (hitSide), reverse direction
    if (res.hitSide && prevVx !== 0) {
      this.vx = prevVx > 0 ? -sp : sp;
    }
    if (this.vx > 0) this.vx = sp; else if (this.vx < 0) this.vx = -sp;

    // Smart enemies check for ledge ahead and turn before falling off
    if (this.smart && res.onGround) {
      const probeX = this.vx > 0 ? this.x + this.w + 2 : this.x - 4;
      const probeY = this.y + this.h + 4;
      let hasGround = false;
      for (const s of solids) {
        if (s.dead) continue;
        if (probeX >= s.x && probeX < s.x + s.w &&
            probeY >= s.y && probeY < s.y + s.h) {
          hasGround = true;
          break;
        }
      }
      if (!hasGround) this.vx = -this.vx;
    }

  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    if (this.type === 'koffing') {
      this._drawKoffing(ctx, x, y, w, h);
    } else if (this.type === 'squirtle') {
      this._drawSquirtle(ctx, x, y, w, h);
    } else if (this.type === 'blooper') {
      this._drawBlooper(ctx, x, y, w, h);
    } else if (this.type === 'cheepcheep' || this.type === 'cheepjump') {
      this._drawCheepCheep(ctx, x, y, w, h);
    } else if (this.type === 'podoboo') {
      this._drawPodoboo(ctx, x, y, w, h);
    } else if (this.type === 'zubat') {
      this._drawZubat(ctx, x, y, w, h);
    } else if (this.type === 'cubone') {
      this._drawCubone(ctx, x, y, w, h);
    } else if (this.type === 'pineco' || this.type === 'pinecoegg') {
      this._drawPineco(ctx, x, y, w, h);
    } else if (this.type === 'bulletbill') {
      this._drawBulletBill(ctx, x, y, w, h);
    } else {
      this._drawEkans(ctx, x, y, w, h);
    }
  }

  // Soft contact shadow for walkers: resolveCollisions zeroes vy on landing,
  // so vy === 0 is the "standing on something" notion for ground enemies
  _groundShadow(ctx, x, y, w, h) {
    if (this.dying || this.flying || this.vy !== 0 || this.squashTimer > 0) return;
    shadow(ctx, x + w / 2, y + h + 1, w * 0.42);
  }

  // Ekans — purple snake coiled on its tail, head raised, rattle wagging
  _drawEkans(ctx, x, y, w, h) {
    const PUR = '#a05cc0', OL = '#3a1650', YEL = '#f1c40f', BELLY = '#ecd27a', EYE = '#f9e46a';
    if (this.squashTimer > 0) {
      // Flattened coil + X eyes
      const fh = 10, fy = y + h - fh, cx = x + w / 2;
      ell(ctx, cx, fy + 5, w * 0.5, 5, 0, PUR, OL, { dy: 2 });
      ell(ctx, cx, fy + 6.5, w * 0.3, 2, 0, BELLY, null, { sh: 0 });
      ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const ex of [cx - 9, cx + 3]) {
        ctx.beginPath(); ctx.moveTo(ex, fy + 1); ctx.lineTo(ex + 6, fy + 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 6, fy + 1); ctx.lineTo(ex, fy + 7); ctx.stroke();
      }
      return;
    }

    this._groundShadow(ctx, x, y, w, h);
    ctx.save();
    if (this.dying) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(this.animTimer * 0.2);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    // local coords: origin top-centre, +x = facing direction
    const dir = this.vx > 0 ? 1 : -1;
    ctx.translate(x + w / 2, y); ctx.scale(dir, 1);
    const moving = Math.abs(this.vx) > 0.3;
    const sl = moving ? Math.sin(this.animTimer * 0.25) : 0;   // slither wiggle
    const bob = moving ? Math.abs(Math.sin(this.animTimer * 0.125)) * 1.2 : 0;

    // Tail rising behind the coil, yellow rattle on the tip
    ell(ctx, -11 + sl * 0.6, h * 0.56, 3.4, 7.5, 0.32 - sl * 0.12, PUR, OL, { lw: 1.3 });
    ell(ctx, -13.5 + sl * 1.2, h * 0.27, 3, 3.8, 0, YEL, OL, { sh: 0.8, lw: 1.3 });
    ctx.strokeStyle = tint(YEL, 0.7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-16 + sl * 1.2, h * 0.27); ctx.lineTo(-11 + sl * 1.2, h * 0.27); ctx.stroke();

    // Rear coil loop
    ell(ctx, -1, h * 0.77, 13.5, 5.8, 0, PUR, OL);
    ell(ctx, 0, h * 0.81, 9.5, 2.3, 0, BELLY, null, { sh: 0 });
    // Front coil (overlapping, slightly higher — gives the body volume)
    ell(ctx, 2 - sl, h * 0.66, 9.5, 4.6, 0, PUR, OL, { lw: 1.3 });
    ell(ctx, 3 - sl, h * 0.69, 6.5, 1.8, 0, BELLY, null, { sh: 0 });

    // Neck rising from the front of the coil
    ell(ctx, 5, h * 0.5 - bob * 0.5, 5, 8.8, -0.28, PUR, OL);
    ell(ctx, 6.4, h * 0.48 - bob * 0.5, 3.6, 1.7, -0.28, YEL, null, { sh: 0 });

    // Head
    const hy = h * 0.27 - bob;
    ell(ctx, 6, hy, 9, 7.2, 0, PUR, OL);
    hilite(ctx, 3, hy - 3, 3, 1.4);
    // Big yellow eyes with slit pupils
    ell(ctx, 8.8, hy - 0.5, 3, 3.6, 0, EYE, OL, { sh: 0, lw: 1 });
    ell(ctx, 2.2, hy - 1, 2.5, 3.3, 0, EYE, OL, { sh: 0, lw: 1 });
    ctx.fillStyle = '#111';
    ctx.fillRect(8.3, hy - 3, 1.5, 4.6);
    ctx.fillRect(2.2, hy - 3.2, 1.3, 4.2);
    // Nostril + mouth line
    ctx.fillRect(12.5, hy + 0.5, 1.2, 1.2);
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(9, hy + 3.8); ctx.quadraticCurveTo(12, hy + 4.4, 14, hy + 2.6); ctx.stroke();
    // Forked tongue flick
    if (Math.sin(this.animTimer * 0.18) > 0.5) {
      ctx.strokeStyle = '#e7403c'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(13.5, hy + 3); ctx.lineTo(18, hy + 2.5);
      ctx.moveTo(18, hy + 2.5); ctx.lineTo(20, hy + 0.5);
      ctx.moveTo(18, hy + 2.5); ctx.lineTo(20.5, hy + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Koffing — floating purple gas ball: craters, angry grin, skull mark, puffs
  _drawKoffing(ctx, x, y, w, h) {
    const bobY = Math.sin(this.animTimer * 0.06) * 4;
    const cx = x + w / 2;
    const cy = y + h / 2 + bobY;
    const r = w / 2 - 1;
    const PUR = '#8a4fb0', OL = '#2e1246', BONE = '#f3eedd';

    if (this.dying) {
      ctx.globalAlpha = this.deathAlpha;
      const flash = Math.floor(this.animTimer / 4) % 2;
      if (flash) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
    }

    // Toxic gas puffs drifting around the body (behind)
    const t = this.animTimer * 0.05;
    for (const [a, d, pr] of [[-2.1, 1.0, 6], [0.6, 1.05, 5.5], [-0.9, 1.1, 4.5], [2.4, 1.0, 5]]) {
      const px = cx + Math.cos(a + Math.sin(t + a) * 0.2) * r * d;
      const py = cy + Math.sin(a + Math.sin(t + a) * 0.2) * r * d - 2;
      ctx.fillStyle = 'rgba(190,130,230,0.55)';
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(80,30,120,0.45)'; ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Body — sphere with bumpy craters on the silhouette (one outline)
    const bumps = [[-2.3, 3.8], [-1.3, 3.2], [-0.2, 3.6], [0.9, 3.0], [2.0, 3.4], [3.1, 3.0]];
    const build = () => {
      ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
      for (const [a, br] of bumps) {
        const bx = cx + Math.cos(a) * (r - 1), by = cy + Math.sin(a) * (r - 1);
        ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU);
      }
    };
    shape(ctx, build, PUR, OL, { sh: 0.7, dy: 3 });
    hilite(ctx, cx - 6, cy - 8, 4.5, 2.2);
    // Crater dimples
    ctx.fillStyle = tint(PUR, 0.68);
    for (const [dx, dy, cr] of [[-10, 2, 1.8], [10, -1, 1.6], [-4, 9, 1.5], [7, 8, 1.4], [0, -11, 1.3]]) {
      ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, cr, cr * 0.8, 0, 0, TAU); ctx.fill();
    }

    // Eyes — wide, with angry brows
    eye(ctx, cx - 6, cy - 3, 3.6);
    eye(ctx, cx + 6, cy - 3, 3.6);
    ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 9); ctx.lineTo(cx - 3, cy - 6.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 10, cy - 9); ctx.lineTo(cx + 3, cy - 6.5); ctx.stroke();

    // Wide grin with teeth
    const my = cy + 3;
    shape(ctx, () => { ctx.moveTo(cx - 9, my); ctx.quadraticCurveTo(cx, my + 11, cx + 9, my); ctx.closePath(); },
          '#2a1038', OL, { sh: 0, lw: 1.3 });
    ctx.fillStyle = BONE;
    for (let i = 0; i < 4; i++) {
      const tx = cx - 7 + i * 4;
      ctx.beginPath(); ctx.moveTo(tx, my + 0.5); ctx.lineTo(tx + 1.8, my + 3.5); ctx.lineTo(tx + 3.6, my + 0.5); ctx.closePath(); ctx.fill();
    }

    // Skull-and-crossbones mark under the mouth
    ctx.strokeStyle = BONE; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + 9); ctx.lineTo(cx + 4, cy + 13); ctx.moveTo(cx + 4, cy + 9); ctx.lineTo(cx - 4, cy + 13); ctx.stroke();
    ell(ctx, cx, cy + 10.5, 2.6, 2.4, 0, BONE, null, { sh: 0 });
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 1.6, cy + 9.6, 1.1, 1.1); ctx.fillRect(cx + 0.5, cy + 9.6, 1.1, 1.1);

    ctx.globalAlpha = 1;
  }

  // Sandshrew — sandy armadillo-mouse: dark armoured back with bold plate
  // rows, cream belly + face, big eye with brow, pointed ear, stubby clawed
  // feet. Curls into a plated ball (shell state).
  _drawSquirtle(ctx, x, y, w, h) {
    const SHELL = '#d1a542', SHELL_D = '#7c5316', CREAM = '#fff1cc', OL = '#33200a';
    const CLAW = '#3a2a16';

    if (this.inShell) {
      // FSM: from frame 350 the shell "peeks" — wiggle warns it's waking up
      if (!this.shellSliding && this.shellCounter > 350) {
        x += Math.sin(this.animTimer * 0.8) * 1.5;
      }
      const cx = x + w / 2, cy2 = y + h - 13;
      this._groundShadow(ctx, x, y, w, h);
      // Rolling: full spin while sliding, tiny rock while idle so it still
      // reads as a living ball that could get going
      const rot = this.shellSliding
        ? this.animTimer * 0.35 * (this.vx > 0 ? 1 : -1)
        : 0;
      ctx.save();
      ctx.translate(cx, cy2); ctx.rotate(rot);
      // Ball — darker plated body, heavy outline
      ell(ctx, 0, 0, 12.5, 12.5, 0, SHELL, OL, { sh: 0.72, dy: 4.5, lw: 1.8 });
      // Plate segmentation: 3 wide bands + staggered vertical cuts, bold
      // grooves with a pale top edge on each plate
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, 11.6, 0, TAU); ctx.clip();
      ctx.lineCap = 'butt';
      for (let row = -1; row <= 1; row++) {
        const yy = row * 7;
        ctx.strokeStyle = SHELL_D; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-13, yy); ctx.lineTo(13, yy); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,245,200,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-13, yy + 1.6); ctx.lineTo(13, yy + 1.6); ctx.stroke();
        const off = row ? 0 : 4.5;
        ctx.strokeStyle = SHELL_D; ctx.lineWidth = 2;
        for (let c = -1; c <= 1; c++) {
          const xx = c * 9 + off;
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 7); ctx.stroke();
        }
      }
      ctx.restore();
      hilite(ctx, -5, -6.5, 3.8, 1.8, 0.4);
      // Tucked face — cream patch at the lower front with one open eye
      ell(ctx, 6, 5.5, 5.6, 4.4, -0.25, CREAM, OL, { sh: 0.9, lw: 1.4 });
      eye(ctx, 6.5, 4.8, 2.1);
      ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4.6, 1.6); ctx.lineTo(8.6, 2.2); ctx.stroke();   // brow
      ctx.fillStyle = CLAW;
      ctx.beginPath(); ctx.arc(10.2, 7.2, 1.1, 0, TAU); ctx.fill();                  // nose
      // Pointed ear poking out above the face, curled tail nub at the back
      poly(ctx, [1, -1, 5.5, -7.5, 7.5, -1.5], SHELL, OL, { sh: 0.85, lw: 1.3 });
      ell(ctx, -8, 7, 4, 2.6, 0.5, SHELL, OL, { sh: 0.8, lw: 1.3 });
      ctx.restore();
      // Motion lines when sliding
      if (this.shellSliding) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const d = this.vx > 0 ? -1 : 1;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + d * (14 + i * 6), cy2 - 6 + i * 3);
          ctx.lineTo(cx + d * (14 + i * 6 + 12), cy2 - 6 + i * 3);
          ctx.stroke();
        }
      }
      return;
    }

    this._groundShadow(ctx, x, y, w, h);
    const dir = this.vx <= 0 ? -1 : 1;   // face direction of travel

    // Feathered wings for the flying variant (behind the body)
    if (this.flying) {
      const flap = Math.sin(this.animTimer * 0.4);
      const wing = (side) => {
        ctx.save();
        ctx.translate(x + w / 2 + side * w * 0.2, y + h * 0.32);
        ctx.scale(side, 1);
        ctx.rotate(-0.25 + flap * 0.4);
        const build = () => {
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(-8, -9, -19, -8);
          ctx.quadraticCurveTo(-21, -3, -17, 1);
          ctx.quadraticCurveTo(-13, 4, -11, 3);
          ctx.quadraticCurveTo(-7, 6, -5, 4.5);
          ctx.quadraticCurveTo(-2, 6, 0, 3.5);
          ctx.closePath();
        };
        shape(ctx, build, '#f4f4ff', '#4a4a78', { sh: 0.84, dy: 3, lw: 1.3 });
        ctx.strokeStyle = 'rgba(90,90,140,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(-11, -4); ctx.moveTo(-3, 2.5); ctx.lineTo(-15, -1); ctx.stroke();
        ctx.restore();
      };
      wing(-1); wing(1);
    }

    // Body is drawn in a local frame: origin at the hitbox's top-centre,
    // +u = facing direction, v down. u in [-15, 15], v in [0, 26].
    ctx.save();
    ctx.translate(x + w / 2, y);
    ctx.scale(dir, 1);

    // Feet — alternate on the walk cycle, each with 3 dark claws in front
    const walking = Math.abs(this.vx) > 0.3 || this.flying;
    const step = walking ? Math.floor(this.animTimer / 8) % 2 : 0;
    const lift = walking ? [step ? -1.5 : 0, step ? 0 : -1.5] : [0, 0];
    const feet = [[-8 + (step ? 3 : -2), lift[0]], [5 + (step ? -2 : 3), lift[1]]];
    for (const [fu, fv] of feet) {
      ell(ctx, fu, 22.5 + fv, 4.6, 3.3, 0, SHELL, OL, { lw: 1.4, sh: 0.78, dy: 1.5 });
      ctx.strokeStyle = CLAW; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (const du of [1.2, 3, 4.6]) {
        ctx.beginPath(); ctx.moveTo(fu + du, 23.2 + fv); ctx.lineTo(fu + du + 0.8, 25.4 + fv); ctx.stroke();
      }
    }

    // Tail — tapered, trailing behind
    poly(ctx, [-9, 16, -16, 12.5, -15.5, 16, -10, 19.5], SHELL, OL, { sh: 0.8, lw: 1.4 });

    // Cream belly under the body
    ell(ctx, 1, 18.5, 9, 4.8, 0, CREAM, OL, { sh: 0, lw: 1.4 });

    // Armoured back dome — darker sand, bold outline
    ell(ctx, -2.5, 12, 11.5, 9.5, 0, SHELL, OL, { sh: 0.72, dy: 4.5, lw: 1.6 });
    // Plate rows — 2 wide dark grooves + staggered cuts, pale edge beneath
    ctx.save();
    ctx.beginPath(); ctx.ellipse(-2.5, 12, 10.7, 8.7, 0, 0, TAU); ctx.clip();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = SHELL_D; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-15, 9); ctx.lineTo(10, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, 15); ctx.lineTo(10, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-7, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(-1, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 9); ctx.lineTo(-10, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, 9); ctx.lineTo(-3, 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, 15); ctx.lineTo(-7, 22); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,200,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-15, 10.6); ctx.lineTo(10, 10.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-15, 16.6); ctx.lineTo(10, 16.6); ctx.stroke();
    ctx.restore();
    hilite(ctx, -6, 5.5, 4, 1.8, 0.38);

    // Head — cream face with a sandy cap, big eye + brow, pointed ear
    ell(ctx, 8, 11, 7, 6.6, 0, CREAM, OL, { sh: 0, lw: 1.6 });
    // Sandy cap over the top of the head (clipped to the head ellipse)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(8, 11, 6.2, 5.8, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = SHELL;
    ctx.beginPath(); ctx.ellipse(4.5, 2.8, 8, 2.8, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // Ear — pointed, with a dark inner
    poly(ctx, [3, 7, 5.5, -1, 9.5, 5.5], SHELL, OL, { sh: 0.85, lw: 1.4 });
    poly(ctx, [4.8, 5.5, 5.8, 1.5, 7.8, 5.2], '#b07048', null, { sh: 0 });
    // Eye — white, pupil, shine; heavy brow above
    eye(ctx, 9.5, 10.5, 2.5);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(7, 7); ctx.lineTo(12, 7.8); ctx.stroke();
    // Nose + mouth on the snout tip
    ctx.fillStyle = CLAW;
    ctx.beginPath(); ctx.arc(14.2, 12.5, 1.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(13.5, 14.5); ctx.lineTo(10.5, 15.2); ctx.stroke();
    ctx.restore();
  }

  // Tentacool — blue jellyfish: big bell with darker rim, two red crystal
  // gems with highlights, eyes between, outlined swaying tentacles
  _drawBlooper(ctx, x, y, w, h) {
    const OL = '#10203f', BELL = '#4f9fe0', BELL_L = '#9ad2f4', RED = '#e02828', TENT = '#3878c0';
    const sway = Math.sin(this.animTimer * 0.1) * 2;
    const cx = x + w / 2;
    if (this.squeeze) {
      ctx.save();
      ctx.translate(cx, y + h);
      ctx.scale(1.12, 0.78);
      ctx.translate(-cx, -(y + h));
    }

    // Tentacles — hang from under the bell, stay inside the hitbox (+3px)
    const tent = (sx, sy, c1x, c1y, ex, ey, lw) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = OL; ctx.lineWidth = lw + 2.2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(c1x, c1y, ex, ey); ctx.stroke();
      ctx.strokeStyle = TENT; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(c1x, c1y, ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx - 1, sy); ctx.quadraticCurveTo(c1x - 1, c1y, ex - 1, ey); ctx.stroke();
    };
    const tb = y + h * 0.66;
    tent(x + w * 0.2, tb, x + w * 0.1 + sway, y + h * 0.9, x + w * 0.2 - sway, y + h + 2, 3.2);
    tent(x + w * 0.8, tb, x + w * 0.9 - sway, y + h * 0.9, x + w * 0.8 + sway, y + h + 2, 3.2);
    tent(x + w * 0.4, tb + 2, x + w * 0.37 - sway, y + h * 0.88, x + w * 0.42 + sway * 0.6, y + h + 1, 2.2);
    tent(x + w * 0.6, tb + 2, x + w * 0.63 + sway, y + h * 0.88, x + w * 0.58 - sway * 0.6, y + h + 1, 2.2);

    // Bell dome — fills the width of the hitbox, darker underside rim
    ell(ctx, cx, y + h * 0.4, w * 0.5, h * 0.37, 0, BELL, OL, { sh: 0.7, dy: 5, lw: 1.6 });
    // Pale band around the base of the bell (lip)
    ell(ctx, cx, y + h * 0.66, w * 0.42, h * 0.12, 0, BELL_L, OL, { sh: 0.86, dy: 1.5, lw: 1.3 });
    hilite(ctx, x + w * 0.3, y + h * 0.18, 4.2, 2, 0.42);

    // Two red crystal gems on the upper bell, with shine
    for (const gx of [x + w * 0.26, x + w * 0.74]) {
      ell(ctx, gx, y + h * 0.26, 4.6, 5.2, 0, RED, OL, { sh: 0.66, dy: 2.5, lw: 1.3 });
      hilite(ctx, gx - 1.6, y + h * 0.2, 1.8, 1, 0.75);
    }
    // Small ridge gem on top of the bell
    ell(ctx, cx, y + h * 0.06, 2.8, 2.6, 0, RED, OL, { sh: 0.7, lw: 1.1 });

    // Eyes — between the gems, white with pupils
    eye(ctx, x + w * 0.4, y + h * 0.46, 2.2);
    eye(ctx, x + w * 0.6, y + h * 0.46, 2.2);
    if (this.squeeze) ctx.restore();
  }
  // Magikarp — red fish with whiskers and crown fin
  _drawCheepCheep(ctx, x, y, w, h) {
    const OL = '#5a1408', RED = '#e8412a', FIN = '#f6e6b8', FIN_OL = '#9a7a40';
    const flop = Math.sin(this.animTimer * 0.15) * 2;

    // Tail fin — pale fan on the left
    poly(ctx, [x + 3, y + h * 0.3, x - 8, y - 2 + flop, x - 6, y + h * 0.5, x - 8, y + h + 2 - flop, x + 3, y + h * 0.7],
         FIN, FIN_OL, { lw: 1.2, sh: 0.86 });
    ctx.strokeStyle = 'rgba(120,90,40,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1, y + h * 0.5); ctx.lineTo(x - 6, y + 2 + flop); ctx.moveTo(x + 1, y + h * 0.5); ctx.lineTo(x - 6, y + h - 2 - flop); ctx.stroke();

    // Crown fin on top — spiky, behind the body
    poly(ctx, [x + w * 0.32, y + h * 0.16, x + w * 0.4, y - 5 + flop * 0.5, x + w * 0.5, y + h * 0.08,
               x + w * 0.6, y - 5 + flop * 0.5, x + w * 0.68, y + h * 0.16], FIN, FIN_OL, { lw: 1.2, sh: 0.86 });
    // Ventral fin
    poly(ctx, [x + w * 0.36, y + h * 0.86, x + w * 0.44, y + h + 3, x + w * 0.56, y + h + 2, x + w * 0.6, y + h * 0.86],
         FIN, FIN_OL, { lw: 1.1, sh: 0.86 });

    // Body — red, rounded, shaded underside
    ell(ctx, x + w * 0.52, y + h * 0.5, w * 0.44, h * 0.44, 0, RED, OL, { sh: 0.72, dy: 3 });
    // Scales
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x + w * 0.52, y + h * 0.5, w * 0.42, h * 0.42, 0, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(90,20,8,0.4)'; ctx.lineWidth = 1;
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < 4; c++) {
        const sx2 = x + w * 0.2 + c * 6 + (row % 2) * 3, sy2 = y + h * 0.25 + row * 5;
        ctx.beginPath(); ctx.arc(sx2, sy2, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    }
    ctx.restore();
    hilite(ctx, x + w * 0.4, y + h * 0.22, 4, 2);

    // White belly
    ell(ctx, x + w * 0.56, y + h * 0.7, w * 0.3, h * 0.18, 0, '#f8f0e0', null, { sh: 0.9, dy: 1.5 });

    // Side fin
    ell(ctx, x + w * 0.45, y + h * 0.62, 5.5, 3.5, 0.4 + flop * 0.1, FIN, FIN_OL, { lw: 1, sh: 0.86 });

    // Big round eye
    eye(ctx, x + w * 0.72, y + h * 0.34, 5, '#111', '#fff', 0.5);

    // Open mouth — big lips
    shape(ctx, () => ctx.arc(x + w * 0.94, y + h * 0.52, 4, Math.PI * 0.6, Math.PI * 1.4, true), '#7a1810', OL, { sh: 0, lw: 1.4 });

    // Whiskers — yellow, drooping from the mouth
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + w * 0.9, y + h * 0.58);
    ctx.quadraticCurveTo(x + w * 0.98, y + h * 0.8, x + w * 0.9 + flop * 0.5, y + h * 0.95); ctx.stroke();
    ctx.strokeStyle = '#f0d060'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + w * 0.9, y + h * 0.58);
    ctx.quadraticCurveTo(x + w * 0.98, y + h * 0.8, x + w * 0.9 + flop * 0.5, y + h * 0.95); ctx.stroke();
  }

  // Beldum — metallic bullet (Bullet Bill role)
  _drawBulletBill(ctx, x, y, w, h) {
    const OL = '#121a28', STEEL = '#5f80a8', FIN = '#3a5878';
    const dir = this.vx < 0 ? -1 : 1;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    // Rear claw fins
    poly(ctx, [-w * 0.2, -h * 0.3, -w * 0.46, -h * 0.5, -w * 0.3, -h * 0.1], FIN, OL, { lw: 1.3 });
    poly(ctx, [-w * 0.2, h * 0.3, -w * 0.46, h * 0.5, -w * 0.3, h * 0.1], FIN, OL, { lw: 1.3 });
    poly(ctx, [-w * 0.24, -h * 0.12, -w * 0.5, 0, -w * 0.24, h * 0.12], FIN, OL, { lw: 1.3 });
    // Body — rounded steel capsule, nose leading
    shape(ctx, () => {
      ctx.moveTo(-w * 0.20, -h * 0.42);
      ctx.lineTo(w * 0.10, -h * 0.42);
      ctx.quadraticCurveTo(w * 0.50, 0, w * 0.10, h * 0.42);
      ctx.lineTo(-w * 0.20, h * 0.42);
      ctx.quadraticCurveTo(-w * 0.42, 0, -w * 0.20, -h * 0.42);
      ctx.closePath();
    }, STEEL, OL, { sh: 0.7, dy: 3.5 });
    // Steel sheen + rivets
    hilite(ctx, -w * 0.05, -h * 0.22, w * 0.2, h * 0.09, 0.45);
    ctx.fillStyle = tint(STEEL, 0.75);
    for (const rx of [-w * 0.12, w * 0.02]) { ctx.beginPath(); ctx.arc(rx, h * 0.3, 1.3, 0, TAU); ctx.fill(); }
    // Single glowing red eye
    ell(ctx, w * 0.12, 0, 5.2, 5.2, 0, '#e02020', OL, { sh: 0.7, lw: 1.2 });
    ctx.fillStyle = 'rgba(255,120,120,0.35)';
    ctx.beginPath(); ctx.arc(w * 0.12, 0, 7, 0, TAU); ctx.fill();
    ell(ctx, w * 0.1, -1.5, 2, 2, 0, '#ffb0b0', null, { sh: 0 });
    ctx.restore();
  }

  // Zubat — blue bat hovering above (Lakitu role). Big outlined membrane
  // wings (3 ribs each) spanning the hitbox width, small round body, ears,
  // open fanged mouth and no eyes.
  _drawZubat(ctx, x, y, w, h) {
    const OL = '#1c1640';
    const flap = Math.sin(this.animTimer * 0.5);
    const BLUE = '#5a7ccc', PURP = '#7a5ab0', PURP_D = tint('#7a5ab0', 0.62);
    const cx = x + w / 2;
    const by = y + h * 0.58;        // body centre
    const sx = w * 0.12, sy = by - h * 0.1;    // wing shoulder (relative to cx)

    // Wings — built for the right side in +x, mirrored for the left; the
    // membrane hangs from a leading edge that pivots at the shoulder
    const wing = (side) => {
      ctx.save();
      ctx.translate(cx + side * sx, sy);
      ctx.scale(side, 1);
      ctx.rotate(-flap * 0.42);
      const tipX = w * 0.34, tipY = -h * 0.36;      // wing tip (upper outer corner)
      const f1 = [w * 0.37, -h * 0.02], f2 = [w * 0.3, h * 0.24], f3 = [w * 0.14, h * 0.36];   // finger tips along the trailing edge
      const build = () => {
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(tipX * 0.45, tipY * 0.95, tipX, tipY);    // leading edge (bone)
        ctx.lineTo(f1[0], f1[1]);
        ctx.quadraticCurveTo(f1[0] - 4, (f1[1] + f2[1]) * 0.5 - 2, f2[0], f2[1]);   // scalloped trailing edge
        ctx.quadraticCurveTo((f2[0] + f3[0]) * 0.5 - 2, (f2[1] + f3[1]) * 0.5 - 2, f3[0], f3[1]);
        ctx.quadraticCurveTo(f3[0] * 0.5 - 1, f3[1] * 0.6, 0, 3);
        ctx.closePath();
      };
      shape(ctx, build, PURP, OL, { sh: 0.74, dx: -1, dy: 2.6, lw: 1.4 });
      // ribs (wing fingers) from the shoulder to each scallop point
      ctx.strokeStyle = PURP_D; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [fx, fy] of [f1, f2, f3]) { ctx.moveTo(0, 0); ctx.lineTo(fx, fy); }
      ctx.stroke();
      // thicker leading-edge bone
      ctx.strokeStyle = tint(BLUE, 0.8); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(tipX * 0.45, tipY * 0.95, tipX, tipY); ctx.stroke();
      hilite(ctx, tipX * 0.5, tipY * 0.55, 3, 1.3, 0.22);
      ctx.restore();
    };
    wing(-1); wing(1);

    // Ears — tall pointed, purple inner
    poly(ctx, [cx - w * 0.2, by - h * 0.22, cx - w * 0.24, by - h * 0.62, cx - w * 0.03, by - h * 0.3], BLUE, OL, { sh: 0.74, dy: 2, lw: 1.3 });
    poly(ctx, [cx + w * 0.2, by - h * 0.22, cx + w * 0.24, by - h * 0.62, cx + w * 0.03, by - h * 0.3], BLUE, OL, { sh: 0.74, dy: 2, lw: 1.3 });
    poly(ctx, [cx - w * 0.17, by - h * 0.26, cx - w * 0.2, by - h * 0.5, cx - w * 0.08, by - h * 0.3], PURP, null, { sh: 0 });
    poly(ctx, [cx + w * 0.17, by - h * 0.26, cx + w * 0.2, by - h * 0.5, cx + w * 0.08, by - h * 0.3], PURP, null, { sh: 0 });
    // Tiny dangling feet
    ell(ctx, cx - 3.5, by + h * 0.36, 2.2, 2.6, 0.3, BLUE, OL, { lw: 1, sh: 0 });
    ell(ctx, cx + 3.5, by + h * 0.36, 2.2, 2.6, -0.3, BLUE, OL, { lw: 1, sh: 0 });
    // Round body
    ell(ctx, cx, by, w * 0.27, h * 0.33, 0, BLUE, OL, { sh: 0.72, dy: 3 });
    hilite(ctx, cx - 3.5, by - h * 0.18, 3, 1.6);

    // No eyes (Zubat!) — open mouth with four fangs
    ell(ctx, cx, by + h * 0.1, w * 0.17, h * 0.13, 0, '#2a1240', OL, { sh: 0, lw: 1.2 });
    ctx.fillStyle = '#fff';
    const mt = by + h * 0.1 - h * 0.11, mb = by + h * 0.1 + h * 0.11;
    ctx.beginPath(); ctx.moveTo(cx - 3.6, mt); ctx.lineTo(cx - 2.4, mt + 3.2); ctx.lineTo(cx - 1.2, mt); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 1.2, mt); ctx.lineTo(cx + 2.4, mt + 3.2); ctx.lineTo(cx + 3.6, mt); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 2.4, mb); ctx.lineTo(cx - 1.6, mb - 2.2); ctx.lineTo(cx - 0.8, mb); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 0.8, mb); ctx.lineTo(cx + 1.6, mb - 2.2); ctx.lineTo(cx + 2.4, mb); ctx.closePath(); ctx.fill();
  }

  // Cubone — brown, skull helmet, holds a bone (Hammer Bro role)
  _drawCubone(ctx, x, y, w, h) {
    const OL = '#3a2410', BODY = '#c09868', BELLY = '#ecd8a8', SKULL = '#f3eee0', SKULL_OL = '#6a5a40';
    const throwing = this.boneTimer < 12;
    const cx = x + w / 2;
    this._groundShadow(ctx, x, y, w, h);

    // Feet
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 10) % 2 : 0;
    ell(ctx, x + w * 0.3 + step * 2, y + h * 0.94, 5.5, 3.8, 0, BODY, OL, { lw: 1.2 });
    ell(ctx, x + w * 0.7 - step * 2, y + h * 0.94, 5.5, 3.8, 0, BODY, OL, { lw: 1.2 });
    // Tail
    ell(ctx, x + w * 0.1, y + h * 0.74, 5, 2.6, -0.4, BODY, OL, { lw: 1.2 });
    // Body + belly
    ell(ctx, cx, y + h * 0.62, w * 0.42, h * 0.33, 0, BODY, OL, { sh: 0.74, dy: 3 });
    ell(ctx, cx, y + h * 0.68, w * 0.26, h * 0.2, 0, BELLY, null, { sh: 0.9, dy: 1.5 });
    // Arm + bone — raised when about to throw
    ell(ctx, x + w * 0.86, y + h * (throwing ? 0.42 : 0.6), 4, 3, throwing ? -0.8 : 0.3, BODY, OL, { lw: 1.1 });
    ctx.save();
    ctx.translate(x + w * 0.94, y + h * (throwing ? 0.30 : 0.52));
    ctx.rotate(throwing ? -0.9 : 0.5);
    ctx.strokeStyle = SKULL_OL; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.strokeStyle = SKULL; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
    for (const [bx2, by2] of [[-7, -2], [-7, 2], [7, -2], [7, 2]]) {
      ell(ctx, bx2, by2, 2.3, 2.3, 0, SKULL, SKULL_OL, { lw: 1, sh: 0.9 });
    }
    ctx.restore();

    // Skull helmet head
    ell(ctx, cx, y + h * 0.25, w * 0.4, h * 0.24, 0, SKULL, SKULL_OL, { sh: 0.84, dy: 3 });
    ell(ctx, x + w * 0.78, y + h * 0.33, w * 0.14, h * 0.1, 0.2, SKULL, SKULL_OL, { lw: 1, sh: 0.84 });
    poly(ctx, [x + w * 0.30, y + h * 0.1, x + w * 0.22, y - h * 0.03, x + w * 0.4, y + h * 0.06], SKULL, SKULL_OL, { lw: 1.1, sh: 0.84 });
    poly(ctx, [x + w * 0.66, y + h * 0.08, x + w * 0.74, y - h * 0.03, x + w * 0.56, y + h * 0.05], SKULL, SKULL_OL, { lw: 1.1, sh: 0.84 });
    hilite(ctx, x + w * 0.4, y + h * 0.14, 3.5, 1.6, 0.5);
    // Skull cracks
    ctx.strokeStyle = SKULL_OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, y + h * 0.06); ctx.lineTo(cx + 1, y + h * 0.13); ctx.lineTo(cx - 1, y + h * 0.18); ctx.stroke();
    // Eye holes with green glint
    ell(ctx, x + w * 0.6, y + h * 0.25, 3.4, 4.2, 0, '#1a1410', null, { sh: 0 });
    ell(ctx, x + w * 0.36, y + h * 0.25, 3.4, 4.2, 0, '#1a1410', null, { sh: 0 });
    ell(ctx, x + w * 0.61, y + h * 0.26, 1.4, 1.4, 0, '#68c058', null, { sh: 0 });
    ell(ctx, x + w * 0.37, y + h * 0.26, 1.4, 1.4, 0, '#68c058', null, { sh: 0 });
  }

  // Pineco — blue-grey pinecone with layered scales (Spiny role; hurts to stomp)
  _drawPineco(ctx, x, y, w, h) {
    const OL = '#14223c', BODY = '#5c7cae', SCALE = '#46648f';
    const cx = x + w / 2, cy = y + h / 2;
    const rx = w * 0.46, ry = h * 0.48;
    const egg = this.type === 'pinecoegg';
    if (!egg) this._groundShadow(ctx, x, y, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    if (egg) ctx.rotate(this.animTimer * 0.2);
    // Scale tips poking out of the silhouette
    const spikes = 9;
    for (let i = 0; i < spikes; i++) {
      const a = -Math.PI / 2 + (i / spikes) * TAU;
      const sx2 = Math.cos(a) * rx * 0.86, sy2 = Math.sin(a) * ry * 0.86;
      const tx = Math.cos(a) * (rx + 3.5), ty = Math.sin(a) * (ry + 3.5);
      const px = Math.cos(a + Math.PI / 2) * 3.2, py = Math.sin(a + Math.PI / 2) * 3.2;
      poly(ctx, [sx2 + px, sy2 + py, tx, ty, sx2 - px, sy2 - py], SCALE, OL, { lw: 1.2, sh: 0 });
    }
    // Body with underside shade
    ell(ctx, 0, 0, rx, ry, 0, BODY, OL, { sh: 0.72, dy: 3.5 });
    // Overlapping scale rows (clipped to the body)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 0.8, ry - 0.8, 0, 0, TAU); ctx.clip();
    for (let row = 0; row < 4; row++) {
      const yy = -ry + 4 + row * 5;
      const off = row % 2 ? 3 : 0;
      for (let c = -3; c <= 3; c++) {
        const xx = c * 6 + off;
        ctx.fillStyle = tint(BODY, 0.82);
        ctx.beginPath(); ctx.moveTo(xx - 3, yy); ctx.quadraticCurveTo(xx, yy + 1, xx + 3, yy); ctx.lineTo(xx, yy + 4.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,34,60,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xx - 3, yy); ctx.lineTo(xx, yy + 4.5); ctx.lineTo(xx + 3, yy); ctx.stroke();
      }
    }
    ctx.restore();
    hilite(ctx, -rx * 0.4, -ry * 0.5, 3.5, 1.8);
    // Eyes — two dark ovals with glints on the lighter face patch
    ell(ctx, 0, 0.5, rx * 0.55, ry * 0.42, 0, BODY, null, { sh: 0 });
    ell(ctx, -4, -1, 2.1, 3, 0, '#111', null, { sh: 0 });
    ell(ctx, 4, -1, 2.1, 3, 0, '#111', null, { sh: 0 });
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4.8, -2.6, 1.3, 1.3); ctx.fillRect(3.2, -2.6, 1.3, 1.3);
    ctx.restore();
  }

  // Slugma — lava slug with droopy eyes, rises from the lava
  _drawPodoboo(ctx, x, y, w, h) {
    if (!this.isJumping && !this.dying) return; // hidden below the lava surface
    const OL = '#5a1000';
    const flicker = Math.floor(this.animTimer / 4) % 2;
    const cx = x + w / 2;

    // Heat glow
    const glow = ctx.createRadialGradient(cx, y + h * 0.5, 4, cx, y + h * 0.5, w * 0.95);
    glow.addColorStop(0, 'rgba(255,140,40,0.45)'); glow.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, y + h * 0.5, w * 0.95, 0, TAU); ctx.fill();

    // Dripping magma blobs beneath
    const DRIP = flicker ? '#ff5a10' : '#e84214';
    ell(ctx, x + w * 0.3, y + h * 0.95, 3, 4, 0, DRIP, OL, { lw: 1.1, sh: 0.8 });
    ell(ctx, x + w * 0.7, y + h * 1.0, 2.5, 3.5, 0, DRIP, OL, { lw: 1.1, sh: 0.8 });

    // Body — teardrop magma blob leaning up
    shape(ctx, () => {
      ctx.moveTo(cx, y - h * 0.15);
      ctx.bezierCurveTo(x + w * 1.05, y + h * 0.15, x + w * 1.0, y + h * 0.9, cx, y + h * 0.95);
      ctx.bezierCurveTo(x + w * 0.0, y + h * 0.9, x - w * 0.05, y + h * 0.15, cx, y - h * 0.15);
      ctx.closePath();
    }, flicker ? '#f04a18' : '#e03a10', OL, { sh: 0.72, dy: 3.5 });
    // Inner glow + bright core
    ell(ctx, cx, y + h * 0.55, w * 0.3, h * 0.3, 0, flicker ? '#ff9a30' : '#ff7a20', null, { sh: 0 });
    hilite(ctx, cx - 3, y + h * 0.42, 3, 1.6, 0.5);

    // Droopy round eyes on top — Slugma's signature look
    ell(ctx, x + w * 0.34, y + h * 0.16, 4.5, 5, -0.15, '#f8d838', OL, { lw: 1.1, sh: 0.85 });
    ell(ctx, x + w * 0.66, y + h * 0.16, 4.5, 5, 0.15, '#f8d838', OL, { lw: 1.1, sh: 0.85 });
    ell(ctx, x + w * 0.35, y + h * 0.2, 1.8, 2.2, 0, '#111', null, { sh: 0 });
    ell(ctx, x + w * 0.65, y + h * 0.2, 1.8, 2.2, 0, '#111', null, { sh: 0 });
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * 0.35 - 1.5, y + h * 0.16, 1.2, 1.2);
    ctx.fillRect(x + w * 0.65 - 1.5, y + h * 0.16, 1.2, 1.2);
  }
}
