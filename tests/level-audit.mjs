// ============================================================
// Static level audit — run with:  node tests/level-audit.mjs
// Builds every level / sub-area and checks: build errors, spawn safety
// (after Game._safeSpawn), enemies/coins buried in solids, duplicate
// blocks, pipes jammed under blocks, goal presence, and a coarse
// jump-reachability BFS from the spawn to the goal (flag / axe / exit
// pipe / maze pipe). Exits 1 if anything other than INFO is found.
// ============================================================
import { GROUND_Y } from '../src/constants.js';
import { Player } from '../src/entities/player.js';
import { Platform } from '../src/entities/platform.js';
const W = {};
for (let i = 1; i <= 8; i++) W[i] = (await import(`../src/levels/world${i}.js`))[`buildWorld${i}`];

// ── jump arc (full-hold running jump), continued into free fall ──
const floor = new Platform(-1e5, GROUND_Y, 2e5, 60, '#000');
const game = { onBlockBumped(){}, spawnFireball(){} };
const p = new Player(0, GROUND_Y - 60); p.power = 1; p._applySize();
const inp = (j, jp) => ({ left:false,right:true,down:false,run:true,jump:j,jumpPressed:jp,firePressed:false,justPressed:()=>false });
for (let i=0;i<120;i++) p.update(inp(false,false),[floor],game);
const x0 = p.x, y0 = p.y, arc = [];
p.update(inp(true,true),[floor],game);
for (let f=0; f<260; f++) { arc.push([p.x - x0, y0 - p.y]); p.update(inp(true,false),[],game); }
const PEAK = Math.max(...arc.map(a => a[1]));
const dmax = (h, peak) => {          // furthest horizontal reach that lands at relative height h
  if (h > peak) return -1;
  let best = -1, rising = true;
  for (let i=1;i<arc.length;i++) { if (arc[i][1] < arc[i-1][1]) rising = false;
    if (!rising && arc[i][1] >= h * (PEAK/peak)) best = arc[i][0]; }
  return best;
};

const PW = 30, PH = 30;              // optimistic (small form) body
const SPECS = [
  [1,0,0,'flag'],[1,0,1,'hpipe'],[1,1,1,'hpipe'],[1,1,2,'flag'],[1,2,0,'flag'],[1,3,0,'axe'],
  [2,0,0,'flag'],[2,0,1,'hpipe'],[2,1,2,'flag'],[2,2,0,'flag'],[2,3,0,'axe'],
  [3,0,0,'flag'],[3,0,1,'hpipe'],[3,1,0,'flag'],[3,2,0,'flag'],[3,3,0,'axe'],
  [4,0,0,'flag'],[4,0,1,'hpipe'],[4,1,1,'hpipe'],[4,1,2,'hpipe'],[4,1,3,'flag'],[4,2,0,'flag'],[4,3,0,'axe'],
  [5,0,0,'flag'],[5,0,1,'hpipe'],[5,1,0,'flag'],[5,2,0,'flag'],[5,3,0,'axe'],
  [6,0,0,'flag'],[6,1,0,'flag'],[6,1,1,'hpipe'],[6,1,4,'hpipe'],[6,2,0,'flag'],[6,3,0,'axe'],
  [7,0,0,'flag'],[7,0,1,'hpipe'],[7,1,2,'flag'],[7,2,0,'flag'],[7,3,0,'axe'],
  [8,0,0,'flag'],[8,0,1,'hpipe'],[8,1,0,'flag'],[8,1,1,'hpipe'],[8,2,0,'flag'],
  [8,3,0,'pipe:2'],[8,3,1,'pipe:3'],[8,3,2,'pipe:4'],[8,3,4,'axe'],
  // build/spawn-only checks (swim / sky / auto-walk areas)
  [1,1,0,null],[2,0,2,null],[2,1,0,null],[2,1,1,null],[3,0,2,null],[4,1,0,null],[4,1,4,null],
  [5,1,1,null],[5,1,2,null],[6,1,2,null],[6,1,3,null],[7,1,0,null],[7,1,1,null],[8,3,3,null],
];
const ov = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const issues = [];
const note = (id, kind, msg) => issues.push({ id, kind, msg });

