import { TILE, COLORS, GROUND_Y } from '../constants.js';

// Generic solid platform rectangle
export class Platform {
  constructor(x, y, w, h, color) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.color = color;
    this.dead = false;
    this.kind = 'platform';
  }

  draw(r, cam) {
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    if (this.isBridge) {
      const ctx = r.ctx;
      // Planks
      ctx.fillStyle = '#8b5e2a';
      ctx.fillRect(sx, sy, this.w, this.h);
      ctx.fillStyle = '#a8763a';
      for (let px = 0; px < this.w; px += 16) ctx.fillRect(sx + px + 1, sy + 2, 14, this.h - 4);
      // Green railing on top (SMB bridge look)
      ctx.fillStyle = '#2e9e40';
      ctx.fillRect(sx, sy - 8, this.w, 3);
      for (let px = 4; px < this.w; px += 16) ctx.fillRect(sx + px, sy - 8, 3, 8);
      return;
    }
    if (this.color === COLORS.ground || this.color === '#7a4a1e') {
      r.drawGround(sx, sy, this.w, this.h);
    } else {
      r.platform(sx, sy, this.w, this.h, this.color);
    }
  }
}

// Question block: bump from below to release pokeball or power-up.
export class QuestionBlock {
  constructor(x, y, contents = 'pokeball', hidden = false) {
    this.x = x; this.y = y; this.w = TILE; this.h = TILE;
    this.contents = contents;
    this.hidden = hidden;  // invisible until hit from below
    this.used = false;
    this.dead = false;
    this.bump = 0;
    this.anim = Math.floor(Math.random() * 60);
    this.kind = 'qblock';
  }

  onBump(game) {
    if (this.hidden) { this.hidden = false; return; }
    if (this.used) return;
    this.used = true;
    this.bump = 8;
    if (this.contents === 'pokeball' || this.contents === 'coin') {
      game.collectBlockCoin(this.x + this.w / 2 - 10, this.y - 4);
    } else if (this.contents === 'star' || this.contents === 'oneup' || this.contents === 'vine') {
      game.spawnBrickContents(this);
    } else {
      // If player is Eevee → Rare Candy (Umbreon), if Umbreon → Fire Stone (Flareon)
      const kind = game.player.big ? 'firestone' : 'candy';
      game.spawnPowerUp(this.x + 4, this.y - 4, kind);
    }
  }

  update() {
    this.anim++;
    if (this.bump > 0) this.bump--;
  }

  draw(r, cam) {
    if (this.hidden) {
      // Debug/parent mode: hint at the secret with a subtle dashed outline
      if (!r.showHidden) return;
      const ctx = r.ctx;
      const x = Math.floor(this.x - cam.x);
      const y = Math.floor(this.y);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, this.w - 6, this.h - 6);
      ctx.restore();
      return;
    }
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const yOff = this.bump > 0 ? -Math.sin((this.bump / 8) * Math.PI) * 8 : 0;
    const y = Math.floor(this.y + yOff);
    const w = this.w, h = this.h;

    if (this.used) {
      // Empty block (dark brown)
      ctx.fillStyle = '#a8772f';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#7a531c';
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.strokeStyle = '#5a3c12'; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      return;
    }

