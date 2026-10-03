// Piplup line: Piplup (small), Prinplup (evo 1), Empoleon (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
// Same look as the Eevee line: base fill, explicit darker shade on the
// underside, ~1.3–1.6px ink outline, one small specular on the head.
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

// ── shared pieces ────────────────────────────────────────────────────────────

// Eevee-style dark oval eye with a square glint in the upper-left
function darkEye(ctx, x, y, rx, ry, col) {
  ell(ctx, x, y, rx, ry, 0, col, null, { sh: 0 });
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - rx * 0.65, y - ry * 0.8, 1.5, 1.5);
}

// Webbed foot: flat yellow oval with two toe notches cut by short ink ticks
function foot(ctx, x, y, rx, ry, rot, col, ol) {
  ell(ctx, x, y, rx, ry, rot, col, ol, { sh: 0.8, dy: 1.6, lw: 1.3 });
  ctx.strokeStyle = ol; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const k of [-0.33, 0.33]) {
    const tx = x + rx * k * Math.cos(rot), ty = y + ry * 0.35 + rx * k * Math.sin(rot);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty + ry * 0.6); ctx.stroke();
  }
}

// Beak: a rounded wedge pointing down from (x, top); wide `bw`, length `len`,
// with a faint mouth line across the middle
function beak(ctx, x, top, bw, len, col, ol) {
  shape(ctx, () => {
    ctx.moveTo(x - bw / 2, top);
    ctx.quadraticCurveTo(x, top - len * 0.25, x + bw / 2, top);
    ctx.quadraticCurveTo(x + bw * 0.42, top + len * 0.7, x, top + len);
    ctx.quadraticCurveTo(x - bw * 0.42, top + len * 0.7, x - bw / 2, top);
    ctx.closePath();
  }, col, ol, { sh: 0.8, dy: len * 0.45, lw: 1.2 });
  ctx.strokeStyle = ol; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - bw * 0.3, top + len * 0.42); ctx.quadraticCurveTo(x, top + len * 0.55, x + bw * 0.3, top + len * 0.42); ctx.stroke();
}

// Pointed flipper hanging from the shoulder (sx, sy); `k` = -1 left / +1 right,
// `ang` swings it outward (0 = straight down, ~1.3 = raised sideways)
function flipper(ctx, sx, sy, k, len, wid, ang, col, ol, o) {
  const dx = Math.sin(ang) * k, dy = Math.cos(ang);         // direction of the flipper
  const px = dy * k, py = -Math.sin(ang);                   // perpendicular (outward)
  const tipX = sx + dx * len, tipY = sy + dy * len;
  const m1x = sx + dx * len * 0.3 + px * wid * 0.55, m1y = sy + dy * len * 0.3 + py * wid * 0.55;
  const m2x = sx + dx * len * 0.3 - px * wid * 0.45, m2y = sy + dy * len * 0.3 - py * wid * 0.45;
  shape(ctx, () => {
    ctx.moveTo(sx - px * wid * 0.3, sy - py * wid * 0.3);
    ctx.quadraticCurveTo(m1x - px * wid * 0.1, m1y - py * wid * 0.1, m1x, m1y);
    ctx.quadraticCurveTo(sx + dx * len * 0.8 + px * wid * 0.35, sy + dy * len * 0.8 + py * wid * 0.35, tipX, tipY);
    ctx.quadraticCurveTo(sx + dx * len * 0.7 - px * wid * 0.35, sy + dy * len * 0.7 - py * wid * 0.35, m2x, m2y);
    ctx.closePath();
  }, col, ol, o);
  return [tipX, tipY];
}

