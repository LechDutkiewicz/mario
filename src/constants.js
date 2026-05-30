// Game constants and configuration
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const GROUND_Y = 540;
export const LEVEL_WIDTH = 6000;

// Physics
export const GRAVITY = 0.7;
export const MAX_FALL_SPEED = 14;
export const PLAYER_SPEED = 3.4;
export const PLAYER_RUN_SPEED = 5.2;
export const JUMP_VELOCITY = -14;
export const FRICTION = 0.82;
export const AIR_FRICTION = 0.92;

// Player sizes
export const PLAYER_SMALL_W = 28;
export const PLAYER_SMALL_H = 32;
export const PLAYER_BIG_W = 32;
export const PLAYER_BIG_H = 56;

export const INVINCIBLE_TIME = 120; // frames

// Game states
export const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  WIN: 'WIN',
};

// Player power states
export const POWER = {
  SMALL: 0,
  BIG: 1,
  FIRE: 2,
};

// Colors palette (from the child's drawing)
export const COLORS = {
  sky1: '#5fb8ff',
  sky2: '#bfe9ff',
  ground: '#7a4a1e',
  groundTop: '#3fa53f',
  red: '#e23b3b',
  orange: '#f08a1d',
  green: '#4cc24c',
  blue: '#3b7de2',
  pink: '#f06fae',
  purple: '#8b3bd6',
  cyan: '#3bd6d6',
  yellow: '#ffd23b',
  coin: '#ffd23b',
  qblock: '#f0a81d',
  brick: '#b5651d',
  white: '#ffffff',
  black: '#1a1a1a',
};

export const SCORE_COIN = 100;
export const SCORE_STOMP = 200;
export const SCORE_FIRE = 200;
export const SCORE_BOSS = 5000;
