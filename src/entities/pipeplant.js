import { TILE, GROUND_Y } from '../constants.js';
import { TAU, shape, ell, poly, hilite } from './sprite-utils.js';

export class PipePlant {
  constructor(pipeX, pipeTopY) {
    this.pipeX = pipeX;
    this.pipeTopY = pipeTopY;
    this.x = pipeX + TILE - 14;        // centred on the 2-tile pipe
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
    ctx.rect(x - 10, -100, w + 20, Math.floor(this.pipeTopY) + 101);   // nothing below the pipe's top edge
    ctx.clip();

    // ── ARBOK ── purple cobra rising from the pipe, hood spread wide,
    // big head on top that opens its fanged mouth
    const OL = '#2a1040';
    const PUR = '#9a55c0', PUR_D = '#6a3090', YEL = '#f0c828', RED = '#d82828';
    const cx = x + w / 2 + Math.sin(this.animTimer * 0.06) * 1.5;
    const open = Math.max(0, Math.sin(this.animTimer * 0.07));      // mouth 0..1

    // Body column — tapers into the pipe, cream belly bands
    shape(ctx, () => {
      ctx.moveTo(cx - 7, y + h + 12);
      ctx.quadraticCurveTo(cx - 8, y + h * 0.7, cx - 9, y + h * 0.5);
      ctx.lineTo(cx + 9, y + h * 0.5);
      ctx.quadraticCurveTo(cx + 8, y + h * 0.7, cx + 7, y + h + 12);
      ctx.closePath();
    }, PUR, OL, { sh: 0.72, dx: 2.5, dy: 0, lw: 1.4 });
    ctx.fillStyle = '#ecd27a';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.66 + i * 6, 5.5, 1.8, 0, 0, TAU); ctx.fill();
    }

    // Hood — wide diamond behind the head
    shape(ctx, () => {
      ctx.moveTo(cx, y + 4);
      ctx.quadraticCurveTo(cx - w * 0.66, y + h * 0.1, cx - w * 0.6, y + h * 0.32);
      ctx.quadraticCurveTo(cx - w * 0.34, y + h * 0.56, cx, y + h * 0.56);
      ctx.quadraticCurveTo(cx + w * 0.34, y + h * 0.56, cx + w * 0.6, y + h * 0.32);
      ctx.quadraticCurveTo(cx + w * 0.66, y + h * 0.1, cx, y + 4);
      ctx.closePath();
    }, PUR, OL, { sh: 0.74, dy: 3.5, lw: 1.6 });
    // Hood "scary face" marking: red eyespots, black brows, yellow band
    ell(ctx, cx - w * 0.3, y + h * 0.3, 4, 4.8, 0.15, RED, OL, { sh: 0.72, lw: 1 });
    ell(ctx, cx + w * 0.3, y + h * 0.3, 4, 4.8, -0.15, RED, OL, { sh: 0.72, lw: 1 });
    hilite(ctx, cx - w * 0.32, y + h * 0.27, 1.2, 0.8, 0.6);
    hilite(ctx, cx + w * 0.28, y + h * 0.27, 1.2, 0.8, 0.6);
    poly(ctx, [cx - w * 0.46, y + h * 0.17, cx - w * 0.14, y + h * 0.24, cx - w * 0.44, y + h * 0.27], '#1a1a1a', null, { sh: 0 });
    poly(ctx, [cx + w * 0.46, y + h * 0.17, cx + w * 0.14, y + h * 0.24, cx + w * 0.44, y + h * 0.27], '#1a1a1a', null, { sh: 0 });
    ell(ctx, cx, y + h * 0.46, w * 0.28, 3.2, 0, YEL, null, { sh: 0.85, dy: 1.5 });

    // Head — big, sits on top of the hood
    const hy = y + h * 0.14;
    ell(ctx, cx, hy, 11, 9, 0, PUR_D, OL, { sh: 0.74, dy: 3 });
    hilite(ctx, cx - 4, hy - 4.5, 3.5, 1.6);
    // Open mouth: dark red interior, fangs and tongue; closed: thin mouth line
    if (open > 0.15) {
      const mh = 3 + open * 5;
      shape(ctx, () => ctx.ellipse(cx, hy + 4.5, 7.5, mh, 0, 0, TAU), '#7a1020', OL, { sh: 0, lw: 1.2 });
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(cx - 5.5, hy + 2); ctx.lineTo(cx - 4, hy + 3 + mh * 0.8); ctx.lineTo(cx - 2.5, hy + 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 2.5, hy + 2); ctx.lineTo(cx + 4, hy + 3 + mh * 0.8); ctx.lineTo(cx + 5.5, hy + 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const tl = 4 + open * 5;
      ctx.beginPath(); ctx.moveTo(cx, hy + 5); ctx.lineTo(cx, hy + 5 + tl);
      ctx.moveTo(cx, hy + 5 + tl); ctx.lineTo(cx - 2.5, hy + 8 + tl);
      ctx.moveTo(cx, hy + 5 + tl); ctx.lineTo(cx + 2.5, hy + 8 + tl); ctx.stroke();
    } else {
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 6, hy + 4); ctx.quadraticCurveTo(cx, hy + 6.5, cx + 6, hy + 4); ctx.stroke();
    }
    // Eyes — yellow, narrow angry slits with brows
    ell(ctx, cx - 5, hy - 2, 2.8, 2.4, 0.2, YEL, OL, { sh: 0, lw: 1 });
    ell(ctx, cx + 5, hy - 2, 2.8, 2.4, -0.2, YEL, OL, { sh: 0, lw: 1 });
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 5.6, hy - 4, 1.4, 4); ctx.fillRect(cx + 4.2, hy - 4, 1.4, 4);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(cx - 8.5, hy - 5.5); ctx.lineTo(cx - 2.5, hy - 3.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8.5, hy - 5.5); ctx.lineTo(cx + 2.5, hy - 3.8); ctx.stroke();
    // Nostrils
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 2, hy + 1, 1.2, 1.2); ctx.fillRect(cx + 1, hy + 1, 1.2, 1.2);

    ctx.restore();
  }
}