export function drawPiplup(p, ctx, w, h) {
  const pw      = p.power;
  const jumping = !p.onGround;
  const moving  = Math.abs(p.vx) > 0.3;
  const step    = moving ? Math.floor(p.animTimer / 8) % 2 : 0;
  const bob     = moving && !jumping ? (step ? 0 : 0.6) : 0;   // tiny body bounce on the step

  if (pw === POWER.SMALL) {
    // ── PIPLUP (28×32) ── chubby light-blue chick: big round head, white eye
    // patches, short beak, dark-blue cape with two round collar marks that
    // frame the white bib, stubby flippers, webbed yellow feet
    const C = '#4a9ae0', SH = '#2f78c0', NAVY = '#2a5aa8', NAVY_SH = '#1c4284', OL = '#10305e';
    const WHITE = '#f6fbff', WHITE_OL = '#9ab6d4', BEAK = '#f4b030', BEAK_OL = '#7a4a08', EYE = '#172a52';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.5;

    // Feet — flat, webbed; alternate on the walk, tuck back in the air
    if (jumping) {
      foot(ctx, cx - w*0.2, h*0.9, w*0.14, h*0.075, 0.45, BEAK, BEAK_OL);
      foot(ctx, cx + w*0.2, h*0.88, w*0.14, h*0.075, -0.45, BEAK, BEAK_OL);
    } else {
      foot(ctx, cx - w*0.17 + step*2, h*0.925, w*0.15, h*0.075, 0, BEAK, BEAK_OL);
      foot(ctx, cx + w*0.17 - step*2, h*0.925, w*0.15, h*0.075, 0, BEAK, BEAK_OL);
    }

    // Body — egg shape
    ell(ctx, cx, h*0.7 - bob, w*0.36, h*0.25, 0, C, OL, o);
    // Cape — dark-blue mantle over the shoulders and upper chest
    shape(ctx, () => ctx.ellipse(cx, h*0.7 - bob, w*0.36, h*0.25, 0, 0, TAU), NAVY, null, { shade: NAVY_SH, dy: 2 });
    shape(ctx, () => ctx.ellipse(cx, h*0.8 - bob, w*0.37, h*0.17, 0, 0, TAU), C, null, o);
    // White bib
    ell(ctx, cx, h*0.77 - bob, w*0.23, h*0.16, 0, WHITE, WHITE_OL, { sh: 0.9, dy: 3, lw: 1 });
    // Collar — two dark-blue rounds sitting on the top edge of the bib
    for (const k of [-1, 1]) ell(ctx, cx + k * w*0.13, h*0.65 - bob, 3.4, 3.2, 0, NAVY, OL, { shade: NAVY_SH, dy: 1.6, lw: 1.2 });

    // Flippers — stubby, held out a little; raised when jumping
    const fa = jumping ? 1.1 : 0.45;
    flipper(ctx, cx - w*0.33, h*0.58 - bob, -1, h*0.22, 5, fa, C, OL, oL);
    flipper(ctx, cx + w*0.33, h*0.58 - bob, 1, h*0.22, 5, fa, C, OL, oL);

    // Head — big and round
    ell(ctx, cx, h*0.33 - bob, w*0.41, h*0.28, 0, C, OL, o);
    hilite(ctx, cx - w*0.17, h*0.17 - bob, 3.2, 1.6);

    // White eye patches with dark oval eyes
    for (const k of [-1, 1]) {
      const ex = cx + k * w*0.155, ey = h*0.335 - bob;
      ell(ctx, ex, ey, 4.1, 5.0, 0, WHITE, OL, { sh: 0, lw: 1 });
      darkEye(ctx, ex + 0.2, ey + 0.4, 2.3, 3.1, EYE);
    }
    // Short beak
    beak(ctx, cx, h*0.44 - bob, 7, 4.8, BEAK, BEAK_OL);

  } else if (pw === POWER.BIG) {
    // ── PRINPLUP (32×56) ── taller, darker blue, light chest with two white
    // spots, three-spike yellow crest, long beak, pointed flippers held out
    const C = '#2e6ab8', SH = '#214f90', OL = '#14305e';
    const CHEST = '#8ec4f0', CHEST_OL = '#4a86c0', WHITE = '#f6fbff';
    const GOLD = '#f8d040', GOLD_SH = '#d8a820', GOLD_OL = '#7a5008', EYE = '#101c3a';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.5;

    // Feet
    if (jumping) {
      foot(ctx, cx - w*0.2, h*0.93, w*0.16, h*0.045, 0.4, GOLD, GOLD_OL);
      foot(ctx, cx + w*0.2, h*0.92, w*0.16, h*0.045, -0.4, GOLD, GOLD_OL);
    } else {
      foot(ctx, cx - w*0.19 + step*2, h*0.955, w*0.17, h*0.045, 0, GOLD, GOLD_OL);
      foot(ctx, cx + w*0.19 - step*2, h*0.955, w*0.17, h*0.045, 0, GOLD, GOLD_OL);
    }

    // Flippers — long pointed blades, behind the body
    const fa = jumping ? 1.2 : 0.5;
    flipper(ctx, cx - w*0.3, h*0.45 - bob, -1, h*0.36, 7, fa, C, OL, oL);
    flipper(ctx, cx + w*0.3, h*0.45 - bob, 1, h*0.36, 7, fa, C, OL, oL);

    // Body — tall egg, light chest with two white spots
    ell(ctx, cx, h*0.64 - bob, w*0.35, h*0.3, 0, C, OL, o);
    ell(ctx, cx, h*0.66 - bob, w*0.22, h*0.23, 0, CHEST, CHEST_OL, { sh: 0.88, dy: 3.5, lw: 1 });
    for (const k of [-1, 1]) ell(ctx, cx + k * w*0.1, h*0.56 - bob, 2.4, 3.2, 0, WHITE, null, { sh: 0 });

    // Crest — three yellow spikes; the head covers their bases
    const crestT = jumping ? -0.02 : 0;
    poly(ctx, [cx - w*0.06, h*0.16, cx + w*0.06, h*0.16, cx, h*(-0.09 + crestT)], GOLD, GOLD_OL, { shade: GOLD_SH, dy: 3, dx: -1, lw: 1.2 });
    poly(ctx, [cx - w*0.26, h*0.2, cx - w*0.14, h*0.14, cx - w*0.33, h*(-0.03 + crestT)], GOLD, GOLD_OL, { shade: GOLD_SH, dy: 3, dx: -1, lw: 1.2 });
    poly(ctx, [cx + w*0.14, h*0.14, cx + w*0.26, h*0.2, cx + w*0.33, h*(-0.03 + crestT)], GOLD, GOLD_OL, { shade: GOLD_SH, dy: 3, dx: -1, lw: 1.2 });

    // Head
    ell(ctx, cx, h*0.27 - bob, w*0.36, h*0.18, 0, C, OL, o);
    hilite(ctx, cx - w*0.16, h*0.16 - bob, 3.2, 1.6);

    // Eyes — dark ovals, a slanted lid gives him his proud look
    for (const k of [-1, 1]) {
      const ex = cx + k * w*0.17, ey = h*0.26 - bob;
      darkEye(ctx, ex, ey, 2.6, 3.5, EYE);
      // lid: inner corner lower than the outer one
      poly(ctx, [ex - 3.5, ey - 5.2, ex + 3.5, ey - 5.2, ex + 3.5, ey - 3.6 - k * 1.1, ex - 3.5, ey - 3.6 + k * 1.1], C, null, { sh: 0 });
      ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - 3.2, ey - 3.6 + k * 1.1); ctx.lineTo(ex + 3.2, ey - 3.6 - k * 1.1); ctx.stroke();
    }
    // Long beak
    beak(ctx, cx, h*0.345 - bob, 7.5, 8.5, GOLD, GOLD_OL);

  } else {
    // ── EMPOLEON (32×56) ── armoured emperor: broad steel-blue body, navy head
    // with a yellow trident crest over the beak, fierce eyes, white bib with
    // brass spots, long navy flippers with a steel edge, yellow feet
    const C = '#3a5a9a', SH = '#2a4478', OL = '#0e1a3a';
    const NAVY = '#1c2e5c', NAVY_SH = '#121f42', NAVY_OL = '#070e26';
    const STEEL = '#6a9ad0', WHITE = '#f6fbff', WHITE_OL = '#9ab6d4';
    const GOLD = '#f8d040', GOLD_SH = '#d8a820', GOLD_OL = '#7a5008', BRASS = '#e0b030';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const oN = { shade: NAVY_SH, lw: 1.5 };
    const cx = w * 0.5;

    // Feet — big and sturdy
    if (jumping) {
      foot(ctx, cx - w*0.21, h*0.93, w*0.18, h*0.05, 0.4, GOLD, GOLD_OL);
      foot(ctx, cx + w*0.21, h*0.92, w*0.18, h*0.05, -0.4, GOLD, GOLD_OL);
    } else {
      foot(ctx, cx - w*0.2 + step*2, h*0.955, w*0.19, h*0.05, 0, GOLD, GOLD_OL);
      foot(ctx, cx + w*0.2 - step*2, h*0.955, w*0.19, h*0.05, 0, GOLD, GOLD_OL);
    }

    // Flippers — long navy blades with a sharp steel-blue leading edge
    const fa = jumping ? 1.15 : 0.42;
    for (const k of [-1, 1]) {
      const sx = cx + k * w*0.34, sy = h*0.43 - bob;
      const [tx, ty] = flipper(ctx, sx, sy, k, h*0.4, 8.5, fa, NAVY, NAVY_OL, oN);
      // steel edge along the outer side
      const dx = Math.sin(fa) * k, dy = Math.cos(fa), px = dy * k, py = -Math.sin(fa);
      ctx.strokeStyle = STEEL; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + dx * h*0.1 + px * 3.4, sy + dy * h*0.1 + py * 3.4);
      ctx.quadraticCurveTo(sx + dx * h*0.3 + px * 3.4, sy + dy * h*0.3 + py * 3.4, tx - dx * 1.5, ty - dy * 1.5);
      ctx.stroke();
    }

    // Body — broad, armoured; white bib with two brass spots
    ell(ctx, cx, h*0.63 - bob, w*0.42, h*0.3, 0, C, OL, o);
    hilite(ctx, cx - w*0.24, h*0.5 - bob, 2.8, 1.3, 0.16);
    ell(ctx, cx, h*0.66 - bob, w*0.25, h*0.23, 0, WHITE, WHITE_OL, { sh: 0.9, dy: 3.5, lw: 1 });
    for (const k of [-1, 1]) ell(ctx, cx + k * w*0.1, h*0.585 - bob, 2.2, 2.7, 0, BRASS, GOLD_OL, { sh: 0.8, dy: 1.4, lw: 1 });

    // Shoulders — navy mantle over the top of the body (cape), under the head
    shape(ctx, () => ctx.ellipse(cx, h*0.43 - bob, w*0.32, h*0.07, 0, 0, TAU), NAVY, NAVY_OL, oN);

    // Head — navy, slightly wider than tall
    ell(ctx, cx, h*0.27 - bob, w*0.36, h*0.18, 0, NAVY, NAVY_OL, oN);
    hilite(ctx, cx - w*0.2, h*0.19 - bob, 2.8, 1.4, 0.26);

    // Eyes — small, fierce, under a heavy brow
    for (const k of [-1, 1]) {
      const ex = cx + k * w*0.19, ey = h*0.285 - bob;
      ell(ctx, ex, ey, 2.9, 2.7, 0, WHITE, NAVY_OL, { sh: 0, lw: 1 });
      ell(ctx, ex - k * 0.3, ey + 0.3, 1.4, 1.7, 0, '#0a1020', null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1.7, ey - 1.9, 1.2, 1.2);
      // heavy brow: inner corner lower than the outer one
      poly(ctx, [ex - 4, ey - 5, ex + 4, ey - 5, ex + 4, ey - 2.2 - k * 1.5, ex - 4, ey - 2.2 + k * 1.5], NAVY, null, { sh: 0 });
      ctx.strokeStyle = NAVY_OL; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - 3.4, ey - 2.2 + k * 1.5); ctx.lineTo(ex + 3.4, ey - 2.2 - k * 1.5); ctx.stroke();
    }

    // Beak — long, between the eyes, under the crest
    beak(ctx, cx, h*0.32 - bob, 6.5, 7.5, GOLD, GOLD_OL);

    // Trident crest — centre prong rising from the forehead, two side prongs
    // sweeping out over the brows; one silhouette so it reads as one piece
    const crestT = jumping ? -0.02 : 0;
    const crest = () => {
      ctx.moveTo(cx - w*0.05, h*0.32 - bob);          // stem rising from the beak
      ctx.lineTo(cx - w*0.06, h*0.19 - bob);
      ctx.lineTo(cx - w*0.2, h*0.2 - bob);            // left prong
      ctx.lineTo(cx - w*0.5, h*(0.07 + crestT) - bob);
      ctx.lineTo(cx - w*0.17, h*0.14 - bob);
      ctx.lineTo(cx - w*0.06, h*0.13 - bob);
      ctx.lineTo(cx - w*0.035, h*0.02 - bob);         // centre prong
      ctx.lineTo(cx, h*(-0.11 + crestT) - bob);
      ctx.lineTo(cx + w*0.035, h*0.02 - bob);
      ctx.lineTo(cx + w*0.06, h*0.13 - bob);
      ctx.lineTo(cx + w*0.17, h*0.14 - bob);
      ctx.lineTo(cx + w*0.5, h*(0.07 + crestT) - bob);  // right prong
      ctx.lineTo(cx + w*0.2, h*0.2 - bob);
      ctx.lineTo(cx + w*0.06, h*0.19 - bob);
      ctx.lineTo(cx + w*0.05, h*0.32 - bob);
      ctx.closePath();
    };
    shape(ctx, crest, GOLD, GOLD_OL, { shade: GOLD_SH, dy: 2.6, dx: -0.8, lw: 1.3 });
    hilite(ctx, cx - 0.8, h*0.03 - bob, 0.9, 2.4, 0.4);
  }
}
