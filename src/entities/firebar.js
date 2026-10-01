import { TAU, ell } from './sprite-utils.js';
// Rotating fire bar — N fireballs orbiting a fixed center block
export class FireBar {
  constructor(cx, cy, count, speed = 1, direction = 1) {
    this.cx = cx + 16; // center of 32px block
    this.cy = cy + 16;
    this.count = count;
    this.angle = 0;
    // speed param in FSM is arbitrary; map to radians/frame
    // negative speed = clockwise (in screen coords, +y is down)
    this.angularVel = direction * 0.035 * (Math.abs(speed) || 1) * (speed < 0 ? -1 : 1);
    this.SPACING = 14; // px between each fireball
  }

  update() {
    this.angle += this.angularVel;
  }

  // Returns array of {x,y,w,h} hitboxes for each fireball
  getBalls() {
    const balls = [];
    for (let i = 0; i < this.count; i++) {
      const r = (i + 1) * this.SPACING;
      balls.push({
        x: this.cx + Math.cos(this.angle) * r - 5,
        y: this.cy + Math.sin(this.angle) * r - 5,
        w: 10,
        h: 10,
      });
    }
    return balls;
  }

  draw(r, cam) {
    const ctx = r.ctx;
    const flick = Math.floor(this.angle * 40) % 2;
    for (let i = 0; i < this.count; i++) {
      const rad = (i + 1) * this.SPACING;
      const bx = Math.floor(this.cx + Math.cos(this.angle) * rad - cam.x);
      const by = Math.floor(this.cy + Math.sin(this.angle) * rad);
      // Soft glow halo
      const glow = ctx.createRadialGradient(bx, by, 3, bx, by, 12);
      glow.addColorStop(0, 'rgba(255,170,40,0.5)');
      glow.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, TAU); ctx.fill();
      // Darker rim with ink outline, shaded underside
      ell(ctx, bx, by, 7, 7, 0, flick ? '#e85a08' : '#d84c00', '#5a1400', { sh: 0.7, dy: 2.5, lw: 1.3 });
      // Yellow body + white-hot core
      ell(ctx, bx - 0.5, by - 0.8, 4.4, 4.4, 0, '#ffd200', null, { sh: 0.85, dy: 1.5 });
      ell(ctx, bx - 1, by - 1.4, 2.2, 2.2, 0, '#fff8e0', null, { sh: 0 });
    }
  }
}
