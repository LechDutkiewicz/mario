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
    this.resetLevel(true);
  }

  resetLevel(fullReset) {
    this.level   = buildWorld1();
    this.player  = new Player(80, GROUND_Y - 60);
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
    this.resetLevel(true);
    this.music.start();
  }

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
      if (input.justPressed('Enter')) { this.state = STATE.PLAYING; this.resetLevel(true); this.music.start(); }
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

    p.update(input, solids, this);
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
        if (stomping && e.stompable) {
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
    if (input.down && p.onGround) {
      for (const pl of lvl.platforms) {
        if (pl.enterable && !pl.isExit) {
          if (p.x + p.w > pl.x && p.x < pl.x + pl.w &&
              Math.abs((p.y + p.h) - pl.y) < 8) {
            p.x = 7050;
            p.y = GROUND_Y - p.h - 5;
            this.cam.x = 7000;
            this._showMsg('UNDERGROUND BONUS!', 90);
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
          if (this.worldClearTimer === 0) {
            this.worldClearTimer = 180;
          }
        }
      }
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
    for (const q  of lvl.qblocks)    q.draw(r, this.cam);
    for (const c  of lvl.coins)      c.draw(r, this.cam);
    for (const pu of this.powerups)  pu.draw(r, this.cam);
    for (const e  of lvl.enemies)    e.draw(r, this.cam);
    for (const pl of lvl.plants || []) pl.draw(r, this.cam);
    if (lvl.boss && !lvl.boss.dead)  lvl.boss.draw(r, this.cam);
    for (const fb of this.fireballs) fb.draw(r, this.cam);
    for (const bs of this.bossShots) bs.draw(r, this.cam);
    if (lvl.flagPole)                lvl.flagPole.draw(r, this.cam);
    if (lvl.pokeCenterX !== undefined) this._drawPokeCenterBuilding(lvl.pokeCenterX);
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
    if (this.state === STATE.PAUSED)    this._overlay('PAUSED', 'Press P to resume');
    if (this.state === STATE.GAME_OVER) this._overlay('GAME OVER', 'Press ENTER to restart');
    if (this.state === STATE.WIN)       this._drawWin();
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
    const label = pw === POWER.FIRE ? 'FIRE' : pw === POWER.BIG ? 'BIG' : 'SMALL';
    ctx.fillStyle = pw === POWER.FIRE ? '#ff6600' : '#fff';
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
    const W = 160, totalH = 120;
    const wallH = 65;

    // White main building
    ctx.fillStyle = '#e8eaeb';
    ctx.fillRect(x, bottomY - wallH, W, wallH);

    // Gray side trim
    ctx.fillStyle = '#b0b5ba';
    ctx.fillRect(x, bottomY - wallH, 14, wallH);
    ctx.fillRect(x + W - 14, bottomY - wallH, 14, wallH);

    // Blue side windows (tall)
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + 2, bottomY - wallH + 8, 10, 30);
    ctx.fillRect(x + W - 12, bottomY - wallH + 8, 10, 30);

    // Central Pokéball logo
    const pcx = x + W / 2, pcy = bottomY - 40;
    const pr = 22;
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(pcx - pr, pcy - 3, pr * 2, 6);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath(); ctx.arc(pcx, pcy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pcx, pcy, 8, 0, Math.PI * 2); ctx.stroke();

    // P.C text
    ctx.fillStyle = '#cc2222';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('P.C', x + 18, bottomY - 10);

    // Blue entrance door
    ctx.fillStyle = '#5baae7';
    ctx.fillRect(x + W / 2 - 16, bottomY - 28, 32, 28);
    ctx.strokeStyle = '#2a5a80'; ctx.lineWidth = 2;
    ctx.strokeRect(x + W / 2 - 16, bottomY - 28, 32, 28);

    // Red dome roof
    ctx.fillStyle = '#d44000';
    ctx.beginPath();
    ctx.moveTo(x - 8, bottomY - wallH);
    ctx.quadraticCurveTo(x + W / 2, bottomY - totalH - 5, x + W + 8, bottomY - wallH);
    ctx.closePath(); ctx.fill();

    // Darker red border on roof bottom
    ctx.fillStyle = '#a83000';
    ctx.fillRect(x - 8, bottomY - wallH, W + 16, 8);

    // Roof grid texture
    ctx.strokeStyle = 'rgba(160,60,0,0.35)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const tx = x + (W / 10) * i;
      ctx.beginPath();
      ctx.moveTo(tx, bottomY - wallH);
      ctx.lineTo(x + W / 2, bottomY - totalH - 5);
      ctx.stroke();
    }
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
