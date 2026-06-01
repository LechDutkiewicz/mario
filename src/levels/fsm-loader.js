// ============================================================
// FSM JSON Level Loader
// Converts FullScreenMario-JSON format → game level objects
// ============================================================
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock, BrickBlock, MovingPlatform } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin } from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';

const T  = TILE;     // 32
const GY = GROUND_Y; // 540

// FSM unit → screen x pixel
const px = u => u * 4;

// FSM unit → screen y top pixel (h = object height in pixels)
// FSM y is measured UP from the ground floor (y=0 → object sits at ground level GY)
const py = (u, h = T) => GY - u * 4 - h;

// Map FSM Q-block contents string → game contents string
function mapContents(c) {
  if (!c) return 'pokeball';
  if (Array.isArray(c)) return 'pokeball'; // Vine, etc.
  switch (c) {
    case 'Mushroom':    return 'grow';
    case 'Mushroom1Up': return 'grow';
    case 'FireFlower':  return 'fire';
    case 'Coin':        return 'coin';
    case 'Star':        return 'grow';
    default:            return 'pokeball';
  }
}

// ---- Single Thing processor ----
function processThing(entry, out) {
  const { thing, x = 0, y = 0 } = entry;
  if (!thing) return;
  const sx = px(x);

  switch (thing) {
    case 'Brick':
      out.platforms.push(new BrickBlock(sx, py(y)));
      break;

    case 'HardBlock':
    case 'Stone': {
      // Stone can stack multiple tiles based on 'height' in FSM units
      const heightUnits = entry.height || 8;
      const tiles = Math.max(1, Math.round(heightUnits / 8));
      const pixH  = tiles * T;
      out.platforms.push(new Platform(sx, py(y, pixH), T, pixH, COLORS.brick));
      break;
    }

    case 'Block':
      out.qblocks.push(new QuestionBlock(sx, py(y), mapContents(entry.contents)));
      break;

    case 'Goomba':
    case 'Koopa':
    case 'Lakitu':
    case 'Blooper':
    case 'BuzzyBeetle':
    case 'HammerBro':
      // y=8 means 1 tile up (standing on ground) — spawn at GY for ground enemies
      if (y <= 16) {
        out.enemies.push(new Enemy(sx, GY, 'ekans'));
      } else {
        // On a platform — position bottom of enemy at py(y - 8, 0)
        out.enemies.push(new Enemy(sx, py(y - 8, 0), 'ekans'));
      }
      break;

    case 'Piranha':
      out.plants.push(new PipePlant(sx, py(y, T * 2)));
      break;

    case 'Coin':
      out.coins.push(new Coin(sx + 6, py(y, T) + 4));
      break;

    case 'Flagpole':
    case 'Flag':
      if (!out.flagPole) out.flagPole = new FlagPole(sx);
      break;

    case 'Platform': {
      // Moving/cloud platform (seen in Sky areas)
      const widthUnits = entry.width || 24;
      const w = px(widthUnits);
      out.movingPlatforms.push(
        new MovingPlatform(sx, py(y, T / 2), w, T / 2, 'x', 1.0, px(48))
      );
      break;
    }

    // Skip non-gameplay things
    case 'PipeHorizontal':
    case 'PipeVertical':
    case 'ScrollBlocker':
    case 'Vine':
    case 'Springboard':
      break;

    default:
      console.warn('[fsm-loader] Unknown thing:', thing);
      break;
  }
}

