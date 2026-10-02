import { TILE, COLORS, GROUND_Y, CANVAS_HEIGHT } from '../constants.js';

// ------------------------------------------------------------
// Pixel-art drawing helpers (private to this module)
// ------------------------------------------------------------

// Offscreen tile sprite cache — each distinct tile look is painted once into
// a small canvas and then blitted with drawImage every frame (no per-frame
// canvas allocations).
const _sprites = new Map();
function getSprite(key, w, h, paint) {
  let c = _sprites.get(key);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  paint(cx, 0, 0);
  _sprites.set(key, c);
  return c;
}
// Blit a cached sprite, or paint directly when no document is available
function blit(ctx, key, x, y, w, h, paint) {
  const c = getSprite(key, w, h, paint);
  if (c) ctx.drawImage(c, x, y); else paint(ctx, x, y);
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Bevelled rectangle: base fill, 1px highlight top/left, 1px shadow
// bottom/right, 1px dark outline all around.
function bevel(ctx, x, y, w, h, base, light, dark, outline, inset = 1) {
  px(ctx, x, y, w, h, outline);
  const i = inset;
  px(ctx, x + i, y + i, w - i * 2, h - i * 2, base);
  px(ctx, x + i, y + i, w - i * 2, 1, light);       // top highlight
  px(ctx, x + i, y + i, 1, h - i * 2, light);       // left highlight
  px(ctx, x + i, y + h - i - 1, w - i * 2, 1, dark); // bottom shade
  px(ctx, x + w - i - 1, y + i, 1, h - i * 2, dark); // right shade
}

// Single brick cell with top/left highlight and bottom/right shade (no outline)
function brickCell(ctx, x, y, w, h, base, light, dark) {
  px(ctx, x, y, w, h, base);
  px(ctx, x, y, w, 1, light);
  px(ctx, x, y, 1, h, light);
  px(ctx, x, y + h - 1, w, 1, dark);
  px(ctx, x + w - 1, y, 1, h, dark);
}

// Small riveted corner bolt: 3x3 dark with a light top-left pixel
function rivet(ctx, x, y, dark, light) {
  px(ctx, x, y, 3, 3, dark);
  px(ctx, x, y, 1, 1, light);
}

// Short bark dashes alternating sides down a trunk
function barkLines(ctx, x, y, w, h, color, step = 12) {
  for (let i = 0, yy = y + 6; yy < y + h - 4; yy += step, i++) {
    const len = Math.max(3, Math.floor(w * 0.35));
    const bx = (i % 2 === 0) ? x + 2 : x + w - 2 - len;
    px(ctx, bx, yy, len, 1, color);
  }
}

const BRICK_PALETTES = {
  default:     { base: '#c0642a', light: '#dd8a4c', dark: '#8c4218', mortar: '#5a2a0c', outline: '#101018' },
  underground: { base: '#5c6c9c', light: '#8294c4', dark: '#3c4870', mortar: '#1e2642', outline: '#101018' },
  castle:      { base: '#86868e', light: '#acacb6', dark: '#5a5a62', mortar: '#303036', outline: '#101018' },
};
function brickPalette(setting) {
  if (setting === 'underground') return BRICK_PALETTES.underground;
  if (setting === 'castle') return BRICK_PALETTES.castle;
  return BRICK_PALETTES.default;
}

// 32x32 brick tile: two rows of offset bricks, 2px mortar, 1px outline
function paintBrick(pal) {
  return (ctx, ox, oy) => {
    const T = TILE;
    px(ctx, ox, oy, T, T, pal.mortar);
    // Row 0: two bricks (1..14, 17..30), mortar 15..16
    brickCell(ctx, ox + 1, oy + 1, 14, 14, pal.base, pal.light, pal.dark);
    brickCell(ctx, ox + 17, oy + 1, 14, 14, pal.base, pal.light, pal.dark);
    // Row 1 (offset): bricks 1..6, 9..22, 25..30; mortar 7..8, 23..24
    brickCell(ctx, ox + 1, oy + 17, 6, 14, pal.base, pal.light, pal.dark);
    brickCell(ctx, ox + 9, oy + 17, 14, 14, pal.base, pal.light, pal.dark);
    brickCell(ctx, ox + 25, oy + 17, 6, 14, pal.base, pal.light, pal.dark);
    // Outline
    ctx.strokeStyle = pal.outline; ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, T - 1, T - 1);
  };
}

