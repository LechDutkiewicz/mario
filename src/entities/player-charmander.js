// Charmander line: Charmander (small), Charmeleon (evo 1), Charizard (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
// Same look as the Eevee line: base fill, explicit darker shade on the
// underside, ~1.3–1.6px ink outline, one small specular on the head.
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

// ── shared pieces ────────────────────────────────────────────────────────────

// Outline only the outer silhouette of a multi-part path (fill, stroke, re-fill)
function union(ctx, build, fill, ol, o) {
  shape(ctx, build, fill, null, o);
  ctx.strokeStyle = ol; ctx.lineWidth = (o && o.lw) || 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); build(); ctx.stroke();
  shape(ctx, build, fill, null, o);
}

// Tail: ink under a shaded stroke, with a lighter top edge so it reads as a
// round tube rather than a flat ribbon. lw = visible thickness.
function tailStroke(ctx, build, col, shade, ol, lw) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ol;    ctx.lineWidth = lw + 2.6; ctx.beginPath(); build(); ctx.stroke();
  ctx.strokeStyle = shade; ctx.lineWidth = lw;       ctx.beginPath(); build(); ctx.stroke();
  ctx.save(); ctx.translate(0, -lw * 0.22);
  ctx.strokeStyle = col;   ctx.lineWidth = lw * 0.6; ctx.beginPath(); build(); ctx.stroke();
  ctx.restore();
}

// Teardrop path: pointed top, round bottom; (x, y) is the centre of the round part
const drop = (ctx, x, y, rw, rh) => () => {
  ctx.moveTo(x, y - rh);
  ctx.quadraticCurveTo(x + rw * 1.25, y - rh * 0.35, x + rw, y);
  ctx.arc(x, y, rw, 0, Math.PI);
  ctx.quadraticCurveTo(x - rw * 1.25, y - rh * 0.35, x, y - rh);
  ctx.closePath();
};

// Layered tail flame standing on its base point (bx, by): dark orange → orange
// → yellow → pale core, flickering with t. s scales the whole thing.
function flame(ctx, bx, by, s, t) {
  const f1 = Math.sin(t * 0.31), f2 = Math.sin(t * 0.47 + 1.3);
  const rw = 3.1 * s, rh = (9.2 + f1 * 1.4) * s, cy = by - rw;
  shape(ctx, drop(ctx, bx, cy, rw, rh), '#e03a08', '#5a1200', { sh: 0, lw: 1.2 });
  shape(ctx, drop(ctx, bx + f2 * 0.3 * s, cy - 0.3 * s, rw * 0.72, rh * 0.74 + f2 * 0.6 * s), '#ff6a14', null, { sh: 0 });
  shape(ctx, drop(ctx, bx + f1 * 0.25 * s, cy - 0.5 * s, rw * 0.46, rh * 0.5 + f1 * 0.4 * s), '#ffb424', null, { sh: 0 });
  shape(ctx, drop(ctx, bx, cy - 0.6 * s, rw * 0.22, rh * 0.26), '#fff4b0', null, { sh: 0 });
}

// Small white claw triangles hanging from a foot/hand edge
function claws(ctx, pts, col, ol) {
  for (const [x, y, len] of pts) poly(ctx, [x - 1.1, y, x + 1.1, y, x, y + len], col, ol, { sh: 0, lw: 0.8 });
}