// ---- Macro processor ----
function processMacro(entry, out) {
  const { macro, x = 0, y = 0 } = entry;

  switch (macro) {
    case 'Floor': {
      const widthUnits = entry.width || 0;
      if (widthUnits <= 0) break;
      out.platforms.push(new Platform(px(x), GY, px(widthUnits), 120, COLORS.ground));
      break;
    }

    case 'Ceiling': {
      const widthUnits = entry.width || 0;
      if (widthUnits <= 0) break;
      // Underground ceiling sits near top of canvas
      const ceilY = 60;
      out.platforms.push(new Platform(px(x), ceilY, px(widthUnits), T, COLORS.brick));
      break;
    }

    case 'Fill': {
      const thing  = entry.thing;
      const xnum   = entry.xnum   || 1;
      const ynum   = entry.ynum   || 1;
      const xwidth = entry.xwidth !== undefined ? entry.xwidth : 8;
      const ywidth = entry.ywidth !== undefined ? entry.ywidth : 8;

      for (let yi = 0; yi < ynum; yi++) {
        for (let xi = 0; xi < xnum; xi++) {
          processThing({
            thing,
            x: x + xi * xwidth,
            y: y + yi * ywidth,
            contents: entry.contents,
            height:   entry.height,
          }, out);
        }
      }
      break;
    }

    case 'Pipe': {
      const heightUnits = entry.height || 16;
      const heightTiles = Math.max(1, Math.round(heightUnits / 8));
      const sx          = px(x);
      const hasPirhana  = entry.pirhana === true || entry.pirhana === 'true';
      const enterable   = entry.entrance != null || entry.exit != null;
      out.platforms.push(new PipeBlock(sx, heightTiles, enterable));
      if (hasPirhana) {
        const topY = GY - heightTiles * T;
        out.plants.push(new PipePlant(sx, topY - T));
      }
      break;
    }

    case 'PlatformGenerator': {
      // Generates moving platforms in a region — create a pair
      const sx = px(x);
      out.movingPlatforms.push(new MovingPlatform(sx,       GY - T * 6, T * 3, T / 2, 'y', 0.8, T * 4));
      out.movingPlatforms.push(new MovingPlatform(sx + T*6, GY - T * 4, T * 3, T / 2, 'y', 0.8, T * 4));
      break;
    }

    case 'EndCastleOutside': {
      if (!out.flagPole) out.flagPole = new FlagPole(px(x));
      break;
    }

    // Decorative / warp / unsupported macros — skip gracefully
    case 'Pattern':
    case 'WarpWorld':
    case 'PipeCorner':
    case 'CastleWall':
    case 'EndOutsideCastle':
      break;

    default:
      console.warn('[fsm-loader] Unknown macro:', macro);
      break;
  }
}

// ---- Main entry point ----
// areaIndex: which area in the JSON to load (default 0 = first/overworld area)
export function loadFSMLevel(jsonData, areaIndex = 0) {
  const area = jsonData.areas[areaIndex];
  if (!area) throw new Error(`[fsm-loader] Area ${areaIndex} not found`);

  const out = {
    platforms:       [],
    qblocks:         [],
    enemies:         [],
    coins:           [],
    plants:          [],
    movingPlatforms: [],
    flagPole:        null,
  };

  const isUnderground = area.setting === 'Underworld';

  for (const entry of area.creation) {
    if (entry.macro) {
      processMacro(entry, out);
    } else if (entry.thing) {
      processThing(entry, out);
    }
    // 'location' entries are navigation hints — skip
  }

  // Derive level width from rightmost solid object + buffer
  let maxX = 800;
  for (const p of [...out.platforms, ...out.qblocks]) {
    maxX = Math.max(maxX, p.x + (p.w || T));
  }
  const levelWidth = maxX + 800;

  // Fallback flagpole if none found in data
  if (!out.flagPole) {
    out.flagPole = new FlagPole(maxX - 300);
  }

  const pokeCenterX = out.flagPole.x + 5 * T;

  return {
    platforms:        out.platforms,
    qblocks:          out.qblocks,
    enemies:          out.enemies,
    coins:            out.coins,
    plants:           out.plants,
    movingPlatforms:  out.movingPlatforms,
    boss:             null,
    flagPole:         out.flagPole,
    pokeCenterX,
    setting:          isUnderground ? 'underground' : 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks, ...this.movingPlatforms]; },
    width:            levelWidth,
  };
}