// '?' glyph bitmap (7x10), drawn at 2x scale
const Q_GLYPH = [
  '.XXXXX.',
  'XX...XX',
  'XX...XX',
  '....XX.',
  '...XX..',
  '..XX...',
  '..XX...',
  '.......',
  '..XX...',
  '..XX...',
];
function paintGlyph(ctx, ox, oy, rows, scale, color) {
  ctx.fillStyle = color;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'X') ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
    }
  }
}

const Q_FRAMES = [
  { base: '#f0a21e', light: '#ffd65a', dark: '#b06810', glyph: '#fff6dc', gshadow: '#7a4410' },
  { base: '#f6ae2a', light: '#ffe27a', dark: '#b87012', glyph: '#fffdf0', gshadow: '#7a4410' },
  { base: '#dc8e14', light: '#f6c448', dark: '#9c5a0c', glyph: '#ffe6a0', gshadow: '#6e3c0c' },
];
function paintQBlock(f) {
  return (ctx, ox, oy) => {
    const T = TILE;
    bevel(ctx, ox, oy, T, T, f.base, f.light, f.dark, '#101018');
    // second, softer bevel ring for a chunkier edge
    px(ctx, ox + 2, oy + 2, T - 4, 1, f.light);
    px(ctx, ox + 2, oy + 2, 1, T - 4, f.light);
    px(ctx, ox + 2, oy + T - 3, T - 4, 1, f.dark);
    px(ctx, ox + T - 3, oy + 2, 1, T - 4, f.dark);
    for (const [cx, cy] of [[4, 4], [T - 7, 4], [4, T - 7], [T - 7, T - 7]]) rivet(ctx, ox + cx, oy + cy, '#5a3410', f.light);
    // Chunky '?' with 1px drop shadow
    const gx = ox + Math.floor((T - 14) / 2), gy = oy + Math.floor((T - 20) / 2);
    paintGlyph(ctx, gx + 1, gy + 1, Q_GLYPH, 2, f.gshadow);
    paintGlyph(ctx, gx, gy, Q_GLYPH, 2, f.glyph);
  };
}
function paintUsedBlock(ctx, ox, oy) {
  const T = TILE;
  bevel(ctx, ox, oy, T, T, '#8c5e22', '#b0803a', '#5c3c12', '#101018');
  px(ctx, ox + 2, oy + 2, T - 4, 1, '#b0803a');
  px(ctx, ox + 2, oy + 2, 1, T - 4, '#b0803a');
  px(ctx, ox + 2, oy + T - 3, T - 4, 1, '#5c3c12');
  px(ctx, ox + T - 3, oy + 2, 1, T - 4, '#5c3c12');
  for (const [cx, cy] of [[4, 4], [T - 7, 4], [4, T - 7], [T - 7, T - 7]]) rivet(ctx, ox + cx, oy + cy, '#40280c', '#b0803a');
  // Subtle inner panel
  px(ctx, ox + 9, oy + 9, T - 18, T - 18, '#7a5020');
  px(ctx, ox + 9, oy + 9, T - 18, 1, '#5c3c12');
  px(ctx, ox + 9, oy + 9, 1, T - 18, '#5c3c12');
}

