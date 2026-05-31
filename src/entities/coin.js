// Pokéball collectible — replaces coin
export class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 20;
    this.dead = false;
    this.anim = Math.floor(Math.random() * 60);
    this.popVy = 0;
    this.popping = false;
    this.popTimer = 0;
  }

  static pop(x, y) {
    const c = new Coin(x, y);
    c.popping = true;
    c.popVy = -9;
    c.popTimer = 45;
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
    const bx = Math.floor(this.x - cam.x);
    // Gentle bob
    const bob = Math.sin(this.anim * 0.1) * 2;
    const by = Math.floor(this.y + bob);
    const rad = this.w / 2;
    const cx = bx + rad;
    const cy = by + rad;

    // Red top half
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, Math.PI, 0);
    ctx.fill();

    // White bottom half
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI);
    ctx.fill();

    // Black band
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, cy);
    ctx.lineTo(bx + this.w, cy);
    ctx.stroke();

    // Outer circle
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();

    // Center button
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
