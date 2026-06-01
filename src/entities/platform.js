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
    if (this.color === COLORS.ground || this.color === '#7a4a1e') {
      r.drawGround(sx, sy, this.w, this.h);
    } else {
      r.platform(sx, sy, this.w, this.h, this.color);
    }
  }
}

// Question block: bump from below to release pokeball or power-up.
export class QuestionBlock {
  constructor(x, y, contents = 'pokeball') {
    this.x = x; this.y = y; this.w = TILE; this.h = TILE;
    this.contents = contents;
    this.used = false;
    this.dead = false;
    this.bump = 0;
    this.anim = Math.floor(Math.random() * 60);
    this.kind = 'qblock';
  }

  onBump(game) {
    if (this.used) return;
    this.used = true;
    this.bump = 8;
    if (this.contents === 'pokeball' || this.contents === 'coin') {
      game.collectBlockCoin(this.x + this.w / 2 - 10, this.y - 4);
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
  constructor(x, y) {
    this.x = x; this.y = y; this.w = TILE; this.h = TILE;
    this.dead = false;
    this.bump = 0;
    this.kind = 'brick';
  }

  onBump(game) {
    if (this.bump > 0) return;
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
  }
}

// Moving platform — travels between two points horizontally or vertically
export class MovingPlatform {
  constructor(x, y, w, h, axis, speed, range) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.axis = axis;  // 'x' or 'y'
    this.speed = speed;
    this.range = range;
    this.startX = x; this.startY = y;
    this.dir = 1;
    this.dead = false;
    this.kind = 'platform';
    this.velX = 0; this.velY = 0;
  }

  update() {
    const prev = this.axis === 'x' ? this.x : this.y;
    if (this.axis === 'x') {
      this.x += this.speed * this.dir;
      if (Math.abs(this.x - this.startX) >= this.range) this.dir = -this.dir;
      this.velX = this.x - prev;
      this.velY = 0;
    } else {
      this.y += this.speed * this.dir;
      if (Math.abs(this.y - this.startY) >= this.range) this.dir = -this.dir;
      this.velY = this.y - prev;
      this.velX = 0;
    }
  }

  draw(r, cam) {
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    r.platform(x, y, this.w, this.h, '#a0522d');
    // light stripe on top
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

    // Pipe cap — visually wider by overhang (pure rendering)
    ctx.fillStyle = '#2a9e2a';
    ctx.fillRect(sx - overhang, sy, w + overhang * 2, TILE);
    // Cap highlight
    ctx.fillStyle = '#3ab83a';
    ctx.fillRect(sx - overhang, sy, w + overhang * 2, 5);
    ctx.fillStyle = '#186018';
    ctx.fillRect(sx - overhang, sy + TILE - 4, w + overhang * 2, 4);

    // Outlines
    ctx.strokeStyle = '#0a2e0a'; ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - overhang, sy, w + overhang * 2, TILE);
    ctx.strokeRect(sx, sy + TILE, w, h - TILE);
  }
}
