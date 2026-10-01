// ── Shared sprite helpers (draw-only) ────────────────────────────────────────
// Mirrors the module-level helpers in player.js so enemies/items/bosses use
// the same SNES-style look: base fill, darker underside shade (same path
// shifted down and clipped to itself), ~1.5px ink outline, small specular
// highlight, and a soft drop-shadow ellipse under grounded sprites.
export const TAU = Math.PI * 2;
const _tintCache = new Map();
// darken (f < 1) or lighten toward white (f > 1) a '#rrggbb' colour; memoised
export function tint(hex, f) {
  const k = hex + f;
  const hit = _tintCache.get(k);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => { const v = (n >> s) & 255; return Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)); };
  const out = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  _tintCache.set(k, out);
  return out;
}
// build: fn that adds the path (called up to 3×, no beginPath inside)
// o: { lw: outline width, sh: shade factor (0 = none), shade: explicit shade
//      colour, dy/dx: shade offset }
export function shape(ctx, build, fill, ol, o) {
  const sh = o && o.sh !== undefined ? o.sh : 0.74;
  ctx.beginPath(); build(); ctx.fillStyle = fill; ctx.fill();
  if (sh && fill[0] === '#') {
    ctx.save(); ctx.clip();
    ctx.translate(o && o.dx !== undefined ? o.dx : -0.6, o && o.dy !== undefined ? o.dy : 2.4);
    ctx.beginPath(); build(); ctx.fillStyle = (o && o.shade) || tint(fill, sh); ctx.fill();
    ctx.restore();
  }
  if (ol) {
    ctx.beginPath(); build();
    ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.5; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
export function ell(ctx, x, y, rx, ry, rot, fill, ol, o) {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, rot, 0, TAU), fill, ol, o);
}
export function poly(ctx, pts, fill, ol, o) {
  shape(ctx, () => {
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }, fill, ol, o);
}
// soft specular highlight (small tilted ellipse, upper-left of a shape)
export function hilite(ctx, x, y, rx, ry, a = 0.32) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.6, 0, TAU); ctx.fill();
}
export const L = (a, b, t) => a + (b - a) * t;
// band across a triangle (ax,ay)-(bx,by) base, (tx,ty) tip, between t0..t1
export function band(ctx, ax, ay, bx, by, tx, ty, t0, t1, col) {
  poly(ctx, [L(ax, tx, t0), L(ay, ty, t0), L(bx, tx, t0), L(by, ty, t0),
             L(bx, tx, t1), L(by, ty, t1), L(ax, tx, t1), L(ay, ty, t1)], col, null, { sh: 0 });
}
// soft contact shadow under the feet so a sprite sits on the ground
export function shadow(ctx, cx, cy, rx, ry = 2.6, a = 0.25) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
}
// small round eye with pupil + shine
export function eye(ctx, x, y, r, iris = '#111', white = '#fff', pr = 0.55) {
  if (white) ell(ctx, x, y, r, r * 1.15, 0, white, '#111', { sh: 0, lw: 1 });
  ell(ctx, x, y + r * 0.1, r * pr, r * pr * 1.2, 0, iris, null, { sh: 0 });
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - r * 0.45, y - r * 0.45, Math.max(1, r * 0.45), Math.max(1, r * 0.45));
}
