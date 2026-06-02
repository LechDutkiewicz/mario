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
    this.areaTransTimer = 0;
    this._pendingArea = -1;
    this._pendingWorld1SubArea = -1;
    this.area0AutoWalk = false; // player auto-walks into entrance pipe
    this.scorePopups = [];
    this._cachedBoard = [];
    this._leaderboardLoading = false;
    // Pre-fetch leaderboard so top 3 shows on menu
    this._fetchLeaderboardJSONP();
    this.resetLevel(true);
  }

  resetLevel(fullReset, resetPower = fullReset) {
    const savedPower = resetPower ? POWER.SMALL : (this.player ? this.player.power : POWER.SMALL);
    if (fullReset) { this.world2Area = 0; this.world1Level = 0; this.world1SubArea = 0; }
    this.level   = this.world === 3 ? buildWorld3()
                 : this.world === 2 ? buildWorld2(this.world2Area)
                 : buildWorld1(this.world1Level, this.world1SubArea);
    this.area0AutoWalk = (this.world === 2 && this.world2Area === 0);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player  = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x   = 0;
    this.fireballs  = [];
    this.bossShots  = [];
    this.powerups   = [];
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
    this.fireballs.push(new Fireball(x, player.y + player.h * 0.4, player.facing));
  }

  collectBlockCoin(x, y) {
    this.coinsCollected++;
    this.score += SCORE_POKEBALL;
    this.level.coins.push(Coin.pop(x, y));
    this.music.playCollect();
  }

  spawnPowerUp(x, y, kind) {
    this.powerups.push(new PowerUp(x, y, kind));
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
        ? `2-${this.world2Area + 1}`
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

  // GET: try JSONP (requires Apps Script redeployment), fall back to localStorage
  _fetchLeaderboardJSONP() {
    return new Promise((resolve) => {
      const cbName = '_gscb' + Date.now();
      const timer  = setTimeout(() => {
        delete window[cbName];
        // JSONP timed out — fall back to local scores
        const local = this._loadLocalScores();
        if (local.length > 0) this._cachedBoard = local;
        this._leaderboardLoading = false;
        resolve([]);
      }, 5000);

      window[cbName] = (data) => {
        clearTimeout(timer);
        delete window[cbName];
        if (Array.isArray(data) && data.length > 0) {
          this._cachedBoard = data;
        } else {
          this._cachedBoard = this._loadLocalScores();
        }
        this._leaderboardLoading = false;
        resolve(this._cachedBoard);
      };

      const script = document.createElement('script');
      script.src = `${Game.SHEETS_URL}?action=get&callback=${cbName}`;
      script.onerror = () => {
        clearTimeout(timer);
        delete window[cbName];
        this._cachedBoard = this._loadLocalScores();
        this._leaderboardLoading = false;
        resolve([]);
      };
      document.head.appendChild(script);
    });
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

    // ESC returns to menu from any non-menu state
    if (input.escape && this.state !== STATE.MENU) {
      this.state = STATE.MENU;
      return;
    }

    if (this.state === STATE.MENU) {
      if (input.justPressed('Enter') || input.justPressed('Space')) {
        this.state = STATE.CHAR_SELECT;
        this.charSelectIdx = 0;
      }
      return;
    }
    if (this.state === STATE.CHAR_SELECT) {
      const chars = ['eevee', 'charmander', 'bulbasaur'];
      if (input.justPressed('ArrowLeft')) this.charSelectIdx = (this.charSelectIdx + 2) % 3;
      if (input.justPressed('ArrowRight')) this.charSelectIdx = (this.charSelectIdx + 1) % 3;
      if (input.justPressed('Enter') || input.justPressed('Space')) {
        this.selectedChar = chars[this.charSelectIdx];
        this.start();
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
      if (input.justPressed('KeyP')) this.state = STATE.PLAYING;
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
        // Touched the pipe's left side — trigger transition directly
        this.area0AutoWalk = false;
        this._startAreaTransition(1);
      }
      // Keep walking right until we hit the pipe
      activeInput = {
        left: false, right: !atPipe, down: false, run: false,
        jump: false, jumpPressed: false, firePressed: false,
        justPressed: () => false,
      };
    }

    p.update(activeInput, solids, this);

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

      // Fireballs don't affect shells
      if (!e.inShell) {
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
          e.squash(); // squirtle enters/stops shell; others die
          p.vy = -8;
          stompedThisFrame = true;
          this.score += SCORE_STOMP;
          this._spawnScorePopup(e.x + e.w / 2, e.y, SCORE_STOMP);
        } else if (!stomping) {
          if (e.type === 'squirtle' && e.inShell && !e.shellSliding) {
            // Kick sitting shell
            const kickDir = (p.x + p.w / 2 < e.x + e.w / 2) ? 1 : -1;
            e.kickShell(kickDir);
          } else if (!stompedThisFrame) {
            // sliding shell or normal enemy — hurt player
            if (!e.inShell || e.shellSliding) this._hurtPlayer();
          }
        }
      }
    }
    lvl.enemies = lvl.enemies.filter(e => !e.dead || e.dying);
    lvl.enemies = lvl.enemies.filter(e => !(e.dead && e.y > 850));

    // Boss (Persian)
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
        this._hurtPlayer();
      }
    }
    if (lvl.plants) lvl.plants = lvl.plants.filter(pl => !pl.dead);

    // Pipe entry / exit — player presses DOWN on enterable pipe
    if (input.down && p.onGround && this.areaTransTimer === 0) {
      for (const pl of lvl.platforms) {
        if (pl.enterable && !pl.isExit) {
          if (p.x + p.w > pl.x && p.x < pl.x + pl.w &&
              Math.abs((p.y + p.h) - pl.y) < 8) {
            if (this.world === 2 && pl.leadsToArea !== undefined) {
              this._startAreaTransition(pl.leadsToArea);
            } else if (this.world === 1 && this.world1Level === 1) {
              // World 1-2: cycle through areas 0 → 1 → 2
              if (this.world1SubArea === 0) {
                this._startWorld1AreaTransition(1); // overworld → underground
              } else if (this.world1SubArea === 1) {
                this._startWorld1AreaTransition(2); // underground → exit overworld
              }
            }
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

    // Area transition fade
    if (this.areaTransTimer > 0) {
      this.areaTransTimer--;
      if (this.areaTransTimer === 0) {
        if (this._pendingWorld1SubArea >= 0) {
          this._doWorld1AreaTransition(this._pendingWorld1SubArea);
          this._pendingWorld1SubArea = -1;
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
          // All of world 1 done — proceed to world 2
          this.world = 2;
          this.world2Area = 0;
          this.resetLevel(false);
          this.music.start();
        } else if (this.world === 2 && this.world2Area === 1) {
          this._doAreaTransition(2);
        } else if (this.world === 2) {
          // World 2 area 2 complete → world 3
          this.world = 3;
          this.resetLevel(false);
          this.music.start();
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

  _startWorld1AreaTransition(toSubArea) {
    this._pendingWorld1SubArea = toSubArea;
    this.areaTransTimer = 40;
  }

  _doWorld1AreaTransition(toSubArea) {
    const savedPower = this.player ? this.player.power : POWER.SMALL;
    this.world1SubArea = toSubArea;
    this.level = buildWorld1(this.world1Level, toSubArea);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
    this.player.char = this.selectedChar || 'eevee';
    this.player._applySize();
    this.cam.x = 0;
    this.fireballs = []; this.bossShots = []; this.powerups = [];
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
    this.fireballs = []; this.bossShots = []; this.powerups = [];
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
    if (lvl.flagPole)                lvl.flagPole.draw(r, this.cam);
    if (lvl.pokeShopX !== undefined)   this._drawPokeShopBuilding(lvl.pokeShopX);
    else if (lvl.pokeCenterX !== undefined) this._drawPokeCenterBuilding(lvl.pokeCenterX);
    this.player.draw(r, this.cam);

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
    if (this.state === STATE.PAUSED)    this._overlay('PAUSED', 'Press P to resume');
    if (this.state === STATE.GAME_OVER) this._overlay('GAME OVER', 'Press ENTER to save score');
    if (this.state === STATE.WIN)       this._drawWin();

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
      { name: 'EEVEE',      evolves: 'UMBREON / FLAREON',       color: '#c8864a' },
      { name: 'CHARMANDER', evolves: 'CHARMELEON / CHARIZARD',  color: '#f07840' },
      { name: 'BULBASAUR',  evolves: 'IVYSAUR / VENUSAUR',      color: '#68a858' },
    ];
    const boxW = 200, boxH = 240, spacing = 230;
    const startX = CANVAS_WIDTH / 2 - spacing;

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
    };
    const charColors = {
      eevee:      ['#fff', '#f0c040', '#ff6600'],
      charmander: ['#f07840', '#e05528', '#cc3300'],
      bulbasaur:  ['#88c878', '#5a9850', '#2a9030'],
    };
    const char = this.player.char || 'eevee';
    const label = (charNames[char] || charNames.eevee)[pw];
    ctx.fillStyle = (charColors[char] || charColors.eevee)[pw];
    ctx.strokeText(label, 24, 64);
    ctx.fillText(label,   24, 64);

    // World / level / area debug label
    let worldLabel;
    if (this.world === 1)      worldLabel = `1-${this.world1Level + 1}`;
    else if (this.world === 2) worldLabel = `2-${this.world2Area + 1}`;
    else                       worldLabel = '3-1';
    const areaIdx = this.level ? (this.level.areaIndex ?? this.world2Area ?? 0) : 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.strokeText(`WORLD ${worldLabel}  AREA ${areaIdx}`, CANVAS_WIDTH - 234, 88);
    ctx.fillText(`WORLD ${worldLabel}  AREA ${areaIdx}`,   CANVAS_WIDTH - 234, 88);
    ctx.fillStyle = '#fff';
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
      ctx.fillText(e.date || '', CANVAS_WIDTH / 2 + 170, y);
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
    ctx.textAlign = 'center';

    // Title
    ctx.fillStyle = '#c8864a';
    ctx.font = 'bold 64px monospace';
    ctx.fillText("EEVEE'S", CANVAS_WIDTH / 2, 160);
    ctx.fillStyle = '#9b59b6';
    ctx.fillText('ADVENTURE', CANVAS_WIDTH / 2, 228);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('Press ENTER or SPACE to START', CANVAS_WIDTH / 2, 310);

    ctx.font = '18px monospace';
    ctx.fillStyle = '#ddd';
    const lines = [
      'Arrows: move   Space / Up: jump',
      'Shift: run     Left Alt: Flamethrower (need TM Fire)',
      'Down: crouch (big Eevee)     P: pause',
      '',
      'Stomp Ekans!  Koffing needs Flamethrower.',
      'Collect Pokeballs. Find Rare Candy and TM Fire!',
    ];
    lines.forEach((l, i) => ctx.fillText(l, CANVAS_WIDTH / 2, 368 + i * 27));

    // Top 3 leaderboard in bottom-right corner
    const board = this._cachedBoard || [];
    if (board.length > 0) {
      const top3 = board.slice(0, 3);
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('TOP SCORES', CANVAS_WIDTH / 2 + 240, 370);
      ctx.font = '13px monospace';
      const medals = ['🥇', '🥈', '🥉'];
      top3.forEach((e, i) => {
        ctx.fillStyle = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32';
        const name  = (e.name  || '???').slice(0, 8).padEnd(8);
        const score = String(e.score || 0).padStart(7, '0');
        ctx.fillText(`${i + 1}. ${name}  ${score}`, CANVAS_WIDTH / 2 + 208, 390 + i * 20);
      });
    } else if (this._leaderboardLoading) {
      ctx.font = '13px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Loading scores...', CANVAS_WIDTH / 2 + 230, 390);
    }
    ctx.textAlign = 'left';
  }
}