// Wooden plank strip (used by bridge and moving lifts)
function paintPlanks(ctx, x, y, w, h, plankW, base, light, dark, seam) {
  px(ctx, x, y, w, h, base);
  for (let p = 0; p < w; p += plankW) {
    const pw = Math.min(plankW, w - p);
    px(ctx, x + p, y, pw, 1, light);
    px(ctx, x + p, y + h - 2, pw, 2, dark);
    if (p > 0) px(ctx, x + p, y, 1, h, seam);
    // wood grain tick
    if (pw > 8) px(ctx, x + p + 3, y + Math.floor(h / 2), pw - 6, 1, dark);
  }
}

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
      const w = this.w, h = this.h;
      // Planks with bevel + 1px outline
      px(ctx, sx, sy, w, h, '#101018');
      paintPlanks(ctx, sx + 1, sy + 1, w - 2, h - 2, 16, '#a8743a', '#cf9654', '#7a4e1c', '#4a2c0e');
      // Green railing on top (SMB bridge look): posts + top rail, outlined
      px(ctx, sx, sy - 9, w, 4, '#143c18');
      px(ctx, sx, sy - 8, w, 2, '#3cb44c');
      px(ctx, sx, sy - 8, w, 1, '#78e080');
      for (let p = 4; p < w; p += 16) {
        px(ctx, sx + p - 1, sy - 9, 5, 9, '#143c18');
        px(ctx, sx + p, sy - 8, 3, 8, '#3cb44c');
        px(ctx, sx + p, sy - 8, 1, 8, '#78e080');
      }
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
    if (this.used) return;
    this.hidden = false;   // a hidden block appears AND dispenses on the first hit (SMB)
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
      // Empty block: dark brown bevelled with rivets
      blit(ctx, 'qused', x, y, w, h, paintUsedBlock);
      return;
    }

    // 3-frame golden shimmer
    const t = Math.floor(this.anim / 18) % 3;
    blit(ctx, 'q' + t, x, y, w, h, paintQBlock(Q_FRAMES[t]));
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
    const setting = r.currentSetting;
    const palKey = setting === 'underground' ? 'underground' : setting === 'castle' ? 'castle' : 'default';
    blit(ctx, 'brick-' + palKey, x, y, T, T, paintBrick(brickPalette(setting)));
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
    const w = this.w, h = this.h;
    // Shaded trunk: 1px outline, light side (left 20%), dark side (right 30%)
    // Trunk reaches the ground if there is ground under it, else the bottom
    // of the screen (SMB treetop levels have no ground; set by the loader)
    const trunkTop = sy + h - 4, trunkH = (this.trunkBottom ?? GROUND_Y) - trunkTop;
    const tiW = trunkW - 2;
    const lightW = Math.max(2, Math.round(tiW * 0.20));
    const darkW = Math.max(3, Math.round(tiW * 0.30));
    px(ctx, trunkX, trunkTop, trunkW, trunkH, '#101018');
    px(ctx, trunkX + 1, trunkTop, tiW, trunkH, '#8a5a2a');
    px(ctx, trunkX + 1, trunkTop, lightW, trunkH, '#b07a44');
    px(ctx, trunkX + 1, trunkTop, 1, trunkH, '#c8946a');
    px(ctx, trunkX + 1 + tiW - darkW, trunkTop, darkW, trunkH, '#5a3814');
    px(ctx, trunkX + 1 + tiW - 2, trunkTop, 2, trunkH, '#3c2208');
    barkLines(ctx, trunkX + 1, trunkTop, tiW, trunkH, '#4a2a10', 14);
    // Rounded leafy canopy inside the hitbox rect; scallops dip 4px below
    const rad = Math.min(10, Math.floor(h / 2));
    const canopy = () => {
      ctx.beginPath();
      ctx.moveTo(sx + rad, sy);
      ctx.lineTo(sx + w - rad, sy);
      ctx.quadraticCurveTo(sx + w, sy, sx + w, sy + rad);
      ctx.lineTo(sx + w, sy + h - 4);
      // scalloped underside
      const n = Math.max(2, Math.round(w / 14));
      const sw = w / n;
      for (let i = n; i > 0; i--) {
        const x0 = sx + i * sw, x1 = sx + (i - 1) * sw;
        ctx.quadraticCurveTo((x0 + x1) / 2, sy + h + 6, x1, sy + h - 4);
      }
      ctx.lineTo(sx, sy + rad);
      ctx.quadraticCurveTo(sx, sy, sx + rad, sy);
      ctx.closePath();
    };
    ctx.save();
    canopy();
    ctx.clip();
    px(ctx, sx, sy, w, h + 6, '#2f7a2a');              // underside (dark)
    px(ctx, sx, sy, w, Math.floor(h * 0.55), '#4fae3c'); // mid
    px(ctx, sx, sy, w, Math.floor(h * 0.25), '#7ad257'); // top light
    // leaf speckles
    for (let lx = sx + 6; lx < sx + w - 4; lx += 12) {
      px(ctx, lx, sy + 9, 3, 2, '#7ad257');
      px(ctx, lx + 5, sy + 16, 3, 2, '#2f7a2a');
    }
    // Shaded underside where the trunk meets the canopy (dark ellipse)
    ctx.fillStyle = 'rgba(6,30,8,0.6)';
    ctx.beginPath();
    ctx.ellipse(trunkX + trunkW / 2, sy + h - 4, trunkW * 1.6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(4,20,6,0.5)';
    ctx.beginPath();
    ctx.ellipse(trunkX + trunkW / 2, sy + h - 1, trunkW * 1.1, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    canopy();
    ctx.strokeStyle = '#101018'; ctx.lineWidth = 1; ctx.stroke();
    // Drop shadow from the canopy onto the trunk top
    px(ctx, trunkX + 1, sy + h + 6, tiW, 4, 'rgba(0,0,0,0.38)');
    px(ctx, trunkX + 1, sy + h + 10, tiW, 2, 'rgba(0,0,0,0.18)');
  }
}

