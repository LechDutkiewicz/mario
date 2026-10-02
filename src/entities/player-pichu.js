// Pichu line: Pichu (small), Pikachu (evo 1), Raichu (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
// Same look as the Eevee line: ~1.3-1.5px ink outline on every solid shape,
// a darker shade pass (the base fill survives as a light rim along the top),
// one small specular on the head, Eevee-style oval eyes with a shine.
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

export function drawPichu(p, ctx, w, h) {
  const pw      = p.power;
  const jumping = !p.onGround;
  const moving  = Math.abs(p.vx) > 0.3;
  const step    = moving ? Math.floor(p.animTimer / 8) % 2 : 0;
  const sway    = moving ? Math.sin(p.animTimer * 0.4) : 0;

  // Eevee-style eyes: dark oval + white glint in the upper-left
  const eyes = (lx, rx, y, erx, ery, col) => {
    for (const ex of [lx, rx]) {
      ell(ctx, ex, y, erx, ery, 0, col, null, { sh: 0 });
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - erx * 0.65, y - ery * 0.8, 1.5, 1.5);
    }
  };
  // tiny "w" mouth (two little arcs) with a dot nose above it
  const wMouth = (x, y, r, col, nose = true) => {
    if (nose) ell(ctx, x, y - r * 1.4, r * 0.8, r * 0.55, 0, col, null, { sh: 0 });
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x - r, y, r, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r, y, r, 0.25, Math.PI - 0.25); ctx.stroke();
  };
  // cheek disc with its own thin outline
  const cheek = (x, y, rx, ry, col, ol) => ell(ctx, x, y, rx, ry, 0, col, ol, { sh: 0.9, lw: 1.1, dy: 1.5 });

  if (pw === POWER.SMALL) {
    // ── PICHU (28×32) ── tiny pale-yellow baby mouse: oversized head, big
    // diamond ears with black outer tips, black neck ruff, pink cheeks.
    const BODY = '#fff2a8', SH = '#f6e070', OL = '#5a4410', BLACK = '#201c18', BLACK_OL = '#080604';
    const CHEEK = '#f49ab8', CHEEK_OL = '#a85070', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.5;

    // Diamond ear: base (bx,by) on the head, tip (tx,ty); the outer 40% is black
    const ear = (bx, by, tx, ty, hw) => {
      const mx = (bx + tx) / 2, my = (by + ty) / 2;
      const len = Math.hypot(tx - bx, ty - by), nx = -(ty - by) / len * hw, ny = (tx - bx) / len * hw;
      poly(ctx, [bx, by, mx + nx, my + ny, tx, ty, mx - nx, my - ny], BODY, OL, oL);
      band(ctx, mx + nx, my + ny, mx - nx, my - ny, tx, ty, 0.2, 1.0, BLACK);
    };

    // Tiny black stub tail behind the left hip
    poly(ctx, [cx - w*0.14, h*0.74, cx - w*0.5, h*0.6, cx - w*0.36, h*0.8], BLACK, BLACK_OL, { lw: 1.2, shade: '#0c0a08' });

    // Legs
    if (jumping) {
      ell(ctx, cx - w*0.2, h*0.86, w*0.1, h*0.08, 0.3, BODY, OL, oL);
      ell(ctx, cx + w*0.18, h*0.82, w*0.1, h*0.08, -0.3, BODY, OL, oL);
    } else {
      ell(ctx, cx - w*(0.19 - step*0.07), h*0.9, w*0.1, h*0.1, 0, BODY, OL, oL);
      ell(ctx, cx + w*(0.15 - step*0.07), h*0.9, w*0.1, h*0.1, 0, BODY, OL, oL);
    }

    // Body + black zig-zag ruff (clipped to the body so it hugs the silhouette)
    const body = () => ctx.ellipse(cx, h*0.72, w*0.27, h*0.2, 0, 0, TAU);
    shape(ctx, body, BODY, OL, o);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    poly(ctx, [cx - w*0.4, h*0.45, cx + w*0.4, h*0.45, cx + w*0.4, h*0.7,
               cx + w*0.2, h*0.77, cx + w*0.09, h*0.7, cx, h*0.78, cx - w*0.09, h*0.7, cx - w*0.2, h*0.77, cx - w*0.4, h*0.7],
         BLACK, null, { sh: 0 });
    ctx.restore();

    // Stubby arms
    ell(ctx, cx - w*0.27, h*0.7, 2.6, 1.9, 0.7, BODY, OL, oL);
    ell(ctx, cx + w*0.27, h*0.7, 2.6, 1.9, -0.7, BODY, OL, oL);

    // Ears — big diamonds sticking out diagonally, tips flick up when jumping
    const tilt = jumping ? 0.05 : 0;
    ear(cx - w*0.2, h*0.26, w*(-0.13), h*(-0.11 - tilt), 4);
    ear(cx + w*0.2, h*0.26, w*1.13,    h*(-0.11 - tilt), 4);

    // Head — oversized
    ell(ctx, cx, h*0.37, w*0.4, h*0.25, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.17, h*0.24, 3.4, 1.7);

    // Cheeks, eyes, nose + "w" smile
    cheek(cx - w*0.29, h*0.44, 2.9, 2.6, CHEEK, CHEEK_OL);
    cheek(cx + w*0.29, h*0.44, 2.9, 2.6, CHEEK, CHEEK_OL);
    eyes(cx - w*0.15, cx + w*0.15, h*0.37, 2.2, 2.9, EYE);
    wMouth(cx, h*0.49, 1.3, EYE);

  } else if (pw === POWER.BIG) {
    // ── PIKACHU (32×56) ── classic yellow, black-tipped ears, red cheeks,
    // brown back stripes, lightning-bolt tail rising behind the left shoulder.
    const BODY = '#ffe66a', SH = '#f8d030', OL = '#6a4a08', BLACK = '#201c18', BROWN = '#9a5410', BROWN_OL = '#5a3008';
    const CHEEK = '#e8382a', CHEEK_OL = '#7a1810', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.56;
    const sx = w / 32, sy = h / 56, P = (pts, dx, dy) => pts.map((v, i) => (i % 2 ? (v + dy) * sy : (v + dx) * sx));

    // Tail — stepped lightning bolt, brown at the base, wide flat head at the top
    const tdx = -3 + sway * 0.6, tdy = 4;
    poly(ctx, P([9,41, 4,33, 7,31, 2,23, 5,21, -1,13, 2,6, 13,3, 15,9, 7,12, 5,15, 11,23, 8,25, 13,33, 10,35, 15,43], tdx, tdy), BODY, OL, { shade: SH, lw: 1.3, dy: 3 });
    poly(ctx, P([9,41, 4,33, 7,31, 13,33, 10,35, 15,43], tdx, tdy), BROWN, null, { sh: 0 });

    // Feet
    if (jumping) {
      ell(ctx, cx - w*0.22, h*0.88, w*0.12, h*0.06, 0.35, BODY, OL, oL);
      ell(ctx, cx + w*0.22, h*0.86, w*0.12, h*0.06, -0.35, BODY, OL, oL);
    } else {
      ell(ctx, cx - w*(0.2 - step*0.06), h*0.935, w*0.12, h*0.06, 0, BODY, OL, oL);
      ell(ctx, cx + w*(0.18 - step*0.06), h*0.935, w*0.12, h*0.06, 0, BODY, OL, oL);
    }

    // Body — plump pear; two brown stripes show on the back (left) side
    const body = () => ctx.ellipse(cx, h*0.66, w*0.3, h*0.225, 0, 0, TAU);
    shape(ctx, body, BODY, OL, o);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    poly(ctx, [cx - w*0.4, h*0.55, cx - w*0.08, h*0.6, cx - w*0.4, h*0.645], BROWN, null, { sh: 0 });
    poly(ctx, [cx - w*0.4, h*0.68, cx - w*0.1, h*0.72, cx - w*0.4, h*0.775], BROWN, null, { sh: 0 });
    ctx.restore();
    hilite(ctx, cx - w*0.1, h*0.52, 3, 1.4, 0.18);

    // Short arms
    ell(ctx, cx - w*0.27, h*0.6, 2.8, 4.2, 0.55, BODY, OL, oL);
    ell(ctx, cx + w*0.27, h*0.6, 2.8, 4.2, -0.55, BODY, OL, oL);

    // Ears — long, black tips, swept back a little when jumping
    const tilt = jumping ? 0.06 : 0;
    const ear = (ax, ay, bx, by, tx, ty) => {
      poly(ctx, [ax, ay, tx, ty, bx, by], BODY, OL, oL);
      band(ctx, ax, ay, bx, by, tx, ty, 0.62, 1.0, BLACK);
    };
    ear(cx - w*0.32, h*0.21, cx - w*0.06, h*0.13, cx - w*(0.46 + tilt), h*(-0.1));
    ear(cx + w*0.06, h*0.13, cx + w*0.32, h*0.21, cx + w*(0.5 + tilt), h*(-0.08));

    // Head
    ell(ctx, cx, h*0.3, w*0.35, h*0.17, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.21, 3.2, 1.6);

    // Cheeks, eyes, nose + small mouth
    cheek(cx - w*0.3, h*0.36, 3.4, 3, CHEEK, CHEEK_OL);
    cheek(cx + w*0.3, h*0.36, 3.4, 3, CHEEK, CHEEK_OL);
    eyes(cx - w*0.15, cx + w*0.15, h*0.3, 2.5, 3.3, EYE);
    wMouth(cx, h*0.405, 1.4, EYE);

  } else {
    // ── RAICHU (32×56) ── orange, cream belly, long curled ears with yellow
    // tips, yellow cheeks, thin brown tail ending in a big yellow bolt.
    const BODY = '#ffb050', SH = '#f09030', OL = '#5a2c0c', CREAM = '#fbe6b8', YEL = '#f8e040', YEL_OL = '#8a6010';
    const BROWN = '#6e4018', FOOT = '#f8f0e0', EYE = '#1a1208';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.54;
    const sx = w / 32, sy = h / 56, P = (pts, dx, dy) => pts.map((v, i) => (i % 2 ? (v + dy) * sy : (v + dx) * sx));

    // Tail — long thin brown whip rising behind the left shoulder…
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const tail = () => {
      ctx.moveTo(cx - w*0.18, h*0.7);
      ctx.bezierCurveTo(w*0.0, h*0.68, w*(-0.14), h*0.48 + sway, w*0.14, h*0.34 + sway);
    };
    ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); tail(); ctx.stroke();
    ctx.strokeStyle = BROWN; ctx.lineWidth = 2.8; ctx.beginPath(); tail(); ctx.stroke();
    // …ending in a big yellow lightning bolt, pointed like an arrow
    poly(ctx, P([3,21, -2,14, 1,13, -4,5, 6,10, 3,12, 9,19], 0, sway), YEL, YEL_OL, { lw: 1.3, dy: 2.5, shade: '#e0b820' });

    // Feet — small, whitish
    if (jumping) {
      ell(ctx, cx - w*0.22, h*0.88, w*0.12, h*0.06, 0.35, FOOT, OL, { lw: 1.3, sh: 0.86 });
      ell(ctx, cx + w*0.22, h*0.86, w*0.12, h*0.06, -0.35, FOOT, OL, { lw: 1.3, sh: 0.86 });
    } else {
      ell(ctx, cx - w*(0.2 - step*0.06), h*0.935, w*0.12, h*0.06, 0, FOOT, OL, { lw: 1.3, sh: 0.86 });
      ell(ctx, cx + w*(0.18 - step*0.06), h*0.935, w*0.12, h*0.06, 0, FOOT, OL, { lw: 1.3, sh: 0.86 });
    }

    // Body + cream belly
    const body = () => ctx.ellipse(cx, h*0.66, w*0.32, h*0.23, 0, 0, TAU);
    shape(ctx, body, BODY, OL, o);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    ell(ctx, cx + w*0.04, h*0.7, w*0.2, h*0.17, 0, CREAM, null, { sh: 0.9, dy: 3 });
    ctx.restore();
    hilite(ctx, cx - w*0.14, h*0.52, 3, 1.4, 0.18);

    // Short arms
    ell(ctx, cx - w*0.29, h*0.6, 2.8, 4.2, 0.55, BODY, OL, oL);
    ell(ctx, cx + w*0.29, h*0.6, 2.8, 4.2, -0.55, BODY, OL, oL);

    // Ears — long brown stems that taper into a hooked spiral at the tip,
    // yellow stripe inside and a yellow line through the curl
    const tilt = jumping ? 1.5 : 0;
    const ear = (dir) => {
      const tx = cx + dir * w*0.44, ty = h*0.03 - tilt, r = 2.3;
      const ccx = tx - dir * 0.85 * r, ccy = ty - 0.5 * r;          // curl centre, inside of the tip
      const a0 = Math.atan2(ty - ccy, tx - ccx), a1 = a0 - dir * 4.6;
      // stem bezier split in two so the root is thicker than the outer half
      const p0 = [cx + dir * w*0.18, h*0.2], p1 = [cx + dir * w*0.32, h*0.08], p2 = [cx + dir * w*0.42, h*0.03 - tilt], p3 = [tx, ty];
      const q = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const m01 = q(p0, p1), m12 = q(p1, p2), m23 = q(p2, p3), m012 = q(m01, m12), m123 = q(m12, m23), mid = q(m012, m123);
      const root  = () => { ctx.moveTo(p0[0], p0[1]); ctx.bezierCurveTo(m01[0], m01[1], m012[0], m012[1], mid[0], mid[1]); };
      const outer = () => { ctx.moveTo(mid[0], mid[1]); ctx.bezierCurveTo(m123[0], m123[1], m23[0], m23[1], tx, ty); };
      const curl  = () => ctx.arc(ccx, ccy, r, a0, a1, dir === 1);
      const stroke = (build, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); build(); ctx.stroke(); };
      stroke(root, OL, 8.6); stroke(outer, OL, 6.8); stroke(curl, OL, 5);
      stroke(root, BROWN, 6.2); stroke(outer, BROWN, 4.4); stroke(curl, BROWN, 2.6);
      stroke(root, YEL, 2.2); stroke(outer, YEL, 1.6); stroke(curl, YEL, 1);
    };
    ear(-1); ear(1);

    // Head
    ell(ctx, cx, h*0.3, w*0.34, h*0.17, 0, BODY, OL, o);
    hilite(ctx, cx - w*0.16, h*0.21, 3.2, 1.6);

    // Cheeks, eyes, nose + mouth
    cheek(cx - w*0.29, h*0.36, 3.4, 3, YEL, YEL_OL);
    cheek(cx + w*0.29, h*0.36, 3.4, 3, YEL, YEL_OL);
    eyes(cx - w*0.15, cx + w*0.15, h*0.3, 2.5, 3.3, EYE);
    poly(ctx, [cx - 1.3, h*0.385, cx + 1.3, h*0.385, cx, h*0.415], EYE, null, { sh: 0 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, h*0.415); ctx.lineTo(cx, h*0.44); ctx.stroke();
  }
}
