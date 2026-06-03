// Rotating fire bar — N fireballs orbiting a fixed center block
export class FireBar {
  constructor(cx, cy, count, speed = 1, direction = 1) {
    this.cx = cx + 16; // center of 32px block
    this.cy = cy + 16;
    this.count = count;
    this.angle = Math.random() * Math.PI * 2;
    // speed param in FSM is arbitrary; map to radians/frame
    // negative speed = clockwise (in screen coords, +y is down)
    this.angularVel = direction * 0.07 * (Math.abs(speed) || 1) * (speed < 0 ? -1 : 1);
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
    for (let i = 0; i < this.count; i++) {
      const rad = (i + 1) * this.SPACING;
      const bx = Math.floor(this.cx + Math.cos(this.angle) * rad - cam.x);
      const by = Math.floor(this.cy + Math.sin(this.angle) * rad);
      // Outer orange
      ctx.fillStyle = '#e05000';
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fill();
      // Inner yellow
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      // White hot core
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
