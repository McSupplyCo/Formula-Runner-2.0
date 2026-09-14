type NoiseNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineHarmonic: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private wind: NoiseNode | null = null;
  private musicOsc: OscillatorNode[] = [];
  private musicNoise: AudioBufferSourceNode | null = null;
  private running = false;
  sfxVolume = 0.8;
  musicVolume = 0.45;

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfx) this.sfx.gain.value = sfx;
    if (this.music) this.music.gain.value = music;
  }

  startEngine() {
    const ctx = this.ensure();
    this.stopEngine();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 56;
    const harmonic = ctx.createOscillator();
    harmonic.type = "triangle";
    harmonic.frequency.value = 112;
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.16;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter);
    harmonic.connect(harmonicGain).connect(filter);
    filter.connect(gain).connect(this.sfx!);
    osc.start();
    harmonic.start();
    this.engine = osc;
    this.engineHarmonic = harmonic;
    this.engineGain = gain;
    this.engineFilter = filter;
    this.wind = this.makeNoise(0.0001, "wind");
    this.running = true;
    this.startMusic();
  }

  stopEngine() {
    this.engine?.stop();
    this.engine?.disconnect();
    this.engine = null;
    this.engineHarmonic?.stop();
    this.engineHarmonic?.disconnect();
    this.engineHarmonic = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.wind?.source.stop();
    this.wind?.source.disconnect();
    this.wind = null;
    for (const osc of this.musicOsc) {
      osc.stop();
      osc.disconnect();
    }
    this.musicOsc = [];
    this.musicNoise?.stop();
    this.musicNoise?.disconnect();
    this.musicNoise = null;
    this.running = false;
  }

  update(speedKph: number, boosting: boolean) {
    if (!this.running || !this.ctx || !this.engine || !this.engineGain || !this.engineFilter) return;
    const t = Math.min(1, speedKph / 260);
    const lift = boosting ? 1 : 0;
    const hz = 54 + t * 72 + lift * 8;
    this.engine.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.1);
    this.engineHarmonic?.frequency.setTargetAtTime(hz * 2.01, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(250 + t * 280 + lift * 110, this.ctx.currentTime, 0.12);
    this.engineGain.gain.setTargetAtTime(0.042 + t * 0.048 + lift * 0.01, this.ctx.currentTime, 0.1);
    if (this.wind) {
      this.wind.gain.gain.setTargetAtTime(0.02 + t * 0.075 + lift * 0.05, this.ctx.currentTime, 0.14);
      this.wind.filter.frequency.setTargetAtTime(780 + t * 820 + lift * 380, this.ctx.currentTime, 0.16);
    }
  }

  playUi() {
    this.blip(510, 0.05, "sine", 0.035);
  }

  playDeny() {
    this.blip(164, 0.09, "triangle", 0.03);
  }

  playDeny() {
    this.blip(180, 0.08, "square", 0.03);
  }

  playCountdown(step: number) {
    this.blip(step >= 3 ? 620 : 390, 0.11, "sine", 0.055);
  }

  playGo() {
    this.blip(196, 0.16, "sine", 0.06);
    this.blip(392, 0.14, "triangle", 0.03);
  }

  playNearMiss(combo: number) {
    this.blip(640 + combo * 28, 0.07, "sine", 0.045);
    this.noiseBurst(0.08, 0.04, "wind");
  }

  playOvertake() {
    this.blip(720, 0.05, "sine", 0.035);
    this.blip(960, 0.07, "triangle", 0.028);
  }

  playBoost() {
    const ctx = this.ensure();
    const whoosh = this.makeNoise(0.055, "wind");
    whoosh.filter.frequency.setValueAtTime(640, ctx.currentTime);
    whoosh.filter.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.3);
    whoosh.gain.gain.setValueAtTime(0.055 * this.sfxVolume, ctx.currentTime);
    whoosh.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    whoosh.source.stop(ctx.currentTime + 0.34);
    this.sweep(96, 188, 0.28, 0.03);
  }

  playCrash() {
    this.noiseBurst(0.3, 0.13, "burst");
    this.blip(72, 0.24, "sine", 0.09);
    this.stopEngine();
  }

  playBest() {
    this.blip(523, 0.1, "sine", 0.045);
    this.blip(784, 0.14, "triangle", 0.04);
  }

  playCoin() {
    this.blip(784, 0.06, "sine", 0.04);
    this.blip(1046, 0.09, "sine", 0.03);
  }

  playUpgrade() {
    this.blip(392, 0.08, "sine", 0.04);
    this.blip(587, 0.1, "triangle", 0.04);
  }

  private ensure() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      const sfx = ctx.createGain();
      sfx.gain.value = this.sfxVolume;
      sfx.connect(master);
      const music = ctx.createGain();
      music.gain.value = this.musicVolume;
      music.connect(master);
      this.ctx = ctx;
      this.sfx = sfx;
      this.music = music;
    }
    return this.ctx;
  }

  private startMusic() {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx;
    const pad = (freq: number, vol: number, cutoff: number, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      osc.connect(filter).connect(gain).connect(this.music!);
      osc.start();
      this.musicOsc.push(osc);
      return gain;
    };

    pad(49, 0.02, 130);
    pad(73.4, 0.009, 210);
    const sky = pad(196, 0.0035, 340);
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.055;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.0028;
    lfo.connect(lfoDepth).connect(sky.gain);
    lfo.start();
    this.musicOsc.push(lfo);

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    this.fillNoise(buffer.getChannelData(0), "pink");
    const wash = ctx.createBufferSource();
    wash.buffer = buffer;
    wash.loop = true;
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = "bandpass";
    washFilter.frequency.value = 380;
    washFilter.Q.value = 0.55;
    const washGain = ctx.createGain();
    washGain.gain.value = 0.011;
    wash.connect(washFilter).connect(washGain).connect(this.music);
    wash.start();
    this.musicNoise = wash;
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVolume;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(this.sfx!);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private sweep(from: number, to: number, dur: number, vol: number) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVolume;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(filter).connect(gain).connect(this.sfx!);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, kind: "wind" | "burst" = "burst") {
    const node = this.makeNoise(vol, kind);
    node.gain.gain.exponentialRampToValueAtTime(0.0001, this.ensure().currentTime + dur);
    node.source.stop(this.ensure().currentTime + dur + 0.02);
  }

  private makeNoise(vol: number, kind: "wind" | "burst" = "burst"): NoiseNode {
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
    this.fillNoise(buffer.getChannelData(0), kind === "wind" ? "pink" : "white");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    if (kind === "wind") {
      filter.type = "bandpass";
      filter.frequency.value = 1100;
      filter.Q.value = 0.55;
    } else {
      filter.type = "lowpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.7;
    }
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVolume;
    source.connect(filter).connect(gain).connect(this.sfx!);
    source.start();
    return { source, gain, filter };
  }

  private fillNoise(data: Float32Array, color: "white" | "pink") {
    if (color === "white") {
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return;
    }
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      data[i] = (b0 + b1 + b2 + white * 0.31) * 0.32;
    }
  }
}
