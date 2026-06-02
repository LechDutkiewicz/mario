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
import { Platform, QuestionBlock, PipeBlock, BrickBlock, MovingPlatform, TreePlatform } from '../entities/platform.js';
import { FlagPole } from '../entities/flagpole.js';
import { Enemy } from '../entities/enemy.js';
import { Coin } from '../entities/coin.js';
import { PipePlant } from '../entities/pipeplant.js';
import { FireBar } from '../entities/firebar.js';
import { CastleBoss, BossAxe } from '../entities/castleboss.js';

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
    case 'HardBlock': {
      // y = top of stone (upward from ground in FSM units)
      // height (optional) = thickness in FSM units; if absent, 1 tile default
      // width  (optional) = width in FSM units; default = 1 tile (8 FSM units)
      const stoneTopY = GY - y * 4;
      const stoneH    = e.height !== undefined ? e.height * 4 : T;
      const stoneW    = e.width  !== undefined ? ux(e.width)  : T;
      out.platforms.push(new Platform(sx, stoneTopY, stoneW, stoneH, COLORS.brick));
      break;
    }

    case 'CastleBlock': {
      const stoneTopY = GY - y * 4;
      const stoneH    = e.height !== undefined ? e.height * 4 : T;
      const stoneW    = e.width  !== undefined ? ux(e.width)  : T;
      out.platforms.push(new Platform(sx, stoneTopY, stoneW, stoneH, COLORS.brick));
      if (e.fireballs) {
        // direction param: FSM uses direction:1 for counter-clockwise; speed:-1 reverses
        const dir = (e.direction === 1) ? -1 : 1;
        const spd = (e.speed !== undefined) ? e.speed : 1;
        out.fireBars.push(new FireBar(sx, stoneTopY, e.fireballs, spd, dir));
      }
      break;
    }

    case 'Block':
      out.qblocks.push(new QuestionBlock(sx, uy(y), mapContents(e.contents), !!e.hidden));
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
      if (e.jumping && e.floating && e.begin !== undefined && e.end !== undefined) {
        // Paratroopa — flies vertically between begin and end
        const flyMinY = uy(e.end);   // end = higher y in FSM → lower screen y (top)
        const flyMaxY = Math.min(uy(e.begin), GY - 40);
        out.enemies.push(new Enemy(sx, 0, 'squirtle', false, true, flyMinY, flyMaxY));
      } else {
        const feetY = GY - (y - 8) * 4;
        out.enemies.push(new Enemy(sx, feetY, 'squirtle', !!e.smart));
      }
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
        const by    = Math.min(uy(e.begin), GY - T);  // clip below ground
        const ey    = uy(e.end);
        const topY  = Math.min(by, ey);
        const range = Math.abs(by - ey);
        out.movingPlatforms.push(new MovingPlatform(sx, topY, w, T / 2, 'y', 1.0, range));
      } else {
        out.movingPlatforms.push(new MovingPlatform(sx, uy(y), w, T / 2, 'x', 1.0, ux(48)));
      }
      break;
    }

    // PipeHorizontal with transport → marks an exit zone player walks into
    case 'PipeHorizontal': {
      if (e.transport != null && typeof e.transport === 'number') {
        // Store as exit trigger (not a solid, just a zone)
        out.hPipeExits = out.hPipeExits || [];
        out.hPipeExits.push({ x: ux(x), y: GY - (e.y || 0) * 4, transportId: e.transport });
      }
      break;
    }
    // PipeVertical — vertical pipe visual drawn as a tall PipeBlock
    case 'PipeVertical': {
      const pipeTopFSM = y || (e.height ? Math.round(e.height / 8) * 8 : 8);
      let htiles;
      if (pipeTopFSM >= 40) {
        // Tall underground exit pipe — extend beyond canvas top so cap is hidden
        htiles = Math.ceil(GY / T) + 1; // 18 tiles: top at -4px (above canvas)
      } else if (e.height !== undefined) {
        htiles = Math.max(1, Math.round(e.height / 8));
      } else {
        htiles = Math.max(1, Math.round(pipeTopFSM / 8));
      }
      out.platforms.push(new PipeBlock(ux(x), htiles, false));
      break;
    }
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
            hidden:   e.hidden,
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
      if (e.exit != null)      pb.leadsToArea   = 2;
      if (e.transport != null) pb.transportId   = typeof e.transport === 'object' ? null : e.transport;
      if (e.entrance  != null) pb.entranceId    = e.entrance;
      out.platforms.push(pb);
      if (e.pirhana || e.piranha) {
        out.plants.push(new PipePlant(sx, GY - heightTiles * T));
      }
      break;
    }

    case 'PlatformGenerator': {
      // 2 staggered platforms travelling in one direction, wrapping off-screen.
      // direction=1 (default): platforms descend.  direction=-1: platforms ascend.
      const sx      = ux(x);
      const pW      = T * 3;
      const pSpeed  = (e.direction === -1) ? -1.5 : 1.5;
      const topY    = -T;          // just above canvas top (wrap destination when going up)
      const bottomY = 640;         // just below canvas bottom (wrap destination when going down)
      const totalH  = bottomY - topY;   // full travel range including off-screen buffer
      const count   = 2;
      for (let i = 0; i < count; i++) {
        const p = new MovingPlatform(sx, topY, pW, T / 2, 'y', pSpeed, totalH, 'conveyor');
        // Stagger starting positions within the visible area so one is always on screen
        p.y = topY + (totalH / count) * i;
        out.movingPlatforms.push(p);
      }
      break;
    }

    case 'EndCastleOutside':
    case 'EndOutsideCastle':
      if (!out.flagPole) out.flagPole = new FlagPole(ux(x));
      break;

    case 'EndInsideCastle': {
      // Bridge over lava + boss + axe
      // The bridge starts at x (EndInsideCastle position) and extends right
      const bridgeX = ux(x);
      const BRIDGE_W = T * 14;               // 14-tile wide bridge
      const bossStartX = bridgeX + T * 2;   // boss starts 2 tiles in
      const axeX       = bridgeX + T * 11;  // axe near right end of bridge

      // Bridge platform (thin, at floor level)
      out.platforms.push(new Platform(bridgeX, GY, BRIDGE_W, T * 4, COLORS.brick));

      out.castleBoss = new CastleBoss(bossStartX, GY, bridgeX + T, bridgeX + T * 10);
      out.bossAxe    = new BossAxe(axeX, GY);
      out.noFlagPole = true;
      break;
    }

    case 'Tree': {
      const w = ux(e.width || 8);
      out.platforms.push(new TreePlatform(ux(x), GY - y * 4, w));
      break;
    }

    case 'StartInsideCastle': {
      // Creates the floor at the castle entrance (before the first lava pit)
      const w = ux(e.width || 8);
      out.platforms.push(new Platform(0, GY, w, 120, COLORS.brick));
      break;
    }

    case 'WarpWorld': {
      const worlds = Array.isArray(e.warps) ? e.warps : [4, 3, 2];
      const sx = ux(x);
      const pipeSpacing = T * 3;  // 96px per pipe slot (pipe=64px + 32px gap)
      out.platforms.push(new Platform(sx - T * 2, GY, pipeSpacing * worlds.length + T * 4, 120, COLORS.brick));
      for (let i = 0; i < worlds.length; i++) {
        const px = sx + i * pipeSpacing;
        const pb = new PipeBlock(px, 2, false);
        pb.warpWorld = worlds[i];
        pb.isWarp = true;
        out.platforms.push(pb);
      }
      out.noFlagPole = true;  // no flag/Pokemon Center in warp zones
      break;
    }

    // Decorative / purely visual / unsupported
    case 'Pattern':
    case 'PipeCorner':
    case 'CastleWall':
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
    fireBars:        [],
    castleBoss:      null,
    bossAxe:         null,
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

  const setting = area.setting === 'Underworld' ? 'underground'
                : area.setting === 'Castle'     ? 'castle'
                : 'overworld';

  // Underground areas and warp zones don't get a flag/Pokemon Center
  const suppressFlag = setting === 'underground' || out.noFlagPole;
  if (!suppressFlag && !out.flagPole) out.flagPole = new FlagPole(maxX - 300);
  const pokeCenterX = out.flagPole ? out.flagPole.x + 5 * T : null;

  return {
    platforms:       out.platforms,
    qblocks:         out.qblocks,
    enemies:         out.enemies,
    coins:           out.coins,
    plants:          out.plants,
    movingPlatforms: out.movingPlatforms,
    hPipeExits:      out.hPipeExits || [],
    boss:            null,
    fireBars:        out.fireBars,
    castleBoss:      out.castleBoss || null,
    bossAxe:         out.bossAxe || null,
    flagPole:        out.flagPole || null,
    pokeCenterX,
    setting,
    get solids() { return [...this.platforms, ...this.qblocks, ...this.movingPlatforms]; },
    width:           levelWidth,
  };
}
