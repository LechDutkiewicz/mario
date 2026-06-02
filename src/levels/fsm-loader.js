// ============================================================
// FSM JSON Level Loader — FullScreenMario-JSON → game objects
// ============================================================
// Coordinate system:
//   FSM y = distance (in FSM units, 1 unit = 4px) from the FLOOR to the
//           TOP of the entity, measured UPWARD.
//   Tile size = 8 FSM units = 32px (TILE constant).
//   Screen y  = GY - json_y * 4   (top of entity in screen coords)
//   Ground    = GY (= 540)
// ============================================================
import { TILE, GROUND_Y, COLORS } from '../constants.js';
import { Platform, QuestionBlock, PipeBlock, BrickBlock, MovingPlatform } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin } from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';

const T  = TILE;      // 32
const GY = GROUND_Y;  // 540

// FSM unit → screen pixel (horizontal)
const ux = u => u * 4;

// FSM y (top of entity, upward from floor) → screen y (top, downward from top of canvas)
const uy = u => GY - u * 4;

function mapContents(c) {
  if (!c || Array.isArray(c)) return 'pokeball';
  const map = { Mushroom:'candy', Mushroom1Up:'candy', FireFlower:'firestone', Coin:'coin', Star:'candy' };
  return map[c] || 'pokeball';
}

function processThing(e, out) {
  const x = e.x || 0;
  const y = e.y || 0;
  const sx = ux(x);

  switch (e.thing) {
    case 'Brick':
      // y = top of brick in FSM units → screen_top = GY - y*4
      out.platforms.push(new BrickBlock(sx, uy(y)));
      break;

    case 'Stone':
    case 'HardBlock':
    case 'CastleBlock': {
      // y = top of stone (upward from ground in FSM units)
      // height (optional) = thickness in FSM units; if absent, stone extends to ground
      // width  (optional) = width in FSM units; default = 1 tile (8 FSM units)
      const stoneTopY = GY - y * 4;
      const stoneH    = e.height !== undefined ? e.height * 4 : y * 4;
      const stoneW    = e.width  !== undefined ? ux(e.width)  : T;
      out.platforms.push(new Platform(sx, stoneTopY, stoneW, stoneH, COLORS.brick));
      break;
    }

    case 'Block':
      // Q-block: y = top in FSM units
      out.qblocks.push(new QuestionBlock(sx, uy(y), mapContents(e.contents)));
      break;

    case 'Goomba':
    case 'Lakitu':
    case 'BuzzyBeetle':
    case 'HammerBro': {
      // y = top of enemy (enemy height = 8 FSM units = 32px)
      // feet = GY - (y - 8) * 4
      const feetY = GY - (y - 8) * 4;
      out.enemies.push(new Enemy(sx, feetY, 'ekans'));
      break;
    }

    case 'Koopa': {
      const feetY = GY - (y - 8) * 4;
      out.enemies.push(new Enemy(sx, feetY, 'squirtle'));
      break;
    }

    case 'Piranha': {
      // y is the top of the piranha in FSM units (= top of the pipe it sits in).
      // pipeTopY in screen coords = GY - y*4
      const pipeTopY = GY - y * 4;
      out.plants.push(new PipePlant(sx, pipeTopY));
      break;
    }

    case 'Coin':
      out.coins.push(new Coin(sx + 6, uy(y) + 4));
      break;

    case 'Flagpole':
    case 'Flag':
      if (!out.flagPole) out.flagPole = new FlagPole(sx);
      break;

    case 'Platform': {
      const w = ux(e.width || 24);
      if (e.sliding && e.begin !== undefined && e.end !== undefined) {
        // Horizontal sliding platform — moves between ux(begin) and ux(end)
        const bx    = ux(e.begin);
        const ex    = ux(e.end);
        const range = Math.abs(ex - bx);
        out.movingPlatforms.push(new MovingPlatform(Math.min(bx, ex), uy(y), w, T / 2, 'x', 1.0, range));
      } else if (e.floating && e.begin !== undefined && e.end !== undefined) {
        // Vertical floating platform — oscillates between uy(begin) and uy(end)
        const by    = uy(e.begin);
        const ey    = uy(e.end);
        const range = Math.abs(ey - by);
        out.movingPlatforms.push(new MovingPlatform(sx, Math.min(by, ey), w, T / 2, 'y', 1.0, range));
      } else {
        out.movingPlatforms.push(new MovingPlatform(sx, uy(y), w, T / 2, 'x', 1.0, ux(48)));
      }
      break;
    }

    // Unsupported / purely visual / decorative
    case 'PipeHorizontal':
    case 'PipeVertical':
    case 'ScrollBlocker':
    case 'ScrollEnabler':
    case 'Vine':
    case 'Springboard':
    case 'Blooper':
    case 'CheepCheep':
    case 'DecorativeBack':
    case 'DecorativeDot':
    case 'CustomText':
    case 'FireFlower':
    case 'Mushroom':
    case 'Star':
    case 'Mushroom1Up':
      break;

    default:
      if (e.thing) console.warn('[fsm-loader] Unknown thing:', e.thing);
  }
}

