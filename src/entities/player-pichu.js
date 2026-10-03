// Pichu line: Pichu (small), Pikachu (evo 1), Raichu (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
// Same look as the Eevee / Charmander lines: base fill with an explicit darker
// shade on the underside, ~1.3–1.6px ink outline on every solid shape, one
// small specular on the head, Eevee-style oval eyes with a glint. The head and
// cheek pouches are one silhouette (union path), ears are leaf shapes with
// real thickness, a base shadow and a diagonal black tip, limbs carry
// finger/toe marks and the tails get their own shade pass.
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L } from './sprite-utils.js';

// ── shared pieces ────────────────────────────────────────────────────────────

// Outline only the outer silhouette of a multi-part path (fill, stroke, re-fill)
function union(ctx, build, fill, ol, o) {
  shape(ctx, build, fill, null, o);
  ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); build(); ctx.stroke();
  shape(ctx, build, fill, null, o);
}

// Head ellipse plus two cheek pouches bulging out of its lower sides, as one path
const headPath = (ctx, cx, cy, rx, ry, cw, chy, crx, cry) => () => {
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.moveTo(cx - cw + crx, chy); ctx.ellipse(cx - cw, chy, crx, cry, 0, 0, TAU);
  ctx.moveTo(cx + cw + crx, chy); ctx.ellipse(cx + cw, chy, crx, cry, 0, 0, TAU);
};

// Leaf-shaped ear: base chord A–B sits on the head, tip T; `fat` bows the two
// edges outward so the ear has thickness. Beyond a diagonal cut (u1 along the
// A edge, u2 along the B edge) the ear is painted tipCol; a soft shadow sits in
// the base where it meets the head and a darker band runs up the A (inner) edge.
function leafEar(ctx, A, B, T, fat, col, ol, o, tipCol, u1, u2, innerSh) {
  const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const ax = T[0] - mid[0], ay = T[1] - mid[1], len = Math.hypot(ax, ay);
  let nx = -ay / len, ny = ax / len;                                   // unit normal…
  if ((A[0] - mid[0]) * nx + (A[1] - mid[1]) * ny < 0) { nx = -nx; ny = -ny; } // …pointing to A's side
  const C1 = [L(A[0], T[0], 0.42) + nx * fat, L(A[1], T[1], 0.42) + ny * fat];
  const C2 = [L(B[0], T[0], 0.42) - nx * fat, L(B[1], T[1], 0.42) - ny * fat];
  const path = () => {
    ctx.moveTo(A[0], A[1]);
    ctx.quadraticCurveTo(C1[0], C1[1], T[0], T[1]);
    ctx.quadraticCurveTo(C2[0], C2[1], B[0], B[1]);
    ctx.closePath();
  };
  shape(ctx, path, col, null, o);
  ctx.save(); ctx.beginPath(); path(); ctx.clip();
  // darker band along the inner edge (the ear turning away from the light)
  ctx.strokeStyle = innerSh; ctx.lineWidth = fat * 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(C1[0], C1[1], T[0], T[1]); ctx.stroke();
  // shadow where the ear meets the head
  ell(ctx, mid[0] + ax / len * 1.2, mid[1] + ay / len * 1.2, fat * 1.6, len * 0.2, Math.atan2(ny, nx), 'rgba(40,20,0,0.22)', null, { sh: 0 });
  // tip: everything beyond a straight diagonal cut from u1 on one edge to u2 on the other
  const P1 = [L(A[0], T[0], u1), L(A[1], T[1], u1)], P2 = [L(B[0], T[0], u2), L(B[1], T[1], u2)];
  const ex = ax / len * len, ey = ay / len * len;
  poly(ctx, [P1[0] + nx * 8, P1[1] + ny * 8, P2[0] - nx * 8, P2[1] - ny * 8,
             P2[0] - nx * 8 + ex, P2[1] - ny * 8 + ey, P1[0] + nx * 8 + ex, P1[1] + ny * 8 + ey], tipCol, null, { sh: 0 });
  ctx.restore();
  ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.4; ctx.lineJoin = 'round';
  ctx.beginPath(); path(); ctx.stroke();
}

