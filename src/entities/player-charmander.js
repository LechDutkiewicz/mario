// Charmander line: Charmander (small), Charmeleon (evo 1), Charizard (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
import { POWER } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

export function drawCharmander(p, ctx, w, h) {
  const pw    = p.power;
  const step  = Math.abs(p.vx) > 0.3 ? Math.floor(p.animTimer / 8) % 2 : 0;
  const flick = Math.sin(p.animTimer * 0.28) * 1.2;

  // Tail flame — layered teardrop, flickers; outer layer inked
  const flame = (fx, fy, s) => {
    ell(ctx, fx, fy, s*3.2, s*6.5+flick*s*0.7, 0, '#c83000', '#6a1400', { sh: 0, lw: 1.2 });
    ctx.fillStyle = '#ff5500';
    ctx.beginPath(); ctx.ellipse(fx, fy-s*2.2, s*2.2, s*4.6+flick*s*0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath(); ctx.ellipse(fx, fy-s*3.8, s*1.3, s*2.8+flick*s*0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffee88';
    ctx.beginPath(); ctx.ellipse(fx, fy-s*5.0, s*0.65, s*1.5, 0, 0, TAU); ctx.fill();
  };
  // Tail: inked stroke under a coloured stroke
  const tailStroke = (build, col, ol, lw) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = ol; ctx.lineWidth = lw + 2.6; ctx.beginPath(); build(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); build(); ctx.stroke();
  };

  if (pw === POWER.SMALL) {
    // ── CHARMANDER ── round orange lizard, big head, tail flame
    const C = '#f8933c', CREAM = '#f8e0a0', OL = '#6a2a08';

    tailStroke(() => { ctx.moveTo(w*0.26, h*0.72); ctx.quadraticCurveTo(w*(-0.04), h*0.72, w*0.02, h*0.44); }, C, OL, 5);
    flame(w*0.02, h*0.36, 0.9);

    ell(ctx, w*0.5, h*0.70, w*0.34, h*0.25, 0, C, OL);
    ell(ctx, w*0.58, h*0.74, w*0.2, h*0.16, 0.1, CREAM, null, { sh: 0.9, dy: 3 });

    ell(ctx, w*(0.34+step*0.05), h*0.94, w*0.12, h*0.06, 0, C, OL, { lw: 1.2 });
    ell(ctx, w*(0.66-step*0.05), h*0.94, w*0.12, h*0.06, 0, C, OL, { lw: 1.2 });

    ell(ctx, w*0.78, h*0.64, w*0.08, h*0.06, 0.4, C, OL, { lw: 1.2 });
    ell(ctx, w*0.24, h*0.64, w*0.08, h*0.06, -0.4, C, OL, { lw: 1.2 });

    ell(ctx, w*0.54, h*0.34, w*0.39, h*0.27, 0, C, OL);
    hilite(ctx, w*0.36, h*0.2, 3.5, 1.8);

    const eye = (ex) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex, h*0.30, 3.6, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a6ad8';
      ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.31, 2.3, 3.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(ex + 0.7, h*0.315, 1.3, 1.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex - 0.6, h*0.272, 1.6, 1.6);
    };
    eye(w*0.40);
    eye(w*0.68);

    ctx.fillStyle = OL;
    ctx.fillRect(w*0.51, h*0.40, 1.3, 1.3);
    ctx.fillRect(w*0.58, h*0.40, 1.3, 1.3);

    ctx.strokeStyle = OL; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w*0.34, h*0.45);
    ctx.quadraticCurveTo(w*0.54, h*0.525, w*0.76, h*0.44);
    ctx.stroke();

  } else if (pw === POWER.BIG) {
    // ── CHARMELEON ── crimson, upright, single backward horn, fierce
    const C = '#e04828', D = '#a82808', CREAM = '#f8e0a0', CLAW = '#f0f0d0', OL = '#4a1008';

    tailStroke(() => { ctx.moveTo(w*0.30, h*0.72); ctx.quadraticCurveTo(w*(-0.08), h*0.74, w*(-0.02), h*0.40); }, C, OL, 7);
    flame(w*(-0.02), h*0.32, 1.1);

    ell(ctx, w*(0.36+step*0.05), h*0.90, w*0.13, h*0.09, 0, C, OL, { lw: 1.3 });
    ell(ctx, w*(0.66-step*0.05), h*0.90, w*0.13, h*0.09, 0, C, OL, { lw: 1.3 });
    ctx.fillStyle = CLAW;
    ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2, 3);
    ctx.fillRect(w*(0.38+step*0.05), h*0.955, 2, 3);
    ctx.fillRect(w*(0.60-step*0.05), h*0.955, 2, 3);
    ctx.fillRect(w*(0.68-step*0.05), h*0.955, 2, 3);

    ell(ctx, w*0.5, h*0.62, w*0.32, h*0.30, 0, C, OL);
    ell(ctx, w*0.58, h*0.66, w*0.19, h*0.22, 0.05, CREAM, null, { sh: 0.9, dy: 3 });

    ell(ctx, w*0.80, h*0.58, w*0.09, h*0.06, 0.5, C, OL, { lw: 1.1 });
    ctx.fillStyle = CLAW;
    ctx.fillRect(w*0.86, h*0.615, 2, 3.5);
    ctx.fillRect(w*0.90, h*0.60, 2, 3.5);

    ell(ctx, w*0.56, h*0.26, w*0.30, h*0.17, 0, C, OL);
    hilite(ctx, w*0.44, h*0.18, 3, 1.5);

    poly(ctx, [w*0.38, h*0.155, w*0.12, h*0.035, w*0.30, h*0.21], D, OL, { lw: 1.2 });

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(w*0.70, h*0.235, 4, 4.5, 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(w*0.715, h*0.245, 1.8, 2.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.62, h*0.185); ctx.lineTo(w*0.78, h*0.20); ctx.stroke();

    ctx.fillStyle = OL;
    ctx.fillRect(w*0.82, h*0.27, 1.8, 1.8);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(w*0.68, h*0.335); ctx.lineTo(w*0.84, h*0.32); ctx.stroke();

  } else {
    // ── CHARIZARD ── bipedal orange dragon; angular teal wings drawn with
    // straight polygon edges (never beziers), long neck, backward horns
    const C = '#f08030', D = '#c85810', CREAM = '#f8e0a0', CLAW = '#f0f0d0', OL = '#5a2408';
    const WING_D = '#175840', WING_L = '#2a9460', WING_OL = '#082818';

    tailStroke(() => { ctx.moveTo(w*0.32, h*0.78); ctx.quadraticCurveTo(w*(-0.02), h*0.84, w*(-0.06), h*0.62); }, C, OL, 6);
    flame(w*(-0.06), h*0.54, 1.0);

    const wing = (ox, oy, fill) => {
      poly(ctx, [
        w*(0.46+ox), h*(0.42+oy),   // shoulder root
        w*(0.02+ox), h*(0.02+oy),   // apex (top tip)
        w*(0.16+ox), h*(0.22+oy),   // notch
        w*(-0.08+ox), h*(0.20+oy),  // fingertip 2
        w*(0.13+ox), h*(0.35+oy),   // notch
        w*(-0.04+ox), h*(0.44+oy),  // fingertip 3
        w*(0.34+ox), h*(0.54+oy),   // membrane back to body
      ], fill, WING_OL, { lw: 1.3, sh: 0.8, dy: 3 });
      ctx.strokeStyle = '#0e3826'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w*(0.46+ox), h*(0.42+oy));
      ctx.lineTo(w*(0.02+ox), h*(0.02+oy));
      ctx.stroke();
    };
    wing(0.14, -0.05, WING_D);   // far wing
    wing(0,     0,    WING_L);   // near wing

    ell(ctx, w*(0.36+step*0.05), h*0.90, w*0.14, h*0.09, 0, C, OL, { lw: 1.4 });
    ell(ctx, w*(0.68-step*0.05), h*0.90, w*0.14, h*0.09, 0, C, OL, { lw: 1.4 });
    ctx.fillStyle = CLAW;
    ctx.fillRect(w*(0.30+step*0.05), h*0.955, 2.5, 3.5);
    ctx.fillRect(w*(0.39+step*0.05), h*0.955, 2.5, 3.5);
    ctx.fillRect(w*(0.62-step*0.05), h*0.955, 2.5, 3.5);
    ctx.fillRect(w*(0.71-step*0.05), h*0.955, 2.5, 3.5);

    ell(ctx, w*0.52, h*0.64, w*0.33, h*0.26, 0.08, C, OL);
    ell(ctx, w*0.60, h*0.68, w*0.19, h*0.19, 0.08, CREAM, null, { sh: 0.9, dy: 3 });
    ctx.strokeStyle = '#d8b870'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.46, h*0.62); ctx.lineTo(w*0.76, h*0.60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.45, h*0.70); ctx.lineTo(w*0.77, h*0.68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.47, h*0.78); ctx.lineTo(w*0.75, h*0.76); ctx.stroke();

    ell(ctx, w*0.82, h*0.56, w*0.09, h*0.055, 0.5, C, OL, { lw: 1.1 });
    ctx.fillStyle = CLAW;
    ctx.fillRect(w*0.88, h*0.585, 2, 3.5);
    ctx.fillRect(w*0.92, h*0.57, 2, 3.5);

    ell(ctx, w*0.62, h*0.38, w*0.13, h*0.12, -0.35, C, OL, { lw: 1.4 });

    ell(ctx, w*0.64, h*0.22, w*0.20, h*0.13, 0, C, OL);
    poly(ctx, [w*0.76, h*0.16, w*0.97, h*0.19, w*0.97, h*0.26, w*0.76, h*0.29], C, OL, { lw: 1.3 });
    hilite(ctx, w*0.56, h*0.16, 2.6, 1.3);
    ctx.fillStyle = OL;
    ctx.fillRect(w*0.925, h*0.205, 1.8, 1.8);
    ctx.strokeStyle = OL; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(w*0.78, h*0.265); ctx.lineTo(w*0.95, h*0.245); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w*0.88, h*0.25); ctx.lineTo(w*0.895, h*0.29); ctx.lineTo(w*0.91, h*0.248);
    ctx.closePath(); ctx.fill();

    poly(ctx, [w*0.56, h*0.135, w*0.34, h*0.005, w*0.49, h*0.175], D, OL, { lw: 1.1 });
    poly(ctx, [w*0.66, h*0.125, w*0.50, h*(-0.035), w*0.585, h*0.15], D, OL, { lw: 1.1 });

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(w*0.72, h*0.195, 3.2, 3.8, 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#1a6ad8';
    ctx.beginPath(); ctx.ellipse(w*0.73, h*0.20, 1.7, 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(w*0.73, h*0.205, 0.9, 1.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.65, h*0.15); ctx.lineTo(w*0.79, h*0.165); ctx.stroke();
  }
}
