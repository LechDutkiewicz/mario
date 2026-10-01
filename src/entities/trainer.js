// ── Rescued trainers (Ash / Goh / Friede) ────────────────────────────────────
// Cartoon trainer waiting at the end of each world's castle, ~48px tall,
// facing LEFT toward the arriving player and waving. Same signature and
// semantics as the old Game._drawTrainer: cx = horizontal centre, footY =
// ground line, who ∈ 'ash' | 'goh' | 'friede'. Drawn in the house sprite
// style (ink outline, 2-3 tone shading, specular highlight, drop shadow).
import { TAU, tint, shape, ell, poly, hilite, shadow } from './sprite-utils.js';

const PAL = {
  ash:    { hair: '#1a1a1a', cap: '#d82020', capPanel: '#f4f4f4', jacket: '#2858c8', trim: '#f0f0f0', pants: '#4a68b0', shoes: '#2a2a2a', skin: '#f0c8a0', ol: '#1c1830' },
  goh:    { hair: '#20304a', cap: null,      capPanel: null,      jacket: '#f6f6f6', trim: '#d82020', pants: '#607080', shoes: '#f0f0f0', skin: '#f0c8a0', ol: '#1c1830' },
  friede: { hair: '#f0f0f0', cap: null,      capPanel: null,      jacket: '#284898', trim: '#101828', pants: '#282838', shoes: '#5a3a18', skin: '#e8b890', ol: '#1c1830' },
};
const H = 48;

// module-level frame counter so the waving arm animates per call
let frame = 0;

