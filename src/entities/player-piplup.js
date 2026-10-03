// Piplup line: Piplup (small), Prinplup (evo 1), Empoleon (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
import { POWER, COLORS } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

export function drawPiplup(p, ctx, w, h) {
  const pw   = p.power;
  const step = Math.abs(p.vx) > 0.3 ? Math.floor(p.animTimer / 8) % 2 : 0;

  const eye = (ex, ey, r, iris, OL) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, r, r + 0.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    if (iris) { ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 0.5, r*0.55, r*0.62, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 0.6, r*0.4, r*0.42, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(ex, ey - r*0.6, 1.5, 1.5);
  };

  if (pw === POWER.SMALL) {
    // Piplup — small round blue penguin
    const NAVY = '#1840a0', LIGHT = '#80c8f0', BEAK = '#f0a020', OL = '#0a1848';

    ell(ctx, w*0.5, h*0.62, w*0.34, h*0.3, 0, NAVY, OL);
    ell(ctx, w*0.62, h*0.64, w*0.2, h*0.22, 0.1, LIGHT, null, { sh: 0.86, dy: 3 });

    ell(ctx, w*0.66, h*0.32, w*0.24, h*0.24, 0, NAVY, OL);
    ell(ctx, w*0.72, h*0.34, w*0.14, h*0.16, 0.1, LIGHT, null, { sh: 0.86 });
    hilite(ctx, w*0.54, h*0.2, 2.8, 1.5);

    ell(ctx, w*(0.26+step*0.03), h*0.6, w*0.08, h*0.14, -0.3, NAVY, OL, { lw: 1.2 });
    ell(ctx, w*(0.82-step*0.03), h*0.6, w*0.08, h*0.14, 0.3, NAVY, OL, { lw: 1.2 });

    ell(ctx, w*(0.42+step*0.04), h*0.89, w*0.1, h*0.07, 0.1, BEAK, OL, { lw: 1.2 });
    ell(ctx, w*(0.62-step*0.04), h*0.89, w*0.1, h*0.07, -0.1, BEAK, OL, { lw: 1.2 });

    poly(ctx, [w*0.83, h*0.33, w*0.92, h*0.38, w*0.83, h*0.42], BEAK, OL, { lw: 1.2 });

    eye(w*0.76, h*0.29, 5, null, OL);

  } else if (pw === POWER.BIG) {
    // Prinplup — taller, darker navy, golden V-crest
    const NAVY = '#102870', LIGHT = '#a8d8f0', BEAK = '#d89010', GOLD = '#f0c020', OL = '#060e34';

    ell(ctx, w*0.5, h*0.6, w*0.32, h*0.32, 0, NAVY, OL);
    ell(ctx, w*0.6, h*0.62, w*0.22, h*0.26, 0.1, '#e8f4ff', null, { sh: 0.86, dy: 3 });
    ctx.fillStyle = LIGHT;
    ctx.beginPath(); ctx.ellipse(w*0.6, h*0.52, w*0.1, h*0.08, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.58, h*0.63, w*0.09, h*0.07, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.62, h*0.73, w*0.08, h*0.06, 0, 0, TAU); ctx.fill();

    ell(ctx, w*(0.22+step*0.03), h*0.58, w*0.1, h*0.18, -0.25, NAVY, OL);
    ell(ctx, w*(0.84-step*0.03), h*0.58, w*0.1, h*0.18, 0.25, NAVY, OL);

    ell(ctx, w*(0.4+step*0.04), h*0.89, w*0.1, h*0.08, 0.1, BEAK, OL, { lw: 1.2 });
    ell(ctx, w*(0.62-step*0.04), h*0.89, w*0.1, h*0.08, -0.1, BEAK, OL, { lw: 1.2 });

    ell(ctx, w*0.66, h*0.3, w*0.26, h*0.22, 0, NAVY, OL);
    ell(ctx, w*0.72, h*0.32, w*0.15, h*0.16, 0.1, LIGHT, null, { sh: 0.86 });
    hilite(ctx, w*0.52, h*0.18, 3, 1.5);

    poly(ctx, [w*0.56, h*0.12, w*0.52, h*(-0.04), w*0.62, h*0.1], GOLD, OL, { lw: 1.1 });
    poly(ctx, [w*0.66, h*0.1, w*0.62, h*(-0.06), w*0.72, h*0.08], GOLD, OL, { lw: 1.1 });

    poly(ctx, [w*0.85, h*0.3, w*0.95, h*0.34, w*0.85, h*0.38], BEAK, OL, { lw: 1.2 });

    eye(w*0.78, h*0.27, 5, null, OL);

  } else {
    // Empoleon — large, imposing, trident crown, steel armor wings
    const NAVY = '#0a1840', STEEL = '#2050a8', BEAK = '#c87800', GOLD = '#f0c020', OL = '#04091e';

    ell(ctx, w*(0.18+step*0.03), h*0.54, w*0.12, h*0.26, -0.2, STEEL, OL);
    ell(ctx, w*(0.88-step*0.03), h*0.54, w*0.12, h*0.26, 0.2, STEEL, OL);
    ctx.strokeStyle = '#4070d0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.16, h*0.42); ctx.lineTo(w*0.14, h*0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.86, h*0.42); ctx.lineTo(w*0.88, h*0.7); ctx.stroke();

    ell(ctx, w*0.52, h*0.58, w*0.36, h*0.34, 0, NAVY, OL, { lw: 1.8, shade: '#040c24' });
    ell(ctx, w*0.62, h*0.6, w*0.24, h*0.28, 0.1, '#e0eeff', null, { sh: 0.86, dy: 3 });
    ctx.strokeStyle = STEEL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w*0.62, h*0.52, w*0.12, h*0.06, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*0.62, h*0.62, w*0.1, h*0.05, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(w*0.62, h*0.72, w*0.08, h*0.04, 0, 0, TAU); ctx.stroke();

    ell(ctx, w*(0.38+step*0.04), h*0.87, w*0.12, h*0.11, 0.1, NAVY, OL, { shade: '#040c24' });
    ell(ctx, w*(0.64-step*0.04), h*0.87, w*0.12, h*0.11, -0.1, NAVY, OL, { shade: '#040c24' });
    ell(ctx, w*(0.36+step*0.04), h*0.93, w*0.12, h*0.06, 0, BEAK, OL, { lw: 1.2 });
    ell(ctx, w*(0.66-step*0.04), h*0.93, w*0.12, h*0.06, 0, BEAK, OL, { lw: 1.2 });

    ell(ctx, w*0.66, h*0.28, w*0.28, h*0.22, 0, NAVY, OL, { lw: 1.8, shade: '#040c24' });
    ell(ctx, w*0.74, h*0.3, w*0.16, h*0.18, 0.1, '#c0d8f8', null, { sh: 0.86 });
    hilite(ctx, w*0.5, h*0.16, 3, 1.5, 0.25);

    poly(ctx, [w*0.62, h*0.1, w*0.58, h*(-0.1), w*0.66, h*0.08], GOLD, OL, { lw: 1.1 });
    poly(ctx, [w*0.52, h*0.12, w*0.46, h*(-0.04), w*0.58, h*0.1], GOLD, OL, { lw: 1.1 });
    poly(ctx, [w*0.72, h*0.1, w*0.68, h*(-0.04), w*0.78, h*0.12], GOLD, OL, { lw: 1.1 });
    poly(ctx, [w*0.48, h*0.09, w*0.76, h*0.09, w*0.76, h*0.13, w*0.48, h*0.13], GOLD, OL, { lw: 1.1 });

    poly(ctx, [w*0.88, h*0.28, w*0.98, h*0.33, w*0.88, h*0.38], BEAK, OL, { lw: 1.2 });

    eye(w*0.8, h*0.25, 5.5, '#1840a0', OL);
  }
}
