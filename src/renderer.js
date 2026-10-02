import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, GROUND_Y } from './constants.js';

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

// Terrain palettes per level setting (SNES-style limited, harmonious ramps).
// grass*  = top cap colours, dirt* = body colours, pebble = speckle, outline = 1px edge
const TERRAIN = {
  overworld: {
    grass: '#58c044', grassLight: '#94e46c', grassDark: '#2c7e2e',
    dirt: '#a0682e', dirtLight: '#c08a4a', dirtDark: '#74461c', pebble: '#865420', outline: '#2e1a0a',
  },
  night: {
    grass: '#2e7a4a', grassLight: '#4c9e64', grassDark: '#1a4e30',
    dirt: '#5a4446', dirtLight: '#705658', dirtDark: '#3e2c30', pebble: '#4a3438', outline: '#120c14',
  },
  underground: {
    stone: true,
    grass: '#7484a4', grassLight: '#98a8c4', grassDark: '#4c5a7a',
    dirt: '#50607c', dirtLight: '#66789a', dirtDark: '#384660', pebble: '#2e3a52', outline: '#141a2a',
  },
  castle: {
    stone: true,
    grass: '#8c888c', grassLight: '#b0acb0', grassDark: '#5c585c',
    dirt: '#6c686c', dirtLight: '#8a868a', dirtDark: '#4a464a', pebble: '#3c383c', outline: '#1a1418',
  },
  underwater: {
    sand: true,
    grass: '#ecd89c', grassLight: '#fcf0c0', grassDark: '#c4ac68',
    dirt: '#d0b46c', dirtLight: '#e4cc88', dirtDark: '#a48a48', pebble: '#b09450', outline: '#4a3a1c',
  },
};
// Sky world uses the overworld terrain palette (grass caps, dirt body)
TERRAIN.sky = TERRAIN.overworld;

