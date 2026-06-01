import { TILE, GROUND_Y } from '../constants.js';
import { aabb } from '../physics.js';

// Flagpole — touch to win
export class FlagPole {
  constructor(x) {
    this.x = x - TILE / 2;
    this.y = GROUND_Y - 10 * TILE;
    this.w = 16;
    this.h = 10 * TILE;
    this.touched = false;
    this.dead = false;
    this.anim = 0;
    this.flagY = this.y + 5;
    this.flagTargetY = GROUND_Y - TILE - 22;
    this.slideComplete = false;
  }

  update(player) {
    this.anim++;
    if (!this.touched && !player.dead && aabb(player, this)) {
      this.touched = true;
    }
    // Slide flag down after touched
    if (this.touched && this.flagY < this.flagTargetY) {
      this.flagY += 2;
      if (this.flagY >= this.flagTargetY) {
        this.flagY = this.flagTargetY;
        this.slideComplete = true;
      }
    }
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const sx = Math.floor(this.x - cam.x);
    const sy = Math.floor(this.y);

    // Pole
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(sx + 6, sy, 4, this.h);
    // Highlight
    ctx.fillStyle = '#dddddd';
    ctx.fillRect(sx + 7, sy, 2, this.h);

    // Gold ball on top
    ctx.fillStyle = '#ffd23b';
    ctx.beginPath();
    ctx.arc(sx + 8, sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pokéball flag
    const flagX = sx + 10;
    const flagY = Math.floor(this.flagY) - Math.floor(this.y) + sy;
    const fw = 28;
    const fh = 22;
    // Red top
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(flagX, flagY, fw, fh / 2);
    // White bottom
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(flagX, flagY + fh / 2, fw, fh / 2);
    // Black band
    ctx.fillStyle = '#222';
    ctx.fillRect(flagX, flagY + fh / 2 - 1, fw, 3);
    // Center button
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(flagX + fw / 2, flagY + fh / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.stroke();
    // Animate flag flutter
    if (this.anim % 20 < 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(flagX + 2, flagY, 4, fh);
    }
  }
}
