// ============================================================
// AUDIO — Pokémon adventure music (Web Audio API, procedural)
// Cheerful pentatonic melody in G major, 140 BPM
// ============================================================

const BPM  = 130;
const STEP = 60 / BPM / 2; // 8th note duration in seconds

// Note frequencies — G major pentatonic + extras
const N = {
  _: 0,
  G2: 97.999, D3: 146.832, G3: 195.998,
  E4: 329.628, Fs4: 369.994, G4: 391.995, A4: 440.000,
  B4: 493.883, C5: 523.251, D5: 587.330, E5: 659.255, G5: 783.991,
  A3: 220.000, B3: 246.942,
};

// [melody_hz, dur_8ths, bass_hz]
// Pokémon-style melody — G major pentatonic, ~16 bars at 130 BPM
const MELODY = [
  // Bar 1-2: opening fanfare
  [N.G4, 1, N.G2],  [N.G4, 1, N.G2],  [N.D5, 2, N.D3],
  [N.B4, 1, N.G2],  [N.G4, 1, N.G2],  [N.A4, 2, N.D3],
  // Bar 3-4
  [N.A4, 1, N.G2],  [N.A4, 1, N.G2],  [N.E5, 2, N.D3],
  [N.D5, 1, N.G2],  [N.B4, 1, N.G2],  [N.G4, 2, N.D3],
  // Bar 5-6: ascending run
  [N.G4, 1, N.G2],  [N.A4, 1, N.G2],  [N.B4, 1, N.D3],  [N.D5, 1, N.D3],
  [N.E5, 1, N.G2],  [N.G5, 3, N.D3],
  // Bar 7-8: answer phrase
  [N.E5, 1, N.G2],  [N.D5, 1, N.G2],  [N.B4, 2, N.D3],
  [N.A4, 1, N.G2],  [N.G4, 3, N.D3],
  // Bar 9-10: bridge
  [N.D5, 1, N.G2],  [N.D5, 1, N.G2],  [N.E5, 1, N.D3],  [N.D5, 1, N.D3],
  [N.B4, 1, N.G2],  [N.G4, 1, N.G2],  [N.A4, 2, N.D3],
  // Bar 11-12
  [N.A4, 1, N.G2],  [N.G4, 1, N.G2],  [N.A4, 1, N.D3],  [N.B4, 1, N.D3],
  [N.D5, 2, N.G2],  [N.G4, 2, N.D3],
  // Bar 13-14: climax
  [N.G5, 1, N.G2],  [N.E5, 1, N.G2],  [N.D5, 1, N.D3],  [N.B4, 1, N.D3],
  [N.G4, 2, N.G2],  [N.A4, 2, N.D3],
  // Bar 15-16: cadence back to start
  [N.B4, 1, N.G2],  [N.A4, 1, N.G2],  [N.G4, 2, N.D3],
  [N._, 2, N._],    [N.G4, 2, N.G2],
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

  playEndJingle() {
    if (!this.actx) return;
    const ac = this.actx;
    const notes = [
      [392, 0.0, 0.12],    // G4
      [440, 0.12, 0.12],   // A4
      [494, 0.24, 0.12],   // B4
      [523, 0.36, 0.12],   // C5
      [587, 0.48, 0.12],   // D5
      [659, 0.60, 0.12],   // E5
      [784, 0.72, 0.4],    // G5 long
      [659, 1.12, 0.12],   // E5
      [784, 1.24, 0.6],    // G5 held
    ];
    const now = ac.currentTime + 0.05;
    for (const [freq, t, dur] of notes) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start(now + t); osc.stop(now + t + dur + 0.05);
    }
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
