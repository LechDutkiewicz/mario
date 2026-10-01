// ============================================================
// Sprite contact sheets — run with:
//   node tests/contact-sheet.mjs [outDir] [--root <repoDir>]
// Renders every player form, enemy, boss, trainer and item at 3x on
// labelled grids (players.png, enemies.png, bosses.png, items.png) so
// sprite changes can be compared before/after. --root lets you render
// another checkout (e.g. a git worktree of an older commit) with the
// same script. Default outDir: tests/sheets
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootIdx = args.indexOf('--root');
const ROOT = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const positional = args.filter((a, i) => a !== '--root' && !(rootIdx >= 0 && i === rootIdx + 1));
const OUT = path.resolve(positional[0] || path.join(ROOT, 'tests', 'sheets'));
fs.mkdirSync(OUT, { recursive: true });

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const req = createRequire(path.join(globalRoot, 'noop.js'));
    return await import(req.resolve('playwright'));
  } catch {}
  console.error('Playwright not found. Install it with:  npm i -D playwright  (or globally)');
  process.exit(2);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default?.chromium;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  .catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(`http://localhost:${PORT}/tests/README.md`);

const sheets = await page.evaluate(async () => {
  const { Game } = await import('/src/game.js');
  const { Renderer } = await import('/src/renderer.js');
  const { Player } = await import('/src/entities/player.js');
  const { Enemy } = await import('/src/entities/enemy.js');
  const { Boss } = await import('/src/entities/boss.js');
  const { CastleBoss, BossAxe } = await import('/src/entities/castleboss.js');
  const { PipePlant } = await import('/src/entities/pipeplant.js');
  const { PowerUp } = await import('/src/entities/powerup.js');
  const { Coin } = await import('/src/entities/coin.js');
  let seed = 7; Math.random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  const DEF = { scale: 3, cw: 150, ch: 210, cols: 6 };
  const out = {};
  const makeSheet = (title, cells, opt = {}) => {
    const { scale: SCALE, cw: CW, ch: CH, cols: COLS } = { ...DEF, ...opt };
    const rows = Math.ceil(cells.length / COLS);
    const cv = document.createElement('canvas'); cv.width = COLS * CW; cv.height = rows * CH + 40;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#5c8bd6'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.fillText(title, 12, 26);
    const r = new Renderer(ctx); r.currentSetting = 'overworld';
    cells.forEach((cell, i) => {
      const cx = (i % COLS) * CW, cy = 40 + Math.floor(i / COLS) * CH;
      ctx.fillStyle = (i % 2) ? '#6c9be6' : '#5c8bd6'; ctx.fillRect(cx, cy, CW, CH);
      ctx.fillStyle = '#3f8f3f'; ctx.fillRect(cx, cy + CH - 46, CW, 8);
      ctx.fillStyle = '#7a4a1e'; ctx.fillRect(cx, cy + CH - 38, CW, 14);
      ctx.save();
      ctx.translate(cx + CW / 2, cy + CH - 46); ctx.scale(SCALE, SCALE);
      try { cell.draw(ctx, r); } catch (e) { ctx.restore(); ctx.save(); ctx.strokeStyle = '#f33'; ctx.lineWidth = 3; ctx.strokeRect(cx + 10, cy + 10, CW - 20, CH - 70); console.error(cell.label, e.message); }
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.fillText(cell.label, cx + CW / 2, cy + CH - 16); ctx.textAlign = 'left';
    });
    out[title] = cv.toDataURL('image/png');
  };
  // helper: draw an entity whose feet are at (0,0) in the scaled frame
  const ent = (label, make, opts = {}) => ({ label, draw(ctx, r) {
    const e = make();
    e.x = -Math.floor(e.w / 2); e.y = -e.h + (opts.lift || 0);
    if (opts.setup) opts.setup(e);
    e.draw(r, { x: 0 });
  } });

  // ---- players: every character × form (+ crouch for the Eevee line) ----
  const chars = ['eevee', 'charmander', 'bulbasaur', 'pichu', 'piplup'];
  const formName = ['small', 'evo 1', 'evo 2'];
  const cells = [];
  for (const ch of chars) for (let pw = 0; pw < 3; pw++) cells.push({ label: `${ch} · ${formName[pw]}`, draw(ctx, r) {
    const p = new Player(0, 0); p.char = ch; p.power = pw; p._applySize(); p.onGround = true; p.facing = 1;
    p.x = -Math.floor(p.w / 2); p.y = -p.h; p.animTimer = 0; p.draw(r, { x: 0 });
  } });
  cells.push({ label: 'eevee · crouch (evo)', draw(ctx, r) {
    const p = new Player(0, 0); p.char = 'eevee'; p.power = 1; p._applySize(); p.crouching = true; p.h = 32; p.onGround = true;
    p.x = -Math.floor(p.w / 2); p.y = -p.h; p.draw(r, { x: 0 });
  } });
  cells.push({ label: 'eevee · jump', draw(ctx, r) {
    const p = new Player(0, 0); p.char = 'eevee'; p.power = 0; p._applySize(); p.onGround = false; p.vy = -4;
    p.x = -Math.floor(p.w / 2); p.y = -p.h - 10; p.draw(r, { x: 0 });
  } });
  makeSheet('players', cells);

  // ---- enemies ----
  const types = ['ekans', 'squirtle', 'koffing', 'pineco', 'pinecoegg', 'cubone', 'zubat', 'blooper', 'cheepcheep', 'cheepjump', 'bulletbill', 'podoboo'];
  const ecells = types.map(t => ent(t, () => new Enemy(0, 0, t), { setup(e) { e.vy = 0; } }));
  ecells.push(ent('squirtle · shell', () => new Enemy(0, 0, 'squirtle'), { setup(e) { e.shell = true; e.inShell = true; e.vy = 0; } }));
  ecells.push(ent('squirtle · flying', () => new Enemy(0, 0, 'squirtle', false, true, 0, 40), { setup(e) { e.y = -e.h - 20; } }));
  ecells.push({ label: 'pipeplant (Arbok)', draw(ctx, r) { const pp = new PipePlant(-16, 0); pp.state = 'up'; pp.offsetY = 0; pp.animTimer = 10; pp.isVisible = () => true; pp.draw(r, { x: 0 }); } });
  ecells.push(ent('podoboo · jumping', () => new Enemy(0, 0, 'podoboo'), { setup(e) { e.isJumping = true; e.vy = -3; } }));
  makeSheet('enemies', ecells);

  // ---- bosses + trainers ----
  const bcells = [];
  bcells.push({ label: 'Persian (boss)', draw(ctx, r) { const b = new Boss(0, 0, -200, 200); b.x = -Math.floor(b.w / 2); b.y = -b.h; b.draw(r, { x: 0 }); } });
  bcells.push({ label: 'Gengar (castle boss)', draw(ctx, r) { const b = new CastleBoss(0, 0, -200, 200); b.x = -Math.floor(b.w / 2); b.y = -b.h; b.draw(r, { x: 0 }); } });
  bcells.push({ label: 'Ultra Ball (axe)', draw(ctx, r) { const a = new BossAxe(0, 0); a.x = -14; a.y = -40; a.draw(r, { x: 0 }); } });
  const cv0 = document.createElement('canvas'); cv0.width = 800; cv0.height = 600;
  const inp = { k: {}, p: {}, get left() { return false }, get right() { return false }, get down() { return false }, get jump() { return false }, get jumpPressed() { return false }, get run() { return false }, get firePressed() { return false }, get escape() { return false }, justPressed() { return false }, isDown() { return false }, update() {} };
  const g = new Game(cv0.getContext('2d'), inp); g.music.enabled = false;
  for (const who of ['ash', 'goh', 'friede']) bcells.push({ label: `trainer · ${who}`, draw(ctx) { g._drawTrainer(ctx, 0, 0, who); } });
  makeSheet('bosses', bcells, { scale: 2, cw: 250, ch: 250, cols: 4 });

  // ---- items ----
  const icells = [];
  icells.push(ent('pokéball', () => new Coin(0, 0)));
  for (const [kind, el] of [['candy'], ['firestone', 'fire'], ['firestone', 'leaf'], ['firestone', 'electric'], ['firestone', 'shadow'], ['firestone', 'water'], ['star'], ['oneup']])
    icells.push(ent(`${kind}${el ? ' · ' + el : ''}`, () => new PowerUp(0, 0, kind, el || 'fire')));
  makeSheet('items', icells);
  return out;
});

for (const [name, dataUrl] of Object.entries(sheets)) {
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('sheet', name);
}
await browser.close();
server.close();
if (pageErrors.length) { console.error('page errors:', pageErrors); process.exit(1); }
console.log('saved to', OUT);
