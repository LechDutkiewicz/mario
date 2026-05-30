import { COLORS } from '../constants.js';

export class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 22;
    this.dead = false;
    this.anim = Math.floor(Math.random() * 40);
    // pop animation (when spawned from block)
    this.popVy = 0;
    this.popping = false;
    this.popTimer = 0;
  }

  static pop(x, y) {
    const c = new Coin(x, y);
    c.popping = true;
    c.popVy = -9;
    c.popTimer = 40;
    return c;
  }

  update() {
    this.anim++;
    if (this.popping) {
      this.y += this.popVy;
      this.popVy += 0.6;
      this.popTimer--;
      if (this.popTimer <= 0) this.dead = true;
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const x = this.x - cam.x;
    const y = this.y;
    // spin: width oscillates
    const phase = Math.abs(Math.sin(this.anim * 0.12));
    const ww = 4 + this.w * phase;
    const cx = x + this.w / 2;
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.ellipse(cx, y + this.h / 2, ww / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (ww > 10) {
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(cx - 1, y + 4, 2, this.h - 8);
    }
  }
}