// Cannon (FSM Bill Blaster) — solid launcher block that fires Beldum bullets
export class Cannon {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.timer = 270;      // FSM: addEventInterval(..., 270)
    this.flash = 0;
    this.dead = false;
    this.kind = 'platform';
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const w = this.w, h = this.h;
    // Base column: bevelled grey with banding
    if (h > 26) {
      bevel(ctx, sx, sy + 26, w, h - 26, '#4a4a56', '#72727e', '#2a2a34', '#101018');
      for (let yy = sy + 34; yy < sy + h - 4; yy += 8) {
        px(ctx, sx + 2, yy, w - 4, 1, '#2a2a34');
        px(ctx, sx + 2, yy + 1, w - 4, 1, '#5a5a66');
      }
      rivet(ctx, sx + 3, sy + h - 6, '#1a1a22', '#8a8a96');
      rivet(ctx, sx + w - 6, sy + h - 6, '#1a1a22', '#8a8a96');
    }
    // Muzzle block: near-black bevel with rivets
    bevel(ctx, sx - 2, sy, w + 4, 28, '#262630', '#50505c', '#121218', '#06060a');
    px(ctx, sx, sy + 3, w, 1, '#50505c');
    for (const [cx, cy] of [[1, 3], [w - 2, 3], [1, 22], [w - 2, 22]]) rivet(ctx, sx + cx, sy + cy, '#0a0a10', '#6a6a78');
    // Barrel mouth with rim
    ctx.fillStyle = '#5a5a66';
    ctx.beginPath(); ctx.ellipse(sx + w / 2, sy + 15, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.flash > 0 ? '#ffd23b' : '#0a0a10';
    ctx.beginPath(); ctx.ellipse(sx + w / 2, sy + 15, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#06060a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(sx + w / 2, sy + 15, 11.5, 10.5, 0, 0, Math.PI * 2); ctx.stroke();
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
    const w = this.w, h = Math.floor(this.h);
    // Shaded trunk down to the ground, with bark lines
    const tx = Math.floor(cx) - 9, tTop = sy + h - 2, tH = (this.trunkBottom ?? GROUND_Y) - tTop;
    px(ctx, tx, tTop, 18, tH, '#101018');
    px(ctx, tx + 1, tTop, 16, tH, '#d8a060');
    px(ctx, tx + 1, tTop, 2, tH, '#ecc080');
    px(ctx, tx + 12, tTop, 5, tH, '#a87038');
    barkLines(ctx, tx + 1, tTop, 16, tH, '#8a5828', 12);
    // Cap — rounded red dome with light top / dark underside
    const cap = () => {
      ctx.beginPath();
      ctx.moveTo(sx, sy + h);
      ctx.lineTo(sx, sy + 8);
      ctx.quadraticCurveTo(sx, sy, sx + 12, sy);
      ctx.lineTo(sx + w - 12, sy);
      ctx.quadraticCurveTo(sx + w, sy, sx + w, sy + 8);
      ctx.lineTo(sx + w, sy + h);
      ctx.closePath();
    };
    ctx.save();
    cap(); ctx.clip();
    px(ctx, sx, sy, w, h, '#e03828');
    px(ctx, sx, sy, w, 5, '#ff6a58');          // top highlight
    px(ctx, sx, sy, 3, h, '#ff6a58');          // left highlight
    px(ctx, sx, sy + h - 9, w, 5, '#b02018');  // underside shade
    px(ctx, sx + w - 3, sy, 3, h, '#b02018');  // right shade
    // White spots with shade
    for (let i = 0; i < Math.max(2, Math.floor(w / 44)); i++) {
      const dx = sx + 16 + i * 44;
      if (dx < sx + w - 10) {
        ctx.fillStyle = '#c8b8a8';
        ctx.beginPath(); ctx.ellipse(dx + 1, sy + 9, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbf5ec';
        ctx.beginPath(); ctx.ellipse(dx, sy + 8, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Bottom rim (cream) with its own shade line
    px(ctx, sx, sy + h - 4, w, 4, '#f0d8b0');
    px(ctx, sx, sy + h - 4, w, 1, '#fff4dc');
    px(ctx, sx, sy + h - 1, w, 1, '#c8a878');
    ctx.restore();
    cap();
    ctx.strokeStyle = '#101018'; ctx.lineWidth = 1; ctx.stroke();
  }
}

// Scale platform (FSM Scale + moveFallingScale) — two platforms hanging from
// a beam on ropes. Standing on one lowers it and raises its partner; if one
// reaches the beam both ropes snap and the pair free-falls.
export class ScalePlatform {
  constructor(x, y, w, beamY, ropeX, beamX1, beamX2, isLeft) {
    this.x = x; this.y = y; this.w = w; this.h = TILE / 2;
    this.beamY = beamY; this.ropeX = ropeX;
    this.beamX1 = beamX1; this.beamX2 = beamX2;
    this.isLeft = isLeft;
    this.partner = null;
    this.scale = true;
    this.yvel = 0;
    this.snapped = false;
    this.dead = false;
    this.kind = 'platform';
    this.velX = 0; this.velY = 0;
  }

  update() { this.velX = 0; this.velY = 0; }   // driven by game.js

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);
    const rx = Math.floor(this.ropeX - cam.x);

    if (!this.snapped) {
      // The left platform draws the shared beam
      if (this.isLeft) {
        const b1 = Math.floor(this.beamX1 - cam.x), b2 = Math.floor(this.beamX2 - cam.x);
        const by = Math.floor(this.beamY);
        // Beam: outlined wooden bar with light top edge
        px(ctx, b1, by - 3, b2 - b1, 6, '#101018');
        px(ctx, b1 + 1, by - 2, b2 - b1 - 2, 4, '#e0a860');
        px(ctx, b1 + 1, by - 2, b2 - b1 - 2, 1, '#f8d8a0');
        px(ctx, b1 + 1, by + 1, b2 - b1 - 2, 1, '#a87038');
        // Pulleys at each end
        for (const bx of [b1, b2]) {
          ctx.fillStyle = '#3a1c08';
          ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d87030';
          ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f8b070';
          ctx.beginPath(); ctx.arc(bx - 1, by - 1, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Rope from the beam down to this platform (dark edge + light core)
      px(ctx, rx - 2, Math.floor(this.beamY), 4, sy - Math.floor(this.beamY), '#8a5828');
      px(ctx, rx - 1, Math.floor(this.beamY), 2, sy - Math.floor(this.beamY), '#f0c890');
    }

    // Platform slab: bevelled orange with riveted bolts
    const w = this.w, h = Math.floor(this.h);
    bevel(ctx, sx, sy, w, h, '#e08828', '#f8b858', '#a05418', '#101018');
    px(ctx, sx + 2, sy + 2, w - 4, 1, '#f8b858');
    px(ctx, sx + 2, sy + h - 3, w - 4, 1, '#a05418');
    for (let p = 6; p < w - 6; p += 18) {
      ctx.fillStyle = '#7a3010';
      ctx.beginPath(); ctx.ellipse(sx + p + 4, sy + h / 2 + 1, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c04818';
      ctx.beginPath(); ctx.ellipse(sx + p + 4, sy + h / 2, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f08860';
      ctx.beginPath(); ctx.ellipse(sx + p + 2, sy + h / 2 - 1.5, 1.5, 1, 0, 0, Math.PI * 2); ctx.fill();
    }
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
    const ctx = r.ctx;
    const w = this.w, h = Math.floor(this.h);
    // SMW-style wooden lift: outlined planks with metal end caps
    px(ctx, x, y, w, h, '#101018');
    const capW = Math.min(6, Math.floor(w / 6));
    const rowH = h > 14 ? Math.ceil((h - 2) / Math.round((h - 2) / 8)) : h - 2;
    for (let yy = y + 1; yy < y + h - 1; yy += rowH) {
      const rh = Math.min(rowH, y + h - 1 - yy);
      paintPlanks(ctx, x + 1, yy, w - 2, rh, 16, '#b8783a', '#dc9c5a', '#80501e', '#4a2c0e');
    }
    for (const ex of [x, x + w - capW]) {
      bevel(ctx, ex, y, capW, h, '#8a8a96', '#c4c4d0', '#4e4e5a', '#101018');
      if (h >= 8) rivet(ctx, ex + Math.floor(capW / 2) - 1, y + Math.floor(h / 2) - 1, '#2a2a34', '#e0e0ea');
    }
  }
}

// Pipe block — solid hitbox is exactly T*2 wide; cap is drawn visually wider but doesn't affect collision
export class PipeBlock {
  constructor(tx, tileHeight, enterable = false, baseY = GROUND_Y) {
    const T = TILE;
    // Solid hitbox: exact pipe body width, full height. baseY = where the
    // pipe's bottom sits (ground, or the top of a stone pedestal)
    this.x = tx;
    this.y = baseY - T * tileHeight;
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

    // Pipe cap — only draw if visible (not buried near/above ceiling)
    const showCap = this.y > 40;
    const bodyY = showCap ? sy + TILE : sy;
    // A pipe standing in lava is drawn down to the bottom of the screen
    // (visual only; set by the level loader)
    const bodyH = (showCap ? h - TILE : h) + (this.extendToBottom ? Math.max(0, CANVAS_HEIGHT - (sy + h)) : 0);

    // Cylindrical body: 5-tone shading (dark edge | highlight | mid |
    // shadow | dark edge) inside a 2px near-black outline. Slightly
    // desaturated green so the ambient tint reads on top of it.
    const OUT = '#101018';
    const shadeColumn = (x0, y0, cw, ch) => {
      px(ctx, x0, y0, cw, ch, OUT);
      const ix = x0 + 2, iw = cw - 4;
      const edgeL = Math.max(3, Math.round(iw * 0.15));
      const hiW   = Math.max(4, Math.round(iw * 0.20));
      const shW   = Math.max(4, Math.round(iw * 0.20));
      const edgeR = Math.max(3, Math.round(iw * 0.15));
      px(ctx, ix, y0, iw, ch, '#2f9e44');                                   // mid (~40%)
      px(ctx, ix, y0, edgeL, ch, '#145a22');                                 // left dark edge
      px(ctx, ix + edgeL, y0, hiW, ch, '#6fd46f');                           // highlight band
      px(ctx, ix + edgeL, y0, 2, ch, '#b8f5b0');                             // specular line
      px(ctx, ix + edgeL + hiW, y0, 1, ch, '#4cbc54');                       // soft falloff
      px(ctx, ix + iw - edgeR - shW, y0, shW, ch, '#1f7a2e');                // shadow (~20%)
      px(ctx, ix + iw - edgeR, y0, edgeR, ch, '#0e4218');                    // right dark edge
      px(ctx, ix + iw - edgeR - shW, y0, 1, ch, '#26903a');                  // seam between mid/shadow
    };
    shadeColumn(sx, bodyY, w, bodyH);
    if (bodyH > 0) px(ctx, sx, bodyY + bodyH - 2, w, 2, OUT);

    if (showCap) {
      const cx = sx - overhang, cw = w + overhang * 2;
      // Lip: same cylinder shading, then its own bevel (light top / dark bottom)
      shadeColumn(cx, sy, cw, TILE);
      px(ctx, cx, sy, cw, 2, OUT);                               // top outline (2px)
      px(ctx, cx + 2, sy + 2, cw - 4, 3, '#a8f0a0');             // light top bevel
      px(ctx, cx + 2, sy + 5, cw - 4, 1, '#6fd46f');
      px(ctx, cx + 2, sy + TILE - 6, cw - 4, 1, '#1f7a2e');
      px(ctx, cx + 2, sy + TILE - 5, cw - 4, 3, '#0b3614');      // dark bottom bevel
      px(ctx, cx, sy + TILE - 2, cw, 2, OUT);                    // bottom outline (2px)
      // Cap shadow cast onto the body (3px)
      px(ctx, sx + 2, sy + TILE, w - 4, 3, 'rgba(0,0,0,0.45)');
      px(ctx, sx + 2, sy + TILE + 3, w - 4, 1, 'rgba(0,0,0,0.2)');
    } else {
      px(ctx, sx, sy, w, 2, OUT);
    }

    // Scene tint (night / underground / castle) supplied by the renderer
    if (typeof r.ambientTint === 'function') {
      const tint = r.ambientTint();
      if (typeof tint === 'string' && tint) {
        ctx.fillStyle = tint;
        ctx.fillRect(sx, bodyY, w, bodyH);
        if (showCap) ctx.fillRect(sx - overhang, sy, w + overhang * 2, TILE);
      }
    }
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

    // Base plate: bevelled steel
    bevel(ctx, x + 2, bottom - 6, this.w - 4, 6, '#6a6a74', '#a0a0ac', '#3a3a44', '#101018');
    // Coils — squeeze with compression; dark rim + light core
    const coils = 4;
    const span = (bottom - 6) - (top + 8);
    for (let i = 0; i < coils; i++) {
      const cy = top + 10 + (span / coils) * (i + 0.5);
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, cy, this.w * 0.32, 3.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#303038'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = '#b8b8c4'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + this.w / 2, cy - 1, this.w * 0.28, 2.5, 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = '#e8e8f0'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Top plate — bevelled red
    bevel(ctx, x, top, this.w, 8, '#d03830', '#f07068', '#8a1c18', '#101018');
    px(ctx, x + 2, top + 2, this.w - 4, 1, '#f07068');
  }
}
