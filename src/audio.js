// ============================================================
// AUDIO — Pokémon adventure music (Web Audio API, procedural)
// Cheerful pentatonic melody in G major, 140 BPM
// ============================================================

const BPM  = 140;
const STEP = 60 / BPM / 2; // 8th note duration in seconds

// Note frequencies
const N = {
  _: 0,
  G2: 97.999, D3: 146.832,
  E4: 329.628, G4: 391.995, A4: 440.000,
  B4: 493.883, C5: 523.251, D5: 587.330, G5: 783.991,
};

// [melody_hz, dur_8ths, bass_hz]
// Melody: G4, B4, D5, G5, D5, B4, G4, E4, G4, B4, D5, B4, G4, A4, B4, C5, B4, A4, G4
const MELODY = [
  // Phrase 1: ascending
  [N.G4, 2, N.G2],  [N.B4, 2, N.D3],
  [N.D5, 2, N.G2],  [N.G5, 2, N.D3],
  // Phrase 2: descending
  [N.D5, 2, N.G2],  [N.B4, 2, N.D3],
  [N.G4, 2, N.G2],  [N.E4, 2, N.D3],
  // Phrase 3: mid sequence
  [N.G4, 2, N.G2],  [N.B4, 2, N.D3],
  [N.D5, 2, N.G2],  [N.B4, 2, N.D3],
  // Phrase 4: cadence
  [N.G4, 2, N.G2],  [N.A4, 2, N.D3],
  [N.B4, 2, N.G2],  [N.C5, 2, N.D3],
  [N.B4, 2, N.G2],  [N.A4, 2, N.D3],
  [N.G4, 4, N.G2],  [N._, 2, N._],
];

export class Music {
  constructor() {
    this.actx    = null;
    this.running = false;
    this.idx     = 0;
    this.t       = 0;
    this.tid     = null;
  }

  _ctx() {
    if (!this.actx) {
      this.actx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.actx;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.idx = 0;
    const ac = this._ctx();
    this.t = ac.currentTime + 0.05;
    this._pump();
  }

  stop() {
    this.running = false;
    clearTimeout(this.tid);
  }

  _pump() {
    if (!this.running) return;
    const ac = this._ctx();
    while (this.t < ac.currentTime + 0.3) {
      const [mhz, dur, bhz] = MELODY[this.idx];
      const d = dur * STEP;
      if (mhz) this._tone(ac, mhz, this.t, d, 'square', 0.055);
      if (bhz) this._tone(ac, bhz, this.t, d * 1.8, 'triangle', 0.08);
      this.t += d;
      this.idx = (this.idx + 1) % MELODY.length;
    }
    this.tid = setTimeout(() => this._pump(), 50);
  }

  _tone(ac, freq, start, dur, type, vol) {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.85);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur);
  }

  // One-shot SFX: high chime for pokéball collect
  playCollect() {
    try {
      const ac = this._ctx();
      const t = ac.currentTime;
      this._tone(ac, 880, t, 0.07, 'sine', 0.12);
      this._tone(ac, 1320, t + 0.06, 0.07, 'sine', 0.09);
      this._tone(ac, 1760, t + 0.11, 0.08, 'sine', 0.07);
    } catch (_) { /* ignore if audio not ready */ }
  }
}
