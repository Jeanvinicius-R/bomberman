// Efeitos sonoros sintetizados (sem arquivos de áudio, o app fica leve).

// [frequência, duração, forma de onda, volume, atraso]
const SFX = {
  bomb: [[180, 0.08, 'square', 0.05]],
  pickup: [[660, 0.1, 'triangle', 0.07], [990, 0.15, 'triangle', 0.06, 0.05]],
  kill: [[300, 0.15, 'square', 0.06]],
  hurt: [[120, 0.4, 'sawtooth', 0.08]],
  life: [[880, 0.2, 'triangle', 0.07]],
  clear: [[523, 0.12, 'triangle', 0.07], [784, 0.25, 'triangle', 0.07, 0.13]],
  ui: [[660, 0.1, 'triangle', 0.06]],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.noise = null;
    this.enabled = true;
  }

  // Navegadores só liberam áudio depois de um toque do usuário.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.connect(this.ctx.destination);
        this.noise = this.makeNoise(0.35);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  // Suspender quando o app vai para segundo plano economiza bateria.
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    return buf;
  }

  play(name) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    if (name === 'boom') return this.boom();
    const seq = SFX[name];
    if (seq) for (const [f, dur, type, vol, delay = 0] of seq) this.tone(f, dur, type, vol, delay);
  }

  tone(freq, dur, type, vol, delay) {
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.out);
    o.start(t0); o.stop(t0 + dur);
  }

  boom() {
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = this.noise;
    g.gain.value = 0.25;
    s.connect(g); g.connect(this.out);
    s.start();
  }
}