    const t = Math.floor(this.anim / 18) % 3;
    ctx.fillStyle = t === 2 ? '#d98e10' : COLORS.qblock;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = '#7a531c'; ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#7a531c';
    for (const [cx, cy] of [[5, 5], [w - 9, 5], [5, h - 9], [w - 9, h - 9]]) {
      ctx.fillRect(x + cx, y + cy, 4, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

// Breakable brick — big player breaks it from below, small player bounces it
export class BrickBlock {
  constructor(x, y, contents = null) {
    this.x = x; this.y = y; this.w = TILE; this.h = TILE;
    this.dead = false;
    this.bump = 0;
    this.contents = contents;   // 'star' | 'candy' | 'oneup' | 'vine' | 'coin' | null
    this.used = false;
    this.kind = 'brick';
  }

  onBump(game) {
    if (this.bump > 0) return;
    // Multi-coin brick (FSM): dispenses a coin per bump for 245 frames
    // after the first hit, then becomes spent
    if (this.contents === 'coin' || this.contents === 'pokeball') {
      if (!this.used) {
        game.collectBlockCoin(this.x + this.w / 2 - 10, this.y - 4);
        if (this.coinWindow == null) this.coinWindow = 245;
        if (this.coinWindow <= 0) this.used = true;
      }
      this.bump = 8;
      return;
    }
    // Bricks with other contents dispense them instead of breaking
    if (this.contents) {
      if (!this.used) {
        this.used = true;
        game.spawnBrickContents(this);
      }
      this.bump = 8;
      return;
    }
    if (game.player.big) {
      this.dead = true;
      game.score += 50;
      game.spawnBrickDebris(this.x, this.y);
    } else {
      this.bump = 8;
    }
  }

  update() {
    if (this.bump > 0) this.bump--;
    if (this.coinWindow != null && this.coinWindow > 0) this.coinWindow--;
  }

  draw(r, cam) {
    if (this.dead) return;
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const yOff = this.bump > 0 ? -Math.sin((this.bump / 8) * Math.PI) * 8 : 0;
    const y = Math.floor(this.y + yOff);
    const T = TILE;
    ctx.fillStyle = '#b5651d';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#c87a38';
    ctx.fillRect(x + 2, y + 2, T - 4, 10);
    ctx.fillRect(x + 2, y + T - 12, T - 4, 10);
    ctx.fillStyle = '#c87a38';
    ctx.fillRect(x + 2, y + 14, (T - 6) / 2 - 1, 8);
    ctx.fillRect(x + (T - 6) / 2 + 5, y + 14, (T - 6) / 2 - 1, 8);
    ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
    // Explorer mode: bricks hiding contents get a golden dashed hint
    if (r.showHidden && this.contents && !this.used) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(255,215,60,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
      ctx.restore();
    }
  }
}

// Tree platform — green canopy with brown trunk extending to ground
export class TreePlatform {
  constructor(x, y, w) {
    this.x = x; this.y = y; this.w = w; this.h = TILE;
    this.color = '#5a8830';
    this.dead = false;
    this.kind = 'platform';
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const trunkW = Math.max(8, Math.floor(this.w * 0.25));
    const trunkX = sx + Math.floor((this.w - trunkW) / 2);
    // Brown trunk from bottom of canopy to ground
    ctx.fillStyle = '#7a4a1e';
    ctx.fillRect(trunkX, sy + this.h, trunkW, GROUND_Y - sy - this.h);
    // Green canopy
    r.platform(sx, sy, this.w, this.h, this.color);
  }
}

// Mushroom platform (FSM ShroomTop) — red cap with white spots on a trunk
export class ShroomPlatform {
  constructor(x, y, w) {
    this.x = x; this.y = y; this.w = w; this.h = TILE * 0.6;
    this.dead = false;
    this.kind = 'platform';
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const cx = sx + this.w / 2;
    // Trunk down to the ground
    ctx.fillStyle = '#c89050';
    ctx.fillRect(cx - 9, sy + this.h - 2, 18, GROUND_Y - sy - this.h + 2);
    ctx.fillStyle = '#a87038';
    ctx.fillRect(cx + 3, sy + this.h - 2, 6, GROUND_Y - sy - this.h + 2);
    // Cap — rounded red dome
    ctx.fillStyle = '#e03828';
    ctx.beginPath();
    ctx.moveTo(sx, sy + this.h);
    ctx.lineTo(sx, sy + 8);
    ctx.quadraticCurveTo(sx, sy, sx + 12, sy);
    ctx.lineTo(sx + this.w - 12, sy);
    ctx.quadraticCurveTo(sx + this.w, sy, sx + this.w, sy + 8);
    ctx.lineTo(sx + this.w, sy + this.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
    // White spots
    ctx.fillStyle = '#f8f0e8';
    for (let i = 0; i < Math.max(2, Math.floor(this.w / 44)); i++) {
      const dx = sx + 16 + i * 44;
      if (dx < sx + this.w - 10) { ctx.beginPath(); ctx.ellipse(dx, sy + 8, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // Bottom rim
    ctx.fillStyle = '#f0d8b0';
    ctx.fillRect(sx + 1, sy + this.h - 4, this.w - 2, 4);
  }
}

// Moving platform — travels between two points horizontally or vertically
export class MovingPlatform {
  // mode: 'oscillate' (default) — bounces back and forth
  //       'conveyor'            — moves in one direction, wraps around (elevator effect)
  constructor(x, y, w, h, axis, speed, range, mode = 'oscillate') {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.axis = axis;
    this.speed = speed;
    this.range = range;
    this.mode  = mode;
    this.startX = x; this.startY = y;
    this.dir = 1;
    this.dead = false;
    this.kind = 'platform';
    this.velX = 0; this.velY = 0;
  }

  update() {
    // Static / falling / transport-ride platforms have no patrol range —
    // leave their position alone (the oscillate clamp below would snap them
    // back to startX every frame, freezing rides in place)
    if (this.speed === 0 && this.range === 0) {
      this.velX = 0; this.velY = 0;
      return;
    }
    const prev = this.axis === 'x' ? this.x : this.y;
    if (this.mode === 'conveyor') {
      // Move continuously in one direction, wrap when exceeding range
      if (this.axis === 'y') {
        this.y += this.speed;
        const lo = this.startY, hi = this.startY + this.range;
        if (this.speed > 0 && this.y > hi)  this.y = lo;
        if (this.speed < 0 && this.y < lo)  this.y = hi;
        this.velY = this.y - prev;
        this.velX = 0;
      } else {
        this.x += this.speed;
        const lo = this.startX, hi = this.startX + this.range;
        if (this.speed > 0 && this.x > hi)  this.x = lo;
        if (this.speed < 0 && this.x < lo)  this.x = hi;
        this.velX = this.x - prev;
        this.velY = 0;
      }
    } else {
      // Oscillate mode — bounce strictly between [start, start + range].
      // (The old |pos - start| >= range check reversed at BOTH ends of the
      // start point, so platforms drifted a full range beyond their bounds.)
      if (this.axis === 'x') {
        this.x += this.speed * this.dir;
        if (this.x >= this.startX + this.range) { this.x = this.startX + this.range; this.dir = -1; }
        if (this.x <= this.startX)             { this.x = this.startX;              this.dir =  1; }
        this.velX = this.x - prev;
        this.velY = 0;
      } else {
        this.y += this.speed * this.dir;
        if (this.y >= this.startY + this.range) { this.y = this.startY + this.range; this.dir = -1; }
        if (this.y <= this.startY)             { this.y = this.startY;              this.dir =  1; }
        this.velY = this.y - prev;
        this.velX = 0;
      }
    }
  }

  draw(r, cam) {
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    r.platform(x, y, this.w, this.h, '#a0522d');
    const ctx = r.ctx;
    ctx.fillStyle = '#c87a38';
    ctx.fillRect(x + 2, y + 2, this.w - 4, 6);
  }
}

// Pipe block — solid hitbox is exactly T*2 wide; cap is drawn visually wider but doesn't affect collision
export class PipeBlock {
  constructor(tx, tileHeight, enterable = false) {
    const T = TILE;
    // Solid hitbox: exact pipe body width, full height
    this.x = tx;
    this.y = GROUND_Y - T * tileHeight;
    this.w = T * 2;
    this.h = T * tileHeight;
    this.dead = false;
    this.kind = 'platform';
    this.enterable = enterable;
    this.isExit = false;
    this._capOverhang = 4; // visual only
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const w = this.w;
    const h = this.h;
    const overhang = this._capOverhang;

    // Pipe body (dark green)
    ctx.fillStyle = '#186018';
    ctx.fillRect(sx, sy + TILE, w, h - TILE);
    // Pipe body highlight
    ctx.fillStyle = '#1e7a1e';
    ctx.fillRect(sx + 3, sy + TILE + 2, 6, h - TILE - 4);
    ctx.fillStyle = '#0f4010';
    ctx.fillRect(sx + w - 6, sy + TILE + 2, 4, h - TILE - 4);

    // Pipe cap — only draw if visible (not buried near/above ceiling)
    const showCap = this.y > 40;
    if (showCap) {
      ctx.fillStyle = '#2a9e2a';
      ctx.fillRect(sx - overhang, sy, w + overhang * 2, TILE);
      ctx.fillStyle = '#3ab83a';
      ctx.fillRect(sx - overhang, sy, w + overhang * 2, 5);
      ctx.fillStyle = '#186018';
      ctx.fillRect(sx - overhang, sy + TILE - 4, w + overhang * 2, 4);
      ctx.strokeStyle = '#0a2e0a'; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - overhang, sy, w + overhang * 2, TILE);
    }

    // Outlines
    ctx.strokeStyle = '#0a2e0a'; ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, showCap ? sy + TILE : sy, w, showCap ? h - TILE : h);
  }
}

// Springboard (FSM: 32px wide, 58px tall) — the player bounces off it;
// compression/launch is orchestrated by game.js
export class Springboard {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 32; this.h = 58;
    this.baseY = y;             // fully extended top
    this.compress = 0;          // 0..20 px of compression
    this.dead = false;
    this.kind = 'spring';
  }

  update() {
    // Relax toward extended when not being compressed by game.js
    if (this.compress > 0 && !this.compressing) {
      this.compress = Math.max(0, this.compress - 4);
      this.y = this.baseY + this.compress;
      this.h = 58 - this.compress;
    }
    this.compressing = false;
  }

  // Called by game.js while the player is pressing it down
  press(amount) {
    this.compress = Math.min(20, amount);
    this.y = this.baseY + this.compress;
    this.h = 58 - this.compress;
    this.compressing = true;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const top = Math.floor(this.y);
    const bottom = Math.floor(this.baseY + 58);

    // Base plate
    ctx.fillStyle = '#606060';
    ctx.fillRect(x + 2, bottom - 6, this.w - 4, 6);
    // Coils — squeeze with compression
    const coils = 4;
    const span = (bottom - 6) - (top + 8);
    ctx.strokeStyle = '#b0b0b0'; ctx.lineWidth = 3;
    for (let i = 0; i < coils; i++) {
      const cy = top + 10 + (span / coils) * (i + 0.5);
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, cy, this.w * 0.32, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Top plate — red
    ctx.fillStyle = '#c83028';
    ctx.fillRect(x, top, this.w, 8);
    ctx.fillStyle = '#e85850';
    ctx.fillRect(x + 2, top + 1, this.w - 4, 3);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
    ctx.strokeRect(x, top, this.w, 8);
  }
}
