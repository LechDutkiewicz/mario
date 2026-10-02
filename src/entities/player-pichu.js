// Pichu line: Pichu (small), Pikachu (evo 1), Raichu (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

export function drawPichu(p, ctx, w, h) {
  const pw   = p.power;
  const step = Math.abs(p.vx) > 0.3 ? Math.floor(p.animTimer / 8) % 2 : 0;

  const face = (lx, rx, ey, nx, ny, r) => {
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(rx, ey, 3.2, 4.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(lx, ey + 0.5, 3.2, 4.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(rx - 1.8, ey - 3, 2, 2);
    ctx.fillRect(lx - 1.8, ey - 2.5, 2, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(nx - 1, ny, 2, 1.5);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(nx, ny + 1, r, 0.3, Math.PI - 0.3); ctx.stroke();
  };

  if (pw === POWER.SMALL) {
    // ── PICHU ── tiny pale-yellow mouse, oversized diamond ears
    const Y = '#f8e470', BLACK = '#222', CHEEK = '#f080a0', OL = '#5a4410', YS = '#d4b040';

    poly(ctx, [w*0.18, h*0.66, w*0.00, h*0.56, w*0.16, h*0.54], BLACK, OL, { lw: 1.2, sh: 0 });

    ell(ctx, w*0.5, h*0.72, w*0.32, h*0.24, 0, Y, OL, { shade: YS });

    ell(ctx, w*(0.36+step*0.04), h*0.93, w*0.11, h*0.06, 0, Y, OL, { lw: 1.2, shade: YS });
    ell(ctx, w*(0.64-step*0.04), h*0.93, w*0.11, h*0.06, 0, Y, OL, { lw: 1.2, shade: YS });

    poly(ctx, [w*0.30, h*0.16, w*0.02, h*0.00, w*0.22, h*0.30], BLACK, OL, { lw: 1.2, shade: '#0a0a0a' });
    poly(ctx, [w*0.68, h*0.14, w*0.98, h*0.00, w*0.80, h*0.28], BLACK, OL, { lw: 1.2, shade: '#0a0a0a' });

    ell(ctx, w*0.52, h*0.38, w*0.40, h*0.28, 0, Y, OL, { shade: YS });
    hilite(ctx, w*0.34, h*0.24, 3.4, 1.7);

    ctx.strokeStyle = BLACK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w*0.52, h*0.50, w*0.24, 0.35, Math.PI - 0.35); ctx.stroke();

    ell(ctx, w*0.82, h*0.44, 4, 3.5, 0, CHEEK, null, { sh: 0.9 });
    ell(ctx, w*0.24, h*0.46, 4, 3.5, 0, CHEEK, null, { sh: 0.9 });

    face(w*0.40, w*0.66, h*0.35, w*0.53, h*0.42, 4);

  } else if (pw === POWER.BIG) {
    // ── PIKACHU ── classic yellow, red cheeks, lightning-bolt tail
    const Y = '#f8d030', BROWN = '#a05a10', CHEEK = '#e03020', BLACK = '#222', OL = '#6a4a08', YS = '#d49a18';

    poly(ctx, [
      w*0.28, h*0.56,            // base at lower back
      w*0.10, h*0.50,
      w*0.22, h*0.42,
      w*0.02, h*0.34,
      w*0.16, h*0.26,
      w*(-0.06), h*0.16,
      w*0.30, h*0.12,            // wide flat top of the bolt
      w*0.16, h*0.24,
      w*0.34, h*0.32,
      w*0.20, h*0.40,
      w*0.36, h*0.48,
    ], Y, OL, { lw: 1.3, dy: 3, shade: YS });
    poly(ctx, [w*0.28, h*0.56, w*0.36, h*0.48, w*0.40, h*0.56], BROWN, null, { sh: 0 });

    ell(ctx, w*0.5, h*0.66, w*0.34, h*0.28, 0, Y, OL, { shade: YS });

    ctx.strokeStyle = BROWN; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w*0.34, h*0.58, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(w*0.34, h*0.66, w*0.16, Math.PI*1.15, Math.PI*1.7); ctx.stroke();

    ell(ctx, w*(0.36+step*0.05), h*0.94, w*0.13, h*0.05, 0, Y, OL, { lw: 1.2, shade: YS });
    ell(ctx, w*(0.66-step*0.05), h*0.94, w*0.13, h*0.05, 0, Y, OL, { lw: 1.2, shade: YS });

    ell(ctx, w*0.80, h*0.62, w*0.08, h*0.05, 0.5, Y, OL, { lw: 1.2, shade: YS });

    poly(ctx, [w*0.32, h*0.20, w*0.12, h*0.00, w*0.44, h*0.14], Y, OL, { lw: 1.2, shade: YS });
    poly(ctx, [w*0.12, h*0.00, w*0.22, h*0.095, w*0.28, h*0.045], BLACK, null, { sh: 0 });
    poly(ctx, [w*0.66, h*0.19, w*0.90, h*0.00, w*0.78, h*0.16], Y, OL, { lw: 1.2, shade: YS });
    poly(ctx, [w*0.90, h*0.00, w*0.80, h*0.085, w*0.86, h*0.06], BLACK, null, { sh: 0 });

    ell(ctx, w*0.54, h*0.30, w*0.32, h*0.18, 0, Y, OL, { shade: YS });
    hilite(ctx, w*0.4, h*0.2, 3.2, 1.6);

    ell(ctx, w*0.80, h*0.35, 4.5, 4, 0, CHEEK, null, { sh: 0.85 });
    ell(ctx, w*0.30, h*0.36, 4.5, 4, 0, CHEEK, null, { sh: 0.85 });

    face(w*0.44, w*0.68, h*0.27, w*0.56, h*0.33, 4);

  } else {
    // ── RAICHU ── orange, cream belly, long thin tail with big bolt tip
    const OR = '#f09030', CREAM = '#f8e0b0', CHEEK = '#f8d838', BROWN = '#7a4a10', OL = '#5a2c0c';

    ctx.lineCap = 'round';
    const tail = () => { ctx.moveTo(w*0.26, h*0.62); ctx.bezierCurveTo(w*0.00, h*0.56, w*(-0.10), h*0.36, w*0.02, h*0.20); };
    ctx.strokeStyle = OL; ctx.lineWidth = 5.5; ctx.beginPath(); tail(); ctx.stroke();
    ctx.strokeStyle = BROWN; ctx.lineWidth = 3.5; ctx.beginPath(); tail(); ctx.stroke();
    poly(ctx, [
      w*0.02, h*0.22,
      w*(-0.12), h*0.14,
      w*(-0.02), h*0.12,
      w*(-0.10), h*0.02,
      w*0.10, h*0.08,
      w*0.02, h*0.10,
      w*0.12, h*0.18,
    ], CHEEK, OL, { lw: 1.2 });

    ell(ctx, w*0.5, h*0.64, w*0.36, h*0.30, 0, OR, OL);
    ell(ctx, w*0.56, h*0.68, w*0.22, h*0.20, 0.05, CREAM, null, { sh: 0.9, dy: 3 });

    ell(ctx, w*(0.34+step*0.05), h*0.95, w*0.14, h*0.05, 0, OR, OL, { lw: 1.2 });
    ell(ctx, w*(0.66-step*0.05), h*0.95, w*0.14, h*0.05, 0, OR, OL, { lw: 1.2 });

    ell(ctx, w*0.82, h*0.58, w*0.08, h*0.055, 0.5, OR, OL, { lw: 1.2 });

    poly(ctx, [w*0.34, h*0.16, w*0.04, h*0.02, w*0.14, h*0.14, w*0.30, h*0.24], BROWN, OL, { lw: 1.2 });
    ell(ctx, w*0.10, h*0.055, 3, 2.5, -0.5, CHEEK, null, { sh: 0 });
    poly(ctx, [w*0.66, h*0.15, w*0.96, h*0.01, w*0.86, h*0.13, w*0.72, h*0.23], BROWN, OL, { lw: 1.2 });
    ell(ctx, w*0.90, h*0.045, 3, 2.5, 0.5, CHEEK, null, { sh: 0 });

    ell(ctx, w*0.54, h*0.28, w*0.30, h*0.17, 0, OR, OL);
    hilite(ctx, w*0.4, h*0.2, 3, 1.5);

    ell(ctx, w*0.79, h*0.33, 4.5, 4, 0, CHEEK, null, { sh: 0.88 });
    ell(ctx, w*0.30, h*0.34, 4.5, 4, 0, CHEEK, null, { sh: 0.88 });

    face(w*0.44, w*0.67, h*0.25, w*0.56, h*0.305, 4.5);
  }
}
