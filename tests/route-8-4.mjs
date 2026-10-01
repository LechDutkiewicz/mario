// ============================================================
// 8-4 route test — run with:  node tests/route-8-4.mjs
// Drives the real game through the intended 8-4 route with scripted
// inputs and real physics: start wall + lava pool, raised floor, the lift
// over the long lava, pipe T2 → hidden-block step → pipe T3 → lava gap →
// pipe T4 → underwater corridor → water pipe → final lava → Ultra Ball.
// The player is immune to enemies (as in browser-test.mjs) but lava and
// pits still kill, so this checks level geometry, not combat.
// Exits 1 if the route cannot be completed. Needs Playwright.
// ============================================================
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  try { const req = createRequire(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'noop.js')); return await import(req.resolve('playwright')); } catch {}
  console.error('Playwright not found. Install it with:  npm i -D playwright  (or globally)'); process.exit(2);
}
const pw = await loadPlaywright(); const chromium = pw.chromium ?? pw.default?.chromium;
const MIME = { '.js': 'text/javascript', '.md': 'text/plain', '.json': 'application/json' };
const server = http.createServer((rq, rs) => { const f = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rs); });
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  .catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
const page = await browser.newPage(); page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(`http://localhost:${server.address().port}/tests/README.md`);
const log = await page.evaluate(async () => {
  const { Game } = await import('/src/game.js');
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 600;
  const inp = { k: {}, p: {}, get left() { return !!this.k.L }, get right() { return !!this.k.R }, get down() { return !!this.k.D }, get jump() { return !!this.k.J }, get jumpPressed() { return !!this.p.J }, get run() { return !!this.k.S }, get firePressed() { return false }, get escape() { return false }, justPressed(c) { return !!this.p[c] }, isDown(c) { return !!this.k[c] }, update() {} };
  const g = new Game(cv.getContext('2d'), inp); g.music.enabled = false; for (const m of ['start', 'playCollect', 'playEndJingle']) g.music[m] = () => {};
  g.selectedChar = 'eevee'; g.start(); g.state = 'PLAYING'; g.lives = 99; g._jumpToLevel(8, 3); g.levelIntroTimer = 0;
  const log = []; let prevJ = 0, frame = 0;
  const P = () => g.player;
  const step = (k) => { inp.p = {}; inp.k = k; if (k.J && !prevJ) inp.p.J = 1; prevJ = k.J ? 1 : 0; g.player.invincible = Math.max(g.player.invincible || 0, 2); g.update(); frame++; if (frame % 4 === 0) g.render(); };
  const sub = () => g.world8SubArea ?? 0;
  const fail = (msg) => { log.push(`FAIL ${msg} @ room ${sub()} x=${Math.round(P().x)} y=${Math.round(P().y)} dead=${P().dead} frame=${frame}`); throw new Error('stop'); };
  // measure max jump height / distance on flat ground first
  for (let f = 0; f < 40; f++) step({});
  const p0 = P(); const sx = p0.x; let minY = p0.y; const y0 = p0.y;
  for (let f = 0; f < 60; f++) { step({ J: f < 32 ? 1 : 0 }); minY = Math.min(minY, P().y); if (f > 5 && P().onGround) break; }
  log.push(`max jump height ≈ ${Math.round(y0 - minY)} px (start y=${Math.round(y0)})`);
  for (let f = 0; f < 60; f++) step({ L: 1, S: 1 }); // back to start wall
  for (let f = 0; f < 30; f++) step({});
  const x1 = P().x; for (let f = 0; f < 90; f++) { step({ R: 1, S: 1, J: f < 32 ? 1 : 0 }); if (f > 5 && P().onGround) break; }
  log.push(`run-jump distance from standstill ≈ ${Math.round(P().x - x1)} px`);
  for (let f = 0; f < 200; f++) step({ L: 1, S: 1 }); for (let f = 0; f < 30; f++) step({});
  const goto = (x, opts = {}) => { let stuck = 0, lastX = P().x, jf = 0; for (let f = 0; f < (opts.max || 1500); f++) { const d = x - P().x; if (Math.abs(d) < 3 && Math.abs(P().vx) < 0.4) return;
      if (Math.abs(d) < 60 && P().onGround) { const gap = d - P().vx * 12; step({ R: gap > 1 ? 1 : 0, L: gap < -1 ? 1 : 0 }); if (P().dead) fail(`died approaching ${x}`); continue; } if (Math.abs(P().x - lastX) < 0.5 && P().onGround) stuck++; else stuck = 0; lastX = P().x; if (stuck > 8) { const near = (g.level.plants || []).filter(q => Math.abs((q.pipeX + 32) - (P().x + 14)) < 110); let guard = 0; while (near.some(q => q.state !== 'hidden') && guard++ < 1500) { step({}); if (P().dead) fail('died waiting for plant'); } jf = 28; stuck = 0; } const threat = g.level.enemies.some(e => !e.dead && e.x > P().x + 8 && e.x < P().x + 80 && Math.abs(e.y - P().y) < 48); if (false && threat && jf === 0 && P().onGround) jf = 22; step({ R: d > 0 ? 1 : 0, L: d < 0 ? 1 : 0, S: opts.run ? 1 : 0, J: jf > 0 ? 1 : 0 }); if (jf > 0) jf--; if (P().dead) fail(`died walking to ${x}`); } fail(`could not reach x=${x}`); };
  const jumpRight = (hold = 32, run = 1, dir = 'R') => { for (let f = 0; f < 120; f++) { step({ [dir]: 1, S: run, J: f < hold ? 1 : 0 }); if (f > 6 && P().onGround) return; if (P().dead) fail('died in jump'); } };
  const idle = (n) => { for (let f = 0; f < n; f++) step({}); };
  const down = () => { const r = sub(); for (let f = 0; f < 240; f++) { step({ D: 1 }); if (sub() !== r && g.areaTransTimer === 0) return; } fail('pipe did not transport'); };
  const plantHidden = (px) => { const pl = (g.level.plants || []).find(q => Math.abs(q.pipeX - px) < 40); if (!pl) return; waitUntil(() => pl.state === 'hidden', 1500); };
  const waitUntil = (fn, max = 2000, k = {}) => { for (let f = 0; f < max; f++) { if (fn()) return; step(k); if (P().dead) fail('died waiting'); } fail('waitUntil timeout'); };
  try {
    // ROOM 0: start lava pool 192..512 has a stone bridge; run-jump over it
    goto(100, { run: 0 }); idle(5); jumpRight(32, 0); idle(5); log.push(`on start wall: x=${Math.round(P().x)} y=${Math.round(P().y)}`); jumpRight(32, 1); log.push(`after pool jump: x=${Math.round(P().x)} y=${Math.round(P().y)}`); goto(560, { run: 0 }); goto(1000, { run: 0 });
    log.push(`after start pool: x=${Math.round(P().x)} room ${sub()}`);
    for (let tries = 0; tries < 5 && P().y > 480; tries++) { goto(2285, { run: 0 }); idle(10); jumpRight(32, 0); idle(5); }   // onto raised floor (top 444)
    log.push(`raised floor? x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    goto(2440, { run: 0 }); idle(20);       // on the raised floor, short of the lava edge (2464)
    const lift = g.level.movingPlatforms.find(m => m.range > 0);
    log.push(`lift y=${lift.y} travels ${lift.startX}..${lift.startX + lift.range} (+${lift.w}), player x=${Math.round(P().x)}`);
    waitUntil(() => lift.x <= lift.startX + 2);   // lift at its nearest point (80px gap)
    for (let f = 0; f < 120; f++) { step({ R: f < 30 ? 1 : 0, S: 1, J: f < 32 ? 1 : 0 }); if (f > 6 && P().onGround) break; if (P().dead) fail('died jumping to lift'); }
    while (P().vx > 0.3) step({ L: 1 });   // brake the run momentum on the lift
    idle(5);
    waitUntil(() => P().y < 460 && P().onGround, 200, { R: 0 });
    log.push(`on lift? x=${Math.round(P().x)} y=${Math.round(P().y)} liftx=${Math.round(lift.x)}`);
    waitUntil(() => lift.x >= lift.startX + lift.range - 2, 800, {});   // ride to the far end
    jumpRight(32, 1);                       // jump to floor at 3008
    while (P().vx > 0.3) step({ L: 1 }); idle(5);
    log.push(`after lift: x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    goto(3120, { run: 0 }); idle(5); plantHidden(3200);   // wait on the stone, out of the plant's range
    goto(3170, { run: 0 }); idle(3); jumpRight(28, 0);   // up onto pipe T2 (x 3200, top 380)
    goto(3216, { run: 0 }); down();
    log.push(`room ${sub()} via T2`);
    // ROOM 1: hub → T3 pipe at 2144 on a stone (stone top 412, pipe top 316)
    goto(1100, { run: 1 }); jumpRight(32); // over the first pipes region by jumping; fall back to walking
    // hidden block (x 2112, top 444) → stone + T3 pipe (top 348)
    const hb = g.level.qblocks.find(q => q.hidden && Math.abs(q.x - 2112) < 8);
    log.push(`hidden block: ${hb ? `x=${hb.x} y=${hb.y}` : 'MISSING'}`);
    goto(2104, { run: 0 }); idle(10);
    for (let f = 0; f < 60; f++) { step({ J: f < 32 ? 1 : 0 }); if (f > 6 && P().onGround) break; }   // bump it from below
    log.push(`after bump: hidden=${hb && hb.hidden} x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    if (hb && hb.hidden) fail('hidden block not revealed');
    goto(2040, { run: 0 }); idle(10);
    for (let f = 0; f < 90; f++) { step({ J: f < 32 ? 1 : 0, R: f < 40 ? 1 : 0 }); if (f > 6 && P().onGround) break; }   // walk-jump onto the block
    while (Math.abs(P().vx) > 0.3) step({ L: P().vx > 0 ? 1 : 0, R: P().vx < 0 ? 1 : 0 }); idle(5);
    log.push(`on block? x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    if (P().y > 420) fail('could not get onto the hidden block');
    plantHidden(2144); goto(2116, { run: 0 }); idle(3);
    for (let f = 0; f < 80; f++) { step({ J: f < 32 ? 1 : 0, R: 1 }); if (f > 6 && P().onGround) break; }   // onto the pipe top
    while (Math.abs(P().vx) > 0.3) step({ L: P().vx > 0 ? 1 : 0, R: P().vx < 0 ? 1 : 0 });
    log.push(`on pipe? x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    goto(2168, { run: 0 }); down();
    log.push(`room ${sub()} via T3`);
    // ROOM 2: → T4 at 1152 (top 380) past lava 896..1152
    goto(760, { run: 0 }); idle(5); goto(860, { run: 0 }); idle(5); jumpRight(32, 1);
    while (Math.abs(P().vx) > 0.3) step({ L: P().vx > 0 ? 1 : 0, R: P().vx < 0 ? 1 : 0 });
    log.push(`room2 after lava: x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    goto(1060, { run: 0 }); idle(5); plantHidden(1152); goto(1120, { run: 0 }); idle(3); jumpRight(28, 0); goto(1168, { run: 0 }); down();
    log.push(`room ${sub()} via T4`);
    // ROOM 3: underwater corridor → horizontal pipe at 2176
    const hp = g.level.hPipeExits[0];
    { let mode = 0, lastX = P().x, lastCheck = 0; const targetY = [300, 420, 230, 480];
      for (let f = 0; f < 6000; f++) {
        if (f - lastCheck >= 40) { if (P().x - lastX < 6) { mode = (mode + 1) % targetY.length; } lastX = P().x; lastCheck = f; }
        const wantUp = P().y > targetY[mode];
        step({ R: 1, J: (wantUp && f % 10 < 6) ? 1 : 0 });
        if (P().dead) fail('died underwater'); if (sub() === 4 || g.areaTransTimer > 0) break;
        if (f % 600 === 599) log.push(`swim f${f} x=${Math.round(P().x)} y=${Math.round(P().y)} mode=${mode}`);
      } }
    waitUntil(() => sub() === 4 && g.areaTransTimer === 0, 300);
    log.push(`room ${sub()} via water pipe`);
    // ROOM 4: lava 512..960, floor 736.. at 444, then bridge/axe
    { const res = []; let okT = null;
      for (const trig of [520, 535, 548, 560, 570]) {
        P().x = 330; P().y = 508; P().vx = 0; P().vy = 0; idle(3);
        let jumped = false, jf = 0, landed = null;
        for (let f = 0; f < 200; f++) { if (!jumped && P().x >= trig && P().onGround) { jumped = true; jf = 32; } step({ R: 1, S: 1, J: jf > 0 ? 1 : 0 }); if (jf > 0) jf--; if (jumped && jf < 30 && P().onGround) { landed = [Math.round(P().x), Math.round(P().y)]; break; } if (P().dead) { landed = ['dead']; break; } }
        res.push(`${trig}:${landed ? landed.join(',') : '?'}`); if (landed && landed[1] === 412 && !okT) okT = trig;
      }
      log.push('room4 lava sweep ' + res.join(' '));
      if (!okT) fail('no run-jump clears the room-4 lava');
      P().x = 330; P().y = 508; P().vx = 0; P().vy = 0; idle(3);
      let jumped = false, jf = 0; for (let f = 0; f < 200; f++) { if (!jumped && P().x >= okT && P().onGround) { jumped = true; jf = 32; } step({ R: 1, S: 1, J: jf > 0 ? 1 : 0 }); if (jf > 0) jf--; if (jumped && jf < 30 && P().onGround) break; }
    }
    log.push(`room4 after lava: x=${Math.round(P().x)} y=${Math.round(P().y)}`);
    const L4 = g.level; log.push(`axe=${JSON.stringify(L4.bossAxe && { x: L4.bossAxe.x, y: L4.bossAxe.y, taken: L4.bossAxe.taken })} bridge=${L4.bossBridgeX},${L4.bossBridgeW},${L4.bossBridgeY} boss=${L4.castleBoss && Math.round(L4.castleBoss.x)} width=${L4.width}`);
    goto(1300, { run: 0 }); idle(5);
    for (let f = 0; f < 3000; f++) { step({ R: f < 40 ? 1 : 0 }); if (g.state === 'ENDING') break; if (P().dead) fail('died in boss room'); if (f % 500 === 499) log.push(`boss f${f} x=${Math.round(P().x)} y=${Math.round(P().y)} axeTaken=${L4.bossAxe && L4.bossAxe.taken} walkToPC=${g.walkToPC} state=${g.state}`); }
    log.push(`state=${g.state} x=${Math.round(P().x)} axeTaken=${L4.bossAxe && L4.bossAxe.taken}`);
  } catch (e) { if (e.message !== 'stop') log.push('EXC ' + e.message + ' ' + e.stack.split('\n')[1]); }
  return log;
});
console.log(log.join('\n'));
await browser.close(); server.close();
const ok = log.some(l => l.startsWith('state=ENDING')) && !log.some(l => l.startsWith('FAIL') || l.startsWith('EXC'));
console.log(ok ? '\n8-4 ROUTE OK' : '\n8-4 ROUTE FAILED');
process.exit(ok ? 0 : 1);