// Per-setting ambient tint other entity renderers may multiply over raw
// sprite colours (pipes etc.) so they sit in the scene's mood. null = none.
const AMBIENT = {
  night:       'rgba(20,30,80,0.25)',
  castle:      'rgba(60,10,0,0.2)',
  underground: 'rgba(10,20,60,0.2)',
  underwater:  'rgba(10,40,90,0.2)',
};

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear() {
    const ctx = this.ctx;
    // Sky gradient: lighter blue
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    g.addColorStop(0, COLORS.sky);
    g.addColorStop(1, COLORS.skyLight);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Pokémon location silhouettes — disabled
  drawPokemonBackground(ctx, camX) { /* disabled */ }
  _drawPokemonBackground_disabled(ctx, camX) {
    const groundLine = 490;
    const px = camX * 0.15;
    // Pallet Town houses at start of level
    this._drawHouse(ctx, 350 - px, groundLine, '#6a3a2a', '#9a7a5a');
    this._drawHouse(ctx, 410 - px, groundLine, '#5a7a3a', '#8a9a6a');
    this._drawLab(ctx, 470 - px, groundLine);
    // Pokémon Center (most recognizable)
    this._drawPokeCenter(ctx, 1100 - px, groundLine);
    // Mt. Moon
    this._drawMountain(ctx, 1900 - px, groundLine);
    // Viridian Forest trees
    for (let i = 0; i < 6; i++) {
      this._drawTree(ctx, 2800 - px + i * 110, groundLine - (i % 2) * 5);
    }
    // Another house cluster later
    this._drawHouse(ctx, 4000 - px, groundLine, '#6a3a2a', '#9a7a5a');
    this._drawPokeCenter(ctx, 4400 - px, groundLine);
  }

  _drawPokeCenter(ctx, x, bottomY) {
    const W = 90, totalH = 90;

    // White main building (lower 55%)
    ctx.fillStyle = '#e8eaeb';
    ctx.fillRect(x, bottomY - 50, W, 50);

    // Gray trim on sides of white building
    ctx.fillStyle = '#c0c4c8';
    ctx.fillRect(x, bottomY - 50, 8, 50);
    ctx.fillRect(x + W - 8, bottomY - 50, 8, 50);

    // Blue side windows
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + 2, bottomY - 44, 6, 16);
    ctx.fillRect(x + W - 8, bottomY - 44, 6, 16);

    // Central Pokéball logo circle
    const pcx = x + W / 2, pcy = bottomY - 32;
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(pcx - 14, pcy - 2, 28, 4);
    ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(pcx, pcy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pcx, pcy, 5, 0, Math.PI * 2); ctx.stroke();

    // P.C text
    ctx.fillStyle = '#cc2222';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('P.C', x + 10, bottomY - 10);

    // Blue entrance door
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + W / 2 - 10, bottomY - 20, 20, 20);

    // Red dome roof (curved)
    ctx.fillStyle = '#d44000';
    ctx.beginPath();
    ctx.moveTo(x - 5, bottomY - 50);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 10, x + W + 5, bottomY - 50);
    ctx.closePath();
    ctx.fill();
    // Darker red edge on roof
    ctx.fillStyle = '#a83000';
    ctx.beginPath();
    ctx.moveTo(x - 5, bottomY - 48);
    ctx.lineTo(x - 5, bottomY - 50);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 10, x + W + 5, bottomY - 50);
    ctx.lineTo(x + W + 5, bottomY - 48);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 8, x - 5, bottomY - 48);
    ctx.fill();
    // Roof texture grid lines
    ctx.strokeStyle = 'rgba(180,80,0,0.4)'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const tx = x + (W / 8) * i;
      ctx.beginPath();
      ctx.moveTo(tx, bottomY - 50);
      ctx.quadraticCurveTo(tx, bottomY - totalH, x + W / 2, bottomY - totalH - 10);
      ctx.stroke();
    }
  }

  _drawHouse(ctx, x, bottomY, roofColor, wallColor) {
    const W = 44, wallH = 32;
    ctx.fillStyle = wallColor;
    ctx.fillRect(x, bottomY - wallH, W, wallH);
    // Windows
    ctx.fillStyle = '#8bb8e8';
    ctx.fillRect(x + 6, bottomY - 26, 10, 10);
    ctx.fillRect(x + W - 16, bottomY - 26, 10, 10);
    // Door
    ctx.fillStyle = '#6b3a2a';
    ctx.fillRect(x + W / 2 - 5, bottomY - 14, 10, 14);
    // Roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - 4, bottomY - wallH);
    ctx.lineTo(x + W / 2, bottomY - wallH - 20);
    ctx.lineTo(x + W + 4, bottomY - wallH);
    ctx.closePath(); ctx.fill();
  }

  _drawLab(ctx, x, bottomY) {
    const W = 70, wallH = 45;
    ctx.fillStyle = '#5a7040';
    ctx.fillRect(x, bottomY - wallH, W, wallH);
    // Big research window
    ctx.fillStyle = '#a8d0f0';
    ctx.fillRect(x + 14, bottomY - wallH + 5, W - 28, 22);
    ctx.strokeStyle = '#3a5020'; ctx.lineWidth = 2;
    ctx.strokeRect(x + 14, bottomY - wallH + 5, W - 28, 22);
    // Roof
    ctx.fillStyle = '#4a5a30';
    ctx.beginPath();
    ctx.moveTo(x - 5, bottomY - wallH);
    ctx.lineTo(x + W / 2, bottomY - wallH - 26);
    ctx.lineTo(x + W + 5, bottomY - wallH);
    ctx.closePath(); ctx.fill();
    // Door
    ctx.fillStyle = '#8b6030';
    ctx.fillRect(x + W / 2 - 6, bottomY - 15, 12, 15);
  }

  _drawMountain(ctx, x, bottomY) {
    // Main mountain
    ctx.fillStyle = '#7a8898';
    ctx.beginPath();
    ctx.moveTo(x - 10, bottomY);
    ctx.lineTo(x + 80, bottomY - 140);
    ctx.lineTo(x + 170, bottomY);
    ctx.closePath(); ctx.fill();
    // Second peak
    ctx.fillStyle = '#8a98a8';
    ctx.beginPath();
    ctx.moveTo(x + 90, bottomY);
    ctx.lineTo(x + 150, bottomY - 90);
    ctx.lineTo(x + 210, bottomY);
    ctx.closePath(); ctx.fill();
    // Snow cap
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath();
    ctx.moveTo(x + 80, bottomY - 140);
    ctx.lineTo(x + 54, bottomY - 100);
    ctx.lineTo(x + 106, bottomY - 100);
    ctx.closePath(); ctx.fill();
  }

  _drawTree(ctx, x, bottomY) {
    ctx.fillStyle = '#2d6a1e';
    ctx.beginPath(); ctx.arc(x, bottomY - 30, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 12, bottomY - 20, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 12, bottomY - 20, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e4a15';
    ctx.fillRect(x - 5, bottomY - 12, 10, 12);
  }

  // ------------------------------------------------------------
  // Palette helpers (cached, never allocate per frame after warm-up)
  // ------------------------------------------------------------
  _rgb(color) {
    if (!this._rgbCache) this._rgbCache = new Map();
    let v = this._rgbCache.get(color);
    if (v) return v;
    let m = /^#([0-9a-f]{6})$/i.exec(color || '');
    if (m) {
      const n = parseInt(m[1], 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    } else if ((m = /^#([0-9a-f]{3})$/i.exec(color || ''))) {
      v = [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    } else {
      v = [128, 128, 128];
    }
    this._rgbCache.set(color, v);
    return v;
  }

  // Mix an rgb triple toward a target triple by t (0..1) and return css.
  _mix(rgb, target, t) {
    const r = Math.round(rgb[0] + (target[0] - rgb[0]) * t);
    const g = Math.round(rgb[1] + (target[1] - rgb[1]) * t);
    const b = Math.round(rgb[2] + (target[2] - rgb[2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  // Deterministic integer hash → [0,1)
  _hash(i) {
    let x = (i | 0) * 2654435761;
    x = (x ^ (x >>> 13)) * 1274126177;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  _terrain() {
    const s = this.currentSetting || 'overworld';
    return TERRAIN[s] || TERRAIN.overworld;
  }

  // CSS colour to tint foreground props toward the scene mood, or null.
  ambientTint() {
    return AMBIENT[this.currentSetting] || null;
  }

  _makeTile(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // ------------------------------------------------------------
  // Cached 32px dirt / stone tile pattern per setting
  // ------------------------------------------------------------
  _dirtPattern() {
    const key = this.currentSetting || 'overworld';
    if (!this._dirtPat) this._dirtPat = new Map();
    let p = this._dirtPat.get(key);
    if (p) return p;
    const T = this._terrain();
    const c = this._makeTile(32, 32);
    const g = c.getContext('2d');
    g.fillStyle = T.dirt;
    g.fillRect(0, 0, 32, 32);
    if (T.stone) {
      // Rough stone blocks: two rows of 32x16 blocks, offset by 16px
      for (let row = 0; row < 2; row++) {
        const off = row ? 16 : 0;
        for (let bx = -16; bx < 32; bx += 32) {
          const x0 = bx + off, y0 = row * 16;
          g.fillStyle = T.dirtLight;
          g.fillRect(x0 + 1, y0 + 1, 30, 1);
          g.fillRect(x0 + 1, y0 + 1, 1, 14);
          g.fillStyle = T.dirtDark;
          g.fillRect(x0 + 1, y0 + 14, 31, 1);
          g.fillRect(x0 + 30, y0 + 1, 1, 14);
          g.fillStyle = T.outline;
          g.fillRect(x0, y0, 32, 1);
          g.fillRect(x0, y0, 1, 16);
        }
      }
      // Few chips
      g.fillStyle = T.pebble;
      for (let i = 0; i < 5; i++) {
        const px = Math.floor(this._hash(i * 7 + 3) * 30), py = Math.floor(this._hash(i * 11 + 5) * 30);
        g.fillRect(px, py, 2, 1);
      }
    } else {
      // Pebbles and specks, deterministic positions
      for (let i = 0; i < 9; i++) {
        const px = Math.floor(this._hash(i * 13 + 1) * 30), py = Math.floor(this._hash(i * 17 + 2) * 30);
        g.fillStyle = T.pebble;
        g.fillRect(px, py, 3, 2);
        g.fillStyle = T.dirtLight;
        g.fillRect(px, py - 1, 2, 1);
      }
      for (let i = 0; i < 6; i++) {
        const px = Math.floor(this._hash(i * 19 + 7) * 31), py = Math.floor(this._hash(i * 23 + 9) * 31);
        g.fillStyle = T.dirtLight;
        g.fillRect(px, py, 1, 1);
      }
      for (let i = 0; i < 6; i++) {
        const px = Math.floor(this._hash(i * 29 + 4) * 31), py = Math.floor(this._hash(i * 31 + 6) * 31);
        g.fillStyle = T.dirtDark;
        g.fillRect(px, py, 2, 1);
      }
    }
    p = this.ctx.createPattern(c, 'repeat');
    this._dirtPat.set(key, p);
    return p;
  }

  // Cached top-cap tile (grass / stone ledge / sand) per setting, 32x16, transparent bg
  _capPattern() {
    const key = this.currentSetting || 'overworld';
    if (!this._capPat) this._capPat = new Map();
    let p = this._capPat.get(key);
    if (p) return p;
    const T = this._terrain();
    const c = this._makeTile(32, 16);
    const g = c.getContext('2d');
    if (T.stone) {
      // Flat stone ledge: light top, highlight line, shadow line under
      g.fillStyle = T.grass;
      g.fillRect(0, 0, 32, 10);
      g.fillStyle = T.grassLight;
      g.fillRect(0, 1, 32, 2);
      g.fillStyle = T.grassDark;
      g.fillRect(0, 8, 32, 2);
      g.fillStyle = T.outline;
      g.fillRect(0, 10, 32, 1);
      g.fillRect(15, 1, 1, 9);
    } else if (T.sand) {
      // Sand: pale top with gentle ripples
      g.fillStyle = T.grass;
      g.fillRect(0, 0, 32, 9);
      g.fillStyle = T.grassLight;
      g.fillRect(0, 1, 32, 2);
      g.fillRect(4, 5, 8, 1); g.fillRect(20, 6, 8, 1);
      g.fillStyle = T.grassDark;
      g.fillRect(0, 8, 32, 2);
      g.fillRect(6, 6, 8, 1); g.fillRect(22, 7, 8, 1);
    } else {
      // Grass: scalloped rounded cap with tufts
      g.fillStyle = T.grassDark;
      g.fillRect(0, 2, 32, 10);
      g.fillStyle = T.grass;
      g.fillRect(0, 2, 32, 7);
      // rounded bumps (two per tile)
      g.fillStyle = T.grass;
      g.fillRect(2, 1, 12, 1); g.fillRect(18, 1, 12, 1);
      g.fillRect(4, 0, 8, 1);  g.fillRect(20, 0, 8, 1);
      g.fillStyle = T.grassLight;
      g.fillRect(4, 1, 8, 1);  g.fillRect(20, 1, 8, 1);
      g.fillRect(2, 2, 12, 1); g.fillRect(18, 2, 12, 1);
      // tufts poking above
      g.fillStyle = T.grassLight;
      g.fillRect(7, -1, 1, 2); g.fillRect(24, -1, 1, 2);
      // dark shadow below the cap
      g.fillStyle = T.grassDark;
      g.fillRect(0, 9, 32, 3);
      g.fillRect(1, 12, 6, 1); g.fillRect(12, 12, 4, 1); g.fillRect(22, 12, 6, 1);
      // dark edge pixels between scallops
      g.fillStyle = T.grassDark;
      g.fillRect(0, 1, 2, 1); g.fillRect(14, 1, 4, 1); g.fillRect(30, 1, 2, 1);
    }
    p = this.ctx.createPattern(c, 'repeat');
    this._capPat.set(key, p);
    return p;
  }

  // Cached subtle noise overlay (for bevelled platforms)
  _noisePattern() {
    if (this._noisePat) return this._noisePat;
    const c = this._makeTile(32, 32);
    const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const px = Math.floor(this._hash(i * 37 + 11) * 32), py = Math.floor(this._hash(i * 41 + 13) * 32);
      g.fillStyle = (i & 1) ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
      g.fillRect(px, py, 2, 1);
    }
    this._noisePat = this.ctx.createPattern(c, 'repeat');
    return this._noisePat;
  }

  // Cached faint rear-wall patterns for underground/castle
  _wallPattern(key, base, line, light) {
    if (!this._wallPat) this._wallPat = new Map();
    let p = this._wallPat.get(key);
    if (p) return p;
    const c = this._makeTile(64, 32);
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 32);
    g.fillStyle = line;
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 16, 64, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillRect(32, 0, 1, 16);
    g.fillRect(16, 16, 1, 16);
    g.fillRect(48, 16, 1, 16);
    g.fillStyle = light;
    g.fillRect(1, 1, 31, 1);
    g.fillRect(33, 1, 31, 1);
    g.fillRect(17, 17, 31, 1);
    g.fillRect(49, 17, 15, 1);
    g.fillRect(0, 17, 16, 1);
    p = this.ctx.createPattern(c, 'repeat');
    this._wallPat.set(key, p);
    return p;
  }

  // ------------------------------------------------------------
  // Background layers
  // ------------------------------------------------------------
  _skyGradient(key, top, bottom, stops) {
    // Smooth vertical sky gradient between y=top and y=bottom (cached per key)
    const ctx = this.ctx;
    if (!this._skyGrads) this._skyGrads = new Map();
    let g = this._skyGrads.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, top, 0, bottom);
      const n = stops.length;
      for (let i = 0; i < n; i++) g.addColorStop(n === 1 ? 0 : i / (n - 1), stops[i]);
      this._skyGrads.set(key, g);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, top, CANVAS_WIDTH, bottom - top);
  }

  // Pit / void drop under the horizon line (y >= GROUND_Y). On levels with
  // ground tiles this is fully covered; where the tiles stop (pits, treetop
  // levels over void) it reads as an SMB-style dark drop: a darker version
  // of the horizon colour at the ground line, easing to near-black at the
  // bottom, with no dirt tiling inside. The 1px line at GROUND_Y is the
  // same outline the ground slabs use, so a pit cut looks intentional.
  // `horizon` is the sky colour at the ground line; the remaining arguments
  // are kept for signature compatibility and are unused.
  _farGround(camX, horizon, bottom, ridge, lines) {
    const ctx = this.ctx;
    const key = this.currentSetting || 'overworld';
    if (!this._pitGrads) this._pitGrads = new Map();
    let g = this._pitGrads.get(key);
    if (!g) {
      const h = this._rgb(horizon);
      const deep = bottom ? this._rgb(bottom) : BLACK;
      g = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
      // Eased (quadratic) fall-off: darkens quickly under the lip, then
      // settles into the deep tone with no visible band.
      // Starts in the hills' own colour at the ground line (no visible
      // edge under levels that have no ground, e.g. 1-3 treetops) and
      // eases into the deep tone toward the bottom of the screen.
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const k = 0.08 + 0.92 * (1 - (1 - t) * (1 - t));
        g.addColorStop(t, this._mix(h, deep, k));
      }
      this._pitGrads.set(key, g);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  }

  // Rolling cloud-sea layer: scalloped cloud tops along baseY with a solid
  // body down to the canvas bottom. Shade pass first, lifted white pass over.
  _cloudSea(scroll, baseY, fill, shade) {
    const ctx = this.ctx;
    const period = 560;
    const off = ((scroll % period) + period) % period;
    const bumps = [[0, 70, 30], [110, 58, 22], [205, 82, 36], [330, 54, 20], [420, 74, 32], [520, 48, 18]];
    const passes = [[shade, 0, CANVAS_HEIGHT - baseY], [fill, -6, 18]];
    for (const [col, dy, bodyH] of passes) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-period, baseY + dy, CANVAS_WIDTH + 2 * period, bodyH);
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / period) + 1; i++) {
        const bx = i * period - off;
        for (const [ox, rx, ry] of bumps) {
          ctx.moveTo(bx + ox + rx, baseY + dy);
          ctx.ellipse(bx + ox, baseY + dy, rx, ry, 0, Math.PI, 0);
        }
      }
      ctx.fill();
    }
  }

  // Soft dark edge vignette (cached radial gradient) for enclosed scenes
  _vignette() {
    const ctx = this.ctx;
    if (!this._vigGrad) {
      const g = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.35,
                                         CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      this._vigGrad = g;
    }
    ctx.fillStyle = this._vigGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  _farMountains(camX, fill, baseY) {
    // Low, rounded distant ridge at 0.15x parallax
    const ctx = this.ctx;
    const period = 900;
    const off = ((camX * 0.15) % period + period) % period;
    const ridge = (dy) => {
      ctx.beginPath();
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / period) + 2; i++) {
        const bx = i * period - off, by = baseY + dy;
        ctx.moveTo(bx - 40, by);
        ctx.quadraticCurveTo(bx + 60, by - 100, bx + 160, by - 70);
        ctx.quadraticCurveTo(bx + 240, by - 40, bx + 330, by - 95);
        ctx.quadraticCurveTo(bx + 420, by - 140, bx + 520, by - 60);
        ctx.quadraticCurveTo(bx + 600, by - 30, bx + 700, by - 85);
        ctx.quadraticCurveTo(bx + 800, by - 120, bx + 940, by);
        ctx.closePath();
      }
      ctx.fill();
    };
    // Lit crest band: lighter tone, then the body colour pushed down 14px so
    // only a band along the top edge stays light (bottom overdraw is hidden
    // by the far-ground band drawn later).
    ctx.fillStyle = this._mix(this._rgb(fill), WHITE, 0.22);
    ridge(0);
    ctx.fillStyle = fill;
    ridge(14);
  }

  _hillLayer(camX, fill, outline, bushFill, baseY) {
    const ctx = this.ctx;
    const period = 700;
    const off = ((camX * 0.3) % period + period) % period;
    for (let i = -1; i < Math.ceil(CANVAS_WIDTH / period) + 2; i++) {
      const bx = i * period - off;
      this._hillOutlined(bx + 120, baseY, 110, fill, outline);
      this._hillOutlined(bx + 380, baseY, 75, fill, outline);
      this._hillOutlined(bx + 560, baseY, 90, fill, outline);
      if (bushFill) {
        this._bush(bx + 250, baseY, bushFill, outline);
        this._bush(bx + 470, baseY, bushFill, outline, 0.8);
        this._bush(bx + 660, baseY, bushFill, outline, 0.7);
      }
    }
  }

  _hillOutlined(x, baseY, r, fill, outline) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x, baseY, r, r * 0.6, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, baseY, r, r * 0.6, 0, Math.PI, 0);
      ctx.stroke();
      // Lighter inner highlight following the curve 6px inside (upper-left)
      ctx.strokeStyle = this._mix(this._rgb(fill), WHITE, 0.28);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, baseY, r - 6, r * 0.6 - 6, 0, Math.PI * 1.08, Math.PI * 1.72);
      ctx.stroke();
      // Simple SMW-style dark "eye" spots on the big hills
      if (r >= 90) {
        ctx.fillStyle = outline;
        ctx.fillRect(x - 14, baseY - r * 0.38, 3, 7);
        ctx.fillRect(x + 11, baseY - r * 0.38, 3, 7);
      }
    }
  }

  _bush(x, baseY, fill, outline, s = 1) {
    const ctx = this.ctx;
    const r = 18 * s;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, baseY - r * 0.4, r, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(x - r * 1.1, baseY - r * 0.2, r * 0.75, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 1.1, baseY - r * 0.2, r * 0.75, Math.PI, 0); ctx.fill();
    // Solid body under the domes down to the ground line (no sky gap)
    ctx.fillRect(x - r, baseY - r * 0.4, r * 2, r * 0.4 + 1);
    ctx.fillRect(x - r * 1.85, baseY - r * 0.2, r * 3.7, r * 0.2 + 1);
    if (outline) {
      ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x - r * 1.1, baseY - r * 0.2, r * 0.75, Math.PI, Math.PI * 1.55); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, baseY - r * 0.4, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + r * 1.1, baseY - r * 0.2, r * 0.75, Math.PI * 1.45, 0); ctx.stroke();
    }
  }

  _clouds(camX, fill, shade, outline) {
    for (let i = 0; i < 14; i++) {
      const baseX = i * 520 - (camX * 0.2) % (520 * 14);
      const x = ((baseX % (520 * 14)) + 520 * 14) % (520 * 14) - 200;
      if (x < -120 || x > CANVAS_WIDTH + 40) continue;
      const y = 55 + (i % 3) * 45;
      this._cloud(x, y, fill, shade, outline);
    }
  }

  _bottomShade() {
    // Subtle dark gradient over the lowest 50px so pits don't show raw sky.
    const ctx = this.ctx;
    if (!this._bottomGrad) {
      const g = ctx.createLinearGradient(0, CANVAS_HEIGHT - 50, 0, CANVAS_HEIGHT);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      this._bottomGrad = g;
    }
    ctx.fillStyle = this._bottomGrad;
    ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 50);
  }

  // Background parallax hills and clouds
  drawBackground(camX) {
    const ctx = this.ctx;

    if (this.currentSetting === 'underground') {
      ctx.fillStyle = '#141828';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Faint rear stone wall at 0.1x parallax
      const wall = this._wallPattern('underground', '#181c30', '#10142a', '#1e2238');
      const wx = -(((camX * 0.1) % 64 + 64) % 64);
      ctx.save();
      ctx.translate(wx, 0);
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, CANVAS_WIDTH + 64, CANVAS_HEIGHT);
      ctx.restore();
      // Far cave mouths at 0.05x: darker arches behind the brickwork
      const ap = 720;
      const aoff = ((camX * 0.05) % ap + ap) % ap;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / ap) + 2; i++) {
        const bx = i * ap - aoff;
        for (const [ox, w, top] of [[80, 150, 250], [340, 110, 300], [540, 180, 210]]) {
          ctx.beginPath();
          ctx.moveTo(bx + ox, GROUND_Y);
          ctx.lineTo(bx + ox, top + w / 2);
          ctx.arc(bx + ox + w / 2, top + w / 2, w / 2, Math.PI, 0);
          ctx.lineTo(bx + ox + w, GROUND_Y);
          ctx.closePath();
          ctx.fillStyle = '#0c1020';
          ctx.fill();
          ctx.strokeStyle = '#1c2240';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Inner, even darker depth
          ctx.fillStyle = '#080c18';
          ctx.beginPath();
          ctx.moveTo(bx + ox + 14, GROUND_Y);
          ctx.lineTo(bx + ox + 14, top + w / 2 + 10);
          ctx.arc(bx + ox + w / 2, top + w / 2 + 10, w / 2 - 14, Math.PI, 0);
          ctx.lineTo(bx + ox + w - 14, GROUND_Y);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Stalactite silhouettes at 0.3x
      ctx.fillStyle = '#0e1222';
      const sp = 640;
      const soff = ((camX * 0.3) % sp + sp) % sp;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / sp) + 2; i++) {
        const bx = i * sp - soff;
        const pts = [[40, 70, 110], [200, 36, 60], [330, 90, 150], [470, 44, 80], [560, 60, 95]];
        for (const [ox, hw, hh] of pts) {
          ctx.beginPath();
          ctx.moveTo(bx + ox - hw, 0);
          ctx.lineTo(bx + ox + hw, 0);
          ctx.lineTo(bx + ox + hw * 0.25, hh);
          ctx.lineTo(bx + ox - hw * 0.15, hh * 0.7);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Floor-level darker gradient
      if (!this._ugFloorGrad) {
        const g = ctx.createLinearGradient(0, GROUND_Y - 140, 0, CANVAS_HEIGHT);
        g.addColorStop(0, 'rgba(0,0,10,0)');
        g.addColorStop(1, 'rgba(0,0,10,0.55)');
        this._ugFloorGrad = g;
      }
      ctx.fillStyle = this._ugFloorGrad;
      ctx.fillRect(0, GROUND_Y - 140, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y + 140);
      this._vignette();
      return;  // skip hills and clouds
    }

    if (this.currentSetting === 'night') {
      // Night sky — deep navy with stars and dark silhouette hills
      this._skyGradient('night', 0, GROUND_Y, ['#060a1c', '#0c1430', '#141c40', '#1e2c58', '#2a3a66']);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 40; i++) {
        // Deterministic star positions from index hash
        const sx = ((i * 379 + 83) % (CANVAS_WIDTH + 200)) - 100 - ((camX * 0.1) % (CANVAS_WIDTH + 200));
        const wx = ((sx % (CANVAS_WIDTH + 200)) + CANVAS_WIDTH + 200) % (CANVAS_WIDTH + 200) - 100;
        const sy = (i * 151 + 37) % (GROUND_Y - 150);
        const tw = (i * 7) % 3 ? 1.5 : 2.2;
        ctx.fillRect(wx, sy, tw, tw);
      }
      // Moon (kept clear of the HUD block in the top-right)
      const mx = CANVAS_WIDTH - 110, my = 150;
      ctx.fillStyle = 'rgba(240,236,216,0.08)';
      ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0ecd8';
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#121a38';
      ctx.beginPath(); ctx.arc(mx + 10, my - 8, 22, 0, Math.PI * 2); ctx.fill();
      // Far ridge + silhouette hills
      this._farMountains(camX, '#131c3c', GROUND_Y);
      this._hillLayer(camX, '#1a2a48', '#101a34', '#162440', GROUND_Y);
      this._farGround(camX, '#1a2a48', '#02030a');
      this._bottomShade();
      return;
    }

    if (this.currentSetting === 'underwater') {
      const SURFACE = 188;  // FSM WaterBlock mapped to our ground height (540-416+64)
      // Air band above the surface
      this._skyGradient('uw-air', 0, SURFACE, ['#86c4ec', '#c0e2f4']);
      // Water below — deep blue gradient
      if (!this._waterGrad) {
        const grad = ctx.createLinearGradient(0, SURFACE, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, '#2870c0');
        grad.addColorStop(1, '#0a2860');
        this._waterGrad = grad;
      }
      ctx.fillStyle = this._waterGrad;
      ctx.fillRect(0, SURFACE, CANVAS_WIDTH, CANVAS_HEIGHT - SURFACE);
      // Wavy surface line
      this._waveT = (this._waveT || 0) + 0.03;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let wx = -20; wx < CANVAS_WIDTH + 20; wx += 4) {
        const wy = Math.sin((wx + camX * 0.5) * 0.06 + this._waveT) * 3;
        ctx.fillRect(wx, SURFACE + wy - 1, 4, 3);
      }
      // Faint light rays under water
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 4; i++) {
        const rx = ((i * 340 - camX * 0.2) % (CANVAS_WIDTH + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(rx, SURFACE); ctx.lineTo(rx + 60, SURFACE);
        ctx.lineTo(rx + 160, CANVAS_HEIGHT); ctx.lineTo(rx + 40, CANVAS_HEIGHT);
        ctx.closePath(); ctx.fill();
      }
      // Sandy floor shade band just above the ground line
      if (!this._sandGrad) {
        const g = ctx.createLinearGradient(0, GROUND_Y - 90, 0, GROUND_Y);
        g.addColorStop(0, 'rgba(120,110,70,0)');
        g.addColorStop(1, 'rgba(120,110,70,0.45)');
        this._sandGrad = g;
      }
      ctx.fillStyle = this._sandGrad;
      ctx.fillRect(0, GROUND_Y - 90, CANVAS_WIDTH, 90);
      // Far rock mounds and seaweed silhouettes at 0.2x
      const sp = 560;
      const soff = ((camX * 0.2) % sp + sp) % sp;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / sp) + 2; i++) {
        const bx = i * sp - soff;
        ctx.fillStyle = '#0c2a5c';
        ctx.beginPath(); ctx.ellipse(bx + 90, GROUND_Y, 70, 34, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx + 380, GROUND_Y, 48, 26, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#0e3a68';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const [ox, h] of [[200, 90], [222, 120], [244, 80], [470, 100], [490, 70]]) {
          ctx.beginPath();
          ctx.moveTo(bx + ox, GROUND_Y + 2);
          ctx.bezierCurveTo(bx + ox - 10, GROUND_Y - h * 0.4, bx + ox + 12, GROUND_Y - h * 0.6, bx + ox + 2, GROUND_Y - h);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      this._bottomShade();
      return;
    }

    if (this.currentSetting === 'castle') {
      ctx.fillStyle = '#1a1014';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Dim stone wall at 0.1x
      const wall = this._wallPattern('castle', '#1c1216', '#140c10', '#241a1e');
      const wx = -(((camX * 0.1) % 64 + 64) % 64);
      ctx.save();
      ctx.translate(wx, 0);
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, CANVAS_WIDTH + 64, CANVAS_HEIGHT);
      ctx.restore();
      // Dark pillars with arches at 0.2x
      const sp = 480;
      const soff = ((camX * 0.2) % sp + sp) % sp;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / sp) + 2; i++) {
        const bx = i * sp - soff;
        for (const ox of [60, 300]) {
          // Arch opening (slightly lighter) then pillars either side
          ctx.fillStyle = '#120a0e';
          ctx.beginPath();
          ctx.moveTo(bx + ox + 24, GROUND_Y);
          ctx.lineTo(bx + ox + 24, 200);
          ctx.arc(bx + ox + 90, 200, 66, Math.PI, 0);
          ctx.lineTo(bx + ox + 156, GROUND_Y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#0e080a';
          ctx.fillRect(bx + ox, 110, 24, GROUND_Y - 110);
          ctx.fillRect(bx + ox + 156, 110, 24, GROUND_Y - 110);
          ctx.fillRect(bx + ox - 6, 100, 36, 12);
          ctx.fillRect(bx + ox + 150, 100, 36, 12);
          ctx.fillStyle = '#261a20';
          ctx.fillRect(bx + ox + 2, 112, 2, GROUND_Y - 112);
          ctx.fillRect(bx + ox + 158, 112, 2, GROUND_Y - 112);
        }
      }
      // No full-width lava glow here: the lava itself (drawn by the game)
      // carries its own local glow, so plain floors stay unlit and there is
      // no horizontal seam where a background band would start.
      return;
    }

    if (this.currentSetting === 'sky') {
      // ---- Sky world: high above the clouds ----
      this._skyGradient('sky', 0, GROUND_Y, ['#5aa8f0', '#86c2f4', '#b0d8f8', '#d6eafa', '#eef6fc']);
      // Sparse flat far clouds at 0.08x
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const fp = 640 * 6;
      for (let i = 0; i < 6; i++) {
        const sx = ((i * 640 + this._hash(i + 3) * 320 - camX * 0.08) % fp + fp) % fp - 160;
        if (sx < -160 || sx > CANVAS_WIDTH + 20) continue;
        const sy = 70 + this._hash(i + 40) * 240;
        const sw = 80 + (i % 3) * 30;
        ctx.fillRect(sx, sy, sw, 6);
        ctx.fillRect(sx + 18, sy - 5, sw - 40, 5);
        ctx.fillRect(sx + 10, sy + 6, sw - 24, 4);
      }
      // Second, higher haze band at 0.12x (y 200-260): long soft streaks
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      const hp = 900;
      const hoff = ((camX * 0.12) % hp + hp) % hp;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / hp) + 1; i++) {
        const bx = i * hp - hoff;
        for (const [ox, oy, w] of [[40, 206, 260], [380, 238, 180], [620, 222, 220]]) {
          ctx.fillRect(bx + ox, oy, w, 4);
          ctx.fillRect(bx + ox + 30, oy - 4, w - 90, 4);
          ctx.fillRect(bx + ox + 16, oy + 4, w - 40, 3);
          ctx.fillRect(bx + ox + 60, oy + 7, w - 120, 2);
        }
      }
      // Distant floating islands at 0.1x: a cloud puff with a tiny green top
      const ip = 1100;
      const ioff = ((camX * 0.1) % ip + ip) % ip;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / ip) + 1; i++) {
        const bx = i * ip - ioff;
        for (const [ox, oy, s] of [[150, 168, 1], [520, 318, 0.8], [860, 244, 0.9]]) {
          this._skyIsland(bx + ox, oy, s);
        }
      }
      // Puffy clouds at 0.2x, slightly cooler shade
      this._clouds(camX, '#ffffff', '#dce8f6', '#7aa6d6');
      // Cloud sea: three rolling layers across the bottom third
      this._cloudSea(camX * 0.25, GROUND_Y - 118, '#e6f0fa', '#c8daf0');
      this._cloudSea(camX * 0.35 + 190, GROUND_Y - 62, '#f6faff', '#d8e6f4');
      this._cloudSea(camX * 0.45 + 90, GROUND_Y + 4, '#ffffff', '#e4edf8');
      this._bottomShade();
      return;
    }

    // ---- Overworld ----
    // Smooth sky: deeper blue up top → pale, slightly warm at the horizon
    this._skyGradient('ow', 0, GROUND_Y, ['#4e98e6', '#6cb2ec', '#92caf0', '#b8def6', '#d8ecf6']);
    // Far pale mountains at 0.15x
    this._farMountains(camX, '#aed8dc', GROUND_Y);
    // Mid hills with dark outline + bushes at 0.3x
    this._hillLayer(camX, '#6ecb6e', '#2e7a30', '#4fae52', GROUND_Y);
    // White puffy clouds at 0.2x
    this._clouds(camX, '#ffffff', '#d2e4f2', '#5a8fc0');
    // Dark drop below the horizon (hidden behind ground tiles, seen in pits)
    this._farGround(camX, '#58b25a', '#0b1a10');
    this._bottomShade();
  }

  // Open water under the bridge levels (SMB 2-3 / 7-3): surface just below
  // the ground line, waves scrolling with the camera
  drawWaterFloor(camX) {
    const ctx = this.ctx;
    const top = GROUND_Y - 6;
    if (!this._waterFloorGrad) {
      const g = ctx.createLinearGradient(0, top, 0, CANVAS_HEIGHT);
      g.addColorStop(0, '#4aa0e0'); g.addColorStop(0.35, '#2a74c0'); g.addColorStop(1, '#123a78');
      this._waterFloorGrad = g;
    }
    ctx.fillStyle = this._waterFloorGrad;
    ctx.fillRect(0, top, CANVAS_WIDTH, CANVAS_HEIGHT - top);
    this._waveT = (this._waveT || 0) + 0.03;
    ctx.fillStyle = '#9ad4ff';
    for (let wx = -16; wx < CANVAS_WIDTH + 16; wx += 4) {
      const wy = Math.sin((wx + camX * 0.6) * 0.07 + this._waveT) * 2;
      ctx.fillRect(wx, top + wy - 1, 4, 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let wx = -16; wx < CANVAS_WIDTH + 16; wx += 4) {
      const wy = Math.sin((wx + camX * 0.6) * 0.05 + this._waveT * 1.3) * 2;
      ctx.fillRect(wx, top + 10 + wy, 4, 1);
    }
  }

  _hill(x, baseY, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x, baseY, r, r * 0.6, 0, Math.PI, 0);
    ctx.fill();
  }

  // SMW-style cloud: outline pass, shade pass, then the white body lifted a
  // few px so the shade shows as a soft underside. Each circle is its own
  // path (a single arc chain drew connecting wedges).
  _cloud(x, y, fill = '#ffffff', shade = '#d2e4f2', outline = '#5a8fc0') {
    const ctx = this.ctx;
    const parts = [[0, 0, 22], [26, 6, 28], [56, 0, 22], [28, -12, 22]];
    ctx.fillStyle = outline;
    for (const [ox, oy, r] of parts) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r + 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = shade;
    for (const [ox, oy, r] of parts) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = fill;
    for (const [ox, oy, r] of parts) {
      ctx.beginPath(); ctx.arc(x + ox, y + oy - 5, r - 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Small far floating island: faded cloud puff carrying a tiny grass-topped
  // dirt block. Drawn muted so it stays a quiet background note.
  _skyIsland(x, y, s) {
    const ctx = this.ctx;
    const w = 56 * s, h = 10 * s;
    // dirt block + grass top (atmospheric, desaturated)
    ctx.fillStyle = '#9c8a74';
    ctx.fillRect(x - w / 2 + 4 * s, y, w - 8 * s, h);
    ctx.fillStyle = '#7fbf7a';
    ctx.fillRect(x - w / 2 + 2 * s, y - 3 * s, w - 4 * s, 4 * s);
    ctx.fillStyle = '#a8dca0';
    ctx.fillRect(x - w / 2 + 6 * s, y - 3 * s, w - 12 * s, 1);
    // cloud puff under it
    const parts = [[-16, 4, 11], [0, 6, 14], [16, 4, 11]];
    ctx.fillStyle = '#d6e4f4';
    for (const [ox, oy, r] of parts) {
      ctx.beginPath(); ctx.arc(x + ox * s, y + h + oy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f4f8fe';
    for (const [ox, oy, r] of parts) {
      ctx.beginPath(); ctx.arc(x + ox * s, y + h + oy * s - 3 * s, (r - 2) * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Cached 64x20 cloud-top cap for sky-world ground: three outlined puffs of
  // differing size, white body, cream highlight, soft grey underside line.
  // Transparent background; the bottom 8 rows are a flat cloud body.
  _cloudCapPattern() {
    if (this._cloudCapPat) return this._cloudCapPat;
    const c = this._makeTile(64, 20);
    const g = c.getContext('2d');
    const puffs = [[12, 12, 12.5], [34, 13, 9.5], [52, 12, 11.5]];
    const pass = (col, dy, dr) => {
      g.fillStyle = col;
      for (const [px, py, r] of puffs) { g.beginPath(); g.arc(px, py + dy, r + dr, 0, Math.PI * 2); g.fill(); }
    };
    pass('#5c7090', 0, 1);                                   // dark outline ring
    g.fillStyle = '#5c7090'; g.fillRect(0, 12, 64, 8);
    pass('#c0cede', 0, 0);                                   // grey shade / underside
    g.fillStyle = '#c0cede'; g.fillRect(0, 12, 64, 7);
    pass('#f0f5fb', -1.5, -1);                               // body
    g.fillStyle = '#f0f5fb'; g.fillRect(0, 11, 64, 6);
    pass('#ffffff', -4, -4.5);                               // highlight
    g.fillStyle = '#fffcf0'; g.fillRect(6, 14, 12, 1); g.fillRect(30, 15, 8, 1); g.fillRect(46, 14, 12, 1);
    g.fillStyle = '#aab8c8'; g.fillRect(0, 18, 64, 1);       // soft grey underside line
    this._cloudCapPat = this.ctx.createPattern(c, 'repeat');
    return this._cloudCapPat;
  }

  // Sky-world ground slab: cream block body with a bevel and a puffy cloud
  // cap. Used by drawGround and by floor-level platforms in the sky setting.
  _skyGround(x, y, w, h) {
    const ctx = this.ctx;
    const x0 = Math.max(x, -32), x1 = Math.min(x + w, CANVAS_WIDTH + 32);
    if (x1 <= x0) return;
    const body = '#e4d4b4', light = '#f6ecd6', dark = '#bca486', outline = '#5a4834';
    ctx.fillStyle = body;
    ctx.fillRect(x0, y + 6, x1 - x0, h - 6);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this._noisePattern();
    ctx.fillRect(x0 - x, 6, x1 - x0, h - 6);
    ctx.restore();
    // bevel: light under the cap, dark above the bottom edge
    ctx.fillStyle = light;
    ctx.fillRect(x0, y + 12, x1 - x0, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(x0, y + h - 3, x1 - x0, 2);
    // 1px dark outline top and bottom, 2px ends 1px inside the slab
    ctx.fillStyle = outline;
    ctx.fillRect(x0, y + 6, x1 - x0, 1);
    ctx.fillRect(x0, y + h - 1, x1 - x0, 1);
    if (x >= -32) ctx.fillRect(x + 1, y + 10, 2, h - 11);
    if (x + w <= CANVAS_WIDTH + 32) ctx.fillRect(x + w - 3, y + 10, 2, h - 11);
    // cloud cap: puffs rise 8px above the slab top, body ends at y+12
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.fillStyle = this._cloudCapPattern();
    ctx.fillRect(x0 - x, 0, x1 - x0, 20);
    ctx.restore();
  }

  // Ground tile: textured dirt/stone with a grass (or ledge / sand) cap.
  // x,y are screen coords (already tile-aligned by callers); the pattern is
  // anchored to the platform's own origin so it never swims with the camera.
  drawGround(x, y, w, h) {
    const ctx = this.ctx;
    // Clip loop/fill work to the visible span
    if (this.currentSetting === 'sky') { this._skyGround(x, y, w, h); return; }
    // Castle floors and raised castle floors share one masonry tileset
    if (this.currentSetting === 'castle') { this.platform(x, y, w, h, COLORS.brick); return; }
    const x0 = Math.max(x, -32), x1 = Math.min(x + w, CANVAS_WIDTH + 32);
    if (x1 <= x0) return;
    const T = this._terrain();
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this._dirtPattern();
    ctx.fillRect(x0 - x, 0, x1 - x0, h);
    ctx.fillStyle = this._capPattern();
    ctx.fillRect(x0 - x, 0, x1 - x0, 16);
    ctx.restore();
    // Edges: 1px dark outline on top, darker shadow line at the bottom,
    // and a 2px end line 1px inside each slab end so a slab that stops at a
    // gap does not look sliced off.
    ctx.fillStyle = T.outline;
    ctx.fillRect(x0, y, x1 - x0, 1);
    // Castle and underwater level data contain abutting floor slabs, which
    // would show a seam, so the end lines are skipped there.
    const s = this.currentSetting;
    // The end lines sit flush with the slab edge so the cut into a pit
    // reads as a clean outlined edge against the dark drop.
    if (s !== 'castle' && s !== 'underwater') {
      if (x >= -32) ctx.fillRect(x, y, 2, h);
      if (x + w <= CANVAS_WIDTH + 32) ctx.fillRect(x + w - 2, y, 2, h);
    }
    if (y + h <= CANVAS_HEIGHT) {
      ctx.fillStyle = T.dirtDark;
      ctx.fillRect(x0, y + h - 3, x1 - x0, 2);
      ctx.fillStyle = T.outline;
      ctx.fillRect(x0, y + h - 1, x1 - x0, 1);
    }
  }

  // Generic solid platform — setting-aware, tinted from `color`
  platform(x, y, w, h, color) {
    const ctx = this.ctx;
    if (x + w < 0 || x > CANVAS_WIDTH || y + h < 0 || y > CANVAS_HEIGHT) return;
    const s = this.currentSetting;
    if (s === 'castle' || s === 'underground') {
      this._masonry(x, y, w, h, color, s);
      return;
    }
    if (s === 'sky' && y >= GROUND_Y - 1) {
      // Floor-level stone in the sky world is the cloud ground itself
      this._skyGround(x, y, w, h);
      return;
    }
    const rgb = this._rgb(color);
    const light = this._mix(rgb, WHITE, 0.45);
    const dark = this._mix(rgb, BLACK, 0.35);
    const edge = this._mix(rgb, BLACK, 0.7);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    // Subtle noise, anchored to the platform origin
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = this._noisePattern();
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    if (h >= w * 1.5 || (s === 'underwater' && h > w)) {
      // Tall narrow column (coral, pillars): shaded like a rounded post.
      // Lighter top band, vertical highlight/shadow stripes, full outline.
      ctx.fillStyle = this._mix(rgb, WHITE, 0.28);
      ctx.fillRect(x + 1, y + 1, w - 2, 7);
      ctx.fillStyle = light;
      ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillRect(x + 2, y + 1, 3, h - 2);
      ctx.fillStyle = this._mix(rgb, WHITE, 0.14);
      ctx.fillRect(x + 5, y + 1, 2, h - 2);
      ctx.fillStyle = dark;
      ctx.fillRect(x + w - 6, y + 1, 5, h - 2);
      ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
      ctx.fillStyle = this._mix(rgb, BLACK, 0.18);
      ctx.fillRect(x + w - 9, y + 1, 3, h - 2);
      // faint horizontal segment lines every 32px
      ctx.fillStyle = this._mix(rgb, BLACK, 0.22);
      for (let ly = y + 32; ly < y + h - 4; ly += 32) ctx.fillRect(x + 2, ly, w - 4, 1);
      ctx.fillStyle = edge;
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.fillRect(x + w - 1, y, 1, h);
      return;
    }
    // Bevel: light top, dark bottom (no side bevels so abutting slabs merge)
    ctx.fillStyle = light;
    ctx.fillRect(x, y + 1, w, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h - 3, w, 2);
    // 1px dark outline, top and bottom only
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
  }

  // Stone-block masonry (castle grey / underground blue-grey), lightly tinted
  _masonry(x, y, w, h, color, s) {
    const ctx = this.ctx;
    const rgb = this._rgb(color);
    const baseRgb = s === 'castle' ? [112, 108, 112] : [92, 104, 132];
    const tinted = [
      Math.round(baseRgb[0] * 0.82 + rgb[0] * 0.18),
      Math.round(baseRgb[1] * 0.82 + rgb[1] * 0.18),
      Math.round(baseRgb[2] * 0.82 + rgb[2] * 0.18),
    ];
    const base = this._mix(tinted, WHITE, 0);
    const light = this._mix(tinted, WHITE, 0.35);
    const dark = this._mix(tinted, BLACK, 0.4);
    const mortar = this._mix(tinted, BLACK, 0.62);
    const edge = this._mix(tinted, BLACK, 0.8);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    // Block grid: 32px rows; each row offset by 16px like brickwork
    const bs = 32;
    const cx0 = Math.max(x, 0), cx1 = Math.min(x + w, CANVAS_WIDTH);
    const cy0 = Math.max(y, 0), cy1 = Math.min(y + h, CANVAS_HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const rows = Math.ceil(h / bs);
    for (let r = 0; r < rows; r++) {
      const by = y + r * bs;
      if (by > cy1 || by + bs < cy0) continue;
      const off = (r & 1) ? bs / 2 : 0;
      const bh = Math.min(bs, y + h - by);
      for (let bx = x - off; bx < x + w; bx += bs) {
        if (bx + bs < cx0 || bx > cx1) continue;
        // bevel highlight top-left
        ctx.fillStyle = light;
        ctx.fillRect(bx + 1, by + 1, bs - 2, 2);
        ctx.fillRect(bx + 1, by + 1, 2, bh - 2);
        // shadow bottom-right
        ctx.fillStyle = dark;
        ctx.fillRect(bx + 1, by + bh - 3, bs - 2, 2);
        ctx.fillRect(bx + bs - 3, by + 1, 2, bh - 2);
        // mortar lines
        ctx.fillStyle = mortar;
        ctx.fillRect(bx, by, bs, 1);
        ctx.fillRect(bx, by, 1, bh);
      }
    }
    ctx.restore();
    // Dark outline top and bottom only (sides merge with neighbouring slabs)
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  px(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }
}
