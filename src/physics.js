// AABB collision helpers
export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Resolve entity (with vx, vy, x, y, w, h) against a list of solid platform rects.
// Returns { onGround, hitBelow:[blocks], hitSide }
export function resolveCollisions(ent, solids) {
  const result = { onGround: false, hitBelow: [], hitTop: false };

  // Horizontal pass
  ent.x += ent.vx;
  for (const s of solids) {
    if (s.dead) continue;
    if (aabb(ent, s)) {
      if (ent.vx > 0) {
        ent.x = s.x - ent.w;
      } else if (ent.vx < 0) {
        ent.x = s.x + s.w;
      }
      ent.vx = 0;
    }
  }

  // Vertical pass
  ent.y += ent.vy;
  for (const s of solids) {
    if (s.dead) continue;
    if (aabb(ent, s)) {
      if (ent.vy > 0) {
        ent.y = s.y - ent.h;
        ent.vy = 0;
        result.onGround = true;
      } else if (ent.vy < 0) {
        ent.y = s.y + s.h;
        ent.vy = 0;
        result.hitBelow.push(s);
      }
    }
  }

  return result;
}
