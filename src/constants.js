// ============================================================
// CONSTANTS — Eevee's Adventure
// ============================================================
export const CANVAS_WIDTH  = 800;
export const CANVAS_HEIGHT = 600;
export const GROUND_Y      = 540;
export const TILE          = 32;
export const LEVEL_WIDTH   = 6400;

// Physics
export const GRAVITY          = 0.7;
export const MAX_FALL_SPEED   = 14;
export const PLAYER_SPEED     = 3.4;
export const PLAYER_RUN_SPEED = 5.2;
export const JUMP_VELOCITY    = -16;
export const FRICTION         = 0.82;
export const AIR_FRICTION     = 0.92;

// Player sizes
export const PLAYER_SMALL_W = 28;
export const PLAYER_SMALL_H = 32;
export const PLAYER_BIG_W   = 32;
export const PLAYER_BIG_H   = 56;

export const INVINCIBLE_TIME = 120;

// Game states
export const STATE = Object.freeze({
  MENU:      'MENU',
  PLAYING:   'PLAYING',
  PAUSED:    'PAUSED',
  GAME_OVER: 'GAME_OVER',
  WIN:       'WIN',
});

// Player power states
export const POWER = Object.freeze({ SMALL: 0, BIG: 1, FIRE: 2 });

// Color palette
export const COLORS = {
  sky:        '#87ceeb',
  skyLight:   '#c9e8f7',
  ground:     '#7a4a1e',
  groundTop:  '#3fa53f',
  red:        '#e23b3b',
  orange:     '#f08a1d',
  green:      '#4cc24c',
  blue:       '#3b7de2',
  pink:       '#f06fae',
  purple:     '#8b3bd6',
  cyan:       '#3bd6d6',
  yellow:     '#ffd23b',
  qblock:     '#f0a81d',
  brick:      '#b5651d',
  white:      '#ffffff',
  black:      '#1a1a1a',
  // Eevee palette
  eeveeBody:  '#c8864a',
  eeveeRuff:  '#f5e6c8',
  eeveeEarIn: '#e8a87c',
  eeveeEye:   '#2a1a0a',
};

export const SCORE_POKEBALL = 100;
export const SCORE_STOMP    = 200;
export const SCORE_FIRE     = 200;
export const SCORE_BOSS     = 5000;
