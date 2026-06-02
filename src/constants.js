// ============================================================
// CONSTANTS — Eevee's Adventure
// ============================================================
export const CANVAS_WIDTH  = 800;
export const CANVAS_HEIGHT = 600;
export const GROUND_Y      = 540;
export const TILE          = 32;
export const LEVEL_WIDTH   = 6400;

// Physics — matched to FullScreenMario (unitsize=4)
// gravity = round(12*4)/100 = 0.48
// maxspeed = 4 * 1.35 = 5.4, maxyvel = 4 * 1.75 = 7
// xvel *= 0.98 every frame; accel = 0.098 (walk) / 0.196 (sprint)
// jump: dy = 4 / pow(++jumplev, 1.056 - 0.0014*|xvel|) applied each frame
export const GRAVITY          = 0.48;
export const MAX_FALL_SPEED   = 7;
export const PLAYER_SPEED     = 5.4;   // max speed cap (same walk/run, accel differs)
export const PLAYER_RUN_SPEED = 5.4;
export const PLAYER_ACCEL     = 0.098;
export const PLAYER_RUN_ACCEL = 0.196;
export const JUMP_VELOCITY    = -3.52; // kept for compat (first-frame value, not really used)
export const FRICTION         = 0.98;
export const AIR_FRICTION     = 0.98;
export const JUMP_MAX_VY      = -14.7; // maxyvelinv = maxyvel * -2.1
export const JUMP_FRAMES_MAX  = 32;
export const JUMP_MOD         = 1.056;

// Player sizes
export const PLAYER_SMALL_W = 28;
export const PLAYER_SMALL_H = 32;
export const PLAYER_BIG_W   = 32;
export const PLAYER_BIG_H   = 56;

export const INVINCIBLE_TIME = 120;

// Game states
export const STATE = Object.freeze({
  MENU:        'MENU',
  CHAR_SELECT: 'CHAR_SELECT',
  PLAYING:     'PLAYING',
  PAUSED:      'PAUSED',
  GAME_OVER:   'GAME_OVER',
  WIN:         'WIN',
  LEADERBOARD:  'LEADERBOARD',
  LEVEL_SELECT: 'LEVEL_SELECT',
  NAME_ENTRY:  'NAME_ENTRY',
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
