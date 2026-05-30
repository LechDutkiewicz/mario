import { CANVAS_WIDTH, LEVEL_WIDTH } from './constants.js';

// Smooth horizontal camera following the player
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(target) {
    // Keep player roughly 40% from left
    const desired = target.x + target.w / 2 - CANVAS_WIDTH * 0.4;
    // Smooth lerp
    this.x += (desired - this.x) * 0.12;
    // Clamp
    if (this.x < 0) this.x = 0;
    if (this.x > LEVEL_WIDTH - CANVAS_WIDTH) this.x = LEVEL_WIDTH - CANVAS_WIDTH;
  }
}