// White-sclera eye with a coloured iris looking slightly right; optional
// angry brow (quad in the skin colour cutting the top of the eye, inner side lower)
function irisEye(ctx, x, y, rx, ry, iris, ol, brow, skin, side) {
  ell(ctx, x, y, rx, ry, 0, '#fff', ol, { sh: 0, lw: 1 });
  ell(ctx, x + rx * 0.2, y + ry * 0.08, rx * 0.66, ry * 0.72, 0, iris, null, { sh: 0 });
  ell(ctx, x + rx * 0.22, y + ry * 0.12, rx * 0.34, ry * 0.42, 0, '#101018', null, { sh: 0 });
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - rx * 0.35, y - ry * 0.55, 1.4, 1.4);
  if (brow) {
    // side: +1 = inner edge on the right (left eye), -1 = inner edge on the left
    const outer = y - ry * 0.95, inner = y - ry * 0.3;
    const yl = side > 0 ? outer : inner, yr = side > 0 ? inner : outer;
    poly(ctx, [x - rx - 1, y - ry - 2, x + rx + 1, y - ry - 2, x + rx + 1, yr, x - rx - 1, yl], skin, null, { sh: 0 });
    ctx.strokeStyle = ol; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - rx - 0.5, yl); ctx.lineTo(x + rx + 0.5, yr); ctx.stroke();
  }
}

