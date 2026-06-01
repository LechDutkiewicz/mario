// ============================================================
// WORLD 1 — Loaded from FSM JSON (World 1-2 map)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world11Data } from './data/world1-1.js';

export function buildWorld1() {
  // World 1-2 JSON: area 1 is the main underground section (90 creation entries)
  return loadFSMLevel(world11Data, 1);
}
