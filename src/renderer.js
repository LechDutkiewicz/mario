import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from './constants.js';

// Low-level pixel-art drawing helpers
export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  clear() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    g.addColorStop(0, COLORS.sky1);
    g.addColorStop(1, COLORS.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Parallax clouds & hills (background, drawn relative to camera with factor)
  drawBackground(camX) {
    const ctx = this.ctx;
    // Hills
    ctx.fillStyle = '#79d279';
    for (let i = 0; i < 12; i++) {
      const bx = i * 600 - (camX * 0.5) % 600 - 300;
      this._hill(bx + 150, 540, 120);
      this._hill(bx + 450, 540, 80);
    }
    // Clouds
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const cx = (i * 480 - camX * 0.3) % (480 * 14);
      const x = cx < -200 ? cx + 480 * 14 : cx;
      const y = 60 + (i % 3) * 50;
      this._cloud(x, y);
    }
  }

  _hill(x, baseY, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, baseY, r, Math.PI, 0);
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

  // A platform rect with highlight border
  platform(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    // top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, 4);
    // bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h - 4, w, 4);
    // border
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  // pixel grid helper: draw a scaled "pixel"
  px(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
  }
}
