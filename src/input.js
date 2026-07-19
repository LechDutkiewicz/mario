// Keyboard input handling
export class Input {
  constructor() {
    this.keys = {};
    this.pressed = {}; // edge-triggered (just pressed this frame)
    this._down = {};

    window.addEventListener('keydown', (e) => {
      if (this._isGameKey(e.code)) e.preventDefault();
      if (!this.keys[e.code]) {
        this._down[e.code] = true;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      if (this._isGameKey(e.code)) e.preventDefault();
      this.keys[e.code] = false;
    });
  }

  _isGameKey(code) {
    return [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Space', 'AltLeft', 'KeyP', 'Enter', 'ShiftLeft', 'Escape',
      'Tab', 'KeyM',
    ].includes(code);
  }

  update() {
    this.pressed = this._down;
    this._down = {};
  }

  isDown(code) { return !!this.keys[code]; }
  justPressed(code) { return !!this.pressed[code]; }

  get left()        { return this.isDown('ArrowLeft'); }
  get right()       { return this.isDown('ArrowRight'); }
  get down()        { return this.isDown('ArrowDown'); }
  get jump()        { return this.isDown('Space') || this.isDown('ArrowUp'); }
  get jumpPressed() { return this.justPressed('Space') || this.justPressed('ArrowUp'); }
  get run()         { return this.isDown('ShiftLeft'); }
  get firePressed() { return this.justPressed('AltLeft'); }
  get escape()      { return this.isDown('Escape'); }
}
