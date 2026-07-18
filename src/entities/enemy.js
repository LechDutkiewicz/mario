import { GRAVITY, MAX_FALL_SPEED } from '../constants.js';
import { resolveCollisions } from '../physics.js';

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
    this.vx = type === 'koffing' ? -0.8 : type === 'squirtle' ? -1.3 : -1.1;
    this.vy = 0;
    if (type === 'blooper') { this.w = 26; this.h = 26; this.vx = 0; this.vy = 0; this.y = y - this.h; }
    if (type === 'cheepcheep') { this.w = 26; this.h = 20; this.vx = -2; this.y = y - this.h; }
    if (type === 'podoboo') { this.w = 20; this.h = 20; this.vx = 0; this.baseY = y - this.h; this.y = y - this.h; this.vy = 0; this.jumpTimer = Math.floor(Math.random() * 80) + 30; this.isJumping = false; }
    this.dead = false;
    this.squashTimer = 0;
    this.animTimer = Math.floor(Math.random() * 60);
    this.active = false;
    this.dying = false;
    this.deathAlpha = 1;
    this.inShell = false;
    this.shellSliding = false;
  }

  get stompable() { return this.type !== 'cheepcheep' && this.type !== 'blooper' && this.type !== 'podoboo'; }

  squash() {
    if (this.type === 'squirtle') {
      if (this.shellSliding) {
        this.shellSliding = false;
        this.vx = 0;
      } else if (!this.inShell) {
        this.inShell = true;
        this.vx = 0;
      }
      return;
    }
    this.squashTimer = 30;
    this.vx = 0;
  }

  kickShell(dir) {
    this.shellSliding = true;
    this.vx = dir * 9;
  }

  kill() {
    this.dead = true;
    this.dying = true;
    this.vy = -8;
    this.vx = this.vx < 0 ? -2 : 2;
  }

  update(solids, player) {
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

    if (!this.active) {
      if (Math.abs(this.x - player.x) < 520) this.active = true;
      else return;
    }

    // Flying Paratroopa — oscillates vertically, ignores gravity
    if (this.flying && !this.inShell) {
      this.y += 1.2 * this.flyDir;
      this.x += this.vx;
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

    if (this.type === 'blooper') {
      if (!this.active) {
        if (Math.abs(this.x - player.x) < 520) this.active = true;
        else return;
      }
      // Chase player slowly
      const dx = player.x - this.x, dy = player.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      this.x += (dx/dist) * 1.2;
      this.y += (dy/dist) * 1.2;
      return;
    }
    if (this.type === 'cheepcheep') {
      if (!this.active) {
        if (Math.abs(this.x - player.x) < 520) this.active = true;
        else return;
      }
      this.x += this.vx;
      if (this.smart) {
        // Arc toward player height
        const dy = player.y - this.y;
        this.vy += dy * 0.01;
        if (this.vy > 2) this.vy = 2;
        if (this.vy < -2) this.vy = -2;
        this.y += this.vy;
      }
      return;
    }
    if (this.type === 'podoboo') {
      if (this.dying) {
        this.vy += 0.4;
        this.y += this.vy;
        return;
      }
      if (this.jumpTimer > 0) { this.jumpTimer--; return; }
      if (!this.isJumping) { this.isJumping = true; this.vy = -16; }
      this.vy += 0.4;
      this.y += this.vy;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.vy = 0;
        this.isJumping = false;
        this.jumpTimer = 80;
      }
      return;
    }

    // Ekans / Squirtle — walks on ground
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    const prevVx = this.vx;
    const res = resolveCollisions(this, solids);
    const sp = this.type === 'squirtle' ? 1.3 : 1.1;

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
    } else if (this.type === 'cheepcheep') {
      this._drawCheepCheep(ctx, x, y, w, h);
    } else if (this.type === 'podoboo') {
      this._drawPodoboo(ctx, x, y, w, h);
    } else {
      this._drawEkans(ctx, x, y, w, h);
    }
  }

  _drawEkans(ctx, x, y, w, h) {
    if (this.squashTimer > 0) {
      // Flatten + X eyes
      const fh = 10;
      const fy = y + h - fh;
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(x, fy, w, fh);
      // X eyes
      ctx.strokeStyle = '#f44'; ctx.lineWidth = 2;
      for (const ex of [x + 4, x + w - 12]) {
        ctx.beginPath(); ctx.moveTo(ex, fy + 1); ctx.lineTo(ex + 7, fy + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 7, fy + 1); ctx.lineTo(ex, fy + 8); ctx.stroke();
      }
      return;
    }

    if (this.dying) {
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(this.animTimer * 0.2);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    // Body: purple oval / elongated shape
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.48, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck / head
    ctx.fillStyle = '#7d3c98';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.22, w * 0.3, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yellow slit eyes
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x + 7, y + h * 0.15, 5, 7);
    ctx.fillRect(x + w - 12, y + h * 0.15, 5, 7);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 9, y + h * 0.16, 2, 6); // slit pupil
    ctx.fillRect(x + w - 10, y + h * 0.16, 2, 6);

    // Tongue flick (sine wave animation)
    const tongueOut = Math.sin(this.animTimer * 0.18) > 0.5;
    if (tongueOut) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.38);
      ctx.lineTo(x + w / 2, y + h * 0.48);
      ctx.moveTo(x + w / 2, y + h * 0.48);
      ctx.lineTo(x + w / 2 - 4, y + h * 0.54);
      ctx.moveTo(x + w / 2, y + h * 0.48);
      ctx.lineTo(x + w / 2 + 4, y + h * 0.54);
      ctx.stroke();
    }

    // Belly lighter
    ctx.fillStyle = '#c39bd3';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.28, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stub legs / slithers
    const wig = Math.floor(this.animTimer / 10) % 2;
    ctx.fillStyle = '#7d3c98';
    ctx.fillRect(x + (wig ? 4 : 8), y + h - 6, 7, 6);
    ctx.fillRect(x + w - (wig ? 11 : 15), y + h - 6, 7, 6);

    if (this.dying) ctx.restore();
  }

  _drawKoffing(ctx, x, y, w, h) {
    // Floating bob
    const bobY = Math.sin(this.animTimer * 0.06) * 4;
    const cx = x + w / 2;
    const cy = y + h / 2 + bobY;
    const r = w / 2;

    if (this.dying) {
      ctx.globalAlpha = this.deathAlpha;
      // Flash white
      const flash = Math.floor(this.animTimer / 4) % 2;
      if (flash) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
    }

    // Dark purple body
    ctx.fillStyle = '#6c3483';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Skull mark — eyes (two white circles)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();

    // Skull teeth
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx - 8 + i * 6, cy + 4, 4, 5);
    }

    // Toxic gas puffs around body
    ctx.fillStyle = 'rgba(160,80,200,0.5)';
    const puffPositions = [[-r * 0.7, -r * 0.5], [r * 0.7, -r * 0.4], [0, -r * 0.9]];
    for (const [dx, dy] of puffPositions) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy + bobY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  // Sandshrew — sandy armadillo; curls into a ball (shell mechanic)
  _drawSquirtle(ctx, x, y, w, h) {
    const SAND = '#e0c068', SAND_D = '#b89440', BELLY = '#f8ecc8', OL = '#111';

    if (this.inShell) {
      // Curled-up ball with brick-pattern plates
      const cy2 = y + h - 13;
      ctx.fillStyle = SAND;
      ctx.beginPath(); ctx.arc(x + w / 2, cy2, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      // Brick plate lines (rotate when sliding)
      const rot = this.shellSliding ? this.animTimer * 0.35 * (this.vx > 0 ? 1 : -1) : 0;
      ctx.save();
      ctx.translate(x + w / 2, cy2);
      ctx.rotate(rot);
      ctx.strokeStyle = SAND_D; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(-11, i * 6); ctx.lineTo(11, i * 6); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(5, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -6); ctx.stroke();
      ctx.restore();
      // Motion lines when sliding
      if (this.shellSliding) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        const dir = this.vx > 0 ? -1 : 1;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x + w / 2 + dir * (14 + i * 6), cy2 - 6 + i * 3);
          ctx.lineTo(x + w / 2 + dir * (14 + i * 6 + 12), cy2 - 6 + i * 3);
          ctx.stroke();
        }
      }
      return;
    }

    // Wings for the flying variant
    if (this.flying) {
      const wingFlap = Math.floor(this.animTimer / 8) % 2;
      ctx.fillStyle = '#e8e8ff';
      ctx.strokeStyle = '#8888cc'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x - 8 + wingFlap * 3, y + h * 0.35, 10, 6, -0.4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + w + 8 - wingFlap * 3, y + h * 0.35, 10, 6, 0.4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    const dir = this.vx <= 0 ? -1 : 1;   // face direction of travel
    const fx = (ux) => x + w / 2 + dir * (ux - 0.5) * w;  // mirrorable x

    // Walking Sandshrew — low, on all fours
    // Back armor dome with brick pattern
    ctx.fillStyle = SAND;
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.52, w * 0.46, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = SAND_D; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.38); ctx.lineTo(x + w * 0.9, y + h * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h * 0.55); ctx.lineTo(x + w * 0.92, y + h * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx(0.35), y + h * 0.38); ctx.lineTo(fx(0.35), y + h * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx(0.6), y + h * 0.22); ctx.lineTo(fx(0.6), y + h * 0.38); ctx.stroke();

    // Pale belly (front-lower part)
    ctx.fillStyle = BELLY;
    ctx.beginPath(); ctx.ellipse(fx(0.62), y + h * 0.7, w * 0.24, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();

    // Snout + face on the leading side
    ctx.fillStyle = BELLY;
    ctx.beginPath(); ctx.ellipse(fx(0.82), y + h * 0.42, w * 0.16, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    // Ear nub
    ctx.fillStyle = SAND;
    ctx.beginPath(); ctx.ellipse(fx(0.72), y + h * 0.2, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    // Eye — narrow, mischievous
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(fx(0.8), y + h * 0.36, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(fx(0.8) - 1, y + h * 0.32, 1.5, 1.5);
    // Nose tip
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(fx(0.95), y + h * 0.44, 1.5, 0, Math.PI * 2); ctx.fill();

    // Claws / legs (animated)
    const step = Math.abs(this.vx) > 0.3 ? Math.floor(this.animTimer / 8) % 2 : 0;
    ctx.fillStyle = SAND;
    ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x + w * 0.24 + step * 3, y + h * 0.9, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w * 0.7 - step * 3, y + h * 0.9, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // White claws
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * 0.2 + step * 3, y + h * 0.94, 2, 3);
    ctx.fillRect(x + w * 0.26 + step * 3, y + h * 0.94, 2, 3);
    ctx.fillRect(x + w * 0.66 - step * 3, y + h * 0.94, 2, 3);
    ctx.fillRect(x + w * 0.72 - step * 3, y + h * 0.94, 2, 3);
  }

  // Tentacool — blue jellyfish with red crystals, dangling tentacles
  _drawBlooper(ctx, x, y, w, h) {
    const OL = '#111';
    const sway = Math.sin(this.animTimer * 0.1) * 2;

    // Tentacles — two long wavy ones
    ctx.strokeStyle = '#4878b8'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.7);
    ctx.quadraticCurveTo(x + w * 0.2 + sway, y + h * 1.1, x + w * 0.28 - sway, y + h * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y + h * 0.7);
    ctx.quadraticCurveTo(x + w * 0.8 - sway, y + h * 1.1, x + w * 0.72 + sway, y + h * 1.5);
    ctx.stroke();

    // Bell — light blue dome
    ctx.fillStyle = '#68a8d8';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.42, w * 0.42, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
    // Lighter blue base band
    ctx.fillStyle = '#90c8e8';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.36, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red crystal orbs — one big center-top, two small sides
    ctx.fillStyle = '#d02020';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 0.2, 5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w * 0.26, y + h * 0.42, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w * 0.74, y + h * 0.42, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Crystal shine
    ctx.fillStyle = '#ff9090';
    ctx.fillRect(x + w / 2 - 2, y + h * 0.14, 2, 2);

    // Eyes — small, between crystals
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(x + w * 0.42, y + h * 0.5, 1.8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.58, y + h * 0.5, 1.8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Magikarp — red fish with whiskers and crown fin
  _drawCheepCheep(ctx, x, y, w, h) {
    const OL = '#111';
    const flop = Math.sin(this.animTimer * 0.15) * 2;

    // Tail fin — pale yellow-white fan on the left
    ctx.fillStyle = '#f8e8c0';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h * 0.3);
    ctx.lineTo(x - 8, y - 2 + flop);
    ctx.lineTo(x - 6, y + h * 0.5);
    ctx.lineTo(x - 8, y + h + 2 - flop);
    ctx.lineTo(x + 3, y + h * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();

    // Body — red, rounded
    ctx.fillStyle = '#e83820';
    ctx.beginPath(); ctx.ellipse(x + w * 0.52, y + h * 0.5, w * 0.44, h * 0.44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

    // Crown fin on top — spiky pale yellow
    ctx.fillStyle = '#f8e8c0';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + h * 0.14);
    ctx.lineTo(x + w * 0.4, y - 5 + flop * 0.5);
    ctx.lineTo(x + w * 0.5, y + h * 0.08);
    ctx.lineTo(x + w * 0.6, y - 5 + flop * 0.5);
    ctx.lineTo(x + w * 0.68, y + h * 0.14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();

    // White belly
    ctx.fillStyle = '#f8f0e0';
    ctx.beginPath(); ctx.ellipse(x + w * 0.56, y + h * 0.68, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();

    // Side fin
    ctx.fillStyle = '#f8e8c0';
    ctx.beginPath(); ctx.ellipse(x + w * 0.45, y + h * 0.62, 5, 3.5, 0.4 + flop * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 0.8; ctx.stroke();

    // Big round eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x + w * 0.72, y + h * 0.34, 5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(x + w * 0.73, y + h * 0.35, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Open mouth — big lips
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + w * 0.94, y + h * 0.52, 4, Math.PI * 0.6, Math.PI * 1.4, true); ctx.stroke();

    // Whiskers — yellow, drooping from mouth
    ctx.strokeStyle = '#f0d060'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9, y + h * 0.58);
    ctx.quadraticCurveTo(x + w * 0.98, y + h * 0.8, x + w * 0.9 + flop * 0.5, y + h * 0.95);
    ctx.stroke();
  }

  // Slugma — lava slug with droopy eyes, rises from the lava
  _drawPodoboo(ctx, x, y, w, h) {
    if (!this.isJumping && !this.dying) return; // hidden below the lava surface
    const OL = '#111';
    const flicker = Math.floor(this.animTimer / 4) % 2;

    // Dripping magma blobs beneath
    ctx.fillStyle = flicker ? '#ff5500' : '#e84010';
    ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h * 0.95, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.7, y + h * 1.0, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Body — teardrop magma blob leaning up
    ctx.fillStyle = flicker ? '#f04818' : '#e03810';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y - h * 0.15);
    ctx.bezierCurveTo(x + w * 1.05, y + h * 0.15, x + w * 1.0, y + h * 0.9, x + w * 0.5, y + h * 0.95);
    ctx.bezierCurveTo(x + w * 0.0, y + h * 0.9, x - w * 0.05, y + h * 0.15, x + w * 0.5, y - h * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();

    // Inner glow
    ctx.fillStyle = flicker ? '#ff9030' : '#ff7020';
    ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + h * 0.55, w * 0.3, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();

    // Droopy round eyes on top — Slugma's signature look
    ctx.fillStyle = '#f8d838';
    ctx.beginPath(); ctx.ellipse(x + w * 0.34, y + h * 0.16, 4.5, 5, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + w * 0.66, y + h * 0.16, 4.5, 5, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(x + w * 0.35, y + h * 0.2, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w * 0.65, y + h * 0.2, 1.8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  }
}
