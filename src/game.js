import {
  CANVAS_WIDTH, CANVAS_HEIGHT, STATE, POWER, COLORS,
  SCORE_POKEBALL, SCORE_STOMP, SCORE_FIRE, SCORE_BOSS, GROUND_Y, TILE,
} from './constants.js';
import { Renderer } from './renderer.js';
import { Camera }   from './camera.js';
import { Music }    from './audio.js';
import { Player }   from './entities/player.js';
import { PowerUp }  from './entities/powerup.js';
import { Coin }     from './entities/coin.js';
import { Fireball } from './entities/projectile.js';
import { buildWorld1 } from './levels/world1.js';
import { buildWorld2 } from './levels/world2.js';
import { buildWorld3 } from './levels/world3.js';
import { aabb }     from './physics.js';

// Pokémon type of each playable line — controls which evolution stone
// spawns from ? blocks and what the fired projectile looks like.
const CHAR_ELEMENT = {
  eevee:      'shadow',    // Dark (Umbreon) — Moon Stone, Shadow Ball
  charmander: 'fire',      // Fire — Fire Stone, flame
  bulbasaur:  'leaf',      // Grass — Leaf Stone, Razor Leaf
  piplup:     'water',     // Water — Water Stone, bubbles
  pichu:      'electric',  // Electric — Thunder Stone, spark
};

export class Game {
  constructor(ctx, input) {
    this.ctx   = ctx;
    this.input = input;
    this.r     = new Renderer(ctx);
    this.cam   = new Camera();
    this.music = new Music();
    this.state = STATE.MENU;
    this.score = 0;
    this.lives = 3;
    this.coinsCollected = 0;
    this.worldClearTimer = 0;
    this.walkToPC = false;
    this.walkToPCTimer = 0;
    this.pcEnterX = 0;
    this.world = 1;
    this.world1Level = 0;   // which sub-level of world 1 (0-3)
    this.world1SubArea = 0; // area within 1-2 (0=overworld, 1=underground, 2=exit)
    this.selectedChar = 'eevee';
    this.charSelectIdx = 0;
    this.world2Area = 0;   // current area index within world 2
    this.world2Level   = 0;
    this.world2SubArea = 0;
    this.areaTransTimer = 0;
    this._pendingArea = -1;
    this._pendingWorld1SubArea = -1;
    this._pendingWorld2SubArea = -1;
    this.area0AutoWalk = false; // player auto-walks into entrance pipe
    this._pipeEntry = null;    // { timer, dx, dy, callback } — pipe entry animation
    this.scorePopups = [];
    this._cachedBoard = this._loadLocalScores(); // show immediately from localStorage
    this._leaderboardLoading = false;
    // Refresh from Google Sheets in background; updates _cachedBoard when done
    this._fetchLeaderboardJSONP();
    this.resetLevel(true);
  }

  resetLevel(fullReset, resetPower = fullReset) {
    const savedPower = resetPower ? POWER.SMALL : (this.player ? this.player.power : POWER.SMALL);
    if (fullReset) { this.world2Area = 0; this.world2Level = 0; this.world2SubArea = 0; this.world1Level = 0; this.world1SubArea = 0; }
    this.level   = this.world === 3 ? buildWorld3()
                 : this.world === 2 ? buildWorld2(this.world2Level, this.world2SubArea)
                 : buildWorld1(this.world1Level, this.world1SubArea);
    this.area0AutoWalk = (this.world === 2 && !!this.level?.entrancePipeX)
                      || (this.world === 1 && this.world1Level === 1 && this.world1SubArea === 0);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player  = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x   = 0;
    this.fireballs  = [];
    this.bossShots  = [];
    this.powerups   = [];
    this._castleBossComplete = false; this._bridgeRemoved = false; this._catchCamLock = false; this._pipeEntry = null; this._lavaAnim = 0;
    if (fullReset) {
      this.score          = 0;
      this.lives          = 3;
      this.coinsCollected = 0;
      this.worldClearTimer = 0;
    }
    this.scorePopups = this.scorePopups || [];
  }

  start() {
    this.state = STATE.PLAYING;
    this.world = 1;
    this.world1Level = 0;
    this.walkToPC = false;
    this.walkToPCTimer = 0;
    this.resetLevel(true);
    this.music.start();
  }

  _playEndJingle() { if (this.music) this.music.playEndJingle(); }

  spawnFireball(player) {
    const x = player.facing > 0 ? player.x + player.w : player.x - 18;
    const element = CHAR_ELEMENT[this.selectedChar] || 'fire';
    this.fireballs.push(new Fireball(x, player.y + player.h * 0.4, player.facing, element));
  }

  collectBlockCoin(x, y) {
    this.coinsCollected++;
    this.score += SCORE_POKEBALL;
    this.level.coins.push(Coin.pop(x, y));
    this.music.playCollect();
  }

  spawnPowerUp(x, y, kind) {
    const element = CHAR_ELEMENT[this.selectedChar] || 'fire';
    this.powerups.push(new PowerUp(x, y, kind, element));
  }

  _spawnScorePopup(x, y, score) {
    this.scorePopups.push({ x, y, score, vy: -1.5, life: 50 });
  }

  spawnBrickDebris(x, y) {
    if (!this._debris) this._debris = [];
    for (let i = 0; i < 4; i++) {
      this._debris.push({
        x: x + (i % 2) * 16, y: y + Math.floor(i / 2) * 16,
        vx: (i % 2 === 0 ? -2 : 2) + (Math.random() - 0.5),
        vy: -6 - Math.random() * 4,
        life: 40,
      });
    }
  }

  // ----------------------------------------------------------------
  // LEADERBOARD — Google Sheets backend
  // ----------------------------------------------------------------
  static get SHEETS_URL() {
    return 'https://script.google.com/macros/s/AKfycbwB9GUQCCestn49uPAuc-GDF4S3FLTT-4-Ae2_kngxLg10eJRctHPb4t2zQWxxOeefECw/exec';
  }