for (const [w,l,s,goal] of SPECS) {
  const id = `${w}-${l+1}${s ? ' sub'+s : ''}`;
  let lvl;
  try { lvl = W[w](l, s); } catch (e) { note(id,'BUILD','crash: '+e.message); continue; }
  const statics = [...lvl.platforms, ...lvl.qblocks].filter(o => !o.dead && !o.hidden);
  const solids = [...statics, ...lvl.movingPlatforms];

  // spawn safety (default spawn and exitSpawn)
  // same algorithm as Game._safeSpawn
  const safe = (x, y) => {
    const clear = (bx, by) => !statics.some(o => bx < o.x+o.w && bx+32 > o.x && by < o.y+o.h && by+56 > o.y);
    if (clear(x, y)) return [x, y];
    for (let d = 8; d <= 64; d += 8) for (const cx of [x-d, x+d]) if (cx >= 0 && clear(cx, y)) return [cx, y];
    for (let d = 8; d <= 320; d += 8) for (const cx of [x-d, x+d]) { if (cx < 0) continue;
      const tops = statics.filter(o => cx < o.x+o.w && cx+32 > o.x && o.y > y-200 && o.y <= y+56).map(o => o.y).sort((a,b)=>a-b);
      for (const t of tops) if (clear(cx, t-56)) return [cx, t-56]; }
    return [x, y];
  };
  const [sx0, sy0] = safe(80, GROUND_Y-60);
  const spawns = [{ n:'start', x:sx0, y:sy0 }];
  if (lvl.exitSpawn) { const [ex, ey] = safe(lvl.exitSpawn.x, lvl.exitSpawn.y); spawns.push({ n:'exitSpawn', x:ex, y:ey }); }
  for (const sp of spawns) {
    const box = { x:sp.x, y:sp.y, w:32, h:56 };
    const hit = statics.filter(o => ov(box,o));
    if (hit.length) note(id,'SPAWN',`${sp.n} (${sp.x},${sp.y}) inside ${hit.length} solid(s)`);
    const below = statics.filter(o => o.x < sp.x+32 && o.x+o.w > sp.x && o.y >= sp.y+56-2);
    if (!below.length && !lvl.underwater && !lvl.isSky) note(id,'SPAWN',`${sp.n} x=${sp.x} has nothing underneath (falls into pit)`);
  }
  // entities buried in walls
  for (const e of lvl.enemies) {
    if (e.flying || ['podoboo','blooper','cheepcheep','zubat','bulletbill'].includes(e.type)) continue;
    const box = { x:e.x+3, y:e.y+3, w:e.w-6, h:e.h-6 };
    if (statics.some(o => ov(box,o))) note(id,'ENEMY_IN_WALL',`${e.type} at x=${Math.round(e.x)} y=${Math.round(e.y)}`);
  }
  if (sx0 !== 80) note(id,'INFO_SPAWN_MOVED',`default spawn blocked → safe spawn at (${sx0},${sy0})`);
  let buried = 0; const bx = [];
  for (const c of lvl.coins) { const box = { x:c.x+4, y:c.y+4, w:(c.w||20)-8, h:(c.h||20)-8 };
    if (statics.some(o => ov(box,o))) { buried++; bx.push(Math.round(c.x)); } }
  if (buried) note(id,'COIN_IN_WALL',`${buried} coin(s) inside solids, x≈${bx.slice(0,6).join(',')}`);
  // duplicate blocks at the same spot
  const seen = new Map();
  for (const o of [...lvl.platforms, ...lvl.qblocks]) {
    if (!(o.kind==='brick'||o.kind==='qblock')) continue;
    const k = o.x+','+o.y; if (seen.has(k)) note(id,'DUP_BLOCK',`${seen.get(k)} + ${o.kind} at x=${o.x} y=${o.y}`); else seen.set(k,o.kind);
  }
  // floating pipes / stones hovering over a pipe
  for (const o of lvl.platforms) if (o.enterable !== undefined) {
    const over = statics.filter(q => q !== o && q.x < o.x+o.w && q.x+q.w > o.x && q.y+q.h <= o.y && q.y+q.h > o.y - 40);
    if (over.length) note(id,'PIPE_UNDER_BLOCK',`pipe x=${o.x} top=${o.y} has solid ${o.y-(over[0].y+over[0].h)}px above it`);
  }
  // end goal present
  if (goal === 'flag' && !lvl.flagPole) note(id,'GOAL','no flagpole');
  if (goal === 'axe' && !(lvl.castleBoss && lvl.bossAxe)) note(id,'GOAL','no boss/axe');
  if (goal === 'flag' && lvl.flagPole && lvl.flagPole.x > lvl.width - 64) note(id,'GOAL',`flag x=${lvl.flagPole.x} beyond level width ${lvl.width}`);
  if (!goal || lvl.underwater || lvl.isSky) continue;

  // ── reachability BFS ──
  const surf = [];
  for (const o of statics) {
    let segs = [[o.x, o.x+o.w]];
    for (const q of statics) { if (q === o || !(q.y < o.y && q.y+q.h > o.y-PH)) continue;
      segs = segs.flatMap(([a,b]) => (q.x+q.w <= a || q.x >= b) ? [[a,b]] : [[a,q.x],[q.x+q.w,b]].filter(([m,n]) => n-m >= 12)); }
    for (const [a,b] of segs) surf.push({ a, b, y:o.y, peak: o.kind==='spring' ? 330 : PEAK });
  }
  for (const m of lvl.movingPlatforms) {
    if (m.scale) { for (let y = m.beamY+20; y < GROUND_Y+40; y += 32) surf.push({ a:m.x, b:m.x+m.w, y, peak:PEAK }); continue; }
    if (m.transportRide) { surf.push({ a:m.x, b:lvl.width, y:m.y, peak:PEAK }); continue; }
    if (m.axis === 'x' && m.range) { surf.push({ a:m.startX, b:m.startX+m.range+m.w, y:m.y, peak:PEAK }); continue; }
    if (m.axis === 'y' && m.range) { for (let y = Math.max(m.startY,-40); y <= Math.min(m.startY+m.range, GROUND_Y+60); y += 24) surf.push({ a:m.x, b:m.x+m.w, y, peak:PEAK }); continue; }
    surf.push({ a:m.x, b:m.x+m.w, y:m.y, peak:PEAK });
  }
  const startS = surf.filter(t => t.a < sx0+32 && t.b > sx0 && t.y >= sy0+56-4).sort((a,b)=>a.y-b.y)[0];
  if (!startS) { note(id,'REACH','no surface under the start'); continue; }
  const seenS = new Set([startS]); const q = [startS]; let maxX = startS.b;
  while (q.length) {
    const A = q.shift();
    for (const B of surf) { if (seenS.has(B)) continue;
      const h = A.y - B.y, d = Math.max(0, B.a - A.b, A.a - B.b);
      if (d === 0 && h > 0 && B.a <= A.a && B.b >= A.b) continue;       // directly overhead, no room
      const r = dmax(h, A.peak); if (r < 0 || d > r + PW) continue;
      // a full-height wall between the two surfaces (top above the arc peak,
      // bottom below the lower edge) blocks the jump
      const lo = Math.min(A.y, B.y), gx1 = Math.min(A.b, B.b), gx2 = Math.max(A.a, B.a);
      if (gx2 > gx1 && statics.some(o => o.x < gx2 && o.x + o.w > gx1 &&
          o.y <= lo - A.peak - 8 && o.y + o.h >= lo - 8)) continue;
      seenS.add(B); q.push(B); maxX = Math.max(maxX, B.b);
    }
  }
  let gx, label;
  if (goal === 'flag') { gx = lvl.flagPole.x; label = 'flagpole'; }
  else if (goal === 'axe') { gx = lvl.bossAxe.x; label = 'Ultra Ball (axe)'; }
  else if (goal === 'hpipe') { const hp = (lvl.hPipeExits||[]).slice(-1)[0]; if (!hp) { note(id,'GOAL','no exit pipe'); continue; } gx = hp.x; label = 'exit pipe'; }
  else { const t = +goal.split(':')[1]; const pp = lvl.platforms.find(o => o.transportId === t); if (!pp) { note(id,'GOAL',`no pipe with transport ${t}`); continue; } gx = pp.x; label = `pipe→${t}`; }
  if (maxX < gx - 20) {
    // find the blocking gap: rightmost reached surface
    note(id,'REACH',`cannot reach ${label} at x=${gx}; stuck around x≈${Math.round(maxX)}`);
  }
}
const byKind = {};
for (const i of issues) (byKind[i.kind] ||= []).push(i);
for (const [k, list] of Object.entries(byKind)) { console.log(`\n== ${k} (${list.length}) ==`); for (const i of list) console.log(`  ${i.id.padEnd(9)} ${i.msg}`); }
const real = issues.filter(i => !i.kind.startsWith('INFO'));
console.log(`\nTOTAL: ${real.length} problem(s), ${issues.length - real.length} info note(s) across ${SPECS.length} level/sub-areas`);
process.exit(real.length ? 1 : 0);
