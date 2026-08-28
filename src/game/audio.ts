type NoiseNode = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private wind: NoiseNode | null = null;
  private musicOsc: OscillatorNode[] = [];
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
    osc.type = "sawtooth";
    osc.frequency.value = 72;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(filter).connect(gain).connect(this.sfx!);
    osc.start();
    this.engine = osc;
    this.engineGain = gain;
    this.engineFilter = filter;
    this.wind = this.makeNoise(0.0001);
    this.running = true;
    this.startMusic();
  }

  stopEngine() {
    this.engine?.stop();
    this.engine?.disconnect();
    this.engine = null;
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
    this.running = false;
  }

  update(speedKph: number, boosting: boolean) {
    if (!this.running || !this.ctx || !this.engine || !this.engineGain || !this.engineFilter) return;
    const t = Math.min(1.2, speedKph / 260);
    this.engine.frequency.setTargetAtTime(70 + t * 168 + (boosting ? 28 : 0), this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + t * 1400, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.03 + t * 0.07, this.ctx.currentTime, 0.08);
    if (this.wind) this.wind.gain.gain.setTargetAtTime(0.01 + t * 0.05, this.ctx.currentTime, 0.12);
  }

  playUi() {
    this.blip(620, 0.05, "square", 0.04);
  }

  playCountdown(step: number) {
    this.blip(step >= 3 ? 880 : 520, 0.12, "square", 0.07);
  }

  playGo() {
    this.blip(240, 0.18, "sawtooth", 0.08);
    this.blip(480, 0.18, "square", 0.05);
  }

  playNearMiss(combo: number) {
    this.blip(740 + combo * 40, 0.08, "triangle", 0.06);
    this.noiseBurst(0.07, 0.035);
  }

  playOvertake() {
    this.blip(980, 0.06, "sine", 0.04);
  }

  playBoost() {
    this.sweep(180, 640, 0.22, 0.07);
  }

  playCrash() {
    this.noiseBurst(0.28, 0.12);
    this.blip(90, 0.22, "sawtooth", 0.1);
    this.stopEngine();
  }

  playBest() {
    this.blip(660, 0.1, "triangle", 0.06);
    this.blip(990, 0.14, "triangle", 0.05);
  }

  playCoin() {
    this.blip(880, 0.07, "sine", 0.05);
    this.blip(1180, 0.1, "triangle", 0.04);
  }

  playUpgrade() {
    this.blip(420, 0.08, "square", 0.05);
    this.blip(640, 0.1, "triangle", 0.05);
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
    const notes = [82.4, 123.5, 164.8];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const gain = this.ctx!.createGain();
      gain.gain.value = i === 0 ? 0.035 : 0.012;
      const filter = this.ctx!.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      osc.connect(filter).connect(gain).connect(this.music!);
      osc.start();
      this.musicOsc.push(osc);
    });
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
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVolume;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(this.sfx!);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number) {
    const node = this.makeNoise(vol);
    node.gain.gain.exponentialRampToValueAtTime(0.0001, this.ensure().currentTime + dur);
    node.source.stop(this.ensure().currentTime + dur + 0.02);
  }

  private makeNoise(vol: number): NoiseNode {
    const ctx = this.ensure();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.value = vol * this.sfxVolume;
    source.connect(filter).connect(gain).connect(this.sfx!);
    source.start();
    return { source, gain };
  }
}
