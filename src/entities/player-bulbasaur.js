// Bulbasaur line: Bulbasaur (small), Ivysaur (evo 1), Venusaur (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
// Same look as the Eevee and Charmander lines: base fill, explicit darker
// shade on the underside, ~1.3–1.6px ink outline, one small specular on the
// head. All three are quadrupeds seen from a slight three-quarter front view,
// big head toward the viewer, the plant on the back rising behind the head to
// the upper-left.
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L } from './sprite-utils.js';

// ── shared pieces ────────────────────────────────────────────────────────────

// A shaded, outlined shape with darker mottled patches clipped inside it
// (spots: [x, y, rx, ry, rot]). The outline is stroked last so the patches
// never cover it.
function spotted(ctx, build, fill, ol, o, spots, col) {
  shape(ctx, build, fill, null, o);
  ctx.save(); ctx.beginPath(); build(); ctx.clip();
  for (const [x, y, rx, ry, rot] of spots) {
    ell(ctx, x, y, rx, ry, rot || 0, col, null, { sh: 0 });
    ell(ctx, x + rx * 0.7, y + ry * 0.35, rx * 0.6, ry * 0.7, rot || 0, col, null, { sh: 0 });
  }
  ctx.restore();
  ctx.beginPath(); build();
  ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.5; ctx.lineJoin = 'round'; ctx.stroke();
}

// Red eye with a white sclera: ink outline, red iris looking slightly right,
// dark pupil, one white glint top-left. Optional stern brow: a quad in the
// skin colour cuts the top of the eye, lower on the inner side (side: +1 =
// inner edge on the right, i.e. the left eye; -1 = the right eye).
function redEye(ctx, x, y, rx, ry, ol, brow, skin, side) {
  ell(ctx, x, y, rx, ry, 0, '#fff', ol, { sh: 0, lw: 1 });
  ell(ctx, x + rx * 0.18, y + ry * 0.08, rx * 0.66, ry * 0.72, 0, '#d82830', null, { sh: 0 });
  ell(ctx, x + rx * 0.2, y + ry * 0.12, rx * 0.34, ry * 0.42, 0, '#1a0008', null, { sh: 0 });
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - rx * 0.4, y - ry * 0.55, 1.4, 1.4);
  if (brow) {
    const outer = y - ry * 0.95, inner = y - ry * 0.35;
    const yl = side > 0 ? outer : inner, yr = side > 0 ? inner : outer;
    poly(ctx, [x - rx - 1, y - ry - 2, x + rx + 1, y - ry - 2, x + rx + 1, yr, x - rx - 1, yl], skin, null, { sh: 0 });
    ctx.strokeStyle = ol; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - rx - 0.5, yl); ctx.lineTo(x + rx + 0.5, yr); ctx.stroke();
  }
}

// Small pointed ear: (ax,ay)-(bx,by) base along the skull, (tx,ty) tip; dark inner
function ear(ctx, ax, ay, bx, by, tx, ty, col, inner, ol, shade) {
  poly(ctx, [ax, ay, tx, ty, bx, by], col, ol, { shade, lw: 1.3 });
  const mx = (ax + bx + tx) / 3, my = (ay + by + ty) / 3;
  poly(ctx, [L(mx, ax, 0.5), L(my, ay, 0.5), L(mx, tx, 0.62), L(my, ty, 0.62), L(mx, bx, 0.5), L(my, by, 0.5)], inner, null, { sh: 0 });
}

// Faint toe notches at the bottom edge of a foot centred on x, foot bottom at yb
function toes(ctx, x, yb, ol, n = 2) {
  ctx.strokeStyle = ol; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const tx = x + (i - (n - 1) / 2) * 2.6;
    ctx.beginPath(); ctx.moveTo(tx, yb - 2.4); ctx.lineTo(tx, yb - 0.9); ctx.stroke();
  }
}

// Pointed leaf from (x,y) of length len in direction a (radians), half-width ≈ wid/2,
// with a lighter mid vein
function leaf(ctx, x, y, len, wid, a, col, sh, ol, vein) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
  const tip = P(len, 0), l = P(len * 0.45, -wid), r = P(len * 0.45, wid);
  const build = () => {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(l[0], l[1], tip[0], tip[1]);
    ctx.quadraticCurveTo(r[0], r[1], x, y);
    ctx.closePath();
  };
  shape(ctx, build, col, ol, { shade: sh, lw: 1.3, dx: 1, dy: 2 });
  const v0 = P(len * 0.12, 0), v1 = P(len * 0.78, 0);
  ctx.strokeStyle = vein; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.stroke();
}