export function drawCharmander(p, ctx, w, h) {
  const pw      = p.power;
  const jumping = !p.onGround;
  const moving  = Math.abs(p.vx) > 0.3;
  const step    = moving ? Math.floor(p.animTimer / 8) % 2 : 0;
  const t       = p.animTimer;
  const sway    = moving ? Math.sin(t * 0.4) : 0;

  if (pw === POWER.SMALL) {
    // ── CHARMANDER (28×32) ── chubby orange lizard, big round head, blue eyes,
    // tail low behind the left side with the flame beside the shoulder
    const C = '#f8a048', SH = '#d8782a', CREAM = '#f8e4a8', CREAM_OL = '#c8a060', OL = '#5c2a08';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.57;

    // Tail — leaves the lower back, curls out left and up; flame at the tip
    tailStroke(ctx, () => {
      ctx.moveTo(cx - w*0.26, h*0.80);
      ctx.quadraticCurveTo(w*(-0.12), h*0.88 + sway, w*(-0.02), h*0.60 + sway * 0.5);
    }, C, SH, OL, 4);
    flame(ctx, w*(-0.02), h*0.60 + sway * 0.5, 0.8, t);

    // Stubby legs
    if (jumping) {
      ell(ctx, cx - w*0.2, h*0.88, w*0.11, h*0.09, 0.4, C, OL, oL);
      ell(ctx, cx + w*0.2, h*0.86, w*0.11, h*0.09, -0.4, C, OL, oL);
    } else {
      ell(ctx, cx - w*0.19 + step*1.5, h*0.91, w*0.11, h*0.09, 0, C, OL, oL);
      ell(ctx, cx + w*0.19 - step*1.5, h*0.91, w*0.11, h*0.09, 0, C, OL, oL);
    }

    // Body + cream belly
    ell(ctx, cx, h*0.74, w*0.33, h*0.22, 0, C, OL, o);
    ell(ctx, cx + 0.5, h*0.77, w*0.2, h*0.15, 0, CREAM, CREAM_OL, { sh: 0.9, dy: 3, lw: 1 });

    // Short arms
    if (jumping) {
      ell(ctx, cx - w*0.35, h*0.63, 2.6, 3.8, 0.8, C, OL, oL);
      ell(ctx, cx + w*0.35, h*0.63, 2.6, 3.8, -0.8, C, OL, oL);
    } else {
      ell(ctx, cx - w*0.33, h*0.67, 2.6, 3.8, 0.45, C, OL, oL);
      ell(ctx, cx + w*0.33, h*0.67, 2.6, 3.8, -0.45, C, OL, oL);
    }

    // Head — big and round, sitting on the body
    ell(ctx, cx, h*0.34, w*0.39, h*0.28, 0, C, OL, o);
    hilite(ctx, cx - w*0.17, h*0.19, 3.4, 1.7);

    // Big blue eyes, nostrils, friendly smile
    irisEye(ctx, cx - w*0.15, h*0.34, 3.0, 3.7, '#2a5cd8', OL);
    irisEye(ctx, cx + w*0.15, h*0.34, 3.0, 3.7, '#2a5cd8', OL);
    ctx.fillStyle = OL;
    ctx.fillRect(cx - 2.2, h*0.485, 1.3, 1.3);
    ctx.fillRect(cx + 1.0, h*0.485, 1.3, 1.3);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w*0.15, h*0.52); ctx.quadraticCurveTo(cx, h*0.60, cx + w*0.15, h*0.52); ctx.stroke();

  } else if (pw === POWER.BIG) {
    // ── CHARMELEON (32×56) ── crimson, taller and slimmer, one horn swept back,
    // narrowed eyes, claws. Thin tail leaves the lower back, swings out to the
    // left and only then rises, so the flame sits clear of the body.
    const C = '#e05038', SH = '#ac3224', D = '#b43828', CREAM = '#f8e4a8', CREAM_OL = '#c8a060';
    const CLAW = '#f4f4e0', OL = '#4a1010';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.55;

    // Tail (≤4px) and flame — flame base at upper-left, well clear of the body
    const tipX = w*(-0.06), tipY = h*0.50 + sway * 0.6;
    tailStroke(ctx, () => {
      ctx.moveTo(cx - w*0.2, h*0.72);
      ctx.bezierCurveTo(w*(-0.02), h*0.76, w*(-0.16), h*0.70 + sway, tipX, tipY);
    }, C, SH, OL, 3.8);
    flame(ctx, tipX, tipY, 1.0, t);

    // Legs — longer, with claws
    const legs = jumping
      ? [[cx - w*0.19, h*0.86, 0.35], [cx + w*0.19, h*0.85, -0.35]]
      : [[cx - w*0.18 + step*1.5, h*0.885, 0], [cx + w*0.18 - step*1.5, h*0.885, 0]];
    for (const [lx, ly, rot] of legs) {
      ell(ctx, lx, ly, w*0.1, h*0.115, rot, C, OL, oL);
      if (!jumping) claws(ctx, [[lx - 1.8, h*0.98, 2.4], [lx + 1.4, h*0.98, 2.4]], CLAW, '#8a7a50');
    }

    // Body + cream belly
    ell(ctx, cx, h*0.60, w*0.26, h*0.25, 0, C, OL, o);
    ell(ctx, cx + 0.5, h*0.63, w*0.16, h*0.19, 0, CREAM, CREAM_OL, { sh: 0.9, dy: 3, lw: 1 });

    // Arms with claws
    const arms = jumping
      ? [[cx - w*0.3, h*0.47, 1.1], [cx + w*0.3, h*0.47, -1.1]]
      : [[cx - w*0.3, h*0.56, 0.4], [cx + w*0.3, h*0.56, -0.4]];
    for (const [ax, ay, rot] of arms) {
      ell(ctx, ax, ay, 2.8, 5.2, rot, C, OL, oL);
      if (!jumping) {
        const ex = ax - Math.sin(rot) * 4.6, ey = ay + Math.cos(rot) * 4.6;
        claws(ctx, [[ex - 1.2, ey, 2.2], [ex + 1.2, ey - 0.4, 2.2]], CLAW, '#8a7a50');
      }
    }

    // Horn — single, swept back (left) from the back of the head; head covers its base
    poly(ctx, [cx - w*0.08, h*0.16, cx - w*0.24, h*0.21, cx - w*0.44, h*0.02], D, OL, oL);

    // Head — round skull with a slightly wider muzzle, one silhouette outline
    const head = () => {
      ctx.ellipse(cx, h*0.26, w*0.29, h*0.145, 0, 0, TAU);
      ctx.moveTo(cx + w*0.10 + w*0.21, h*0.335);
      ctx.ellipse(cx + w*0.10, h*0.335, w*0.21, h*0.075, 0, 0, TAU);
    };
    union(ctx, head, C, OL, o);
    hilite(ctx, cx - w*0.14, h*0.17, 3.2, 1.6);

    // Narrowed eyes, nostril, mouth with a small fang
    irisEye(ctx, cx - w*0.14, h*0.255, 3.0, 3.3, '#2a5cd8', OL, true, C, 1);
    irisEye(ctx, cx + w*0.16, h*0.255, 3.0, 3.3, '#2a5cd8', OL, true, C, -1);
    ctx.fillStyle = OL;
    ctx.fillRect(cx + w*0.25, h*0.325, 1.4, 1.4);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w*0.06, h*0.375); ctx.quadraticCurveTo(cx + w*0.1, h*0.395, cx + w*0.26, h*0.37); ctx.stroke();
    poly(ctx, [cx + w*0.14, h*0.382, cx + w*0.2, h*0.378, cx + w*0.17, h*0.43], '#fff', null, { sh: 0 });

  } else {
    // ── CHARIZARD (32×56) ── orange dragon: long neck, snout with a fang, two
    // backward horns, big teal bat wings spread behind the shoulders, tail flame
    const C = '#f08030', SH = '#c45c18', D = '#c86020', CREAM = '#f8e4a8', CREAM_OL = '#c8a060';
    const CLAW = '#f4f4e0', OL = '#5a2808';
    const WING = '#1a5a44', WING_SH = '#12422f', WING_L = '#2a9460', WING_OL = '#06231a';
    const o = { shade: SH }, oL = { shade: SH, lw: 1.3 };
    const cx = w * 0.52;
    const lift = jumping ? h*0.025 : 0;               // wings raised in the air
    const flap = jumping ? Math.sin(t * 0.35) * h*0.015 : 0;

    // Wing: points for the LEFT wing (spreading up and out to the left); the
    // right wing mirrors them about cx, drawn first and a little smaller (far side)
    const wing = (k) => {
      const X = (dx) => cx + dx * w * k, Y = (dy) => h * dy - lift + (k < 0 ? flap : -flap);
      const S  = [X(-0.08), Y(0.46)];                 // shoulder (behind the body)
      const E  = [X(-0.36), Y(0.20)];                 // elbow
      const W  = [X(-0.50), Y(0.02)];                 // wrist
      const T0 = [X(-0.46), Y(-0.085)];                // thumb spike
      const F1 = [X(-0.66), Y(0.09)];                 // finger tips
      const F2 = [X(-0.64), Y(0.29)];
      const F3 = [X(-0.48), Y(0.45)];
      const B  = [X(-0.20), Y(0.58)];                 // membrane root at the hip
      const mid = (a, b, c, f) => [L((a[0] + b[0]) / 2, c[0], f), L((a[1] + b[1]) / 2, c[1], f)];
      const N1 = mid(F1, F2, W, 0.42), N2 = mid(F2, F3, E, 0.4);
      const pts = [...S, ...E, ...W, ...T0, ...F1, ...N1, ...F2, ...N2, ...F3, ...B];
      poly(ctx, pts, WING, WING_OL, { shade: WING_SH, dy: 3.5, dx: -1, lw: 1.4 });
      // bones: leading edge shoulder→elbow→wrist, fingers radiating from the wrist
      ctx.strokeStyle = WING_L; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(W[0], W[1]); ctx.stroke();
      ctx.lineWidth = 1.6;
      for (const F of [F1, F2, F3]) { ctx.beginPath(); ctx.moveTo(W[0], W[1]); ctx.lineTo(F[0], F[1]); ctx.stroke(); }
    };
    wing(-0.84);
    wing(1);

    // Tail — out from the lower back, around to the left, flame at the tip
    const tipX = w*(-0.03), tipY = h*0.68 + sway * 0.6;
    tailStroke(ctx, () => {
      ctx.moveTo(cx - w*0.18, h*0.78);
      ctx.bezierCurveTo(w*(-0.02), h*0.88, w*(-0.14), h*0.84 + sway, tipX, tipY);
    }, C, SH, OL, 4);
    flame(ctx, tipX, tipY, 0.95, t);

    // Legs — sturdy, clawed
    const legs = jumping
      ? [[cx - w*0.2, h*0.86, 0.35], [cx + w*0.2, h*0.85, -0.35]]
      : [[cx - w*0.19 + step*1.5, h*0.885, 0], [cx + w*0.19 - step*1.5, h*0.885, 0]];
    for (const [lx, ly, rot] of legs) {
      ell(ctx, lx, ly, w*0.115, h*0.115, rot, C, OL, oL);
      if (!jumping) claws(ctx, [[lx - 2.2, h*0.98, 2.6], [lx + 0.2, h*0.985, 2.6], [lx + 2.4, h*0.98, 2.6]], CLAW, '#8a7a50');
    }

    // Neck (behind body and head), body, belly with faint plates
    ell(ctx, cx + w*0.03, h*0.37, w*0.105, h*0.13, -0.1, C, OL, o);
    ell(ctx, cx, h*0.66, w*0.30, h*0.21, 0, C, OL, o);
    const belly = () => ctx.ellipse(cx + 0.5, h*0.69, w*0.18, h*0.155, 0, 0, TAU);
    shape(ctx, belly, CREAM, CREAM_OL, { sh: 0.9, dy: 3, lw: 1 });
    ctx.save(); ctx.beginPath(); belly(); ctx.clip();
    ctx.strokeStyle = '#dcc088'; ctx.lineWidth = 1;
    for (const yy of [0.62, 0.69, 0.76]) { ctx.beginPath(); ctx.moveTo(cx - 8, h*yy); ctx.lineTo(cx + 9, h*yy); ctx.stroke(); }
    ctx.restore();

    // Arms with claws
    const arms = jumping
      ? [[cx - w*0.31, h*0.52, 1.1], [cx + w*0.31, h*0.52, -1.1]]
      : [[cx - w*0.31, h*0.60, 0.4], [cx + w*0.31, h*0.60, -0.4]];
    for (const [ax, ay, rot] of arms) {
      ell(ctx, ax, ay, 2.9, 5.4, rot, C, OL, oL);
      if (!jumping) {
        const ex = ax - Math.sin(rot) * 4.8, ey = ay + Math.cos(rot) * 4.8;
        claws(ctx, [[ex - 1.3, ey, 2.3], [ex + 1.1, ey - 0.4, 2.3]], CLAW, '#8a7a50');
      }
    }

    // Horns — two, swept back (left) from the crown; the head covers their bases
    poly(ctx, [cx + w*0.08, h*0.12, cx - w*0.05, h*0.16, cx - w*0.18, h*(-0.04)], D, OL, oL);
    poly(ctx, [cx - w*0.03, h*0.16, cx - w*0.16, h*0.21, cx - w*0.32, h*0.03], D, OL, oL);

    // Head + snout as one silhouette
    const head = () => {
      ctx.ellipse(cx + w*0.04, h*0.21, w*0.21, h*0.105, 0, 0, TAU);
      ctx.moveTo(cx + w*0.25 + w*0.19, h*0.25);
      ctx.ellipse(cx + w*0.25, h*0.25, w*0.19, h*0.07, 0, 0, TAU);
    };
    union(ctx, head, C, OL, o);
    hilite(ctx, cx - w*0.07, h*0.15, 2.8, 1.4);

    // Eyes (blue, with a stern brow), nostril, mouth line, fang
    irisEye(ctx, cx - w*0.06, h*0.205, 2.5, 2.9, '#2a5cd8', OL, true, C, 1);
    irisEye(ctx, cx + w*0.15, h*0.205, 2.5, 2.9, '#2a5cd8', OL, true, C, -1);
    ctx.fillStyle = OL;
    ctx.fillRect(cx + w*0.38, h*0.23, 1.4, 1.4);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + w*0.12, h*0.29); ctx.quadraticCurveTo(cx + w*0.28, h*0.305, cx + w*0.42, h*0.278); ctx.stroke();
    poly(ctx, [cx + w*0.28, h*0.297, cx + w*0.35, h*0.29, cx + w*0.32, h*0.34], '#fff', null, { sh: 0 });
  }
}