// Short ink ticks (finger / toe marks): [[x0,y0,x1,y1], …]
function marks(ctx, pts, col, lw = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of pts) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
}
// Foot ellipse with two toe notches on its front half
function foot(ctx, x, y, rx, ry, rot, col, ol, o) {
  ell(ctx, x, y, rx, ry, rot, col, ol, o);
  if (!rot) marks(ctx, [[x - rx * 0.33, y + ry * 0.2, x - rx * 0.33, y + ry * 0.95], [x + rx * 0.33, y + ry * 0.2, x + rx * 0.33, y + ry * 0.95]], ol, 1);
}
// Arm: rounded stick hanging from the shoulder (x, y), rotated by rot, with n
// finger ticks fanning across its rounded end
function arm(ctx, x, y, rx, ry, rot, col, ol, o, n) {
  ell(ctx, x, y, rx, ry, rot, col, ol, o);
  const m = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i - (n - 1) / 2) * 0.42, d0 = ry * 0.5, d1 = ry * 0.92;
    m.push([x - Math.sin(a) * d0, y + Math.cos(a) * d0, x - Math.sin(a) * d1, y + Math.cos(a) * d1]);
  }
  marks(ctx, m, ol, 0.9);
}

// Eevee-style eyes: dark oval, a square glint upper-left and a faint lower-right one
function eyes(ctx, lx, rx, y, erx, ery, col) {
  for (const ex of [lx, rx]) {
    ell(ctx, ex, y, erx, ery, 0, col, null, { sh: 0 });
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - erx * 0.7, y - ery * 0.8, 1.6, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(ex + erx * 0.15, y + ery * 0.35, 1, 1);
  }
}
// Dot nose with a tiny "w" mouth below it
function wMouth(ctx, x, y, r, col, nose = true) {
  if (nose) ell(ctx, x, y - r * 1.5, r * 0.75, r * 0.5, 0, col, null, { sh: 0 });
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x - r, y, r, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r, y, r, 0.3, Math.PI - 0.3); ctx.stroke();
}
// Cheek pouch: coloured disc with its own thin outline, a shade pass and a gloss
function cheek(ctx, x, y, rx, ry, col, ol, shade, gloss) {
  ell(ctx, x, y, rx, ry, 0, col, ol, { shade, lw: 1, dy: 1.7, dx: -0.3 });
  if (gloss) hilite(ctx, x - rx * 0.3, y - ry * 0.4, rx * 0.45, ry * 0.25, 0.45);
}

// Tapering polyline stroke (ink → body → stripe), used for Raichu's curled ears
function taper(ctx, pts, w0, w1, col) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col;
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = L(w0, w1, i / (pts.length - 2));
    ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
  }
}

// Tail tube: ink under a shaded stroke with a lighter top edge
function tailStroke(ctx, build, col, shade, ol, lw) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ol;    ctx.lineWidth = lw + 2.6; ctx.beginPath(); build(); ctx.stroke();
  ctx.strokeStyle = shade; ctx.lineWidth = lw;       ctx.beginPath(); build(); ctx.stroke();
  ctx.save(); ctx.translate(0, -lw * 0.22);
  ctx.strokeStyle = col;   ctx.lineWidth = lw * 0.6; ctx.beginPath(); build(); ctx.stroke();
  ctx.restore();
}

