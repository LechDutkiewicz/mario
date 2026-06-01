import { TILE, GROUND_Y } from '../constants.js';

export class PipePlant {
  constructor(pipeX, pipeTopY) {
    this.pipeX = pipeX;
    this.pipeTopY = pipeTopY;
    this.x = pipeX + TILE * 0.5 - 14;
    this.w = 28; this.h = 36;
    this.timer = 90;
    this.state = 'hidden';
    this.offsetY = this.h;
    this.dead = false;
    this.animTimer = 0;
  }

  get y() { return this.pipeTopY - this.h + this.offsetY; }
  get stompable() { return false; }

  update() {
    this.animTimer++;
    this.timer--;
    if (this.state === 'hidden' && this.timer <= 0) {
      this.state = 'emerging';
      this.timer = 60;
    } else if (this.state === 'emerging') {
      this.offsetY = Math.max(0, this.offsetY - 0.5);
      if (this.offsetY === 0) { this.state = 'visible'; this.timer = 120; }
    } else if (this.state === 'visible' && this.timer <= 0) {
      this.state = 'retreating';
      this.timer = 60;
    } else if (this.state === 'retreating') {
      this.offsetY = Math.min(this.h, this.offsetY + 0.5);
      if (this.offsetY >= this.h) { this.state = 'hidden'; this.timer = 150; }
    }
  }

  isVisible() { return this.state !== 'hidden'; }

  kill() { this.dead = true; }

  draw(r, cam) {
    if (!this.isVisible()) return;
    const ctx = r.ctx;
    const x = Math.floor(this.x - cam.x);
    const y = Math.floor(this.y);
    const w = this.w, h = this.h;

    // Clip to pipe top
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 10, -100, w + 20, Math.floor(this.pipeTopY) + 110);
    ctx.clip();

    // Victreebel body
    ctx.fillStyle = '#8db600';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth opening at top
    ctx.fillStyle = '#1a1a00';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.18, w * 0.32, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Teeth (white jagged)
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.25 + i * 7, y + h * 0.16);
      ctx.lineTo(x + w * 0.25 + i * 7 + 3, y + h * 0.08);
      ctx.lineTo(x + w * 0.25 + i * 7 + 6, y + h * 0.16);
      ctx.closePath(); ctx.fill();
    }

    // Eyes (red)
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(x + w * 0.32, y + h * 0.35, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w * 0.68, y + h * 0.35, 4, 0, Math.PI * 2); ctx.fill();

    // Vine stem
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.8);
    ctx.lineTo(x + w / 2, y + h + 10);
    ctx.stroke();

    // Leaf curl animation
    const leafAngle = Math.sin(this.animTimer * 0.08) * 0.3;
    ctx.fillStyle = '#27ae60';
    ctx.save();
    ctx.translate(x + w / 2 + 8, y + h * 0.6);
    ctx.rotate(leafAngle);
    ctx.beginPath();
    ctx.ellipse(10, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}
