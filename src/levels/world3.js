// ============================================================
// WORLD 3 — Overworld (SMB 2-1 layout, Pokémon style)
// ============================================================
import { loadFSMLevel } from './fsm-loader.js';
import { world21Data } from './data/world2-1.js';

export function buildWorld3() {
  return loadFSMLevel(world21Data, 0);
}
