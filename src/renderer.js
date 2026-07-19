import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, GROUND_Y } from './constants.js';

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

  // Background parallax hills and clouds
  drawBackground(camX) {
    const ctx = this.ctx;

    if (this.currentSetting === 'underground') {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;  // skip hills and clouds
    }

    if (this.currentSetting === 'night') {
      // Night sky — deep navy with stars and dark silhouette hills
      ctx.fillStyle = '#101832';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 40; i++) {
        // Deterministic star positions from index hash
        const sx = ((i * 379 + 83) % (CANVAS_WIDTH + 200)) - 100 - ((camX * 0.1) % (CANVAS_WIDTH + 200));
        const wx = ((sx % (CANVAS_WIDTH + 200)) + CANVAS_WIDTH + 200) % (CANVAS_WIDTH + 200) - 100;
        const sy = (i * 151 + 37) % (GROUND_Y - 150);
        const tw = (i * 7) % 3 ? 1.5 : 2.2;
        ctx.fillRect(wx, sy, tw, tw);
      }
      // Moon
      ctx.fillStyle = '#f0ecd8';
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 140, 90, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101832';
      ctx.beginPath(); ctx.arc(CANVAS_WIDTH - 130, 82, 22, 0, Math.PI * 2); ctx.fill();
      // Silhouette hills
      ctx.fillStyle = '#1a2a48';
      const hillPeriodN = 700;
      for (let i = -1; i < Math.ceil(CANVAS_WIDTH / hillPeriodN) + 2; i++) {
        const bx = i * hillPeriodN - ((camX * 0.3) % hillPeriodN);
        this._hill(bx + 120, GROUND_Y, 110);
        this._hill(bx + 380, GROUND_Y, 75);
      }
      return;
    }

    if (this.currentSetting === 'underwater') {
      const SURFACE = 188;  // FSM WaterBlock mapped to our ground height (540-416+64)
      // Air band above the surface
      ctx.fillStyle = '#a8d8f0';
      ctx.fillRect(0, 0, CANVAS_WIDTH, SURFACE);
      // Water below — deep blue gradient
      const grad = ctx.createLinearGradient(0, SURFACE, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, '#2870c0');
      grad.addColorStop(1, '#0a2860');
      ctx.fillStyle = grad;
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
      return;
    }

    if (this.currentSetting === 'castle') {
      ctx.fillStyle = '#1a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Draw lava glow at ground level
      const grad = ctx.createLinearGradient(0, CANVAS_HEIGHT - 80, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, 'rgba(200,40,0,0)');
      grad.addColorStop(1, 'rgba(200,40,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, CANVAS_HEIGHT - 80, CANVAS_WIDTH, 80);
      return;
    }

    // Soft green hills at 0.3x parallax
    ctx.fillStyle = '#6ecb6e';
    const hillPeriod = 700;
    for (let i = -1; i < Math.ceil(CANVAS_WIDTH / hillPeriod) + 2; i++) {
      const bx = i * hillPeriod - ((camX * 0.3) % hillPeriod);
      this._hill(bx + 120, GROUND_Y, 110);
      this._hill(bx + 380, GROUND_Y, 75);
      this._hill(bx + 560, GROUND_Y, 90);
    }

    // White puffy clouds at 0.2x parallax
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const baseX = i * 520 - (camX * 0.2) % (520 * 14);
      const x = ((baseX % (520 * 14)) + 520 * 14) % (520 * 14) - 200;
      const y = 55 + (i % 3) * 45;
      this._cloud(x, y);
    }
  }

  _hill(x, baseY, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(x, baseY, r, r * 0.6, 0, Math.PI, 0);
    ctx.fill();
  }

  _cloud(x, y) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 26, y + 6, 28, 0, Math.PI * 2);
    ctx.arc(x + 56, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 28, y - 12, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground tile with grass strip on top, brown soil below
  drawGround(x, y, w, h) {
    const ctx = this.ctx;
    // Soil
    ctx.fillStyle = '#7a4a1e';
    ctx.fillRect(x, y, w, h);
    // Grass strip
    ctx.fillStyle = '#3fa53f';
    ctx.fillRect(x, y, w, 8);
    // Darker grass edge
    ctx.fillStyle = '#2d8a2d';
    ctx.fillRect(x, y + 8, w, 3);
  }

  // Generic solid platform
  platform(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h - 4, w, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
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