export function drawPichu(p, ctx, w, h) {
  const pw      = p.power;
  const jumping = !p.onGround;
  const moving  = Math.abs(p.vx) > 0.3;
  const step    = moving ? Math.floor(p.animTimer / 8) % 2 : 0;
  const sway    = moving ? Math.sin(p.animTimer * 0.4) : 0;
  const swing   = moving ? (step ? 0.25 : -0.25) : 0;      // arm swing

  if (pw === POWER.SMALL) {
    // ── PICHU (28×32) ── pale-yellow baby mouse: oversized head with the cheek
    // pouches in its outline, fat diamond ears with black outer tips, a notched
    // black collar hugging the body, tiny hands held in front, black stub tail.
    const BODY = '#fff0a0', SH = '#ecd04c', BELLY = '#fff9d4', OL = '#4e3a0a';
    const BLACK = '#262220', BLACK_SH = '#121010', BLACK_OL = '#080604';
    const CHEEK = '#f498b4', CHEEK_SH = '#dc7898', CHEEK_OL = '#a04868', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.5;

    // Stub tail — short yellow root at the hip ending in a black kite, tip up
    // and out behind the left side
    const tq = [cx - w*0.16, h*0.75, cx - w*0.34, h*0.6 - sway*0.5, cx - w*0.5, h*0.55 - sway*0.5, cx - w*0.4, h*0.73];
    poly(ctx, tq, BLACK, BLACK_OL, { lw: 1.2, shade: BLACK_SH, dy: 1.6 });
    poly(ctx, [tq[0], tq[1], L(tq[0], tq[2], 0.45), L(tq[1], tq[3], 0.45), L(tq[0], tq[6], 0.45), L(tq[1], tq[7], 0.45)], BODY, OL, { lw: 1.1, shade: SH, dy: 1.4 });

    // Feet with toe marks
    if (jumping) {
      foot(ctx, cx - w*0.2, h*0.87, w*0.1, h*0.085, 0.35, BODY, OL, oL);
      foot(ctx, cx + w*0.19, h*0.84, w*0.1, h*0.085, -0.35, BODY, OL, oL);
    } else {
      foot(ctx, cx - w*0.19 + step*1.6, h*0.9, w*0.105, h*0.1, 0, BODY, OL, oL);
      foot(ctx, cx + w*0.17 - step*1.6, h*0.9, w*0.105, h*0.1, 0, BODY, OL, oL);
    }

    // Body — egg; lighter belly tone, then the notched collar following the curve
    const body = () => ctx.ellipse(cx, h*0.73, w*0.28, h*0.21, 0, 0, TAU);
    shape(ctx, body, BODY, OL, o);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    ell(ctx, cx + 0.4, h*0.81, w*0.16, h*0.1, 0, BELLY, null, { sh: 0 });
    const collar = [cx - w*0.4, h*0.4, cx + w*0.4, h*0.4, cx + w*0.4, h*0.66,
                    cx + w*0.2, h*0.75, cx + w*0.1, h*0.68, cx, h*0.77, cx - w*0.1, h*0.68, cx - w*0.2, h*0.75, cx - w*0.4, h*0.66];
    poly(ctx, collar, BLACK, null, { shade: BLACK_SH, dy: 1.8 });
    ctx.strokeStyle = BLACK_OL; ctx.lineWidth = 1; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(collar[4], collar[5]);
    for (let i = 6; i < collar.length; i += 2) ctx.lineTo(collar[i], collar[i + 1]);
    ctx.stroke();
    ctx.restore();

    // Tiny arms with the hands held in front of the collar
    const aRot = jumping ? 1.3 : 0.95 + swing * 0.4;
    arm(ctx, cx - w*0.24, h*0.66, 2.1, 3.6, aRot, BODY, OL, oL, 2);
    arm(ctx, cx + w*0.24, h*0.66, 2.1, 3.6, -aRot, BODY, OL, oL, 2);

    // Ears — big fat diamonds pointing diagonally out; the outer half is black
    const tilt = jumping ? 1.2 : 0;
    leafEar(ctx, [cx - w*0.1, h*0.17], [cx - w*0.31, h*0.3], [w*(-0.1) - tilt*0.3, h*(-0.1) - tilt], 3.6, BODY, OL, oL, BLACK, 0.5, 0.62, SH);
    leafEar(ctx, [cx + w*0.1, h*0.17], [cx + w*0.31, h*0.3], [w*1.1 + tilt*0.3,    h*(-0.1) - tilt], 3.6, BODY, OL, oL, BLACK, 0.5, 0.62, SH);

    // Head with the cheek pouches in its silhouette; muzzle bump beneath
    union(ctx, headPath(ctx, cx, h*0.37, w*0.37, h*0.255, w*0.33, h*0.45, 3.9, 3.4), BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.22, 3.4, 1.7);
    ell(ctx, cx, h*0.5, 3.8, 2.4, 0, BELLY, null, { sh: 0 });

    // Pink cheeks, eyes, nose + "w" mouth
    cheek(ctx, cx - w*0.33, h*0.45, 3.2, 2.8, CHEEK, CHEEK_OL, CHEEK_SH, false);
    cheek(ctx, cx + w*0.33, h*0.45, 3.2, 2.8, CHEEK, CHEEK_OL, CHEEK_SH, false);
    eyes(ctx, cx - w*0.15, cx + w*0.15, h*0.37, 2.3, 3.0, EYE);
    wMouth(ctx, cx, h*0.515, 1.3, EYE);

  } else if (pw === POWER.BIG) {
    // ── PIKACHU (32×56) ── classic yellow: wide head with the cheek pouches in
    // the outline, long black-tipped ears, brown back stripes on the flank,
    // lightning-bolt tail with a brown fur patch rising behind the left shoulder.
    const BODY = '#ffe25a', SH = '#ecbd22', BELLY = '#fff3ac', OL = '#5e4206';
    const BLACK = '#262220', BROWN = '#9a5410', BROWN_SH = '#7a3e0c', BROWN_OL = '#4a2606';
    const CHEEK = '#e8382a', CHEEK_SH = '#bc2418', CHEEK_OL = '#701410', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.56;
    const sx = w / 32, sy = h / 56, P = (pts, dx, dy) => pts.map((v, i) => (i % 2 ? (v + dy) * sy : (v + dx) * sx));

    // Tail — stepped lightning bolt, wide flat head at the top; the plate gets a
    // shade pass (base colour survives along the top faces of each step)
    const tdx = -3 + sway * 0.6, tdy = jumping ? 2 : 4;
    const bolt = [9,41, 4,33, 7,31, 2,23, 5,21, -1,13, 2,6, 13,3, 15,9, 7,12, 5,15, 11,23, 8,25, 13,33, 10,35, 15,43];
    poly(ctx, P(bolt, tdx, tdy), BODY, OL, { shade: SH, lw: 1.4, dy: 3, dx: -1 });
    poly(ctx, P([9,41, 4,33, 7,31, 13,33, 10,35, 15,43], tdx, tdy), BROWN, BROWN_OL, { shade: BROWN_SH, lw: 1, dy: 2.5 });
    // fur tufts where the brown meets the yellow
    poly(ctx, P([7,31, 9,28.5, 11,31.5, 13,33], tdx, tdy), BROWN, null, { sh: 0 });

    // Feet with toes
    if (jumping) {
      foot(ctx, cx - w*0.22, h*0.88, w*0.12, h*0.06, 0.35, BODY, OL, oL);
      foot(ctx, cx + w*0.22, h*0.86, w*0.12, h*0.06, -0.35, BODY, OL, oL);
    } else {
      foot(ctx, cx - w*0.2 + step*1.8, h*0.935, w*0.125, h*0.06, 0, BODY, OL, oL);
      foot(ctx, cx + w*0.18 - step*1.8, h*0.935, w*0.125, h*0.06, 0, BODY, OL, oL);
    }

    // Body — plump pear, lighter belly; two brown stripes on the back (left) flank
    const body = () => ctx.ellipse(cx, h*0.66, w*0.3, h*0.225, 0, 0, TAU);
    shape(ctx, body, BODY, OL, o);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    ell(ctx, cx + 1, h*0.7, w*0.19, h*0.155, 0, BELLY, null, { sh: 0 });
    for (const [y0, y1, y2] of [[0.515, 0.575, 0.635], [0.655, 0.715, 0.775]]) {
      poly(ctx, [cx - w*0.45, h*y0, cx - w*0.1, h*y1, cx - w*0.45, h*y2], BROWN, null, { shade: BROWN_SH, dy: 1.6, dx: -0.4 });
    }
    ctx.restore();
    hilite(ctx, cx - w*0.1, h*0.5, 3, 1.4, 0.16);

    // Arms with three finger marks
    const aRot = jumping ? 1.15 : 0.5 + swing;
    arm(ctx, cx - w*0.28, h*0.57, 2.9, 4.8, aRot, BODY, OL, oL, 3);
    arm(ctx, cx + w*0.28, h*0.57, 2.9, 4.8, -aRot, BODY, OL, oL, 3);

    // Ears — long leaves, swept a little further out when jumping, black tips
    const tilt = jumping ? 1.5 : 0;
    leafEar(ctx, [cx - w*0.08, h*0.145], [cx - w*0.3, h*0.215], [cx - w*0.47 - tilt, h*(-0.1)], 3.2, BODY, OL, oL, BLACK, 0.58, 0.66, SH);
    leafEar(ctx, [cx + w*0.08, h*0.145], [cx + w*0.3, h*0.215], [cx + w*0.5 + tilt,  h*(-0.085)], 3.2, BODY, OL, oL, BLACK, 0.58, 0.66, SH);

    // Head with the cheek pouches in its silhouette
    union(ctx, headPath(ctx, cx, h*0.295, w*0.36, h*0.165, w*0.35, h*0.355, 4.3, 3.8), BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.205, 3.2, 1.6);
    // soft muzzle tone
    ell(ctx, cx, h*0.375, 4.2, 2.6, 0, BELLY, null, { sh: 0 });

    // Glossy red cheeks, eyes with a glint, nose + "w" mouth
    cheek(ctx, cx - w*0.35, h*0.355, 3.7, 3.2, CHEEK, CHEEK_OL, CHEEK_SH, true);
    cheek(ctx, cx + w*0.35, h*0.355, 3.7, 3.2, CHEEK, CHEEK_OL, CHEEK_SH, true);
    eyes(ctx, cx - w*0.15, cx + w*0.15, h*0.295, 2.6, 3.4, EYE);
    wMouth(ctx, cx, h*0.395, 1.5, EYE);

  } else {
    // ── RAICHU (32×56) ── orange, cream belly with its own outline, yellow cheek
    // pouches in the silhouette, long thin ears curling into a spiral with a
    // yellow inner stripe, thin brown tail rising high with a big yellow bolt.
    const BODY = '#f8a040', SH = '#d47826', OL = '#562a0c', CREAM = '#f8e4a8', CREAM_OL = '#c8a060';
    const YEL = '#f8e040', YEL_SH = '#d4b41c', YEL_OL = '#866010', BROWN = '#7a4818', BROWN_SH = '#5a3410';
    const FOOT = '#f4e2b4', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.54;

    // Tail — thin brown whip from the lower back, out to the left and high up…
    const ex = w*0.2, ey = h*0.34 + sway;
    tailStroke(ctx, () => {
      ctx.moveTo(cx - w*0.16, h*0.72);
      ctx.bezierCurveTo(w*(-0.04), h*0.76, w*(-0.1), h*0.5 + sway, ex, ey);
    }, BROWN, BROWN_SH, OL, 3);
    // …ending in a big double-barbed lightning bolt (drawn tip-up, then tilted
    // ~35° to the left so the tip rises past the ear while the head hides its base)
    {
      const s = 1.2, th = -Math.PI * 0.2, cs = Math.cos(th), sn = Math.sin(th);
      const pts = [0,-12, 3.6,-6.5, 1.2,-6.5, 4.8,-0.5, 2,-0.5, 5.6,5, 0,4.2, -5.6,5, -2,-0.5, -4.8,-0.5, -1.2,-6.5, -3.6,-6.5];
      const out = [];
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] * s, y = pts[i + 1] * s;
        out.push(ex + x * cs - y * sn, ey + x * sn + y * cs);
      }
      poly(ctx, out, YEL, YEL_OL, { shade: YEL_SH, lw: 1.4, dy: 2.4, dx: -0.8 });
    }

    // Feet — cream, with toes
    const fo = { sh: 0.86, lw: 1.3 };
    if (jumping) {
      foot(ctx, cx - w*0.22, h*0.88, w*0.12, h*0.06, 0.35, FOOT, OL, fo);
      foot(ctx, cx + w*0.22, h*0.86, w*0.12, h*0.06, -0.35, FOOT, OL, fo);
    } else {
      foot(ctx, cx - w*0.2 + step*1.8, h*0.935, w*0.125, h*0.06, 0, FOOT, OL, fo);
      foot(ctx, cx + w*0.18 - step*1.8, h*0.935, w*0.125, h*0.06, 0, FOOT, OL, fo);
    }

    // Body + cream belly with its own (lighter) outline
    ell(ctx, cx, h*0.66, w*0.32, h*0.23, 0, BODY, OL, o);
    ell(ctx, cx + 0.5, h*0.695, w*0.2, h*0.165, 0, CREAM, CREAM_OL, { sh: 0.9, dy: 3, lw: 1 });
    hilite(ctx, cx - w*0.16, h*0.5, 3, 1.4, 0.16);

    // Arms with finger marks
    const aRot = jumping ? 1.15 : 0.5 + swing;
    arm(ctx, cx - w*0.3, h*0.58, 2.9, 4.8, aRot, BODY, OL, oL, 3);
    arm(ctx, cx + w*0.3, h*0.58, 2.9, 4.8, -aRot, BODY, OL, oL, 3);

    // Ears — thin brown stems that curl inward into a tapering spiral at the
    // tip; yellow stripe inside. Sampled as a polyline, stroked ink → brown → yellow.
    const tilt = jumping ? 1.5 : 0;
    const earPts = (dir) => {
      const p0 = [cx + dir * w*0.17, h*0.21], p1 = [cx + dir * w*0.36, h*0.1 - tilt * 0.5], p2 = [cx + dir * w*0.46, h*0.0 - tilt];
      const pts = [];
      for (let i = 0; i <= 7; i++) { const u = i / 7; pts.push([(1-u)*(1-u)*p0[0] + 2*(1-u)*u*p1[0] + u*u*p2[0], (1-u)*(1-u)*p0[1] + 2*(1-u)*u*p1[1] + u*u*p2[1]]); }
      // spiral: centre inside the stem end, turning inward (toward the head)
      const r0 = 3.3, ccx = p2[0] - dir * r0 * 0.15, ccy = p2[1] - r0 * 0.95;
      const a0 = Math.atan2(p2[1] - ccy, p2[0] - ccx);
      for (let i = 1; i <= 20; i++) {
        const u = i / 20, a = a0 - dir * u * 1.6 * TAU, r = L(r0, 0.6, u);
        pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]);
      }
      return pts;
    };
    for (const dir of [-1, 1]) {
      const pts = earPts(dir);
      taper(ctx, pts, 6.4, 3.0, OL);
      taper(ctx, pts, 4.0, 1.0, BROWN);
      taper(ctx, pts, 1.6, 0.5, YEL);
    }

    // Head with the yellow cheek pouches in its silhouette
    union(ctx, headPath(ctx, cx, h*0.3, w*0.34, h*0.165, w*0.33, h*0.355, 3.9, 3.5), BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.21, 3.2, 1.6);
    ell(ctx, cx, h*0.38, 4.2, 2.6, 0, '#fcb864', null, { sh: 0 });

    // Yellow cheeks, eyes, triangle nose, determined mouth with two small fangs
    cheek(ctx, cx - w*0.33, h*0.355, 3.4, 3.0, YEL, YEL_OL, YEL_SH, true);
    cheek(ctx, cx + w*0.33, h*0.355, 3.4, 3.0, YEL, YEL_OL, YEL_SH, true);
    eyes(ctx, cx - w*0.15, cx + w*0.15, h*0.3, 2.5, 3.3, EYE);
    poly(ctx, [cx - 1.4, h*0.37, cx + 1.4, h*0.37, cx, h*0.395], EYE, null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 4, h*0.405); ctx.quadraticCurveTo(cx, h*0.43, cx + 4, h*0.405); ctx.stroke();
    poly(ctx, [cx - 3.2, h*0.41, cx - 1.4, h*0.414, cx - 2.4, h*0.445], '#fff', null, { sh: 0 });
    poly(ctx, [cx + 1.4, h*0.414, cx + 3.2, h*0.41, cx + 2.4, h*0.445], '#fff', null, { sh: 0 });
  }
}
