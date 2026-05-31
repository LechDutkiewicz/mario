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

  // Background parallax hills and clouds
  drawBackground(camX) {
    const ctx = this.ctx;

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
