import { CANVAS_WIDTH } from './constants.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(target, levelWidth) {
    const desired = target.x + target.w / 2 - CANVAS_WIDTH * 0.4;
    let nx = this.x + (desired - this.x) * 0.12;
    // SMB/FSM: the screen NEVER scrolls left (one-way scroll)
    if (nx < this.x) nx = this.x;
    if (nx < 0) nx = 0;
    if (nx > levelWidth - CANVAS_WIDTH) nx = levelWidth - CANVAS_WIDTH;
    this.x = nx;
  }
}
