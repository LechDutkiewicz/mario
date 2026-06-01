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
    this.world2Area = 0;   // current area index within world 2
    this.areaTransTimer = 0; // fade-out frames between area transitions
    this._pendingArea = -1;
    this.area0AutoWalk = false; // player auto-walks into entrance pipe
    this.resetLevel(true);
  }

  resetLevel(fullReset) {
    const savedPower = fullReset ? POWER.SMALL : (this.player ? this.player.power : POWER.SMALL);
    if (fullReset) this.world2Area = 0;
    this.level   = this.world === 2 ? buildWorld2(this.world2Area) : buildWorld1();
    this.area0AutoWalk = (this.world === 2 && this.world2Area === 0);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player  = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
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
  }

  start() {
    this.state = STATE.PLAYING;
    this.world = 1;
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
      if (input.justPressed('Enter') || input.justPressed('Space')) this.start();
      return;
    }
    if (this.state === STATE.GAME_OVER || this.state === STATE.WIN) {
      if (input.justPressed('Enter')) {
        this.world = 1;
        this.world2Area = 0;
        this.state = STATE.PLAYING;
        this.resetLevel(true);
        this.music.start();
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

    // Area 0 auto-walk: synthesize input so player walks into the entrance pipe
    let activeInput = input;
    if (this.area0AutoWalk && !p.dead) {
      const pipeX = lvl.entrancePipeX ?? 10 * TILE;
      const atPipe = p.x + p.w >= pipeX + TILE * 0.5;
      if (atPipe) this.area0AutoWalk = false;
      activeInput = {
        left: false, right: !atPipe, down: atPipe, run: false,
        jump: false, jumpPressed: false, firePressed: false,
        justPressed: (c) => atPipe && c === 'ArrowDown',
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

    // Enemies (Ekans + Koffing)
    let stompedThisFrame = false;
    for (const e of lvl.enemies) {
      e.update(solids, p);
      if (e.dead || e.dying || e.squashTimer > 0) continue;

      for (const fb of this.fireballs) {
        if (!fb.dead && aabb(fb, e)) {
          fb.dead = true;
          e.kill();
          this.score += SCORE_FIRE;
          break;
        }
      }
      if (e.dead || e.squashTimer > 0) continue;

      if (!p.dead && aabb(p, e)) {
        const stomping = p.vy > 0 && (p.y + p.h) - e.y < 22;
        if (stomping && e.stompable && !stompedThisFrame) {
          e.squash();
          p.vy = -8;
          stompedThisFrame = true;
          this.score += SCORE_STOMP;
        } else if (!stompedThisFrame) {
          this._hurtPlayer();
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
          if (boss.takeHit()) this.score += SCORE_BOSS;
        }
      }
      if (!p.dead && !boss.defeated && aabb(p, boss)) {
        const stomping = p.vy > 0 && (p.y + p.h) - boss.y < 30;
        if (stomping) {
          if (boss.takeHit()) this.score += SCORE_BOSS;
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
              // World 2 area transition
              this._startAreaTransition(pl.leadsToArea);
            } else if (this.world === 1) {
              // World 1 underground bonus
              p.x = 7050;
              p.y = GROUND_Y - p.h - 5;
              this.cam.x = 7000;
              this._showMsg('UNDERGROUND BONUS!', 90);
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
      if (this.areaTransTimer === 0 && this._pendingArea >= 0) {
        this._doAreaTransition(this._pendingArea);
        this._pendingArea = -1;
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
        if (this.world === 1) {
          this.world = 2;
          this.world2Area = 0;
          this.resetLevel(false);
          this.music.start();
        } else if (this.world === 2 && this.world2Area === 1) {
          // Underground complete → exit to overworld area 2
          this._doAreaTransition(2);
        } else {
          this.state = STATE.WIN;
        }
      }
      return;
    }
    if (this.worldClearTimer > 0) {
      this.worldClearTimer--;
      if (this.worldClearTimer === 0) {
        this.state = STATE.WIN;
      }
      return;
    }

    if (p.dead && p.deathTimer <= 0) this._loseLife();
  }

  _hurtPlayer() { this.player.takeDamage(); }

  _showMsg(text, frames) {
    this._msg = { text, frames };
  }

  _startAreaTransition(toArea) {
    this._pendingArea = toArea;
    this.areaTransTimer = 40; // 40 frames fade-out
  }

  _doAreaTransition(toArea) {
    const savedPower = this.player ? this.player.power : POWER.SMALL;
    this.world2Area = toArea;
    this.area0AutoWalk = false;
    this.level = buildWorld2(toArea);
    this.r.currentSetting = this.level.setting || 'overworld';
    this.player = new Player(80, GROUND_Y - 60);
    this.player.power = savedPower;
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
      this.resetLevel(false);
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

    const lvl = this.level;
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
    if (this.state === STATE.GAME_OVER) this._overlay('GAME OVER', 'Press ENTER to restart');
    if (this.state === STATE.WIN)       this._drawWin();

    // Area transition fade
    if (this.areaTransTimer > 0) {
      const alpha = 1 - this.areaTransTimer / 40;
      this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
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
    const label = pw === POWER.FIRE ? 'FLAREON' : pw === POWER.BIG ? 'UMBREON' : 'EEVEE';
    ctx.fillStyle = pw === POWER.FIRE ? '#ff6600' : pw === POWER.BIG ? '#f0c040' : '#fff';
    ctx.strokeText(label, 24, 64);
    ctx.fillText(label,   24, 64);
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
    ctx.textAlign = 'left';
  }
}