// Mouth: wide friendly line from the left to the right corner, bowed downward
function mouth(ctx, x0, x1, y, bow, ol) {
  ctx.strokeStyle = ol; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + bow, x1, y); ctx.stroke();
}

export function drawBulbasaur(p, ctx, w, h) {
  const pw      = p.power;
  const jumping = !p.onGround;
  const moving  = Math.abs(p.vx) > 0.3;
  const step    = moving ? Math.floor(p.animTimer / 8) % 2 : 0;
  const sway    = moving ? Math.sin(p.animTimer * 0.4) : 0;
  // walk cycle: the two front legs alternate (one forward and lifted), the
  // hind legs the other way round
  const fL = step ? 1 : 0, fR = 1 - fL;

  if (pw === POWER.SMALL) {
    // ── BULBASAUR (28×32) ── teal-green, wide flat head, red eyes, small
    // pointed ears, four stubby legs; the green bulb rises behind the left
    const C = '#58b088', SH = '#3a8a62', SPOT = '#2a7250', OL = '#163a28';
    const BULB = '#3f9a5a', BULB_L = '#72c884', BULB_SH = '#2c7a44', BULB_OL = '#123a20';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.57;

    // Bulb — behind everything, leaning out to the upper-left
    const bx = w * 0.13, by = h * 0.33 + (jumping ? 1 : 0), br = -0.3 + sway * 0.05;
    const bulb = () => ctx.ellipse(bx, by, 7, 10.2, br, 0, TAU);
    shape(ctx, bulb, BULB, BULB_OL, { shade: BULB_SH, dx: 1.2, dy: 2.2, lw: 1.4 });
    ctx.save(); ctx.beginPath(); bulb(); ctx.clip();
    // lighter cap + two seams so it reads as a closed bud
    ell(ctx, bx - 1.5, by - 5.5, 3.6, 2.6, br, BULB_L, null, { sh: 0 });
    ctx.strokeStyle = BULB_SH; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (const dx of [-2.6, 1.6]) {
      ctx.beginPath(); ctx.moveTo(bx + dx, by - 9); ctx.quadraticCurveTo(bx + dx * 1.6, by, bx + dx, by + 9); ctx.stroke();
    }
    ctx.restore();

    // Hind legs (behind the body)
    if (jumping) {
      ell(ctx, cx - w*0.33, h*0.84, w*0.1, h*0.1, 0.5, C, OL, oL);
      ell(ctx, cx + w*0.33, h*0.84, w*0.1, h*0.1, -0.5, C, OL, oL);
    } else {
      ell(ctx, cx - w*0.33 - fR*1.2, h*0.9 - fR*0.6, w*0.1, h*0.1, 0, C, OL, oL);
      ell(ctx, cx + w*0.33 + fL*1.2, h*0.9 - fL*0.6, w*0.1, h*0.1, 0, C, OL, oL);
    }

    // Body
    spotted(ctx, () => ctx.ellipse(cx, h*0.74, w*0.34, h*0.21, 0, 0, TAU), C, OL, o,
      [[cx + w*0.2, h*0.66, 2.6, 1.8, -0.4], [cx - w*0.22, h*0.74, 2, 1.5, 0.3]], SPOT);

    // Front legs with toe marks
    if (jumping) {
      ell(ctx, cx - w*0.17, h*0.8, w*0.105, h*0.1, 0.35, C, OL, oL);
      ell(ctx, cx + w*0.17, h*0.8, w*0.105, h*0.1, -0.35, C, OL, oL);
    } else {
      const ly = h*0.9, lr = h*0.1;
      ell(ctx, cx - w*0.17 + fL*2, ly - fL*1.6, w*0.105, lr, 0, C, OL, oL);
      ell(ctx, cx + w*0.17 - fR*2, ly - fR*1.6, w*0.105, lr, 0, C, OL, oL);
      toes(ctx, cx - w*0.17 + fL*2, ly + lr - fL*1.6, OL);
      toes(ctx, cx + w*0.17 - fR*2, ly + lr - fR*1.6, OL);
    }

    // Ears — small, pointed, dark inner; the head covers their bases
    const tilt = jumping ? 0.05 : 0;
    ear(ctx, cx - w*0.3, h*0.23, cx - w*0.16, h*0.16, cx - w*(0.33 + tilt), h*0.04, C, SPOT, OL, SH);
    ear(ctx, cx + w*0.16, h*0.16, cx + w*0.3, h*0.23, cx + w*(0.33 + tilt), h*0.04, C, SPOT, OL, SH);

    // Head — wide and flat, mottled
    spotted(ctx, () => ctx.ellipse(cx, h*0.39, w*0.4, h*0.25, 0, 0, TAU), C, OL, o,
      [[cx + w*0.03, h*0.2, 2.4, 1.6, 0.2], [cx + w*0.24, h*0.28, 2.6, 1.8, -0.5], [cx - w*0.32, h*0.47, 2.2, 1.7, 0.6], [cx + w*0.3, h*0.52, 2, 1.5, 0.6]], SPOT);
    hilite(ctx, cx - w*0.17, h*0.25, 3.4, 1.7);

    // Red eyes, nostrils, wide friendly mouth
    redEye(ctx, cx - w*0.15, h*0.4, 3.0, 3.7, OL);
    redEye(ctx, cx + w*0.15, h*0.4, 3.0, 3.7, OL);
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 2.4, h*0.5, 1.3, 1.3);
    ctx.fillRect(cx + 1.1, h*0.5, 1.3, 1.3);
    mouth(ctx, cx - w*0.2, cx + w*0.2, h*0.54, h*0.07, OL);

  } else if (pw === POWER.BIG) {
    // ── IVYSAUR (32×56) ── bluer green, taller and sturdier, fangs at the
    // mouth corners; a pink closed bud ringed by big leaves rises behind the
    // head to the upper-left
    const C = '#4aa090', SH = '#2f7e6e', SPOT = '#246454', OL = '#10302a';
    const LEAF = '#2f8a52', LEAF_SH = '#1f6a3a', LEAF_OL = '#0c3418', VEIN = '#5ab878';
    const BUD = '#e8609a', BUD_D = '#b83a70', BUD_OL = '#58122e';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.56;

    // Plant — leaves fan out from a point on the back, behind the head
    const px = w * 0.17, py = h * 0.27 + (jumping ? 1 : 0), rot = sway * 0.03;
    for (const a of [-2.65, -2.2, -1.75, -1.3, -0.85, -0.4]) leaf(ctx, px, py, 12, 5.2, a + rot, LEAF, LEAF_SH, LEAF_OL, VEIN);
    // Bud — pointed top, round bottom, darker base, two seams; green cup below
    const bxp = px + 1, byp = h * 0.13 + (jumping ? 1 : 0), rw = 5, rh = 9.5;
    const bud = () => {
      ctx.moveTo(bxp, byp - rh);
      ctx.quadraticCurveTo(bxp + rw * 1.3, byp - rh * 0.3, bxp + rw, byp);
      ctx.arc(bxp, byp, rw, 0, Math.PI);
      ctx.quadraticCurveTo(bxp - rw * 1.3, byp - rh * 0.3, bxp, byp - rh);
      ctx.closePath();
    };
    shape(ctx, bud, BUD, BUD_OL, { shade: BUD_D, dx: 0.6, dy: 2.6, lw: 1.4 });
    ctx.save(); ctx.beginPath(); bud(); ctx.clip();
    ctx.strokeStyle = BUD_D; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (const dx of [-2.2, 1.8]) { ctx.beginPath(); ctx.moveTo(bxp, byp - rh + 1); ctx.quadraticCurveTo(bxp + dx * 1.8, byp - 2, bxp + dx, byp + rw); ctx.stroke(); }
    ctx.restore();
    hilite(ctx, bxp - 1.6, byp - 3, 1.6, 0.9, 0.4);
    ell(ctx, bxp, byp + rw - 0.5, 4.8, 2.4, 0, LEAF, LEAF_OL, { shade: LEAF_SH, lw: 1.2 });

    // Hind legs (behind the body)
    if (jumping) {
      ell(ctx, cx - w*0.38, h*0.83, w*0.11, h*0.08, 0.5, C, OL, oL);
      ell(ctx, cx + w*0.38, h*0.83, w*0.11, h*0.08, -0.5, C, OL, oL);
    } else {
      ell(ctx, cx - w*0.38 - fR*1.2, h*0.91 - fR*0.6, w*0.11, h*0.08, 0, C, OL, oL);
      ell(ctx, cx + w*0.38 + fL*1.2, h*0.91 - fL*0.6, w*0.11, h*0.08, 0, C, OL, oL);
    }

    // Body — tall and sturdy
    spotted(ctx, () => ctx.ellipse(cx, h*0.69, w*0.4, h*0.2, 0, 0, TAU), C, OL, o,
      [[cx + w*0.22, h*0.6, 3, 2, -0.4], [cx - w*0.24, h*0.7, 2.4, 1.8, 0.3], [cx + w*0.05, h*0.8, 2.2, 1.6, 0.2]], SPOT);

    // Front legs with toe marks
    if (jumping) {
      ell(ctx, cx - w*0.18, h*0.8, w*0.12, h*0.08, 0.35, C, OL, oL);
      ell(ctx, cx + w*0.18, h*0.8, w*0.12, h*0.08, -0.35, C, OL, oL);
    } else {
      const ly = h*0.915, lr = h*0.085;
      ell(ctx, cx - w*0.18 + fL*2, ly - fL*1.8, w*0.12, lr, 0, C, OL, oL);
      ell(ctx, cx + w*0.18 - fR*2, ly - fR*1.8, w*0.12, lr, 0, C, OL, oL);
      toes(ctx, cx - w*0.18 + fL*2, ly + lr - fL*1.8, OL);
      toes(ctx, cx + w*0.18 - fR*2, ly + lr - fR*1.8, OL);
    }

    // Ears
    const tilt = jumping ? 0.05 : 0;
    ear(ctx, cx - w*0.28, h*0.27, cx - w*0.15, h*0.22, cx - w*(0.32 + tilt), h*0.14, C, SPOT, OL, SH);
    ear(ctx, cx + w*0.15, h*0.22, cx + w*0.28, h*0.27, cx + w*(0.32 + tilt), h*0.14, C, SPOT, OL, SH);

    // Head — wide, mottled
    spotted(ctx, () => ctx.ellipse(cx, h*0.38, w*0.4, h*0.165, 0, 0, TAU), C, OL, o,
      [[cx + w*0.03, h*0.25, 2.6, 1.7, 0.2], [cx + w*0.24, h*0.3, 2.8, 1.9, -0.5], [cx - w*0.32, h*0.43, 2.4, 1.8, 0.6], [cx + w*0.32, h*0.46, 2.2, 1.6, 0.6]], SPOT);
    hilite(ctx, cx - w*0.17, h*0.29, 3.4, 1.6);

    // Red eyes, nostrils, mouth with a small fang at each corner
    redEye(ctx, cx - w*0.16, h*0.385, 3.1, 3.6, OL);
    redEye(ctx, cx + w*0.16, h*0.385, 3.1, 3.6, OL);
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 2.4, h*0.445, 1.3, 1.3);
    ctx.fillRect(cx + 1.1, h*0.445, 1.3, 1.3);
    mouth(ctx, cx - w*0.21, cx + w*0.21, h*0.475, h*0.05, OL);
    for (const fx of [cx - w*0.17, cx + w*0.17])
      poly(ctx, [fx - 1.3, h*0.48, fx + 1.3, h*0.48, fx, h*0.535], '#fff', OL, { sh: 0, lw: 0.8 });

  } else {
    // ── VENUSAUR (32×56) ── big bulky body, thick legs, two small tusks; the
    // huge open pink flower with a yellow centre, ringed by broad leaves on a
    // brown trunk, rises above the head to the upper-left
    const C = '#3e9078', SH = '#287060', SPOT = '#1c5440', OL = '#0c2a20';
    const LEAF = '#2f8a52', LEAF_SH = '#1f6a3a', LEAF_OL = '#0c3418', VEIN = '#5ab878';
    const PET = '#f06a9c', PET_SH = '#cc4a7e', PET_OL = '#64163a';
    const CEN = '#f8c030', CEN_OL = '#8a5a08', DOT = '#e07a20';
    const TRUNK = '#7a4a22', TRUNK_SH = '#5a3214', TRUNK_OL = '#2e1606';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.53;

    // Trunk — short brown stump on the back; the head covers its bottom
    const fx = w * 0.22, fy = h * 0.09 + (jumping ? 1 : 0), rot = sway * 0.03;
    ell(ctx, fx + 3, h*0.3, 4.6, 7, 0.2, TRUNK, TRUNK_OL, { shade: TRUNK_SH, lw: 1.3 });
    // Leaf ring — broad leaves radiating from just below the flower
    for (const a of [-2.7, -2.25, -1.8, -1.35, -0.9, -0.45, 0, 0.45]) leaf(ctx, fx + 1, fy + 4, 14, 6.4, a + rot, LEAF, LEAF_SH, LEAF_OL, VEIN);
    // Petals — six, outlined, lighter toward the tip
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (TAU / 6) + rot;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pr = 10.5, pw2 = 4.2;
      const petal = () => ctx.ellipse(fx + ca * pr * 0.52, fy + sa * pr * 0.52, pr * 0.52, pw2, a, 0, TAU);
      shape(ctx, petal, PET, PET_OL, { shade: PET_SH, dx: 0.4, dy: 1.6, lw: 1.3 });
      ell(ctx, fx + ca * pr * 0.68, fy + sa * pr * 0.68, pr * 0.22, pw2 * 0.4, a, '#f8a0c0', null, { sh: 0 });
    }
    // Centre — yellow disc with a ring of orange dots
    ell(ctx, fx, fy, 4.6, 4.6, 0, CEN, CEN_OL, { shade: '#e0a018', dy: 1.6, lw: 1.2 });
    ctx.fillStyle = DOT;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - 0.6; ctx.fillRect(fx + Math.cos(a) * 2.5 - 0.6, fy + Math.sin(a) * 2.5 - 0.6, 1.2, 1.2); }
    ctx.fillRect(fx - 0.6, fy - 0.6, 1.2, 1.2);

    // Hind legs — thick, behind the body
    if (jumping) {
      ell(ctx, cx - w*0.4, h*0.84, w*0.13, h*0.09, 0.5, C, OL, oL);
      ell(ctx, cx + w*0.4, h*0.84, w*0.13, h*0.09, -0.5, C, OL, oL);
    } else {
      ell(ctx, cx - w*0.41 - fR*1.2, h*0.9 - fR*0.6, w*0.13, h*0.09, 0, C, OL, oL);
      ell(ctx, cx + w*0.41 + fL*1.2, h*0.9 - fL*0.6, w*0.13, h*0.09, 0, C, OL, oL);
    }

    // Body — wide and heavy
    spotted(ctx, () => ctx.ellipse(cx, h*0.72, w*0.48, h*0.22, 0, 0, TAU), C, OL, o,
      [[cx + w*0.28, h*0.64, 3.2, 2.2, -0.4], [cx - w*0.32, h*0.7, 2.6, 2, 0.3], [cx + w*0.06, h*0.85, 2.4, 1.8, 0.2], [cx - w*0.12, h*0.6, 2.2, 1.6, -0.2]], SPOT);

    // Front legs — thick, three toe marks
    if (jumping) {
      ell(ctx, cx - w*0.22, h*0.81, w*0.15, h*0.085, 0.35, C, OL, oL);
      ell(ctx, cx + w*0.22, h*0.81, w*0.15, h*0.085, -0.35, C, OL, oL);
    } else {
      const ly = h*0.91, lr = h*0.09;
      ell(ctx, cx - w*0.22 + fL*2, ly - fL*1.8, w*0.15, lr, 0, C, OL, oL);
      ell(ctx, cx + w*0.22 - fR*2, ly - fR*1.8, w*0.15, lr, 0, C, OL, oL);
      toes(ctx, cx - w*0.22 + fL*2, ly + lr - fL*1.8, OL, 3);
      toes(ctx, cx + w*0.22 - fR*2, ly + lr - fR*1.8, OL, 3);
    }

    // Ears — small
    const tilt = jumping ? 0.05 : 0;
    ear(ctx, cx - w*0.28, h*0.34, cx - w*0.15, h*0.29, cx - w*(0.32 + tilt), h*0.22, C, SPOT, OL, SH);
    ear(ctx, cx + w*0.15, h*0.29, cx + w*0.28, h*0.34, cx + w*(0.32 + tilt), h*0.22, C, SPOT, OL, SH);

    // Head — wide, mottled
    spotted(ctx, () => ctx.ellipse(cx, h*0.44, w*0.39, h*0.155, 0, 0, TAU), C, OL, o,
      [[cx + w*0.03, h*0.31, 2.6, 1.7, 0.2], [cx + w*0.25, h*0.36, 2.8, 1.9, -0.5], [cx - w*0.33, h*0.49, 2.4, 1.8, 0.6], [cx + w*0.33, h*0.52, 2.2, 1.6, 0.6]], SPOT);
    hilite(ctx, cx - w*0.17, h*0.35, 3.4, 1.6);

    // Red eyes, nostrils, mouth with two small tusks pointing up from the corners
    redEye(ctx, cx - w*0.16, h*0.445, 3.1, 3.5, OL, true, C, 1);
    redEye(ctx, cx + w*0.16, h*0.445, 3.1, 3.5, OL, true, C, -1);
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 2.4, h*0.505, 1.3, 1.3);
    ctx.fillRect(cx + 1.1, h*0.505, 1.3, 1.3);
    mouth(ctx, cx - w*0.23, cx + w*0.23, h*0.535, h*0.045, OL);
    for (const tx of [cx - w*0.25, cx + w*0.25])
      poly(ctx, [tx - 1.5, h*0.545, tx + 1.5, h*0.545, tx, h*0.48], '#fff', OL, { sh: 0, lw: 0.8 });
  }
}
