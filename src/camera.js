import { CANVAS_WIDTH } from './constants.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(target, levelWidth) {
    const desired = target.x + target.w / 2 - CANVAS_WIDTH * 0.4;
    this.x += (desired - this.x) * 0.12;
    if (this.x < 0) this.x = 0;
    if (this.x > levelWidth - CANVAS_WIDTH) this.x = levelWidth - CANVAS_WIDTH;
  }
}
