/**
 * Ambient Sound Player using real audio samples
 * Uses high-quality royalty-free ambient sounds
 */

export type AmbientSoundType = 'none' | 'white-noise' | 'rain' | 'ocean' | 'forest' | 'coffee-shop' | 'fireplace';

// Free, royalty-free ambient sound URLs from reliable sources
// These are loopable ambient sound samples
const SOUND_URLS: Record<Exclude<AmbientSoundType, 'none'>, string> = {
  'white-noise': 'https://cdn.pixabay.com/audio/2022/10/30/audio_56950e78e9.mp3', // Soft white noise
  'rain': 'https://cdn.pixabay.com/audio/2022/05/16/audio_1c8a89c66b.mp3', // Rain sounds
  'ocean': 'https://cdn.pixabay.com/audio/2024/06/12/audio_dbb8ef1986.mp3', // Ocean waves
  'forest': 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', // Forest birds
  'coffee-shop': 'https://cdn.pixabay.com/audio/2021/09/21/audio_6feac14979.mp3', // Coffee shop ambience
  'fireplace': 'https://cdn.pixabay.com/audio/2021/12/27/audio_6a1f7a1e04.mp3', // Fireplace crackling
};

// Fallback procedural sounds in case audio fails to load
const FALLBACK_ENABLED = true;

export class AmbientSoundGenerator {
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private isPlaying = false;
  private currentType: AmbientSoundType = 'none';
  private scheduledTimeouts: number[] = [];
  private usingFallback = false;
  private volume = 0.4; // 40% default volume

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  async play(type: AmbientSoundType): Promise<void> {
    if (type === 'none') {
      this.stop();
      return;
    }

    // Stop current sound if any
    if (this.isPlaying) {
      this.stop();
    }

    this.currentType = type;
    this.isPlaying = true;
    this.usingFallback = false;

    // Try to play real audio file first
    try {
      await this.playAudioFile(type);
    } catch (error) {
      console.warn(`Failed to load audio for ${type}, using fallback:`, error);
      if (FALLBACK_ENABLED) {
        this.usingFallback = true;
        await this.playFallback(type);
      }
    }
  }

  private async playAudioFile(type: Exclude<AmbientSoundType, 'none'>): Promise<void> {
    const url = SOUND_URLS[type];

    // Create audio element for streaming
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.loop = true;
    this.audioElement.volume = this.volume;
    this.audioElement.src = url;

    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) return reject(new Error('No audio element'));

      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'));
      }, 10000); // 10 second timeout

      this.audioElement.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.audioElement.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      this.audioElement.load();
    });

    // Play the audio
    await this.audioElement.play();
  }

  private async playFallback(type: AmbientSoundType): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;

    // Resume audio context if suspended (autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

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
    // Stop HTML audio element if playing
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    // Stop Web Audio nodes if using fallback
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
    this.usingFallback = false;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update HTML audio element volume
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }

    // Update Web Audio master gain
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  resume(): void {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.play().catch(console.error);
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // ============================================
  // FALLBACK PROCEDURAL SOUNDS (improved quality)
  // ============================================

  private generateWhiteNoise(): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = 2 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Brown noise (smoother, less harsh than white noise)
    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate for volume loss
      }
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Gentle low-pass filter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.7;

    noise.connect(filter);
    filter.connect(this.masterGain);

    noise.start(0);
    this.activeNodes.add(noise);
    this.activeNodes.add(filter);
  }

  private generateRain(): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Pink noise for natural rain sound
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
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.13;
        b6 = white * 0.115926;
      }
    }

    const rain = this.audioContext.createBufferSource();
    rain.buffer = noiseBuffer;
    rain.loop = true;

    // Shape rain sound
    const highpass = this.audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 250;

    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4000;

    rain.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(this.masterGain);

    rain.start(0);
    this.activeNodes.add(rain);
    this.activeNodes.add(highpass);
    this.activeNodes.add(lowpass);
  }

  private generateOcean(): void {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    // Pink noise base
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
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.2;
        b6 = white * 0.115926;
      }
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Wave modulation with multiple LFOs for realism
    const lfo1 = this.audioContext.createOscillator();
    lfo1.frequency.value = 0.06;
    lfo1.type = 'sine';

    const lfo2 = this.audioContext.createOscillator();
    lfo2.frequency.value = 0.11;
    lfo2.type = 'sine';

    const lfoGain1 = this.audioContext.createGain();
    lfoGain1.gain.value = 250;

    const lfoGain2 = this.audioContext.createGain();
    lfoGain2.gain.value = 180;

    // Low-pass for deep ocean rumble
    const lowpass = this.audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 500;
    lowpass.Q.value = 1.5;

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

    // Gentle wind base with brown noise
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 2.5;
      }
    }

    const wind = this.audioContext.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    // Wind modulation
    const windLfo = this.audioContext.createOscillator();
    windLfo.frequency.value = 0.15;
    windLfo.type = 'sine';

    const windLfoGain = this.audioContext.createGain();
    windLfoGain.gain.value = 250;

    const windFilter = this.audioContext.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.8;

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
  }

  private generateCoffeeShop(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Low murmur base
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = noiseBuffer.getChannelData(channel);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3;
      }
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
  }

  private generateFireplace(): void {
    if (!this.audioContext || !this.masterGain) return;

    // Pink noise base for fire crackle
    const bufferSize = 4 * this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

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
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.18;
        b6 = white * 0.115926;
      }
    }

    const fire = this.audioContext.createBufferSource();
    fire.buffer = noiseBuffer;
    fire.loop = true;

    // Fire character filter
    const fireFilter = this.audioContext.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 700;
    fireFilter.Q.value = 0.6;

    // Slow flickering modulation
    const flickerLfo = this.audioContext.createOscillator();
    flickerLfo.frequency.value = 2;
    flickerLfo.type = 'sine';

    const flickerGain = this.audioContext.createGain();
    flickerGain.gain.value = 180;

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
