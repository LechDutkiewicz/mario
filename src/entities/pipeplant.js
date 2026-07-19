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

  update(player) {
    this.animTimer++;
    this.timer--;
    if (this.state === 'hidden' && this.timer <= 0) {
      // FSM movePirhanaRestart: don't emerge while the player's center is
      // within pipe ± 32px (re-checked every 7 frames)
      if (player) {
        const pMid = player.x + player.w / 2;
        if (pMid > this.pipeX - 32 && pMid < this.pipeX + 64 + 32) {
          this.timer = 7;
          return;
        }
      }
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
      if (this.offsetY >= this.h) { this.state = 'hidden'; this.timer = 35; }  // FSM pause
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

    // ── ARBOK ── purple cobra rising from the pipe, hood spread wide
    const OL = '#111';
    const PUR = '#8a4ab0', PUR_D = '#5c2a80';
    const cx2 = x + w / 2;
    const sway = Math.sin(this.animTimer * 0.06) * 1.5;

    // Body column — tapers into the pipe
    ctx.fillStyle = PUR;
    ctx.beginPath();
    ctx.moveTo(cx2 - 6, y + h + 12);
    ctx.quadraticCurveTo(cx2 - 7 + sway, y + h * 0.55, cx2 - 8 + sway, y + h * 0.42);
    ctx.lineTo(cx2 + 8 + sway, y + h * 0.42);
    ctx.quadraticCurveTo(cx2 + 7 + sway, y + h * 0.55, cx2 + 6, y + h + 12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.stroke();

    // Hood — wide flat diamond behind the head
    ctx.fillStyle = PUR;
    ctx.beginPath();
    ctx.moveTo(cx2 + sway, y - 2);                    // top of hood
    ctx.quadraticCurveTo(cx2 - w * 0.62 + sway, y + h * 0.08, cx2 - w * 0.55 + sway, y + h * 0.30);
    ctx.quadraticCurveTo(cx2 - w * 0.30 + sway, y + h * 0.48, cx2 + sway, y + h * 0.46);
    ctx.quadraticCurveTo(cx2 + w * 0.30 + sway, y + h * 0.48, cx2 + w * 0.55 + sway, y + h * 0.30);
    ctx.quadraticCurveTo(cx2 + w * 0.62 + sway, y + h * 0.08, cx2 + sway, y - 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();

    // Hood face-pattern — the angry "scary face" marking
    // Red eyespots
    ctx.fillStyle = '#d82828';
    ctx.beginPath(); ctx.ellipse(cx2 - w * 0.26 + sway, y + h * 0.20, 4.5, 5.5, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx2 + w * 0.26 + sway, y + h * 0.20, 4.5, 5.5, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    // Black angry brows over the eyespots
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(cx2 - w * 0.40 + sway, y + h * 0.08);
    ctx.lineTo(cx2 - w * 0.10 + sway, y + h * 0.16);
    ctx.lineTo(cx2 - w * 0.38 + sway, y + h * 0.18);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx2 + w * 0.40 + sway, y + h * 0.08);
    ctx.lineTo(cx2 + w * 0.10 + sway, y + h * 0.16);
    ctx.lineTo(cx2 + w * 0.38 + sway, y + h * 0.18);
    ctx.closePath(); ctx.fill();
    // Yellow band under the pattern
    ctx.fillStyle = '#f0c828';
    ctx.beginPath();
    ctx.ellipse(cx2 + sway, y + h * 0.36, w * 0.30, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head — small, atop the hood
    ctx.fillStyle = PUR_D;
    ctx.beginPath();
    ctx.ellipse(cx2 + sway, y + h * 0.04, w * 0.20, h * 0.10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.stroke();
    // Real eyes — narrow yellow slits
    ctx.fillStyle = '#f0c828';
    ctx.fillRect(cx2 - 5 + sway, y + h * 0.005, 3, 4);
    ctx.fillRect(cx2 + 2 + sway, y + h * 0.005, 3, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(cx2 - 4 + sway, y + h * 0.01, 1.2, 3);
    ctx.fillRect(cx2 + 3 + sway, y + h * 0.01, 1.2, 3);

    // Forked tongue flick
    if (Math.sin(this.animTimer * 0.18) > 0.4) {
      ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx2 + sway, y - 1);
      ctx.lineTo(cx2 + sway, y - 7);
      ctx.moveTo(cx2 + sway, y - 7);
      ctx.lineTo(cx2 - 3 + sway, y - 11);
      ctx.moveTo(cx2 + sway, y - 7);
      ctx.lineTo(cx2 + 3 + sway, y - 11);
      ctx.stroke();
    }

    ctx.restore();
  }
}
