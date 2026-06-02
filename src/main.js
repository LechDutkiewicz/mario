import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants.js';
import { Input } from './input.js';
import { Game }  from './game.js';

const canvas = document.getElementById('game');
canvas.width  = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const input = new Input();
const game  = new Game(ctx, input);

// Handle LEVELS button click and level-select overlay clicks
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH  / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;
  game.handleClick(mx, my);
});

// Fixed-timestep 60fps game loop with accumulator
const STEP = 1000 / 60;
let last = performance.now();
let acc  = 0;

function frame(now) {
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;
  acc += dt;
  while (acc >= STEP) {
    input.update();
    game.update();
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