  // POST uses no-cors (fire-and-forget — we don't need the response body)
  async _postScore(name, score, char) {
    const world = this.world === 1
      ? `1-${this.world1Level + 1}`
      : this.world === 2
        ? `2-${this.world2Level + 1}`
        : '3-1';
    try {
      await fetch(Game.SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ name, score, char, world, date: new Date().toLocaleDateString() }),
      });
    } catch (e) {
      console.warn('Score post failed:', e);
    }
  }

  // Persist a score to localStorage so leaderboard works even without JSONP
  _saveScoreLocally(name, score, char) {
    try {
      const key = 'eevee_scores';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      stored.push({ name, score, char });
      stored.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(stored.slice(0, 20)));
    } catch (_) {}
  }

  _loadLocalScores() {
    try {
      return JSON.parse(localStorage.getItem('eevee_scores') || '[]');
    } catch (_) { return []; }
  }

  // GET: fetch from Google Sheets (CORS), merge with localStorage, show best
  async _fetchLeaderboardJSONP() {
    const local = this._loadLocalScores();
    try {
      const res  = await fetch(`${Game.SHEETS_URL}?action=get`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const merged = [...data, ...local];
        merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const seen = new Set();
        this._cachedBoard = merged.filter(e => {
          const key = `${e.name}|${e.score}`;
          if (seen.has(key)) return false;
          seen.add(key); return true;
        }).slice(0, 20);
      }
    } catch (_) {
      // Network error or CORS block — local scores already set in constructor
    }
    this._leaderboardLoading = false;
  }

  _enterNameAndSave(isWin) {
    const name = (prompt('Enter your name for the leaderboard:', 'Player') || 'Player').slice(0, 12);
    this._cachedBoard = this._cachedBoard || [];
    this._leaderboardIsWin = isWin;
    this._leaderboardLoading = true;
    this.state = STATE.LEADERBOARD;
    // Save locally immediately so leaderboard always shows even if JSONP fails
    this._saveScoreLocally(name, this.score, this.selectedChar || 'eevee');
    // POST to Google Sheets (no-cors), then try to fetch updated board via JSONP
    this._postScore(name, this.score, this.selectedChar || 'eevee')
      .then(() => this._fetchLeaderboardJSONP());
  }

  // ----------------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------------
  update() {
    const input = this.input;

    // ESC during gameplay → pause; ESC from other non-menu states → menu
    if (input.escape) {
      if (this.state === STATE.PLAYING) {
        this.state = STATE.PAUSED; return;
      }
      if (this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING; return;
      }
      if (this.state !== STATE.MENU) {
        this.state = STATE.MENU; return;
      }
    }

    if (this.state === STATE.MENU) {
      if (input.justPressed('Enter') || input.justPressed('Space')) {
        this.state = STATE.CHAR_SELECT;
        this.charSelectIdx = 0;
      }
      return;
    }
    if (this.state === STATE.CHAR_SELECT) {
      const chars = ['eevee', 'bulbasaur', 'pichu'];
      if (input.justPressed('ArrowLeft')) this.charSelectIdx = (this.charSelectIdx + chars.length - 1) % chars.length;
      if (input.justPressed('ArrowRight')) this.charSelectIdx = (this.charSelectIdx + 1) % chars.length;
      if (input.justPressed('Enter') || input.justPressed('Space')) {
        this.selectedChar = chars[this.charSelectIdx];
        this.start();
      }
      return;
    }
    if (this.state === STATE.ENDING) {
      this._endingTimer = (this._endingTimer || 0) + 1;
      if (this._endingTimer > 60 && (input.justPressed('Enter') || input.justPressed('Space'))) {
        this._enterNameAndSave(true);
      }
      return;
    }
    if (this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
      if (input.justPressed('Enter')) {
        this._enterNameAndSave(this.state === STATE.WIN);
      }
      return;
    }
    if (this.state === STATE.LEADERBOARD) {
      if (input.justPressed('Enter') || input.justPressed('Space')) {
        this.world = 1;
        this.world1Level = 0;
        this.world2Area = 0;
        this.state = STATE.MENU;
      }
      return;
    }
    if (this.state === STATE.PLAYING && input.justPressed('KeyP')) {
      this.state = STATE.PAUSED; return;
    }
    if (this.state === STATE.PAUSED) {
      if (input.justPressed('KeyP')) { this.state = STATE.PLAYING; return; }
      if (input.justPressed('KeyM')) { this.state = STATE.MENU; return; }
      return;
    }
    if (this.state === STATE.LEVEL_SELECT) {
      if (input.justPressed('KeyP') || input.justPressed('Escape')) { this.state = STATE.PLAYING; return; }
      return;
    }

    const lvl    = this.level;
    const solids = lvl.solids;
    const p      = this.player;

    // Moving platforms: update first so solids are current, then carry player
    if (lvl.movingPlatforms) {
      for (const mp of lvl.movingPlatforms) {
        mp.update();
        // Carry player if standing on this platform
        const onTop = p.y + p.h >= mp.y - 2 && p.y + p.h <= mp.y + 8 &&
                      p.x + p.w > mp.x && p.x < mp.x + mp.w;
        if (onTop) {
          p.x += mp.velX;
          p.y += mp.velY;
        }
      }
    }

    // Breakable bricks update
    for (const s of lvl.platforms) {
      if (s.update) s.update();
    }
    lvl.platforms = lvl.platforms.filter(s => !s.dead);

    // Area 0 auto-walk: player walks right and enters pipe on contact with its left side
    let activeInput = input;
    if (this.area0AutoWalk && !p.dead) {
      const pipeX = lvl.entrancePipeX ?? 10 * TILE;
      const atPipe = p.x + p.w >= pipeX - 2;
      if (atPipe && this.areaTransTimer === 0) {
        this.area0AutoWalk = false;
        if (this.world === 1 && this.world1Level === 1 && this.world1SubArea === 0) {
          this._startWorld1AreaTransition(1); // 1-2: overworld → underground
        } else {
          this._startAreaTransition(1);       // world 2 area 0
        }
      }
      // Keep walking right until we hit the pipe
      activeInput = {
        left: false, right: !atPipe, down: false, run: false,
        jump: false, jumpPressed: false, firePressed: false,
        justPressed: () => false,
      };
    }

    const pipeBlockedInput = this._pipeEntry ? {
      left: false, right: false, down: false, run: false,
      jump: false, jumpPressed: false, firePressed: false,
      justPressed: () => false,
    } : null;
    p.update(pipeBlockedInput || activeInput, solids, this);

    this.cam.follow(p, lvl.width);

    for (const q of lvl.qblocks) q.update();

    // Pokéballs
    for (const c of lvl.coins) {
      c.update();
      if (!c.dead && !c.popping && aabb(p, c)) {
        c.dead = true;
        this.coinsCollected++;
        this.score += SCORE_POKEBALL;
        this.music.playCollect();
      }
    }
    lvl.coins = lvl.coins.filter(c => !c.dead);

    // Power-ups
    for (const pu of this.powerups) {
      pu.update(solids);
      if (!pu.dead && aabb(p, pu)) {
        pu.dead = true;
        p.powerUp(pu.kind);
        this.score += 1000;
      }
    }
    this.powerups = this.powerups.filter(pu => !pu.dead);

    // Flamethrower projectiles
    for (const fb of this.fireballs) fb.update(solids);
    this.fireballs = this.fireballs.filter(fb => !fb.dead);

    // Enemies (Ekans + Koffing + Squirtle)
    let stompedThisFrame = false;
    for (const e of lvl.enemies) {
      e.update(solids, p);
      if (e.dead && !e.dying) continue;

      // Sliding shell kills other enemies
      if (e.type === 'squirtle' && e.shellSliding && !e.dead) {
        for (const other of lvl.enemies) {
          if (other !== e && !other.dead && !other.dying && !other.inShell && aabb(e, other)) {
            other.kill();
            this.score += SCORE_STOMP;
            this._spawnScorePopup(other.x + other.w / 2, other.y, SCORE_STOMP);
          }
        }
      }

      // Fireballs don't affect shells or already-dying enemies
      if (!e.inShell && !e.dying) {
        for (const fb of this.fireballs) {
          if (!fb.dead && aabb(fb, e)) {
            fb.dead = true;
            e.kill();
            this.score += SCORE_FIRE;
            this._spawnScorePopup(e.x + e.w / 2, e.y, SCORE_FIRE);
            break;
          }
        }
      }
      if (e.dead || e.squashTimer > 0) continue;

      if (!p.dead && aabb(p, e)) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 22;
        if (stomping && e.stompable && !stompedThisFrame) {
          stompedThisFrame = true;
          p.vy = -8;
          if (e.type === 'squirtle' && e.inShell && !e.shellSliding) {
            // Stomp stationary shell from above → kick it
            const kickDir = (p.x + p.w / 2 < e.x + e.w / 2) ? 1 : -1;
            e.kickShell(kickDir);
          } else if (e.type === 'squirtle' && e.shellSliding) {
            // Stomp sliding shell → stop it, no points
            e.squash();
          } else {
            // Normal stomp: enter shell (squirtle) or flatten (others)
            e.squash();
            this.score += SCORE_STOMP;
            this._spawnScorePopup(e.x + e.w / 2, e.y, SCORE_STOMP);
          }
        } else if (!stomping) {
          if (e.type === 'squirtle' && e.inShell && !e.shellSliding) {
            // Side-kick stationary shell
            const kickDir = (p.x + p.w / 2 < e.x + e.w / 2) ? 1 : -1;
            e.kickShell(kickDir);
          } else if (!stompedThisFrame) {
            if (!e.inShell || e.shellSliding) this._hurtPlayer();
          }
        }
      }
    }
    lvl.enemies = lvl.enemies.filter(e => !e.dead || e.dying);
    lvl.enemies = lvl.enemies.filter(e => !(e.dead && e.y > 850));

    // Boss (Persian — world 3)
    const boss = lvl.boss;
    if (boss && !boss.dead) {
      boss.update(solids, p, this);
      for (const fb of this.fireballs) {
        if (!fb.dead && aabb(fb, boss) && !boss.defeated) {
          fb.dead = true;
          if (boss.takeHit()) { this.score += SCORE_BOSS; this._spawnScorePopup(boss.x + boss.w / 2, boss.y, SCORE_BOSS); }
        }
      }
      if (!p.dead && !boss.defeated && aabb(p, boss)) {
        const stomping = p.vy > 0 && (p.y + p.h) - boss.y < 30;
        if (stomping) {
          if (boss.takeHit()) { this.score += SCORE_BOSS; this._spawnScorePopup(boss.x + boss.w / 2, boss.y, SCORE_BOSS); }
          p.vy = -11;
        } else {
          this._hurtPlayer();
        }
      }
    }
    if (boss && boss.dead) { this.state = STATE.WIN; return; }

    // Castle boss (Gengar — world 1-4)
    const castleBoss = lvl.castleBoss;
    if (castleBoss && !castleBoss.dead) {
      castleBoss.update(solids, p, this);
      castleBoss.updateBridge();
      // 5 fireballs defeat the boss (same as original SMB1 Bowser)
      for (const fb of this.fireballs) {
        if (!fb.dead && aabb(fb, castleBoss) && !castleBoss.defeated) {
          fb.dead = true;
          if (castleBoss.takeHit()) {
            this.score += SCORE_BOSS;
            this._spawnScorePopup(castleBoss.x + castleBoss.w / 2, castleBoss.y, SCORE_BOSS);
          }
        }
      }
      // Remove bridge from solids only when axe was used (not fireball kill)
      if (castleBoss.bridgeCollapsing && castleBoss.bridgeDestroyed && !this._bridgeRemoved) {
        this._bridgeRemoved = true;
        lvl.platforms = lvl.platforms.filter(pl => !pl.isBossBridge);
      }
      // Boss hurts player on contact but is NOT stompable
      if (!p.dead && !castleBoss.defeated && aabb(p, castleBoss)) {
        this._hurtPlayer();
      }
      // Boss dead → player auto-walks to Pikachu
      if (castleBoss.dead && !this._castleBossComplete) {
        this._castleBossComplete = true;
        this.music.stop();
        this._playEndJingle();
        // Walk to pikachuX or a fixed spot right of the bridge
        const destX = (lvl.pikachuX ?? castleBoss.x + 400) + 60;
        this.pcEnterX = destX;
        p.walkToPC = true;
        this.walkToPC = true;
      }
    }
    // Axe — touching it collapses the bridge and drops the boss into lava
    const bossAxe = lvl.bossAxe;
    if (bossAxe && !bossAxe.taken) {
      bossAxe.update();
      if (!p.dead && aabb(p, bossAxe)) {
        bossAxe.taken = true;
        if (castleBoss && !castleBoss.defeated) {
          castleBoss.defeatByAxe(lvl.bossBridgeX, lvl.bossBridgeW, lvl.bossBridgeY);
          this.score += SCORE_BOSS * 2;
          this._spawnScorePopup(castleBoss.x + castleBoss.w / 2, castleBoss.y, SCORE_BOSS * 2);
        }
      }
    }

    // Fire bars
    for (const fb of (lvl.fireBars || [])) {
      fb.update();
      if (!p.dead) {
        for (const ball of fb.getBalls()) {
          if (aabb(p, ball)) { this._hurtPlayer(); break; }
        }
      }
    }

    // Pipe plants (Victreebel)
    for (const pl of lvl.plants || []) {
      pl.update();
      for (const fb of this.fireballs) {
        if (!fb.dead && pl.isVisible() && aabb(fb, pl)) {
          fb.dead = true;
          pl.kill();
          this.score += 200;
        }
      }
      if (pl.isVisible() && !pl.dead && !p.dead && aabb(p, pl)) {
        // Don't hurt if player is standing on top of the pipe (original SMB edge behavior)
        // Only immune if standing directly ON the pipe cap top surface
        const onPipeTop = Math.abs((p.y + p.h) - pl.pipeTopY) <= 3
          && p.x + p.w > pl.pipeX + 4
          && p.x < pl.pipeX + TILE * 2 - 4;
        if (!onPipeTop) this._hurtPlayer();
      }
    }
    if (lvl.plants) lvl.plants = lvl.plants.filter(pl => !pl.dead);

    // Pipe entry animation tick (vertical or horizontal)
    if (this._pipeEntry) {
      const pe = this._pipeEntry;
      p.vx = pe.dx;
      p.vy = 0;
      p.x += pe.dx;
      p.y += pe.dy;
      pe.timer--;
      if (pe.timer <= 0) {
        pe.callback();
        this._pipeEntry = null;
      }
      // Skip normal physics/input this frame
    }

    // Pipe entry / exit — player presses DOWN on enterable pipe
    if (!this._pipeEntry && input.down && p.onGround && this.areaTransTimer === 0) {
      for (const pl of lvl.platforms) {
        if (pl.enterable && !pl.isExit) {
          if (p.x + p.w > pl.x && p.x < pl.x + pl.w &&
              Math.abs((p.y + p.h) - pl.y) < 8) {
            // Vertical pipe: center player in pipe, then slide downward
            p.vx = 0;
            p.x = pl.x + (pl.w - p.w) / 2; // center in pipe
            const callback = () => {
              if (this.world === 2 && pl.leadsToArea !== undefined) {
                this._startWorld2SubAreaTransition(pl.leadsToArea);
              } else if (this.world === 1) {
                this._handleWorld1PipeEntry(pl);
              }
            };
            this._pipeEntry = { timer: 28, dx: 0, dy: 2.5, pipe: pl, callback };
            break;
          }
        }
        if (pl.isExit) {
          if (p.x + p.w > pl.x && p.x < pl.x + pl.w &&
              Math.abs((p.y + p.h) - pl.y) < 8 && input.down) {
            p.x = pl.exitX;
            p.y = GROUND_Y - p.h - 5;
            this.cam.x = Math.max(0, pl.exitX - 200);
            this._showMsg('BACK ON TRACK!', 90);
            break;
          }
        }
      }
    }

    // Horizontal pipe exits — player walks rightward into the pipe zone
    if (!this._pipeEntry && lvl.hPipeExits && lvl.hPipeExits.length > 0 && this.areaTransTimer === 0 && !p.dead) {
      for (const hp of lvl.hPipeExits) {
        if (p.x + p.w >= hp.x && p.x < hp.x + TILE * 2 &&
            p.y + p.h > hp.y - TILE * 2 && p.y < hp.y + TILE * 2 &&
            p.vx > 0) {
          // Horizontal: slide player rightward into pipe before transitioning
          const tid = hp.transportId;
          this._pipeEntry = { timer: 22, dx: 2.5, dy: 0, hPipe: hp, callback: () => {
            if (this.world === 1) { this._handleWorld1PipeEntry({ transportId: tid }); }
            else if (this.world === 2) { this._handleWorld2PipeEntry({ transportId: tid }); }
          } };
          break;
        }
      }
    }

    // Area transition fade
    if (this.areaTransTimer > 0) {
      this.areaTransTimer--;
      if (this.areaTransTimer === 0) {
        if (this._pendingWorld1SubArea >= 0) {
          this._doWorld1AreaTransition(this._pendingWorld1SubArea);
          this._pendingWorld1SubArea = -1;
        } else if (this._pendingWorld2SubArea >= 0) {
          this._doWorld2SubAreaTransition(this._pendingWorld2SubArea);
          this._pendingWorld2SubArea = -1;
        } else if (this._pendingArea >= 0) {
          this._doAreaTransition(this._pendingArea);
          this._pendingArea = -1;
        }
      }
    }

    // Boss shots
    for (const bs of this.bossShots) {
      bs.update();
      if (!bs.dead && !p.dead && aabb(p, bs)) { bs.dead = true; this._hurtPlayer(); }
    }
    this.bossShots = this.bossShots.filter(bs => !bs.dead);

    // Flag pole — touch → slide → WIN
    const fp = this.level.flagPole;
    if (fp) {
      fp.update(p);
      if (fp.touched && !p.poleSliding && !p.dead && this.worldClearTimer === 0) {
        p.poleSliding = true;
        p.x = fp.x + 2;
        p.vx = 0;
        p.vy = 2;
      }
      if (p.poleSliding) {
        p.vy = Math.min(p.vy + 0.15, 4);
        p.y += p.vy;
        p.x = fp.x + 2;
        if (p.y + p.h >= GROUND_Y) {
          p.y = GROUND_Y - p.h;
          p.poleSliding = false;
          if (!this.walkToPC && this.worldClearTimer === 0 && this.walkToPCTimer === 0) {
            const buildingX = this.level.pokeShopX ?? this.level.pokeCenterX ?? 6400;
            this.pcEnterX = buildingX + 100; // door center
            p.walkToPC = true;
            this.walkToPC = true;
            this.music.stop();
            this._playEndJingle();
          }
        }
      }
    }
    if (p.walkToPC) {
      p.vx = 2;
      p.x += p.vx;
      p.vy = 0;
      // Camera must follow during end-walk (no level-width cap)
      this.cam.x = p.x - CANVAS_WIDTH * 0.4;
      if (this.cam.x < 0) this.cam.x = 0;
      if (p.x > this.pcEnterX || input.justPressed('Enter')) {
        p.walkToPC = false;
        this.walkToPC = false;
        this.walkToPCTimer = 180;
      }
      return;
    }
    if (this.walkToPCTimer > 0) {
      this.walkToPCTimer--;
      if (this.walkToPCTimer === 0 || input.justPressed('Enter')) {
        this.walkToPCTimer = 0;
        if (this.world === 1 && this.world1Level < 3) {
          // Advance to next sub-level within world 1
          this.world1Level++;
          this.world1SubArea = 0;
          this.resetLevel(false);
          this.music.start();
        } else if (this.world === 1 && this.world1Level === 3) {
          // All of world 1 done — show Pikachu ending
          this._endingTimer = 0;
          this.state = STATE.ENDING;
          return;
        } else if (this.world === 2) {
          if (this.world2Level < 3) {
            this.world2Level++;
            this.world2SubArea = 0;
            this.resetLevel(false);
            this.music.start();
          } else {
            this.world = 3;
            this.resetLevel(false);
            this.music.start();
          }
        } else if (this.world === 3) {
          this.state = STATE.WIN;
        } else {
          this.state = STATE.WIN;
        }
      }
      return;
    }
    if (this.worldClearTimer > 0) {
      this.worldClearTimer--;
      if (this.worldClearTimer === 0) {
        this._enterNameAndSave(true);
      }
      return;
    }

    // Update score popups
    for (const sp of this.scorePopups) { sp.y += sp.vy; sp.life--; }
    this.scorePopups = this.scorePopups.filter(sp => sp.life > 0);
    this._lavaAnim = (this._lavaAnim || 0) + 1;

    if (p.dead && p.deathTimer <= 0) this._loseLife();
  }

  _hurtPlayer() { this.player.takeDamage(); }

  _showMsg(text, frames) {
    this._msg = { text, frames };
  }

  _startAreaTransition(toArea) {
    this._pendingArea = toArea;
    this.areaTransTimer = 40;
  }

  _startWorld2SubAreaTransition(subArea) {
    this._pendingWorld2SubArea = subArea;
    this.areaTransTimer = 40;
  }

  _handleWorld2PipeEntry(pipe) {
    const tid = pipe.transportId;
    const lvl = this.world2Level;
    if (lvl === 0) {
      // 2-1: transport 4 → underground
      this._startWorld2SubAreaTransition(1);
    } else if (lvl === 1) {
      // 2-2: transport 1 → underwater, transport 2 → exit
      if (tid === 1) this._startWorld2SubAreaTransition(1);
      else if (tid === 2) this._startWorld2SubAreaTransition(2);
    }
  }

  _doWorld2SubAreaTransition(subArea) {
    const prevPower = this.player.power;
    this.world2SubArea = subArea;
    this.level = buildWorld2(this.world2Level, subArea);
    this.r.currentSetting = this.level.setting || 'overworld';

    let spawnX = 80;
    if (subArea === 0 && this.level.exitOverworldX) spawnX = this.level.exitOverworldX;

    this.player = new Player(spawnX, GROUND_Y - 60);
    this.player.power = prevPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x = Math.max(0, spawnX - 200);
    this.fireballs = []; this.bossShots = []; this.powerups = [];
    this._pipeEntry = null;
    this._castleBossComplete = false;
    this._bridgeRemoved = false;
    this._catchCamLock = false;
    this._debris = [];
    this.area0AutoWalk = !!this.level.entrancePipeX;
  }

  _handleWorld1PipeEntry(pipe) {
    const lvl = this.level;
    // Pipe with transportId: N means "go to FSM area N" (0-indexed, or N=2 → area 1 for 1-1)
    if (pipe.transportId != null) {
      if (this.world1Level === 0) {
        // 1-1: transport:2 → underground (area 1); transport:1 → overworld exit near x:5216
        if (pipe.transportId === 2) this._startWorld1AreaTransition(1);
        else if (pipe.transportId === 1) this._startWorld1AreaTransition(0); // exit underground
      } else if (this.world1Level === 1) {
        // 1-2:
        //   transport:1 → area 1 underground (auto-walk pipe, handled by area0AutoWalk)
        //   transport:4 → overworld exit (subArea 2 = FSM area 3)
        if (pipe.transportId === 4) this._startWorld1AreaTransition(2);
        else if (this.world1SubArea === 1) this._startWorld1AreaTransition(2);
      }
    } else if (pipe.leadsToArea !== undefined) {
      this._startAreaTransition(pipe.leadsToArea);
    } else if (this.world1Level === 1) {
      // Plain enterable pipe in 1-2
      if (this.world1SubArea === 0) this._startWorld1AreaTransition(1);
      else if (this.world1SubArea === 1) this._startWorld1AreaTransition(2);
    }
  }

  _startWorld1AreaTransition(toSubArea) {
    this._pendingWorld1SubArea = toSubArea;
    this.areaTransTimer = 40;
  }

  _doWorld1AreaTransition(toSubArea) {
    const savedPower = this.player ? this.player.power : POWER.SMALL;
    const prevSubArea = this.world1SubArea;
    this.world1SubArea = toSubArea;
    this.level = buildWorld1(this.world1Level, toSubArea);
    this.r.currentSetting = this.level.setting || 'overworld';

    // Determine spawn X: if returning to overworld from underground, use exitOverworldX
    let spawnX = 80;
    if (toSubArea === 0 && this.level.exitOverworldX) {
      spawnX = this.level.exitOverworldX;
    }
    this.player = new Player(spawnX, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x = Math.max(0, spawnX - 200);
    this.fireballs = []; this.bossShots = []; this.powerups = []; this._castleBossComplete = false; this._bridgeRemoved = false; this._catchCamLock = false; this._pipeEntry = null;
    this._debris = [];
  }

  _doAreaTransition(toArea) {
    const savedPower = this.player ? this.player.power : POWER.SMALL;
    this.world2Area = toArea;
    this.area0AutoWalk = false;
    this.level = buildWorld2(toArea);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x = 0;
    this.fireballs = []; this.bossShots = []; this.powerups = []; this._castleBossComplete = false; this._bridgeRemoved = false; this._catchCamLock = false; this._pipeEntry = null;
    this._debris = [];
  }

  _loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = STATE.GAME_OVER;
      this.music.stop();
    } else {
      // On death, reset power to SMALL
      this.resetLevel(false, true);
    }
  }

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  render() {
    const r   = this.r;
    const ctx = this.ctx;
    r.clear();
    r.drawBackground(this.cam.x);

    if (this.state === STATE.MENU) { this._drawMenu(); return; }
    if (this.state === STATE.CHAR_SELECT) { this._drawCharSelect(); return; }
    if (this.state === STATE.LEADERBOARD) { this._drawLeaderboard(); return; }
    if (this.state === STATE.ENDING) { this._drawEnding(); return; }

    const lvl = this.level;
    // Draw horizontal pipe piece connecting to entrance pipe in area 0
    if (lvl.entrancePipeX !== undefined) {
      const ctx2 = this.ctx;
      const hpx = Math.floor(lvl.entrancePipeX - this.cam.x);
      const hpy = Math.floor(GROUND_Y - TILE * 1.5);
      const hpw = TILE * 1.5;
      const hph = TILE * 1.5;
      ctx2.fillStyle = '#2ecc40';
      ctx2.fillRect(hpx - hpw, hpy, hpw, hph);
      ctx2.fillStyle = '#27ae35';
      ctx2.fillRect(hpx - hpw, hpy, hpw, 6);
      ctx2.fillRect(hpx - hpw, hpy + hph - 6, hpw, 6);
      ctx2.fillStyle = '#1a7a28';
      ctx2.fillRect(hpx - 4, hpy - 4, 8, hph + 8); // joint between H and V pipe
    }
    // Draw castle small buildings (appear behind platforms)
    for (const cs of (lvl.castleSmalls || [])) {
      this._drawCastleSmall(r.ctx, Math.floor(cs.x - this.cam.x), cs.y);
    }
    for (const pl of lvl.platforms)  pl.draw(r, this.cam);
    if (lvl.movingPlatforms) for (const mp of lvl.movingPlatforms) mp.draw(r, this.cam);
    for (const q  of lvl.qblocks)    q.draw(r, this.cam);
    // Brick debris particles
    if (this._debris) {
      const ctx = r.ctx;
      this._debris = this._debris.filter(d => d.life > 0);
      for (const d of this._debris) {
        d.x += d.vx; d.y += d.vy; d.vy += 0.4; d.life--;
        ctx.globalAlpha = d.life / 40;
        ctx.fillStyle = '#b5651d';
        ctx.fillRect(Math.floor(d.x - this.cam.x), Math.floor(d.y), 10, 10);
        ctx.globalAlpha = 1;
      }
    }
    for (const c  of lvl.coins)      c.draw(r, this.cam);
    for (const pu of this.powerups)  pu.draw(r, this.cam);
    for (const e  of lvl.enemies)    e.draw(r, this.cam);
    for (const pl of lvl.plants || []) pl.draw(r, this.cam);
    if (lvl.boss && !lvl.boss.dead)  lvl.boss.draw(r, this.cam);
    // Lava under the bridge area
    if (lvl.bossBridgeX != null) {
      const ctx2 = this.ctx;
      const lx = Math.floor(lvl.bossBridgeX - this.cam.x);
      const lw = lvl.bossBridgeW;
      const lavaTop = (lvl.bossBridgeY ?? GROUND_Y) + TILE;
      // Lava fill
      ctx2.fillStyle = '#cc2200';
      ctx2.fillRect(lx, lavaTop, lw, CANVAS_HEIGHT - lavaTop);
      // Lava surface wave
      ctx2.fillStyle = '#ff4400';
      for (let i = 0; i < Math.ceil(lw / TILE); i++) {
        const wx = lx + i * TILE;
        const wave = Math.sin((wx + this._lavaAnim * 2) * 0.04) * 4;
        ctx2.beginPath();
        ctx2.moveTo(wx, lavaTop + wave);
        ctx2.lineTo(wx + TILE / 2, lavaTop - 6 + wave);
        ctx2.lineTo(wx + TILE, lavaTop + wave);
        ctx2.fill();
      }
      // Draw bridge planks (isBossBridge platform)
      for (const pl of lvl.platforms) {
        if (!pl.isBossBridge) continue;
        const bx = Math.floor(pl.x - this.cam.x);
        const ctx3 = this.ctx;
        for (let i = 0; i < Math.ceil(pl.w / TILE); i++) {
          const px = bx + i * TILE;
          ctx3.fillStyle = '#8b6914';
          ctx3.fillRect(px + 1, Math.floor(pl.y), TILE - 2, TILE / 3);
          ctx3.fillStyle = '#a07820';
          ctx3.fillRect(px + 3, Math.floor(pl.y) + 2, TILE - 6, 4);
          ctx3.strokeStyle = '#5a4010'; ctx3.lineWidth = 1;
          ctx3.strokeRect(px + 1, Math.floor(pl.y), TILE - 2, TILE / 3);
        }
      }
    }
    if (lvl.castleBoss) lvl.castleBoss.draw(r, this.cam);
    if (lvl.bossAxe && !lvl.bossAxe.taken) lvl.bossAxe.draw(r, this.cam);
    // Pikachu waiting at end of castle (same scale as player ~40px tall)
    if (lvl.pikachuX != null) {
      const pikX = Math.floor(lvl.pikachuX - this.cam.x);
      const pikY = (lvl.bossBridgeY ?? GROUND_Y) - 4;
      this._drawPikachu(this.ctx, pikX, pikY, 0.3);
    }
    for (const bar of (lvl.fireBars || [])) bar.draw(r, this.cam);
    for (const fb of this.fireballs) fb.draw(r, this.cam);
    for (const bs of this.bossShots) bs.draw(r, this.cam);
    // Score popups
    for (const sp of this.scorePopups) {
      const ctx2 = this.ctx;
      ctx2.save();
      ctx2.globalAlpha = sp.life / 50;
      ctx2.font = 'bold 14px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.strokeStyle = '#000';
      ctx2.lineWidth = 3;
      ctx2.strokeText('+' + sp.score, Math.floor(sp.x - this.cam.x), Math.floor(sp.y));
      ctx2.fillStyle = '#fff';
      ctx2.fillText('+' + sp.score, Math.floor(sp.x - this.cam.x), Math.floor(sp.y));
      ctx2.textAlign = 'left';
      ctx2.restore();
    }
    // Draw horizontal pipe exit sections — opening (cap) on LEFT, body extends RIGHT to vertical pipe
    for (const hp of (lvl.hPipeExits || [])) {
      this._drawHPipeCap(hp);
    }
    if (lvl.flagPole)                lvl.flagPole.draw(r, this.cam);
    if (lvl.pokeShopX != null)   this._drawPokeShopBuilding(lvl.pokeShopX);
    else if (lvl.pokeCenterX != null) this._drawPokeCenterBuilding(lvl.pokeCenterX);
    this.player.draw(r, this.cam);

    // During pipe entry, redraw the pipe cap on top of the player so they appear to sink in
    if (this._pipeEntry?.pipe) {
      this._pipeEntry.pipe.draw(r, this.cam);
    }
    // During horizontal pipe entry, redraw cap over the player so player disappears inside
    if (this._pipeEntry?.hPipe) {
      this._drawHPipeCap(this._pipeEntry.hPipe);
    }

    this._drawHUD();

    // On-screen message overlay
    if (this._msg && this._msg.frames > 0) {
      this._msg.frames--;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, CANVAS_HEIGHT / 2 - 44, CANVAS_WIDTH, 60);
      ctx.fillStyle = '#ffd23b';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._msg.text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    if (this.worldClearTimer > 0)    this._drawWorldClear();
    if (this.walkToPCTimer > 0)      this._drawScoreTally();
    if (this.state === STATE.PAUSED)    this._drawPauseMenu();
    if (this.state === STATE.GAME_OVER) this._overlay('GAME OVER', 'Press ENTER to save score');
    if (this.state === STATE.WIN)       this._drawWin();
    if (this.state === STATE.LEVEL_SELECT) this._drawLevelSelect();

    // Area transition fade
    if (this.areaTransTimer > 0) {
      const alpha = 1 - this.areaTransTimer / 40;
      this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  _drawCharSelect() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a0830';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137.5) % CANVAS_WIDTH;
      const sy = (i * 97.3) % (CANVAS_HEIGHT * 0.55);
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 34px monospace';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText('CHOOSE YOUR PARTNER!', CANVAS_WIDTH / 2, 70);
    ctx.fillText('CHOOSE YOUR PARTNER!', CANVAS_WIDTH / 2, 70);

    const chars = [
      { name: 'EEVEE',     evolves: 'UMBREON / FLAREON',   color: '#c8864a' },
      { name: 'BULBASAUR', evolves: 'IVYSAUR / VENUSAUR',  color: '#68a858' },
      { name: 'PICHU',     evolves: 'PIKACHU / RAICHU',    color: '#f8d030' },
    ];
    const boxW = 170, boxH = 230, spacing = 190;
    const startX = CANVAS_WIDTH / 2 - spacing * 1;

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const bx = startX + i * spacing - boxW / 2;
      const by = 100;
      const selected = this.charSelectIdx === i;
      ctx.fillStyle = selected ? 'rgba(255,210,59,0.2)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = selected ? '#ffd23b' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(bx, by, boxW, boxH);
      const pcx = bx + boxW / 2, pcy = by + 100;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(pcx, pcy, 36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(c.name[0], pcx, pcy + 11);
      ctx.fillStyle = selected ? '#ffd23b' : '#ffffff';
      ctx.font = `bold ${selected ? 15 : 13}px monospace`;
      ctx.fillText(c.name, bx + boxW / 2, by + boxH - 58);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px monospace';
      ctx.fillText(c.evolves, bx + boxW / 2, by + boxH - 38);
      if (selected) {
        ctx.fillStyle = '#ffd23b';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('▼', bx + boxW / 2, by - 12);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '16px monospace';
    ctx.fillText('← → to choose   ENTER to confirm', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.textAlign = 'left';
  }

  _drawHUD() {
    const ctx = this.ctx;
    // Heart lives
    for (let i = 0; i < 3; i++) this._heart(24 + i * 34, 28, i < this.lives);

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';

    const sTxt = 'SCORE ' + String(this.score).padStart(6, '0');
    ctx.strokeText(sTxt, CANVAS_WIDTH - 234, 36);
    ctx.fillText(sTxt,   CANVAS_WIDTH - 234, 36);

    ctx.font = 'bold 20px monospace';
    ctx.strokeText('BALLS ' + this.coinsCollected, CANVAS_WIDTH - 234, 62);
    ctx.fillText('BALLS ' + this.coinsCollected,   CANVAS_WIDTH - 234, 62);

    const pw    = this.player.power;
    const charNames = {
      eevee:      ['EEVEE', 'UMBREON', 'FLAREON'],
      charmander: ['CHARMANDER', 'CHARMELEON', 'CHARIZARD'],
      bulbasaur:  ['BULBASAUR', 'IVYSAUR', 'VENUSAUR'],
      piplup:     ['PIPLUP', 'PRINPLUP', 'EMPOLEON'],
      pichu:      ['PICHU', 'PIKACHU', 'RAICHU'],
    };
    const charColors = {
      eevee:      ['#fff', '#f0c040', '#ff6600'],
      charmander: ['#f07840', '#e05528', '#cc3300'],
      bulbasaur:  ['#88c878', '#5a9850', '#2a9030'],
      piplup:     ['#60a8e8', '#2860c8', '#0a1840'],
      pichu:      ['#f8e470', '#f8d030', '#e07820'],
    };
    const char = this.player.char || 'eevee';
    const label = (charNames[char] || charNames.eevee)[pw];
    ctx.fillStyle = (charColors[char] || charColors.eevee)[pw];
    ctx.strokeText(label, 24, 64);
    ctx.fillText(label,   24, 64);

    // World / level / area debug label
    let worldLabel;
    if (this.world === 1)      worldLabel = `1-${this.world1Level + 1}`;
    else if (this.world === 2) worldLabel = `2-${this.world2Level + 1}`;
    else                       worldLabel = '3-1';
    const areaIdx = this.level ? (this.level.areaIndex ?? this.world2Area ?? 0) : 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.strokeText(`WORLD ${worldLabel}  AREA ${areaIdx}`, CANVAS_WIDTH - 234, 88);
    ctx.fillText(`WORLD ${worldLabel}  AREA ${areaIdx}`,   CANVAS_WIDTH - 234, 88);

    // LEVELS button (top-left, below char name)
    const bx = 14, by = 76, bw = 76, bh = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVELS', bx + bw / 2, by + 15);
    ctx.textAlign = 'left';
    this._levelsBtnRect = { x: bx, y: by, w: bw, h: bh };
  }

  _heart(x, y, full) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle   = full ? '#e23636' : 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-12, -8, -12, 8, 0, 14);
    ctx.bezierCurveTo(12, 8, 12, -8, 0, 4);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _drawWorldClear() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 52px monospace';
    ctx.fillText('GOAL!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('Score: ' + this.score, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    ctx.textAlign = 'left';
  }

  handleClick(mx, my) {
    // LEVELS button in HUD
    const btn = this._levelsBtnRect;
    if (btn && this.state === STATE.PLAYING &&
        mx >= btn.x && mx < btn.x + btn.w && my >= btn.y && my < btn.y + btn.h) {
      this.state = STATE.LEVEL_SELECT;
      return;
    }
    // Level select overlay buttons
    if (this.state === STATE.LEVEL_SELECT && this._levelSelectBtns) {
      for (const b of this._levelSelectBtns) {
        if (mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h) {
          this._jumpToLevel(b.world, b.level, b.sub ?? 0);
          this.state = STATE.PLAYING;
          return;
        }
      }
    }
  }

  _jumpToLevel(world, level, sub = 0) {
    const savedPower = this.player ? this.player.power : POWER.SMALL;
    this.world = world;
    this.world1Level = level;
    this.world1SubArea = sub;
    this.world2Area = level;
    this.world2Level = level;
    this.world2SubArea = 0;
    this.level = world === 2 ? buildWorld2(level, 0)
               : world === 1 ? buildWorld1(level, sub)
               : buildWorld3();
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x = 0;
    this.fireballs = []; this.bossShots = []; this.powerups = []; this._castleBossComplete = false; this._bridgeRemoved = false; this._catchCamLock = false; this._pipeEntry = null;
    this._debris = []; this.scorePopups = [];
    this.area0AutoWalk = (world === 2 && !!this.level?.entrancePipeX)
                      || (world === 1 && level === 1 && sub === 0);
  }

  _drawLevelSelect() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL SELECT', CANVAS_WIDTH / 2, 60);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Click a level  |  P or ESC to close', CANVAS_WIDTH / 2, 88);

    const levels = [
      { label: '1-1', world: 1, level: 0, sub: 0 },
      { label: '1-2a', world: 1, level: 1, sub: 0 },
      { label: '1-2b', world: 1, level: 1, sub: 1 },
      { label: '1-2c', world: 1, level: 1, sub: 2 },
      { label: '1-3', world: 1, level: 2, sub: 0 },
      { label: '1-4', world: 1, level: 3, sub: 0 },
      { label: '2-1', world: 2, level: 0 },
      { label: '2-2', world: 2, level: 1 },
      { label: '2-3', world: 2, level: 2 },
      { label: '2-4', world: 2, level: 3 },
    ];
    const cols = 4, bw = 140, bh = 48, gx = 30, gy = 130;
    const gap = 20;
    this._levelSelectBtns = [];
    levels.forEach((lv, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = gx + col * (bw + gap);
      const by = gy + row * (bh + gap);
      this._levelSelectBtns.push({ ...lv, x: bx, y: by, w: bw, h: bh });
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lv.label, bx + bw / 2, by + bh / 2 + 7);
    });
    ctx.textAlign = 'left';
  }

  _drawPauseMenu() {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px monospace';
    ctx.fillText('PAUZA', cx, cy - 40);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('ESC / P  →  wróć do gry', cx, cy + 16);
    ctx.fillStyle = '#ff8888';
    ctx.fillText('M  →  wyjdź do menu', cx, cy + 50);
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SCORE ' + this.score, cx, cy + 90);
    ctx.textAlign = 'left';
  }

  _overlay(title, sub) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px monospace';
    ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.font = 'bold 22px monospace';
    ctx.fillText(sub, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillText('SCORE ' + this.score, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 74);
    ctx.textAlign = 'left';
  }

  _drawWin() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,5,40,0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 58px monospace';
    ctx.fillText("EEVEE WINS!", CANVAS_WIDTH / 2, 190);

    ctx.fillStyle = '#a9e0ff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('Giovanni is defeated!', CANVAS_WIDTH / 2, 258);

    ctx.fillStyle = '#fff';
    ctx.fillText('Final Score: ' + this.score, CANVAS_WIDTH / 2, 308);
    ctx.fillText('Pokeballs: ' + this.coinsCollected, CANVAS_WIDTH / 2, 346);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#b0e0ff';
    ctx.fillText('Press ENTER to play again', CANVAS_WIDTH / 2, 420);
    ctx.textAlign = 'left';
  }

  _drawHPipeCap(hp) {
    const ctx2 = this.ctx;
    const BODY_H = TILE * 2;
    const CAP_H  = BODY_H + 10;
    const CAP_W  = TILE;
    const BODY_W = TILE * 2;
    const HOLE_W = 10;  // dark tunnel opening on the left face

    const openX   = Math.floor(hp.x - this.cam.x);
    const bodyTop = Math.floor(hp.y);
    const capTop  = bodyTop - Math.floor((CAP_H - BODY_H) / 2);

    // Body (extends right from cap)
    ctx2.fillStyle = '#186018';
    ctx2.fillRect(openX + CAP_W, bodyTop, BODY_W, BODY_H);
    ctx2.fillStyle = '#1e7a1e';
    ctx2.fillRect(openX + CAP_W, bodyTop + 3, BODY_W, 6);
    ctx2.fillStyle = '#0f4010';
    ctx2.fillRect(openX + CAP_W, bodyTop + BODY_H - 7, BODY_W, 5);
    ctx2.fillStyle = '#0f4010';
    ctx2.fillRect(openX + CAP_W + BODY_W - 5, bodyTop, 5, BODY_H);

    // Cap rim
    ctx2.fillStyle = '#2a9e2a';
    ctx2.fillRect(openX, capTop, CAP_W, CAP_H);
    ctx2.fillStyle = '#3ab83a';
    ctx2.fillRect(openX, capTop + 3, CAP_W, 6);
    ctx2.fillStyle = '#186018';
    ctx2.fillRect(openX, capTop + CAP_H - 7, CAP_W, 5);

    // Dark tunnel opening on the right face of the cap (where player enters)
    ctx2.fillStyle = '#071a07';
    ctx2.fillRect(openX + CAP_W - HOLE_W, bodyTop + 2, HOLE_W, BODY_H - 4);

    ctx2.strokeStyle = '#0a2e0a'; ctx2.lineWidth = 1.5;
    ctx2.strokeRect(openX, capTop, CAP_W, CAP_H);
    ctx2.strokeRect(openX + CAP_W, bodyTop, BODY_W, BODY_H);
    ctx2.lineWidth = 1;
  }

  _drawPokeCenterBuilding(worldX) {
    const ctx = this.ctx;
    const x = Math.floor(worldX - this.cam.x);
    const bottomY = GROUND_Y;
    const W = 280, totalH = 200;
    const wallH = 110;

    // White main building
    ctx.fillStyle = '#e8eaeb';
    ctx.fillRect(x, bottomY - wallH, W, wallH);

    // Gray side trim
    ctx.fillStyle = '#b0b5ba';
    ctx.fillRect(x, bottomY - wallH, 25, wallH);
    ctx.fillRect(x + W - 25, bottomY - wallH, 25, wallH);

    // Blue side windows (tall)
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + 4, bottomY - wallH + 14, 17, 53);
    ctx.fillRect(x + W - 21, bottomY - wallH + 14, 17, 53);

    // Central Pokéball logo
    const pcx = x + W / 2, pcy = bottomY - 70;
    const pr = 39;
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(pcx - pr, pcy - 5, pr * 2, 10);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.stroke();

    // P.C text
    ctx.fillStyle = '#cc2222';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('P.C', x + 32, bottomY - 18);

    // Blue entrance door
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + W / 2 - 28, bottomY - 49, 56, 49);
    ctx.strokeStyle = '#2a5a80'; ctx.lineWidth = 2;
    ctx.strokeRect(x + W / 2 - 28, bottomY - 49, 56, 49);

    // Red dome roof
    ctx.fillStyle = '#d44000';
    ctx.beginPath();
    ctx.moveTo(x - 14, bottomY - wallH);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 9, x + W + 14, bottomY - wallH);
    ctx.closePath(); ctx.fill();

    // Darker red border on roof bottom
    ctx.fillStyle = '#a83000';
    ctx.fillRect(x - 14, bottomY - wallH, W + 28, 14);

    // Roof grid texture
    ctx.strokeStyle = 'rgba(160,60,0,0.35)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const tx = x + (W / 10) * i;
      ctx.beginPath();
      ctx.moveTo(tx, bottomY - wallH);
      ctx.lineTo(x + W / 2, bottomY - totalH - 9);
      ctx.stroke();
    }
  }

  _drawPokeShopBuilding(worldX) {
    const ctx = this.ctx;
    const x = Math.floor(worldX - this.cam.x);
    const bottomY = GROUND_Y;
    const W = 280, totalH = 200, wallH = 110;

    // White main building
    ctx.fillStyle = '#e8eaeb';
    ctx.fillRect(x, bottomY - wallH, W, wallH);

    // Blue-gray side trim
    ctx.fillStyle = '#7a9ab5';
    ctx.fillRect(x, bottomY - wallH, 25, wallH);
    ctx.fillRect(x + W - 25, bottomY - wallH, 25, wallH);

    // Stripe windows
    ctx.fillStyle = '#a8c8e8';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + 4, bottomY - wallH + 14 + i * 6, 17, 4);
      ctx.fillRect(x + W - 21, bottomY - wallH + 14 + i * 6, 17, 4);
    }

    // Central Great Ball logo (blue/white)
    const pcx = x + W / 2, pcy = bottomY - 70;
    const pr = 39;
    ctx.fillStyle = '#3a7abf';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(pcx - pr, pcy - 5, pr * 2, 10);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.stroke();

    // SHOP text
    ctx.fillStyle = '#3a7abf';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SHOP', x + 28, bottomY - 18);

    // Door (teal/blue)
    ctx.fillStyle = '#4ab8c0';
    ctx.fillRect(x + W / 2 - 28, bottomY - 49, 56, 49);
    ctx.strokeStyle = '#1a6870'; ctx.lineWidth = 2;
    ctx.strokeRect(x + W / 2 - 28, bottomY - 49, 56, 49);

    // Blue dome roof
    ctx.fillStyle = '#3a7abf';
    ctx.beginPath();
    ctx.moveTo(x - 14, bottomY - wallH);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 9, x + W + 14, bottomY - wallH);
    ctx.closePath(); ctx.fill();

    // Darker blue roof border
    ctx.fillStyle = '#1a4a8f';
    ctx.fillRect(x - 14, bottomY - wallH, W + 28, 14);

    // Roof grid texture
    ctx.strokeStyle = 'rgba(30,70,160,0.3)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const tx = x + (W / 10) * i;
      ctx.beginPath();
      ctx.moveTo(tx, bottomY - wallH);
      ctx.lineTo(x + W / 2, bottomY - totalH - 9);
      ctx.stroke();
    }
  }

  _drawScoreTally() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('COURSE CLEAR!', CANVAS_WIDTH / 2, 180);
    const progress = 1 - this.walkToPCTimer / 180;
    const shownScore = Math.floor(this.score * progress);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('SCORE', CANVAS_WIDTH / 2, 260);
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(String(shownScore).padStart(7, '0'), CANVAS_WIDTH / 2, 305);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`POKÉBALLS  ×${this.coinsCollected}`, CANVAS_WIDTH / 2, 360);
    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText('Press ENTER to continue', CANVAS_WIDTH / 2, 440);
    ctx.textAlign = 'left';
  }

  _drawCastleSmall(ctx, sx, groundY) {
    // Pokémon Shop — pixel-art style blue octagonal building with Pokéball logo and SHOP sign
    const T = TILE;
    const W = T * 4;   // 128px
    const H = T * 4;   // 128px
    const top = groundY - H;
    const cut = 14;    // corner bevel size

    // Roof (dark navy octagon top strip)
    ctx.fillStyle = '#2a3a6a';
    ctx.beginPath();
    ctx.moveTo(sx + cut, top);
    ctx.lineTo(sx + W - cut, top);
    ctx.lineTo(sx + W, top + cut);
    ctx.lineTo(sx + W, top + T * 1.1);
    ctx.lineTo(sx, top + T * 1.1);
    ctx.lineTo(sx, top + cut);
    ctx.closePath(); ctx.fill();

    // Roof highlight stripe (light blue horizontal lines)
    ctx.fillStyle = '#4a6aaa';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(sx + cut, top + 4 + i * 7, W - cut * 2, 3);
    }

    // Roof bottom dark band
    ctx.fillStyle = '#1a2550';
    ctx.fillRect(sx, top + T * 1.1 - 6, W, 6);

    // Main body (white/cream)
    ctx.fillStyle = '#e8eaf0';
    ctx.fillRect(sx, top + T * 1.1, W, H - T * 1.1);

    // Body side panels (light grey vertical stripes)
    ctx.fillStyle = '#d0d4e0';
    ctx.fillRect(sx, top + T * 1.1, 18, H - T * 1.1);
    ctx.fillRect(sx + W - 18, top + T * 1.1, 18, H - T * 1.1);

    // Pokéball logo in center of roof
    const pbx = sx + W / 2, pby = top + T * 0.5;
    const pbr = 20;
    ctx.fillStyle = '#cc2020'; // top half
    ctx.beginPath(); ctx.arc(pbx, pby, pbr, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff'; // bottom half
    ctx.beginPath(); ctx.arc(pbx, pby, pbr, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pbx, pby, pbr, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pbx - pbr, pby); ctx.lineTo(pbx + pbr, pby); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pbx, pby, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pbx, pby, 7, 0, Math.PI * 2); ctx.stroke();

    // Door (glass sliding — blue rectangle)
    const doorW = T, doorH = T * 1.3;
    const doorX = sx + (W - doorW) / 2;
    const doorY = groundY - doorH;
    ctx.fillStyle = '#7ab0e0';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(doorX + 4, doorY + 4, doorW / 2 - 6, doorH - 8);
    ctx.strokeStyle = '#3a70b0'; ctx.lineWidth = 1.5;
    ctx.strokeRect(doorX, doorY, doorW, doorH);
    ctx.beginPath(); ctx.moveTo(doorX + doorW / 2, doorY); ctx.lineTo(doorX + doorW / 2, doorY + doorH); ctx.stroke();

    // SHOP sign
    const signX = sx + W - 58, signY = groundY - doorH - 22;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(signX, signY, 52, 18);
    ctx.strokeStyle = '#c00000'; ctx.lineWidth = 1;
    ctx.strokeRect(signX, signY, 52, 18);
    ctx.fillStyle = '#cc0000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SHOP', signX + 6, signY + 13);
    ctx.textAlign = 'left';

    // Building outline
    ctx.strokeStyle = '#3a4a7a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + cut, top); ctx.lineTo(sx + W - cut, top);
    ctx.lineTo(sx + W, top + cut); ctx.lineTo(sx + W, groundY);
    ctx.lineTo(sx, groundY); ctx.lineTo(sx, top + cut);
    ctx.closePath(); ctx.stroke();
  }

  _drawEnding() {
    const ctx = this.ctx;
    const t = this._endingTimer || 0;

    // Background — castle interior fading to warm orange/gold
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Castle silhouette at bottom
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, CANVAS_HEIGHT - 80, CANVAS_WIDTH, 80);

    // Stars twinkling
    const stars = [[80,40],[160,90],[240,30],[400,70],[520,50],[640,80],[760,35],[880,60],
                   [300,110],[700,100],[150,140],[600,130]];
    for (const [sx, sy] of stars) {
      const alpha = 0.4 + Math.abs(Math.sin((t + sx) * 0.04)) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fffaaa';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Title — slides in from top
    const titleY = Math.min(90, t * 2);
    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 44px monospace';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
    ctx.textAlign = 'center';
    ctx.strokeText('YOU WIN!', CANVAS_WIDTH / 2, titleY);
    ctx.fillText('YOU WIN!', CANVAS_WIDTH / 2, titleY);

    // Pikachu — drawn procedurally, appears after title
    if (t > 30) {
      const px = CANVAS_WIDTH / 2;
      const py = CANVAS_HEIGHT / 2 + 10 + Math.sin(t * 0.05) * 6; // gentle bounce
      this._drawPikachu(ctx, px, py, 1.4);
    }

    // "World 1 Complete!" subtitle
    if (t > 50) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText('World 1 Complete!', CANVAS_WIDTH / 2, 140);
      ctx.fillText('World 1 Complete!', CANVAS_WIDTH / 2, 140);
    }

    // Score
    if (t > 70) {
      ctx.fillStyle = '#ffd23b';
      ctx.font = '22px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.strokeText(`Score: ${String(this.score).padStart(7, '0')}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 120);
      ctx.fillText(`Score: ${String(this.score).padStart(7, '0')}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 120);
    }

    // Press ENTER prompt
    if (t > 100) {
      ctx.globalAlpha = 0.5 + Math.abs(Math.sin(t * 0.04)) * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.strokeText('Press ENTER to save score', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);
      ctx.fillText('Press ENTER to save score', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  _drawPikachu(ctx, cx, cy, scale = 1) {
    const s = scale;
    // Body (yellow)
    ctx.fillStyle = '#f0d020';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20 * s, 45 * s, 38 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (pointed, black tips)
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#f0d020';
      ctx.beginPath();
      ctx.moveTo(cx + side * 22 * s, cy - 50 * s);
      ctx.lineTo(cx + side * 35 * s, cy - 90 * s);
      ctx.lineTo(cx + side * 12 * s, cy - 52 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(cx + side * 26 * s, cy - 62 * s);
      ctx.lineTo(cx + side * 33 * s, cy - 86 * s);
      ctx.lineTo(cx + side * 16 * s, cy - 64 * s);
      ctx.closePath(); ctx.fill();
    }

    // Head
    ctx.fillStyle = '#f0d020';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 24 * s, 40 * s, 36 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheek blush (red circles)
    ctx.fillStyle = '#e04040';
    ctx.beginPath(); ctx.ellipse(cx - 28 * s, cy - 14 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 28 * s, cy - 14 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();

    // Eyes (happy/squinting — curved lines)
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * 14 * s, cy - 30 * s, 8 * s, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    // Nose
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(cx, cy - 22 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(cx, cy - 10 * s, 12 * s, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Arms raised (waving)
    ctx.strokeStyle = '#f0d020'; ctx.lineWidth = 12 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 40 * s, cy + 5 * s);
    ctx.lineTo(cx - 60 * s, cy - 25 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 40 * s, cy + 5 * s);
    ctx.lineTo(cx + 60 * s, cy - 25 * s);
    ctx.stroke();

    // Tail (zigzag lightning bolt — yellow/brown)
    ctx.strokeStyle = '#c8a010'; ctx.lineWidth = 8 * s; ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(cx + 42 * s, cy + 28 * s);
    ctx.lineTo(cx + 60 * s, cy + 10 * s);
    ctx.lineTo(cx + 50 * s, cy + 30 * s);
    ctx.lineTo(cx + 72 * s, cy + 8 * s);
    ctx.stroke();

    // Feet
    ctx.fillStyle = '#c8a010';
    ctx.beginPath(); ctx.ellipse(cx - 22 * s, cy + 55 * s, 18 * s, 10 * s, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 22 * s, cy + 55 * s, 18 * s, 10 * s, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1;
  }

  _fmtDate(dateStr) {
    const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr || '';
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  _drawLeaderboard() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,5,40,0.95)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 40px monospace';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText('TOP 10 SCORES', CANVAS_WIDTH / 2, 60);
    ctx.fillText('TOP 10 SCORES', CANVAS_WIDTH / 2, 60);

    const board = this._cachedBoard || [];
    if (this._leaderboardLoading) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading scores...', CANVAS_WIDTH / 2, 200);
    }
    const charColors = { eevee: '#c8864a', charmander: '#f07840', bulbasaur: '#68a858' };
    ctx.font = 'bold 18px monospace';
    for (let i = 0; i < Math.min(10, board.length); i++) {
      const e = board[i];
      const y = 105 + i * 44;
      const rowAlpha = i === 0 ? 1 : 0.85 - i * 0.04;
      ctx.globalAlpha = rowAlpha;
      ctx.fillStyle = i < 3 ? '#ffd23b' : '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`${i + 1}.`, CANVAS_WIDTH / 2 - 200, y);
      ctx.fillStyle = charColors[e.char] || '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(e.name, CANVAS_WIDTH / 2 - 185, y);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(String(e.score).padStart(7, '0'), CANVAS_WIDTH / 2 + 160, y);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(this._fmtDate(e.date), CANVAS_WIDTH / 2 + 170, y);
      ctx.font = 'bold 18px monospace';
    }
    ctx.globalAlpha = 1;
    if (board.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No scores yet!', CANVAS_WIDTH / 2, 200);
    }
    ctx.fillStyle = '#b0e0ff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER or SPACE to continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.textAlign = 'left';
  }

  _drawMenu() {
    const ctx = this.ctx;
    // Dark overlay on sky background
    ctx.fillStyle = 'rgba(0,0,18,0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';

    // Title
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#c8864a';
    ctx.font = 'bold 64px monospace';
    ctx.fillText("EEVEE'S", CANVAS_WIDTH / 2, 130);
    ctx.fillStyle = '#b070e8';
    ctx.fillText('ADVENTURE', CANVAS_WIDTH / 2, 198);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('Press ENTER or SPACE to START', CANVAS_WIDTH / 2, 268);

    // Top scores panel  (bottom portion of screen)
    const board = this._cachedBoard || [];
    const panelY = 310;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(60, panelY, CANVAS_WIDTH - 120, 240);
    ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 2;
    ctx.strokeRect(60, panelY, CANVAS_WIDTH - 120, 240);

    ctx.fillStyle = '#ffd23b';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('TOP SCORES', CANVAS_WIDTH / 2, panelY + 28);

    if (board.length === 0 && !this._leaderboardLoading) {
      ctx.fillStyle = '#aaa'; ctx.font = '17px monospace';
      ctx.fillText('No scores yet — play a game first!', CANVAS_WIDTH / 2, panelY + 80);
    } else if (this._leaderboardLoading) {
      ctx.fillStyle = '#aaa'; ctx.font = '17px monospace';
      ctx.fillText('Loading scores...', CANVAS_WIDTH / 2, panelY + 80);
    } else {
      const top5 = board.slice(0, 5);
      ctx.font = 'bold 16px monospace';
      top5.forEach((e, i) => {
        const rowY = panelY + 56 + i * 36;
        ctx.fillStyle = i === 0 ? '#ffd23b' : i === 1 ? '#c8c8c8' : '#cd7f32';
        ctx.textAlign = 'right';
        ctx.fillText(`${i + 1}.`, CANVAS_WIDTH / 2 - 220, rowY);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText((e.name || '???').slice(0, 10), CANVAS_WIDTH / 2 - 205, rowY);
        ctx.textAlign = 'right';
        ctx.fillText(String(e.score || 0).padStart(7, '0'), CANVAS_WIDTH / 2 + 220, rowY);
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this._fmtDate(e.date), CANVAS_WIDTH / 2 + 228, rowY);
        ctx.font = 'bold 16px monospace';
      });
    }
    ctx.textAlign = 'left'; ctx.shadowBlur = 0;
  }
}
