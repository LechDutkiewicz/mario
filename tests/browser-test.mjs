// ============================================================
// Browser runtime test — run with:  node tests/browser-test.mjs [--quick]
// Drives the real Game in headless Chromium (Playwright) and checks:
//   1. smoke run of all 32 levels (bot: run right + jump, enemy-proof)
//      → no exceptions, no NaN positions
//   2. every sub-area reachable by a transition builds, runs and renders
//   3. every character × form (incl. crouch) renders
//   4. progression: from just before the goal (flag / Ultra Ball) every
//      level advances to the next; 8-4 reaches the finale
//   5. 8-4 maze: the right pipe advances a room, wrong pipes send back
//   6. checkpoints: set in the right sub-area, respawn there, never set
//      inside bonus rooms
//   7. swim-in exits of the underwater sections work
// Exits 1 on any failure. Needs Playwright (local or global install);
// CHROMIUM_PATH can point at a Chromium binary.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');

// ── locate Playwright: local node_modules first, then the global install ──
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

// ── tiny static server for the repo ──
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
               '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain' };
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
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(`http://localhost:${PORT}/tests/README.md`);

const report = await page.evaluate(async (QUICK) => {
  const { Game } = await import('/src/game.js');
  const { GROUND_Y } = await import('/src/constants.js');
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
  const inp = { k: {}, p: {},
    get left() { return !!this.k.L }, get right() { return !!this.k.R }, get down() { return !!this.k.D },
    get jump() { return !!this.k.J }, get jumpPressed() { return !!this.p.J }, get run() { return !!this.k.S },
    get firePressed() { return false }, get escape() { return false },
    justPressed(c) { return !!this.p[c] }, isDown(c) { return !!this.k[c] }, update() {} };
  const g = new Game(cv.getContext('2d'), inp);
  g.music.enabled = false;
  for (const m of ['start', 'playCollect', 'playEndJingle']) g.music[m] = () => {};
  g.selectedChar = 'eevee';
  g.start();

  const fails = [], notes = [];
  let god = false;
  const levelOf = () => (g.world === 1 ? g.world1Level : g[`world${g.world}Level`]);
  const lvlId = () => `${g.world}-${levelOf() + 1}`;
  const sub = () => g[`world${g.world}SubArea`] ?? 0;
  const toSub = (w, s) => g[w === 1 ? '_doWorld1AreaTransition' : `_doWorld${w}SubAreaTransition`](s);
  const reset = () => { g.state = 'PLAYING'; g.lives = 99; };
  const go = (w, l, s) => { reset(); g._jumpToLevel(w, l); g.levelIntroTimer = 0; if (s) toSub(w, s); };
  // keys: object or fn(frame) → object; J is turned into a press edge
  const run = (n, keys, until, renderEvery = 5) => {
    let prevJ = 0;
    for (let f = 0; f < n; f++) {
      inp.p = {}; inp.k = typeof keys === 'function' ? keys(f) : keys;
      if (inp.k.J && !prevJ) inp.p.J = 1; prevJ = inp.k.J ? 1 : 0;
      if (god && g.player) g.player.invincible = Math.max(g.player.invincible || 0, 2);
      g.update(); if (f % renderEvery === 0) g.render();
      if (until && until(f)) return f;
    }
    return -1;
  };
  const guard = (label, fn) => { try { fn(); } catch (e) { fails.push(`${label}: EXCEPTION ${e.message} @ ${(e.stack || '').split('\n')[1]?.trim()}`); } };

  // 1) smoke run of every level
  god = true;
  for (let w = 1; w <= 8; w++) for (let l = 0; l < 4; l++) guard(`smoke ${w}-${l + 1}`, () => {
    go(w, l);
    const start = `${w}-${l + 1}`;
    run(QUICK ? 900 : 3000, f => ({ R: 1, S: 1, J: f % 50 < 26 ? 1 : 0 }), () => {
      const p = g.player;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`NaN player position in sub${sub()}`);
      return lvlId() !== start || g.state === 'ENDING';
    }, 6);
  });

  // 2) every sub-area reachable by a transition
  const subs = { 1: [[0, [1]], [1, [1, 2]]], 2: [[0, [1, 2]], [1, [1, 2]]], 3: [[0, [1, 2]]], 4: [[0, [1]], [1, [1, 2, 3, 4]]],
                 5: [[0, [1]], [1, [1, 2]]], 6: [[1, [1, 2, 3, 4]]], 7: [[0, [1]], [1, [1, 2]]], 8: [[0, [1]], [1, [1]], [3, [1, 2, 3, 4]]] };
  for (const [w, list] of Object.entries(subs)) for (const [l, ss] of list) for (const s of ss) guard(`sub-area ${w}-${l + 1} sub${s}`, () => {
    go(+w, l, s);
    run(120, { R: 1 }, null, 4);
    if (g.player.dead) fails.push(`sub-area ${w}-${l + 1} sub${s}: player died within 2s of arriving`);
  });

  // 3) every character × form, walking then crouching
  god = false;
  for (const ch of ['eevee', 'charmander', 'bulbasaur', 'pichu']) for (const pw of [0, 1, 2]) guard(`render ${ch}/power${pw}`, () => {
    g.selectedChar = ch; go(1, 0);
    g.player.char = ch; g.player.power = pw; g.player._applySize();
    run(40, f => (f > 20 ? { D: 1 } : { R: 1, J: f < 3 ? 1 : 0 }), null, 1);
  });
  g.selectedChar = 'eevee';

  // 4) progression from just before each goal
  const goalSub = { '1-2': 2, '2-2': 2, '4-2': 3, '7-2': 2, '8-4': 4 };
  for (let w = 1; w <= 8; w++) for (let l = 0; l < 4; l++) guard(`progress ${w}-${l + 1}`, () => {
    const id = `${w}-${l + 1}`;
    go(w, l, goalSub[id]);
    const L = g.level, p = g.player;
    // cycle small / big / fire form so every form finishes flags and castles
    p.power = (w + l) % 3; p._applySize();
    if (L.flagPole) { p.x = L.flagPole.x - 90; p.y = GROUND_Y - p.h - 150; }
    else if (L.bossAxe) { p.x = L.bossAxe.x - 60; p.y = L.bossBridgeY - p.h; }
    else return fails.push(`progress ${id}: no flag or Ultra Ball in sub${sub()}`);
    p.vy = 0; g.cam.x = Math.max(0, p.x - 300);
    const f = run(2400, fr => ({ R: 1, S: 1, J: fr % 40 < 20 ? 1 : 0 }), () => lvlId() !== id || g.state === 'ENDING');
    if (f < 0) fails.push(`progress ${id} (form ${(w + l) % 3}): did not advance (x=${Math.round(g.player.x)}, walkToPC=${g.walkToPC})`);
    else if (id === '8-4' && g.state !== 'ENDING') fails.push('progress 8-4: finale did not start');
    const expect = w === 8 && l === 3 ? 'ENDING' : (l < 3 ? `${w}-${l + 2}` : `${w + 1}-1`);
    const got = g.state === 'ENDING' ? 'ENDING' : lvlId();
    if (f >= 0 && got !== expect) fails.push(`progress ${id}: went to ${got}, expected ${expect}`);
  });

  // 5) 8-4 maze routing
  god = true;
  for (const [room, tid, expectRoom] of [[0, 2, 1], [1, 3, 2], [2, 4, 3], [1, 1, 0], [2, 1, 0]]) guard(`8-4 room ${room} pipe ${tid}`, () => {
    go(8, 3, room);
    const pp = g.level.platforms.find(o => o.transportId === tid);
    if (!pp) return fails.push(`8-4 room ${room}: no pipe with transport ${tid}`);
    const p = g.player; p.x = pp.x + 16; p.y = pp.y - p.h; p.vy = 0; p.onGround = true;
    const f = run(200, fr => (fr < 3 ? {} : { D: 1 }), () => sub() === expectRoom && g.areaTransTimer === 0);
    if (f < 0) fails.push(`8-4 room ${room} pipe ${tid}: expected room ${expectRoom}, now room ${sub()}`);
  });

  // 6) checkpoints
  guard('checkpoint 4-2', () => {
    go(4, 1, 1); g._checkpoint = null;
    const p = g.player; p.x = Math.round(g.level.width * 0.6); p.y = GROUND_Y - 200; g.cam.x = p.x - 300;
    run(20, {});
    const cp = g._checkpoint;
    g.player.die(); run(200, {}); g.levelIntroTimer = 0;
    if (!cp || cp.sub !== 1) fails.push('checkpoint 4-2: not set in the main sub-area');
    else if (g.world4SubArea !== 1 || Math.abs(g.player.x - cp.x) > 40) fails.push(`checkpoint 4-2: respawned sub${g.world4SubArea} x=${Math.round(g.player.x)}`);
  });
  guard('checkpoint 6-2 bonus death', () => {
    go(6, 1); g._checkpoint = null;
    const p = g.player; p.x = Math.round(g.level.width * 0.6); p.y = GROUND_Y - 200; g.cam.x = p.x - 300;
    run(20, {});
    const cp = g._checkpoint;
    toSub(6, 2); run(5, {}); g.player.die(); run(200, {}); g.levelIntroTimer = 0;
    if (!cp || g.world6SubArea !== 0 || Math.abs(g.player.x - cp.x) > 40) fails.push(`checkpoint 6-2: death in bonus respawned sub${g.world6SubArea} x=${Math.round(g.player.x)}`);
  });
  guard('checkpoint 3-1 bonus room', () => {
    go(3, 0, 1); g._checkpoint = null;
    const p = g.player; p.x = 1200; p.y = GROUND_Y - 200; g.cam.x = 900;
    run(30, {});
    if (g._checkpoint) fails.push('checkpoint 3-1: set inside the underworld bonus room');
  });

  // 7) swim-in exits of underwater sections
  for (const [w, l, s, next] of [[2, 1, 1, 2], [7, 1, 1, 2], [8, 3, 3, 4]]) guard(`swim exit ${w}-${l + 1}`, () => {
    go(w, l, s);
    const hp = g.level.hPipeExits.slice(-1)[0];
    const p = g.player; p.x = hp.x - 70; p.y = hp.y + 96 - p.h; p.vy = 0; g.cam.x = p.x - 300;
    const f = run(240, fr => ({ R: 1, J: fr % 30 < 8 ? 1 : 0 }), () => g.areaTransTimer > 0 || sub() === next);
    if (f < 0) fails.push(`swim exit ${w}-${l + 1}: could not swim into the exit pipe`);
  });

  notes.push(`levels smoke-tested: 32, sub-areas: ${Object.values(subs).flat().reduce((n, [, ss]) => n + ss.length, 0)}, character×form: 12`);
  return { fails, notes };
}, QUICK);

await browser.close();
server.close();
for (const n of report.notes) console.log(n);
const errs = [...new Set(pageErrors)];
if (errs.length) report.fails.push(...errs.map(e => `uncaught page error: ${e}`));
if (report.fails.length) {
  console.log(`\nFAILED (${report.fails.length}):\n  ` + report.fails.join('\n  '));
  process.exit(1);
}
console.log('\nALL BROWSER CHECKS PASSED');
