/**
 * Ambient Sound Generator using Web Audio API
 * Improved realistic ambient sounds without external audio files
 */

export type AmbientSoundType = 'none' | 'white-noise' | 'rain' | 'ocean' | 'forest' | 'coffee-shop' | 'fireplace';

export class AmbientSoundGenerator {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private isPlaying = false;
  private currentType: AmbientSoundType = 'none';
  private scheduledTimeouts: number[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.25; // 25% volume - quieter
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
      case 'fireplace':
        this.generateFireplace();
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

    // Clear all scheduled timeouts
    this.scheduledTimeouts.forEach(id => clearTimeout(id));
    this.scheduledTimeouts = [];

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

    // Softer white noise
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const whiteNoise = this.audioContext.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass filter for softer sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);

    whiteNoise.start(0);
    this.activeNodes.add(whiteNoise);
    this.activeNodes.add(filter);
  }

  private generateRain(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Realistic rain base (continuous pink noise)
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Pink noise (1/f noise) - more natural than white noise
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    const rain = this.audioContext.createBufferSource();
    rain.buffer = noiseBuffer;
    rain.loop = true;

    // Highpass to remove low rumble, then slight lowpass
    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 300;
    highpass.Q.value = 0.5;

    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000;
    lowpass.Q.value = 0.5;

    rain.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(this.masterGain);

    rain.start(0);
    this.activeNodes.add(rain);
    this.activeNodes.add(highpass);
    this.activeNodes.add(lowpass);

    // Add occasional heavier drops for realism
    this.scheduleRainDrops();
  }

  private scheduleRainDrops(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextDrop = Math.random() * 400 + 200; // 200-600ms between drops

    const timeoutId = window.setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      // Short burst of filtered noise for drop
      const dropBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
      const dropData = dropBuffer.getChannelData(0);

      for (let i = 0; i < dropData.length; i++) {
        dropData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (dropData.length * 0.3));
      }

      const drop = this.audioContext.createBufferSource();
      drop.buffer = dropBuffer;

      const dropGain = this.audioContext.createGain();
      dropGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
      dropGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

      const dropFilter = this.audioContext.createBiquadFilter();
      dropFilter.type = 'highpass';
      dropFilter.frequency.value = 1500;

      drop.connect(dropFilter);
      dropFilter.connect(dropGain);
      dropGain.connect(this.masterGain);

      drop.start(this.audioContext.currentTime);
      drop.stop(this.audioContext.currentTime + 0.1);

      this.scheduleRainDrops();
    }, nextDrop);

    this.scheduledTimeouts.push(timeoutId);
  }

  private generateOcean(): void {
    if (!this.audioContext || !this.masterGain) return;

    // More realistic ocean waves with filtered noise
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.2;
      }
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Wave modulation (LFO)
    const lfo1 = this.audioContext.createOscillator();
    lfo1.frequency.value = 0.08; // Very slow for waves
    lfo1.type = 'sine';

    const lfo2 = this.audioContext.createOscillator();
    lfo2.frequency.value = 0.13;
    lfo2.type = 'sine';

    const lfoGain1 = this.audioContext.createGain();
    lfoGain1.gain.value = 200;

    const lfoGain2 = this.audioContext.createGain();
    lfoGain2.gain.value = 150;

    // Filter for ocean-like rumble
    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 400;
    lowpass.Q.value = 2;

    // Connect LFOs to modulate filter
    lfo1.connect(lfoGain1);
    lfoGain1.connect(lowpass.frequency);
    lfo2.connect(lfoGain2);
    lfoGain2.connect(lowpass.frequency);

    noise.connect(lowpass);
    lowpass.connect(this.masterGain);

    lfo1.start(0);
    lfo2.start(0);
    noise.start(0);

    this.activeNodes.add(lfo1);
    this.activeNodes.add(lfo2);
    this.activeNodes.add(lfoGain1);
    this.activeNodes.add(lfoGain2);
    this.activeNodes.add(noise);
    this.activeNodes.add(lowpass);
  }

  private generateForest(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Gentle wind base
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.15;
      }
    }

    const wind = this.audioContext.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    // Wind modulation
    const windLfo = this.audioContext.createOscillator();
    windLfo.frequency.value = 0.2;
    windLfo.type = 'sine';

    const windLfoGain = this.audioContext.createGain();
    windLfoGain.gain.value = 300;

    const windFilter = this.audioContext.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 1;

    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    wind.connect(windFilter);
    windFilter.connect(this.masterGain);

    windLfo.start(0);
    wind.start(0);

    this.activeNodes.add(windLfo);
    this.activeNodes.add(windLfoGain);
    this.activeNodes.add(wind);
    this.activeNodes.add(windFilter);

    // Realistic bird chirps
    this.scheduleBirdChirps();
  }

  private scheduleBirdChirps(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextChirp = Math.random() * 4000 + 3000; // 3-7 seconds

    const timeoutId = window.setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      // More realistic chirp with frequency modulation
      const chirp = this.audioContext.createOscillator();
      const chirpGain = this.audioContext.createGain();

      chirp.type = 'sine';
      const startFreq = Math.random() * 800 + 2000; // 2000-2800Hz
      const endFreq = startFreq + (Math.random() * 600 + 300); // Upward sweep

      chirp.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
      chirp.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + 0.08);

      // Quick attack and decay
      chirpGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      chirpGain.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 0.01);
      chirpGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.12);

      chirp.connect(chirpGain);
      chirpGain.connect(this.masterGain);

      chirp.start(this.audioContext.currentTime);
      chirp.stop(this.audioContext.currentTime + 0.12);

      this.scheduleBirdChirps();
    }, nextChirp);

    this.scheduledTimeouts.push(timeoutId);
  }

  private generateCoffeeShop(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Background murmur (low-frequency filtered noise)
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.2;
      }
    }

    const murmur = this.audioContext.createBufferSource();
    murmur.buffer = noiseBuffer;
    murmur.loop = true;

    const murmurFilter = this.audioContext.createBiquadFilter();
    murmurFilter.type = 'bandpass';
    murmurFilter.frequency.value = 250;
    murmurFilter.Q.value = 1.5;

    murmur.connect(murmurFilter);
    murmurFilter.connect(this.masterGain);

    murmur.start(0);
    this.activeNodes.add(murmur);
    this.activeNodes.add(murmurFilter);

    // Coffee shop ambient sounds
    this.scheduleCoffeeSounds();
  }

  private scheduleCoffeeSounds(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextSound = Math.random() * 5000 + 4000; // 4-9 seconds

    const timeoutId = window.setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const soundType = Math.random();

      if (soundType < 0.4) {
        // Cup clink (short metallic sound)
        const clink = this.audioContext.createOscillator();
        const clinkGain = this.audioContext.createGain();

        clink.type = 'sine';
        clink.frequency.value = Math.random() * 300 + 1300;

        clinkGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        clinkGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

        clink.connect(clinkGain);
        clinkGain.connect(this.masterGain);

        clink.start(this.audioContext.currentTime);
        clink.stop(this.audioContext.currentTime + 0.08);
      } else if (soundType < 0.7) {
        // Coffee machine hiss (filtered noise burst)
        const hissBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.5, this.audioContext.sampleRate);
        const hissData = hissBuffer.getChannelData(0);

        for (let i = 0; i < hissData.length; i++) {
          hissData[i] = (Math.random() * 2 - 1) * 0.3 * Math.exp(-i / (hissData.length * 0.5));
        }

        const hiss = this.audioContext.createBufferSource();
        hiss.buffer = hissBuffer;

        const hissGain = this.audioContext.createGain();
        hissGain.gain.value = 0.06;

        const hissFilter = this.audioContext.createBiquadFilter();
        hissFilter.type = 'highpass';
        hissFilter.frequency.value = 2000;

        hiss.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(this.masterGain);

        hiss.start(this.audioContext.currentTime);
      }

      this.scheduleCoffeeSounds();
    }, nextSound);

    this.scheduledTimeouts.push(timeoutId);
  }

  private generateFireplace(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Base crackling fire (pink noise with modulation)
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Pink noise for more natural fire sound
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.15;
        b6 = white * 0.115926;
      }
    }

    const fire = this.audioContext.createBufferSource();
    fire.buffer = noiseBuffer;
    fire.loop = true;

    // Filter for fire character
    const fireFilter = this.audioContext.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 600;
    fireFilter.Q.value = 0.8;

    // Random modulation for flickering effect
    const flickerLfo = this.audioContext.createOscillator();
    flickerLfo.frequency.value = 3;
    flickerLfo.type = 'sine';

    const flickerGain = this.audioContext.createGain();
    flickerGain.gain.value = 200;

    flickerLfo.connect(flickerGain);
    flickerGain.connect(fireFilter.frequency);

    fire.connect(fireFilter);
    fireFilter.connect(this.masterGain);

    flickerLfo.start(0);
    fire.start(0);

    this.activeNodes.add(flickerLfo);
    this.activeNodes.add(flickerGain);
    this.activeNodes.add(fire);
    this.activeNodes.add(fireFilter);

    // Add wood crackles and pops
    this.scheduleFireCrackles();
  }

  private scheduleFireCrackles(): void {
    if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

    const nextCrackle = Math.random() * 1500 + 500; // 0.5-2 seconds

    const timeoutId = window.setTimeout(() => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const crackleType = Math.random();

      if (crackleType < 0.6) {
        // Small crackle (short burst)
        const crackleBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.05, this.audioContext.sampleRate);
        const crackleData = crackleBuffer.getChannelData(0);

        for (let i = 0; i < crackleData.length; i++) {
          crackleData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (crackleData.length * 0.3));
        }

        const crackle = this.audioContext.createBufferSource();
        crackle.buffer = crackleBuffer;

        const crackleGain = this.audioContext.createGain();
        crackleGain.gain.value = 0.15;

        const crackleFilter = this.audioContext.createBiquadFilter();
        crackleFilter.type = 'highpass';
        crackleFilter.frequency.value = 800;

        crackle.connect(crackleFilter);
        crackleFilter.connect(crackleGain);
        crackleGain.connect(this.masterGain);

        crackle.start(this.audioContext.currentTime);
      } else {
        // Loud pop (quick frequency sweep)
        const pop = this.audioContext.createOscillator();
        const popGain = this.audioContext.createGain();

        pop.type = 'square';
        pop.frequency.setValueAtTime(400, this.audioContext.currentTime);
        pop.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.03);

        popGain.gain.setValueAtTime(0.12, this.audioContext.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.04);

        pop.connect(popGain);
        popGain.connect(this.masterGain);

        pop.start(this.audioContext.currentTime);
        pop.stop(this.audioContext.currentTime + 0.04);
      }

      this.scheduleFireCrackles();
    }, nextCrackle);

    this.scheduledTimeouts.push(timeoutId);
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