function processMacro(e, out) {
  const x = e.x || 0;
  const y = e.y || 0;
  const xwidth = (e.xwidth !== undefined) ? e.xwidth : 8;
  const ywidth = (e.ywidth !== undefined) ? e.ywidth : 8;

  switch (e.macro) {
    case 'Floor': {
      const w = ux(e.width || 0);
      if (w <= 0) break;
      if (e.y) {
        // Elevated floor (castle shelves, raised sections) — thin platform
        out.platforms.push(new Platform(ux(x), GY - e.y * 4, w, T, COLORS.brick));
      } else {
        out.platforms.push(new Platform(ux(x), GY, w, 120, COLORS.ground));
      }
      break;
    }

    case 'Ceiling': {
      const w = ux(e.width || 0);
      if (w > 0) {
        const ceilY = GY - 11 * T;
        for (let bx = ux(x); bx < ux(x) + w; bx += T) {
          out.platforms.push(new BrickBlock(bx, ceilY));
        }
      }
      break;
    }

    case 'Fill': {
      const xnum = e.xnum || 1;
      const ynum = e.ynum || 1;
      for (let yi = 0; yi < ynum; yi++) {
        for (let xi = 0; xi < xnum; xi++) {
          processThing({
            thing:    e.thing,
            x:        x + xi * xwidth,
            y:        y + yi * ywidth,
            contents: e.contents,
          }, out);
        }
      }
      break;
    }

    case 'Pipe': {
      const heightTiles = Math.max(1, Math.round((e.height || 16) / 8));
      const sx = ux(x);
      const enterable = (e.entrance != null || e.exit != null || e.transport != null);
      const pb = new PipeBlock(sx, heightTiles, enterable);
      // Tag exit pipes so game.js can trigger area transition
      if (e.exit != null) pb.leadsToArea = 2;
      out.platforms.push(pb);
      if (e.pirhana || e.piranha) {
        out.plants.push(new PipePlant(sx, GY - heightTiles * T));
      }
      break;
    }

    case 'PlatformGenerator': {
      // Vertical lifts over a gap — create 3 staggered platforms going up & down
      const sx = ux(x);
      const dir = (e.direction === -1) ? -1 : 1;
      const range = T * 5;
      out.movingPlatforms.push(
        new MovingPlatform(sx,           GY - T * 2,  T * 3, T / 2, 'y',  dir * 1.0, range)
      );
      out.movingPlatforms.push(
        new MovingPlatform(sx + T * 4,   GY - T * 5,  T * 3, T / 2, 'y', -dir * 1.0, range)
      );
      out.movingPlatforms.push(
        new MovingPlatform(sx + T * 8,   GY - T * 3,  T * 3, T / 2, 'y',  dir * 1.0, range)
      );
      break;
    }

    case 'EndCastleOutside':
    case 'EndOutsideCastle':
      if (!out.flagPole) out.flagPole = new FlagPole(ux(x));
      break;

    case 'EndInsideCastle':
      // Castle level end — place a flagpole as level completion trigger
      if (!out.flagPole) out.flagPole = new FlagPole(ux(x));
      break;

    case 'Tree': {
      // Tree platform: y = top height in FSM units from ground, width = platform width
      const w = ux(e.width || 8);
      out.platforms.push(new Platform(ux(x), GY - y * 4, w, T, '#5a8830'));
      break;
    }

    // Decorative / warp / unsupported
    case 'Pattern':
    case 'WarpWorld':
    case 'PipeCorner':
    case 'CastleWall':
    case 'StartInsideCastle':
    case 'Water':
    case 'CastleSmall':
    case 'ScrollBlocker':
    case 'ScrollEnabler':
    case 'BackFence':
    case 'BackRegular':
      break;

    default:
      if (e.macro) console.warn('[fsm-loader] Unknown macro:', e.macro);
  }
}

// areaIndex: which area in the JSON to load (0 = first, 1 = underground, etc.)
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

  for (const entry of area.creation) {
    if (entry.macro)      processMacro(entry, out);
    else if (entry.thing) processThing(entry, out);
  }

  // Level width: rightmost object + buffer
  let maxX = 800;
  for (const p of [...out.platforms, ...out.qblocks]) {
    maxX = Math.max(maxX, p.x + (p.w || T));
  }
  const levelWidth = maxX + 800;

  if (!out.flagPole) out.flagPole = new FlagPole(maxX - 300);
  const pokeCenterX = out.flagPole.x + 5 * T;

  return {
    platforms:       out.platforms,
    qblocks:         out.qblocks,
    enemies:         out.enemies,
    coins:           out.coins,
    plants:          out.plants,
    movingPlatforms: out.movingPlatforms,
    boss:            null,
    flagPole:        out.flagPole,
    pokeCenterX,
    setting:         area.setting === 'Underworld' ? 'underground'
                   : area.setting === 'Castle'     ? 'castle'
                   : 'overworld',
    get solids() { return [...this.platforms, ...this.qblocks, ...this.movingPlatforms]; },
    width:           levelWidth,
  };
}
