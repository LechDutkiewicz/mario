// Bulbasaur line: Bulbasaur (small), Ivysaur (evo 1), Venusaur (evo 2)
// Drawn in the player's local space: (0,0) is the top-left of the hitbox,
// w×h its size (28×32 small, 32×56 evolved), facing right (the caller mirrors).
import { POWER, COLORS } from '../constants.js';
import { TAU, shape, ell, poly, hilite, L, band } from './sprite-utils.js';

export function drawBulbasaur(p, ctx, w, h) {
  const pw = p.power;
  const step = Math.abs(p.vx) > 0.3 ? Math.floor(p.animTimer / 8) % 2 : 0;
  const t = Math.floor(p.animTimer / 6) % 4;
  const flick = t < 2 ? t : 4 - t;

  const redEye = (ex, ey, rx, ry, iris, OL) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1, rx*0.6, ry*0.58, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1.2, rx*0.3, ry*0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - 0.5, ey - ry*0.55, 1.8, 1.8);
  };

  if (pw === POWER.SMALL) {
    // Bulbasaur — green, round, quadruped, seed bulb on back
    const SKIN = '#78c060', DARK = '#4a8838', SPOT = '#5a9a48', BULB = '#3a6820', BULB2 = '#2a5018', CREAM = '#e8f0c8', OL = '#1e4418';

    ell(ctx, w*0.26, h*0.26, w*0.22, h*0.2, -0.1, BULB, OL, { shade: '#24480f' });
    ell(ctx, w*0.26, h*0.24, w*0.14, h*0.12, -0.1, BULB2, null, { sh: 0 });
    ctx.strokeStyle = BULB2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.26, h*0.07); ctx.lineTo(w*0.26, h*0.42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.08, h*0.18); ctx.lineTo(w*0.44, h*0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.44, h*0.18); ctx.lineTo(w*0.08, h*0.32); ctx.stroke();
    hilite(ctx, w*0.18, h*0.16, 2.6, 1.3, 0.22);

    ell(ctx, w*(0.18+step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);
    ell(ctx, w*(0.34-step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);

    ell(ctx, w*0.5, h*0.64, w*0.42, h*0.28, 0, SKIN, OL);
    ell(ctx, w*0.62, h*0.66, w*0.2, h*0.17, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
    ctx.fillStyle = SPOT;
    ctx.beginPath(); ctx.ellipse(w*0.28, h*0.7, w*0.07, h*0.055, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.76, w*0.06, h*0.05, 0, 0, TAU); ctx.fill();

    ell(ctx, w*(0.6+step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);
    ell(ctx, w*(0.74-step*0.04), h*0.86, w*0.1, h*0.1, 0, SKIN, OL);

    ell(ctx, w*0.72, h*0.24, w*0.06, h*0.07, -0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.88, h*0.24, w*0.06, h*0.07, 0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.76, h*0.4, w*0.22, h*0.22, 0, SKIN, OL);
    hilite(ctx, w*0.66, h*0.3, 2.6, 1.3);
    ctx.fillStyle = SPOT;
    ctx.beginPath(); ctx.ellipse(w*0.86, h*0.46, 4, 3, 0, 0, TAU); ctx.fill();
    redEye(w*0.82, h*0.37, 5, 6, '#8b1010', OL);

  } else if (pw === POWER.BIG) {
    // Ivysaur — larger, closed pink tulip bud on splayed leaves
    const SKIN = '#6aac58', DARK = '#3a7030', SPOT = '#4a8440', CREAM = '#d8e8b0', OL = '#1a3c16';
    const bx = w*0.27, byT = h*0.30;   // bud base center

    const leaf = (ang, len, wid) => {
      const tx = bx + Math.cos(ang)*len, ty = byT + Math.sin(ang)*len;
      const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
      shape(ctx, () => {
        ctx.moveTo(bx, byT);
        ctx.quadraticCurveTo(bx + px*wid + Math.cos(ang)*len*0.45, byT + py*wid + Math.sin(ang)*len*0.45, tx, ty);
        ctx.quadraticCurveTo(bx - px*wid + Math.cos(ang)*len*0.45, byT - py*wid + Math.sin(ang)*len*0.45, bx, byT);
        ctx.closePath();
      }, '#2a7828', OL, { lw: 1.1, sh: 0.8 });
      ctx.strokeStyle = '#68b858'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(bx, byT); ctx.lineTo(tx, ty); ctx.stroke();
    };
    leaf(Math.PI * 0.95, w*0.30, w*0.09);   // left
    leaf(Math.PI * 0.70, w*0.26, w*0.08);   // upper-left
    leaf(Math.PI * 0.28, w*0.28, w*0.08);   // upper-right
    leaf(Math.PI * 0.05, w*0.30, w*0.09);   // right

    const petal = (cxp, tipX, tipY, wid, fill) => {
      shape(ctx, () => {
        ctx.moveTo(cxp - wid, byT);
        ctx.quadraticCurveTo(cxp - wid*1.1, byT - h*0.10, tipX, tipY);
        ctx.quadraticCurveTo(cxp + wid*1.1, byT - h*0.10, cxp + wid, byT);
        ctx.closePath();
      }, fill, '#5a1a40', { lw: 1.1, sh: 0.82 });
    };
    petal(bx - w*0.07, bx - w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
    petal(bx + w*0.07, bx + w*0.13, h*0.10 + flick*0.4, w*0.075, '#c8489c');
    petal(bx,          bx,          h*0.055 - flick*0.4, w*0.085, '#e868bc');
    shape(ctx, () => {
      ctx.moveTo(bx - w*0.15, byT - h*0.02);
      ctx.quadraticCurveTo(bx, byT + h*0.09, bx + w*0.15, byT - h*0.02);
      ctx.lineTo(bx + w*0.11, byT + h*0.06);
      ctx.quadraticCurveTo(bx, byT + h*0.12, bx - w*0.11, byT + h*0.06);
      ctx.closePath();
    }, '#2a6828', OL, { lw: 1.2, sh: 0.8 });

    ell(ctx, w*(0.16+step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);
    ell(ctx, w*(0.32-step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);

    ell(ctx, w*0.5, h*0.62, w*0.4, h*0.27, 0, SKIN, OL);
    ell(ctx, w*0.62, h*0.64, w*0.19, h*0.18, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
    ctx.fillStyle = SPOT;
    ctx.beginPath(); ctx.ellipse(w*0.3, h*0.68, w*0.07, h*0.055, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.52, h*0.74, w*0.055, h*0.045, 0, 0, TAU); ctx.fill();

    ell(ctx, w*(0.62+step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);
    ell(ctx, w*(0.76-step*0.04), h*0.85, w*0.1, h*0.12, 0, SKIN, OL);

    ell(ctx, w*0.72, h*0.24, w*0.07, h*0.08, -0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.88, h*0.23, w*0.07, h*0.08, 0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.76, h*0.38, w*0.22, h*0.22, 0, SKIN, OL);
    hilite(ctx, w*0.66, h*0.28, 2.6, 1.3);
    redEye(w*0.82, h*0.365, 4, 5, '#7a1a20', OL);

  } else {
    // Venusaur — huge open flower on a trunk, heavy body
    const SKIN = '#5a9848', DARK = '#3a6830', SPOT = '#4a8040', CREAM = '#c8e0a0', OL = '#163214';

    const fx = w*0.30, fy = h*0.17;   // flower center

    const frond = (ang, len, wid) => {
      const ox = fx, oy = fy + h*0.10;
      const tx = ox + Math.cos(ang)*len, ty = oy + Math.sin(ang)*len;
      const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
      shape(ctx, () => {
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + px*wid + Math.cos(ang)*len*0.45, oy + py*wid + Math.sin(ang)*len*0.45, tx, ty);
        ctx.quadraticCurveTo(ox - px*wid + Math.cos(ang)*len*0.45, oy - py*wid + Math.sin(ang)*len*0.45, ox, oy);
        ctx.closePath();
      }, '#2a6828', OL, { lw: 1.1, sh: 0.8 });
      ctx.strokeStyle = '#5aa848'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
    };
    frond(Math.PI * 0.94, w*0.44, w*0.11);
    frond(Math.PI * 0.62, w*0.34, w*0.10);
    frond(Math.PI * 0.35, w*0.34, w*0.10);
    frond(Math.PI * 0.04, w*0.44, w*0.11);

    poly(ctx, [fx - w*0.09, fy + h*0.16, fx - w*0.06, fy + h*0.04, fx + w*0.06, fy + h*0.04, fx + w*0.09, fy + h*0.16], '#8a5a28', '#3a2008', { lw: 1.2 });

    const fpetal = (ang, shade) => {
      const len = w*0.38 + flick*0.4, wid = w*0.14;
      const tx = fx + Math.cos(ang)*len, ty = fy + Math.sin(ang)*len*0.85;
      const px = Math.cos(ang + Math.PI/2), py = Math.sin(ang + Math.PI/2);
      shape(ctx, () => {
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo(fx + px*wid + Math.cos(ang)*len*0.4, fy + py*wid + Math.sin(ang)*len*0.35, tx, ty);
        ctx.quadraticCurveTo(fx - px*wid + Math.cos(ang)*len*0.4, fy - py*wid + Math.sin(ang)*len*0.35, fx, fy);
        ctx.closePath();
      }, shade, '#6a1428', { lw: 1.1, sh: 0.84 });
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx + Math.cos(ang)*len*0.25, fy + Math.sin(ang)*len*0.22);
      ctx.lineTo(tx - Math.cos(ang)*3, ty - Math.sin(ang)*3); ctx.stroke();
    };
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 - Math.PI/2;
      fpetal(a, i % 2 === 0 ? '#e84868' : '#f06888');
    }
    ell(ctx, fx, fy, w*0.10, w*0.10, 0, '#f8c840', '#6a4000', { lw: 1.2, sh: 0.86 });
    ctx.fillStyle = '#c09000';
    ctx.beginPath(); ctx.arc(fx - w*0.03, fy - h*0.012, 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(fx + w*0.035, fy + h*0.008, 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(fx, fy + h*0.02, 1.3, 0, TAU); ctx.fill();

    ell(ctx, w*(0.18+step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);
    ell(ctx, w*(0.32-step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);

    ell(ctx, w*0.5, h*0.66, w*0.47, h*0.26, 0, SKIN, OL);
    ell(ctx, w*0.64, h*0.68, w*0.22, h*0.17, 0.2, CREAM, null, { sh: 0.9, dy: 3 });
    ctx.fillStyle = SPOT;
    ctx.beginPath(); ctx.ellipse(w*0.28, h*0.72, w*0.08, h*0.055, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.78, w*0.06, h*0.05, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*0.2, h*0.58, w*0.06, h*0.05, 0.3, 0, TAU); ctx.fill();

    ell(ctx, w*(0.64+step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);
    ell(ctx, w*(0.78-step*0.03), h*0.86, w*0.11, h*0.12, 0, SKIN, OL);

    ell(ctx, w*0.74, h*0.25, w*0.07, h*0.09, -0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.9, h*0.24, w*0.07, h*0.09, 0.3, DARK, OL, { lw: 1.1 });
    ell(ctx, w*0.78, h*0.4, w*0.22, h*0.22, 0, SKIN, OL);
    hilite(ctx, w*0.68, h*0.3, 2.6, 1.3);
    redEye(w*0.84, h*0.385, 4, 4.8, '#8b1010', OL);
    ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.76, h*0.315); ctx.lineTo(w*0.90, h*0.335); ctx.stroke();
  }
}
