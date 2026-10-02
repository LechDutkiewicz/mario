// ============================================================
// Visual evidence harness — run with:  node tests/screenshots.mjs [outDir]
// Renders a fixed set of scenes (one per visual setting, menus, player
// forms) in headless Chromium and saves PNGs so visual changes can be
// compared before/after. Default outDir: tests/shots
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tests', 'shots'));
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

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
               '.png': 'image/png', '.md': 'text/plain' };
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
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(`http://localhost:${PORT}/tests/README.md`);

// Scenes: [name, world, level(0-based), sub, frames to simulate, player x (optional), form]
const SCENES = [
  ['menu',            null],
  ['char-select',     'CHAR_SELECT'],
  ['1-1-overworld',   1, 0, 0, 200, 300, 0],
  ['1-1-overworld-far', 1, 0, 0, 200, 2600, 1],
  ['1-1-bonus-underworld', 1, 0, 1, 60, null, 0],
  ['1-2-underworld',  1, 1, 1, 200, 500, 1],
  ['1-3-overworld-trees', 1, 2, 0, 200, 700, 2],
  ['1-4-castle',      1, 3, 0, 120, 400, 1],
  ['2-1-sky',         2, 0, 2, 60, null, 1],
  ['2-2-underwater',  2, 1, 1, 200, 400, 0],
  ['2-3-bridges',     2, 2, 0, 120, 500, 1],
  ['3-1-night',       3, 0, 0, 200, 600, 1],
  ['3-1-night-water', 3, 0, 0, 60, 2300, 1],
  ['4-3-overworld',   4, 2, 0, 200, 600, 2],
  ['5-3-overworld',   5, 2, 0, 200, 600, 0],
  ['6-2-overworld',   6, 1, 0, 200, 600, 1],
  ['7-1-cannons',     7, 0, 0, 200, 700, 1],
  ['8-4-castle-maze', 8, 3, 0, 120, 300, 2],
];

await page.evaluate(async () => {
  const { Game } = await import('/src/game.js');
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600; cv.id = 'shot';
  document.body.style.margin = '0'; document.body.innerHTML = ''; document.body.appendChild(cv);
  const inp = { k: {}, p: {},
    get left() { return !!this.k.L }, get right() { return !!this.k.R }, get down() { return !!this.k.D },
    get jump() { return !!this.k.J }, get jumpPressed() { return !!this.p.J }, get run() { return !!this.k.S },
    get firePressed() { return false }, get escape() { return false },
    justPressed(c) { return !!this.p[c] }, isDown(c) { return !!this.k[c] }, update() {} };
  const g = new Game(cv.getContext('2d'), inp);
  g.music.enabled = false;
  for (const m of ['start', 'playCollect', 'playEndJingle']) g.music[m] = () => {};
  window.__g = g; window.__inp = inp;
  // Deterministic randomness so repeated runs match
  let seed = 12345; Math.random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
});

for (const sc of SCENES) {
  const [name, world, level, sub, frames, px, form] = sc;
  await page.evaluate(([name, world, level, sub, frames, px, form]) => {
    const g = window.__g, inp = window.__inp;
    const toSub = (w, s) => g[w === 1 ? '_doWorld1AreaTransition' : `_doWorld${w}SubAreaTransition`](s);
    if (world === null) { g.state = 'MENU'; g.menuAnim = 60; g.render(); return; }
    if (world === 'CHAR_SELECT') { g.state = 'CHAR_SELECT'; g.render(); return; }
    if (!g.level) { g.selectedChar = 'eevee'; g.start(); }
    g.state = 'PLAYING'; g.lives = 99;
    g._jumpToLevel(world, level); g.levelIntroTimer = 0;
    if (sub) toSub(world, sub);
    const p = g.player;
    p.power = form; p._applySize();
    if (px != null) { p.x = px; g.cam.x = Math.max(0, px - 300); }
    for (let f = 0; f < frames; f++) {
      inp.p = {}; inp.k = { R: f < frames - 30 ? 1 : 0 };
      p.invincible = 0;
      g.update();
      // Keep the player alive and on screen (bot may walk into enemies or pits)
      if (p.dead || p.y > 650) { p.dead = false; p.deathTimer = 0; p.vy = 0; p.y = 200; if (px != null) p.x = px; }
    }
    for (let f = 0; f < 60 && !p.onGround; f++) { inp.p = {}; inp.k = {}; p.invincible = 0; g.update(); if (p.y > 650) { p.y = 200; p.vy = 0; } }
    g.update();
    // Make the player visible in the captured frame (no post-hit blinking)
    p.invincible = 0; p.dead = false; p.deathTimer = 0;
    g.render();
  }, sc);
  await page.locator('#shot').screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}

await browser.close();
server.close();
if (pageErrors.length) { console.error('page errors:', pageErrors); process.exit(1); }
console.log('saved to', OUT);
