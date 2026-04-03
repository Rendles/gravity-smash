import type { GameAudioEvent } from '../game/types';

type ToneType = OscillatorType;

interface ToneOptions {
  frequency: number;
  delay?: number;
  duration: number;
  gain: number;
  type?: ToneType;
  attack?: number;
  release?: number;
  detune?: number;
}

const MENU_CHORDS = [
  [220, 277.18, 329.63],
  [196, 246.94, 311.13],
  [233.08, 293.66, 349.23],
  [207.65, 261.63, 329.63]
] as const;

export class GameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private menuMusicEnabled = false;
  private menuMusicTimer: number | null = null;
  private menuChordIndex = 0;
  private muted = false;

  private getContext() {
    if (this.context) {
      return this.context;
    }

    const context = new AudioContext();
    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : 0.24;
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    return context;
  }

  async resume() {
    const context = this.getContext();
    if (context.state !== 'running') {
      try {
        await context.resume();
      } catch {
        return;
      }
    }

    if (this.menuMusicEnabled && this.menuMusicTimer === null) {
      this.startMenuMusic();
    }
  }

  setMenuMusicEnabled(enabled: boolean) {
    this.menuMusicEnabled = enabled;

    if (!enabled) {
      this.stopMenuMusic();
      return;
    }

    const context = this.getContext();
    if (context.state === 'running' && this.menuMusicTimer === null) {
      this.startMenuMusic();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;

    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : 0.24,
        this.context.currentTime
      );
    }
  }

  playEvent(event: GameAudioEvent) {
    const context = this.getContext();
    if (context.state !== 'running') {
      return;
    }

    switch (event.type) {
      case 'destroy':
        this.playDestroySound(event.count);
        break;
      case 'ability':
        if (event.ability === 'freeze') {
          this.playFreezeSound();
        } else if (event.ability === 'fire') {
          this.playFireSound();
        } else {
          this.playSpectrumSound();
        }
        break;
      case 'round':
        if (event.result === 'win') {
          this.playWinSound();
        } else {
          this.playLoseSound();
        }
        break;
    }
  }

  destroy() {
    this.stopMenuMusic();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }

  private startMenuMusic() {
    this.stopMenuMusic();
    this.playMenuChord();
    this.menuMusicTimer = window.setInterval(() => {
      this.playMenuChord();
    }, 2500);
  }

  private stopMenuMusic() {
    if (this.menuMusicTimer !== null) {
      window.clearInterval(this.menuMusicTimer);
      this.menuMusicTimer = null;
    }
  }

  private playMenuChord() {
    const chord = MENU_CHORDS[this.menuChordIndex % MENU_CHORDS.length];
    this.menuChordIndex += 1;

    chord.forEach((frequency, index) => {
      this.playTone({
        frequency,
        delay: index * 0.06,
        duration: 2.2,
        gain: index === 0 ? 0.028 : 0.018,
        type: 'triangle',
        attack: 0.12,
        release: 1.2,
        detune: index === 1 ? -3 : index === 2 ? 4 : 0
      });
    });

    this.playTone({
      frequency: chord[0] * 0.5,
      delay: 0.02,
      duration: 1.9,
      gain: 0.015,
      type: 'sine',
      attack: 0.08,
      release: 0.9
    });
  }

  private playDestroySound(count: number) {
    const intensity = Math.min(1, 0.35 + count * 0.08);
    this.playTone({
      frequency: 580 + count * 16,
      duration: 0.11,
      gain: 0.018 * intensity,
      type: 'triangle',
      attack: 0.002,
      release: 0.08
    });
    this.playTone({
      frequency: 780 + count * 24,
      delay: 0.02,
      duration: 0.08,
      gain: 0.012 * intensity,
      type: 'sine',
      attack: 0.001,
      release: 0.06
    });
  }

  private playFreezeSound() {
    [1080, 920, 760].forEach((frequency, index) => {
      this.playTone({
        frequency,
        delay: index * 0.045,
        duration: 0.24,
        gain: 0.026,
        type: 'triangle',
        attack: 0.004,
        release: 0.16
      });
    });
  }

  private playFireSound() {
    this.playTone({
      frequency: 220,
      duration: 0.12,
      gain: 0.028,
      type: 'sawtooth',
      attack: 0.002,
      release: 0.1
    });
    this.playTone({
      frequency: 340,
      delay: 0.03,
      duration: 0.16,
      gain: 0.024,
      type: 'triangle',
      attack: 0.004,
      release: 0.12
    });
    this.playTone({
      frequency: 480,
      delay: 0.06,
      duration: 0.14,
      gain: 0.016,
      type: 'square',
      attack: 0.003,
      release: 0.09
    });
  }

  private playSpectrumSound() {
    [330, 415.3, 523.25, 659.25].forEach((frequency, index) => {
      this.playTone({
        frequency,
        delay: index * 0.045,
        duration: 0.2,
        gain: 0.022,
        type: 'sine',
        attack: 0.004,
        release: 0.12
      });
    });
  }

  private playWinSound() {
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
      this.playTone({
        frequency,
        delay: index * 0.08,
        duration: 0.34,
        gain: 0.03,
        type: 'triangle',
        attack: 0.01,
        release: 0.2
      });
    });
  }

  private playLoseSound() {
    [349.23, 261.63, 196].forEach((frequency, index) => {
      this.playTone({
        frequency,
        delay: index * 0.1,
        duration: 0.28,
        gain: 0.028,
        type: 'sawtooth',
        attack: 0.005,
        release: 0.18
      });
    });
  }

  private playTone(options: ToneOptions) {
    const context = this.getContext();
    if (context.state !== 'running' || !this.masterGain) {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.value = options.frequency;
    oscillator.detune.value = options.detune ?? 0;

    const startTime = context.currentTime + (options.delay ?? 0);
    const attack = options.attack ?? 0.01;
    const release = options.release ?? Math.max(0.06, options.duration * 0.5);
    const sustainEnd = startTime + Math.max(0.01, options.duration - release);
    const stopTime = sustainEnd + release;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(options.gain, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start(startTime);
    oscillator.stop(stopTime);
  }
}
