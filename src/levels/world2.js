// ============================================================
// WORLD 2 — Loaded from FSM JSON (World 2-1 map)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world12Data } from './data/world1-2.js';

export function buildWorld2() {
  // World 2-1 JSON has areas[0] = overworld section
  return loadFSMLevel(world12Data, 0);
}
