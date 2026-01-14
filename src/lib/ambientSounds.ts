/**
 * Ambient Sound Generator using Web Audio API
 * Generates procedural ambient sounds without external audio files
 */

export type AmbientSoundType = 'none' | 'white-noise' | 'rain' | 'ocean' | 'forest' | 'coffee-shop';

export class AmbientSoundGenerator {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private isPlaying = false;
  private currentType: AmbientSoundType = 'none';

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.3; // 30% volume
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  async play(type: AmbientSoundType): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;
    if (type === 'none') {
      this.stop();
      return;
    }

    // Resume audio context if suspended (autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Stop current sound if any
    if (this.isPlaying) {
      this.stop();
    }

    this.currentType = type;
    this.isPlaying = true;

    switch (type) {
      case 'white-noise':
        this.generateWhiteNoise();
        break;
      case 'rain':
        this.generateRain();
        break;
      case 'ocean':
        this.generateOcean();
        break;
      case 'forest':
        this.generateForest();
        break;
      case 'coffee-shop':
        this.generateCoffeeShop();
        break;
    }
  }

  stop(): void {
    this.activeNodes.forEach(node => {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
          node.stop();
        }
        node.disconnect();
      } catch (e) {
        // Node may already be stopped
      }
    });
    this.activeNodes.clear();
    this.isPlaying = false;
  }

  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  pause(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  private generateWhiteNoise(): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.audioContext.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass filter for softer sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);

    whiteNoise.start(0);
    this.activeNodes.add(whiteNoise);
    this.activeNodes.add(filter);
  }

  private generateRain(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Base rain sound (filtered white noise)
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const rain = this.audioContext.createBufferSource();
    rain.buffer = noiseBuffer;
    rain.loop = true;

    // Band-pass filter for rain-like sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    rain.connect(filter);
    filter.connect(this.masterGain);

    rain.start(0);
    this.activeNodes.add(rain);
    this.activeNodes.add(filter);

    // Add occasional rain drops (random pings)
    this.scheduleRainDrops();
  }

  private scheduleRainDrops(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextDrop = Math.random() * 200 + 50; // 50-250ms between drops
    const dropFreq = Math.random() * 1000 + 800; // 800-1800Hz

    setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const drop = this.audioContext.createOscillator();
      const dropGain = this.audioContext.createGain();

      drop.frequency.value = dropFreq;
      drop.type = 'sine';

      dropGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      dropGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

      drop.connect(dropGain);
      dropGain.connect(this.masterGain);

      drop.start(this.audioContext.currentTime);
      drop.stop(this.audioContext.currentTime + 0.05);

      this.scheduleRainDrops();
    }, nextDrop);
  }

  private generateOcean(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Base ocean sound (low-frequency oscillation)
    const wave1 = this.audioContext.createOscillator();
    const wave2 = this.audioContext.createOscillator();
    const wave1Gain = this.audioContext.createGain();
    const wave2Gain = this.audioContext.createGain();

    wave1.type = 'sine';
    wave1.frequency.value = 0.1; // Very low frequency for waves
    wave2.type = 'sine';
    wave2.frequency.value = 0.15;

    wave1Gain.gain.value = 0.3;
    wave2Gain.gain.value = 0.2;

    // White noise for waves texture
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Low-pass filter for ocean-like sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    // Modulate filter frequency with LFO
    wave1.connect(wave1Gain);
    wave1Gain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(this.masterGain);

    wave1.start(0);
    wave2.start(0);
    noise.start(0);

    this.activeNodes.add(wave1);
    this.activeNodes.add(wave2);
    this.activeNodes.add(wave1Gain);
    this.activeNodes.add(wave2Gain);
    this.activeNodes.add(noise);
    this.activeNodes.add(filter);
  }

  private generateForest(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Gentle wind (filtered noise)
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const wind = this.audioContext.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    const windFilter = this.audioContext.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 600;
    windFilter.Q.value = 2;

    wind.connect(windFilter);
    windFilter.connect(this.masterGain);

    wind.start(0);
    this.activeNodes.add(wind);
    this.activeNodes.add(windFilter);

    // Add bird chirps periodically
    this.scheduleBirdChirps();
  }

  private scheduleBirdChirps(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextChirp = Math.random() * 3000 + 2000; // 2-5 seconds between chirps

    setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      // Random bird chirp (quick frequency sweep)
      const chirp = this.audioContext.createOscillator();
      const chirpGain = this.audioContext.createGain();

      chirp.type = 'sine';
      const startFreq = Math.random() * 1000 + 2000; // 2000-3000Hz
      const endFreq = startFreq + (Math.random() * 500 + 200); // Upward sweep

      chirp.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
      chirp.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + 0.1);

      chirpGain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      chirpGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

      chirp.connect(chirpGain);
      chirpGain.connect(this.masterGain);

      chirp.start(this.audioContext.currentTime);
      chirp.stop(this.audioContext.currentTime + 0.15);

      this.scheduleBirdChirps();
    }, nextChirp);
  }

  private generateCoffeeShop(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Background murmur (low-frequency filtered noise)
    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const murmur = this.audioContext.createBufferSource();
    murmur.buffer = noiseBuffer;
    murmur.loop = true;

    const murmurFilter = this.audioContext.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.value = 300;
    murmurFilter.Q.value = 1;

    murmur.connect(murmurFilter);
    murmurFilter.connect(this.masterGain);

    murmur.start(0);
    this.activeNodes.add(murmur);
    this.activeNodes.add(murmurFilter);

    // Add occasional coffee machine sounds and chatter
    this.scheduleCoffeeSounds();
  }

  private scheduleCoffeeSounds(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextSound = Math.random() * 4000 + 3000; // 3-7 seconds between sounds

    setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const soundType = Math.random();

      if (soundType < 0.3) {
        // Coffee machine hiss (short burst of noise)
        const hiss = this.audioContext.createOscillator();
        const hissGain = this.audioContext.createGain();

        hiss.type = 'sawtooth';
        hiss.frequency.value = 150;

        hissGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        hissGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        hiss.connect(hissGain);
        hissGain.connect(this.masterGain);

        hiss.start(this.audioContext.currentTime);
        hiss.stop(this.audioContext.currentTime + 0.5);
      } else {
        // Cup clinking (short high-frequency ping)
        const clink = this.audioContext.createOscillator();
        const clinkGain = this.audioContext.createGain();

        clink.type = 'sine';
        clink.frequency.value = Math.random() * 400 + 1200; // 1200-1600Hz

        clinkGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        clinkGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        clink.connect(clinkGain);
        clinkGain.connect(this.masterGain);

        clink.start(this.audioContext.currentTime);
        clink.stop(this.audioContext.currentTime + 0.1);
      }

      this.scheduleCoffeeSounds();
    }, nextSound);
  }

  destroy(): void {
    this.stop();
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