// rounded-rect path builder (no beginPath inside — used through shape())
const rr = (ctx, x, y, w, h, r) => {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export function drawTrainer(ctx, cx, footY, who) {
  const c = PAL[who] || PAL.ash;
  const OL = c.ol;
  const top = footY - H;
  frame = (frame + 1) % 100000;
  const wave = Math.sin(frame * 0.1);   // waving arm swing
  const bob = Math.round(Math.sin(frame * 0.05) * 0.5);   // tiny idle breathing bob (whole figure above the shoes)

  // Drop shadow under the feet
  shadow(ctx, cx - 1, footY - 0.5, 12, 2.8, 0.28);

  // ── Waving arm (far side, right) — drawn first so it sits behind the torso ──
  ctx.save();
  ctx.translate(cx + 8.5, top + 19 + bob);
  ctx.rotate(-2.3 + wave * 0.45);
  shape(ctx, () => rr(ctx, -2.3, -1, 4.6, 12.5, 2), c.jacket, OL, { sh: 0.76, dx: 1.2, dy: 0.6, lw: 1.3 });
  if (who === 'goh') { ctx.fillStyle = c.pants; ctx.fillRect(-2.3, -1, 4.6, 1.6); }  // short sleeve hint
  ell(ctx, 0, 13, 2.6, 2.6, 0, c.skin, OL, { sh: 0.84, dy: 1.2, lw: 1.2 });
  ctx.restore();

  // ── Shoes (facing left: front toes point left) ──
  const bootH = who === 'friede' ? 7 : 5;
  shape(ctx, () => rr(ctx, cx - 11.5, footY - bootH, 10.5, bootH, 2), c.shoes, OL, { sh: 0.72, dy: 2, lw: 1.3 });
  shape(ctx, () => rr(ctx, cx + 0.5, footY - bootH, 9, bootH, 2), c.shoes, OL, { sh: 0.72, dy: 2, lw: 1.3 });
  if (who === 'friede') {   // boot cuff
    ctx.fillStyle = tint(c.shoes, 1.25);
    ctx.fillRect(cx - 11, footY - bootH + 0.8, 9.5, 1.6); ctx.fillRect(cx + 1, footY - bootH + 0.8, 8, 1.6);
  }

  // ── Legs ──
  const legTop = top + 30 + bob, legBot = footY - bootH + 1;
  shape(ctx, () => rr(ctx, cx - 8.5, legTop, 7.5, legBot - legTop, 1.5), c.pants, OL, { sh: 0.74, dx: 1, dy: 2, lw: 1.3 });
  shape(ctx, () => rr(ctx, cx + 1, legTop, 7.5, legBot - legTop, 1.5), c.pants, OL, { sh: 0.74, dx: 1, dy: 2, lw: 1.3 });
  if (who === 'ash') {   // jean seam
    ctx.strokeStyle = tint(c.pants, 0.7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 4.5, legTop + 2); ctx.lineTo(cx - 4.5, legBot - 2); ctx.moveTo(cx + 4.5, legTop + 2); ctx.lineTo(cx + 4.5, legBot - 2); ctx.stroke();
  }

  // ── Torso / jacket ──
  const tTop = top + 17 + bob, tH = 14.5;
  shape(ctx, () => rr(ctx, cx - 9, tTop, 18, tH, 3), c.jacket, OL, { sh: 0.76, dx: 1.2, dy: 2.4 });
  if (who === 'ash') {
    // white zip stripe + collar + yellow pocket flaps
    ctx.fillStyle = c.trim; ctx.fillRect(cx - 1.5, tTop + 1, 3, tH - 1);
    poly(ctx, [cx - 6, tTop, cx - 1, tTop + 5, cx - 1, tTop, cx - 6, tTop], c.trim, null, { sh: 0 });
    poly(ctx, [cx + 6, tTop, cx + 1, tTop + 5, cx + 1, tTop], c.trim, null, { sh: 0 });
    ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 7, tTop + 8, 4, 1.6); ctx.fillRect(cx + 3, tTop + 8, 4, 1.6);
  } else if (who === 'goh') {
    // white shirt: collar wings + red tie
    ctx.strokeStyle = tint(c.jacket, 0.78); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 5, tTop); ctx.lineTo(cx - 1, tTop + 4); ctx.lineTo(cx, tTop); ctx.lineTo(cx + 1, tTop + 4); ctx.lineTo(cx + 5, tTop); ctx.stroke();
    poly(ctx, [cx - 1.6, tTop + 3, cx + 1.6, tTop + 3, cx + 2.2, tTop + 10, cx, tTop + 12.5, cx - 2.2, tTop + 10], c.trim, tint(c.trim, 0.6), { sh: 0.8, dy: 1.5, lw: 1 });
    ctx.fillStyle = tint(c.trim, 0.7); ctx.fillRect(cx - 1, tTop + 1.5, 2, 2);
  } else {
    // Friede: open dark jacket over dark shirt, lapels + pale collar line
    ctx.fillStyle = c.trim; ctx.fillRect(cx - 2.5, tTop + 1, 5, tH - 1);
    poly(ctx, [cx - 7, tTop, cx - 2.5, tTop + 6, cx - 2.5, tTop], tint(c.jacket, 1.3), null, { sh: 0 });
    poly(ctx, [cx + 7, tTop, cx + 2.5, tTop + 6, cx + 2.5, tTop], tint(c.jacket, 1.3), null, { sh: 0 });
    ctx.fillStyle = tint(c.jacket, 0.75); ctx.fillRect(cx - 9, tTop + tH - 2.5, 18, 2);   // hem band
  }
  hilite(ctx, cx - 5, tTop + 3, 2.4, 1.2, 0.22);

  // ── Front arm (near side, left) hangs down ──
  ctx.save();
  ctx.translate(cx - 9, tTop + 2);
  ctx.rotate(0.18);
  shape(ctx, () => rr(ctx, -2.3, -1, 4.6, 11.5, 2), c.jacket, OL, { sh: 0.76, dx: 1, dy: 1.2, lw: 1.3 });
  if (who === 'goh') { ctx.fillStyle = c.pants; ctx.fillRect(-2.3, -1, 4.6, 1.6); }
  ell(ctx, 0, 11.5, 2.5, 2.6, 0, c.skin, OL, { sh: 0.84, dy: 1.2, lw: 1.2 });
  ctx.restore();

  // ── Neck + head ──
  const hy = top + 9 + bob;
  ctx.fillStyle = tint(c.skin, 0.8); ctx.fillRect(cx - 2.5, hy + 6, 5, 3);
  // back hair (behind the head)
  ell(ctx, cx + 1.5, hy - 1.5, 8.2, 7.8, 0, c.hair, OL, { sh: 0.72, dy: 2.5, lw: 1.3 });
  ell(ctx, cx, hy, 7.6, 7.8, 0, c.skin, OL, { sh: 0.84, dx: 1, dy: 2.2 });

  // ── Hair fringe / cap per trainer ──
  if (who === 'ash') {
    // black side-locks poking out under the cap
    poly(ctx, [cx - 8, hy - 1, cx - 9.5, hy + 4, cx - 6, hy + 2], c.hair, OL, { sh: 0, lw: 1.1 });
    poly(ctx, [cx + 7, hy - 1, cx + 9, hy + 4, cx + 5.5, hy + 2.5], c.hair, OL, { sh: 0, lw: 1.1 });
    // red cap dome, white front panel, white peak pointing left
    shape(ctx, () => { ctx.moveTo(cx - 8.5, hy - 2); ctx.arc(cx, hy - 2, 8.5, Math.PI, TAU); ctx.closePath(); }, c.cap, OL, { sh: 0.72, dx: 0.8, dy: 2, lw: 1.3 });
    shape(ctx, () => { ctx.moveTo(cx - 8.5, hy - 2); ctx.arc(cx - 1, hy - 2, 7.5, Math.PI, Math.PI * 1.55); ctx.lineTo(cx - 1, hy - 2); ctx.closePath(); }, c.capPanel, null, { sh: 0.82, dy: 1.5 });
    ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 1, hy - 9.5); ctx.lineTo(cx - 1, hy - 2); ctx.stroke();
    poly(ctx, [cx - 8.5, hy - 3, cx - 15.5, hy - 2, cx - 15, hy + 0.5, cx - 7, hy + 0.5], c.capPanel, OL, { sh: 0.8, dy: 1.2, lw: 1.2 });
    hilite(ctx, cx + 2, hy - 7, 2.6, 1.2, 0.3);
  } else if (who === 'goh') {
    // navy hair: swept fringe over the forehead, pointed tips toward the player
    poly(ctx, [cx - 9, hy - 2, cx - 7, hy - 8, cx - 1, hy - 9.5, cx + 6, hy - 8.5, cx + 8.5, hy - 3,
               cx + 6, hy - 4.5, cx + 2, hy - 2.5, cx - 2, hy - 4.5, cx - 4.5, hy - 0.5, cx - 6.5, hy - 3.5, cx - 8, hy + 1.5],
         c.hair, OL, { sh: 0.76, dx: 0.8, dy: 2, lw: 1.3 });
    hilite(ctx, cx - 2, hy - 7, 2.6, 1.1, 0.22);
  } else {
    // Friede: big spiky white hair
    poly(ctx, [cx - 9, hy + 1, cx - 11, hy - 5, cx - 6.5, hy - 4, cx - 5.5, hy - 11, cx - 1.5, hy - 6,
               cx + 1, hy - 13, cx + 4, hy - 6.5, cx + 8.5, hy - 10, cx + 8, hy - 4, cx + 11, hy - 2, cx + 8.5, hy + 2,
               cx + 5.5, hy - 2.5, cx + 2, hy - 3.5, cx - 2.5, hy - 2.5, cx - 6, hy - 1],
         c.hair, OL, { sh: 0.8, dx: 0.8, dy: 2.4, lw: 1.3 });
    hilite(ctx, cx - 3, hy - 7, 2.4, 1.2, 0.4);
  }
  hilite(ctx, cx - 4, hy - 3.5, 2.2, 1.1, 0.26);

  // ── Face (3/4 view, looking left) ──
  for (const ex of [cx - 4.6, cx + 0.2]) {
    ell(ctx, ex, hy + 1, 1.35, 1.75, 0, '#15121a', null, { sh: 0 });
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1, hy - 0.2, 0.9, 0.9);
  }
  if (who === 'friede') {   // small brow line for the sharper look
    ctx.strokeStyle = OL; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 6, hy - 1.8); ctx.lineTo(cx - 3, hy - 1.2); ctx.moveTo(cx - 1, hy - 1.2); ctx.lineTo(cx + 1.5, hy - 1.8); ctx.stroke();
  }
  // cheek blush + smile
  ctx.fillStyle = 'rgba(230,90,90,0.28)';
  ctx.beginPath(); ctx.ellipse(cx - 5.5, hy + 3.4, 1.6, 0.9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a1a1a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx - 2.5, hy + 3.2, 2.6, 0.25, Math.PI * 0.8); ctx.stroke();
}
