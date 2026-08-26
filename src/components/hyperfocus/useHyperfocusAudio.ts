import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAmbientSoundGenerator,
  AmbientSoundGenerator,
  AudioStatus,
  type ToneFilterStatus,
} from '@/lib/ambientSounds';
import { normalizeHyperfocusSoundId } from '@/lib/hyperfocusAudioCatalog';
import { useAppAudioSettings } from '@/hooks/useAppAudioSettings';
import { clearAppAudioMediaSession, setAppAudioMediaSession } from '@/lib/audioMediaSession';
import { setHyperfocusToneCutoffKhz } from '@/lib/audioManager';
import { normalizeHyperfocusToneKhz } from '@/lib/hyperfocusTone';
import { resolveHyperfocusAmbientVolume } from '@/lib/hyperfocusAudioVolume';

interface UseHyperfocusAudioOptions {
  isRunning: boolean;
  isPaused: boolean;
}

export function useHyperfocusAudio({ isRunning, isPaused }: UseHyperfocusAudioOptions) {
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({
    state: 'idle',
    soundId: null,
    isUnlocked: false,
  });
  const soundGeneratorRef = useRef<AmbientSoundGenerator>(getAmbientSoundGenerator());
  const appAudioSettings = useAppAudioSettings();
  const [toneFilterStatus, setToneFilterStatus] = useState<ToneFilterStatus>(() =>
    soundGeneratorRef.current.getToneFilterStatus(),
  );
  const ambientVolume = resolveHyperfocusAmbientVolume(
    appAudioSettings.volume,
    appAudioSettings.muted,
  );

  // Subscribe to audio status updates
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    const unsubscribe = generator.addStatusListener((status) => {
      setAudioStatus(status);
      if (status.state === 'playing') {
        setIsSoundPlaying(true);
        setAppAudioMediaSession({
          title: 'ZenFlow Hyperfocus',
          artist: 'Focus ambience',
          onPlay: () => generator.resumeDirect(),
          onPause: () => generator.pause(),
          onStop: () => generator.pause(),
        });
      } else if (status.state === 'idle' || status.state === 'paused' || status.state === 'blocked' || status.state === 'error') {
        setIsSoundPlaying(false);
        clearAppAudioMediaSession();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    generator.setVolume(ambientVolume);

    if (appAudioSettings.muted) {
      generator.pause();
      setIsSoundPlaying(false);
      clearAppAudioMediaSession();
    }
  }, [ambientVolume, appAudioSettings.muted]);

  useEffect(() => {
    const generator = soundGeneratorRef.current;
    setToneFilterStatus(generator.setToneCutoffKhz(appAudioSettings.hyperfocusToneCutoffKhz));
  }, [appAudioSettings.hyperfocusToneCutoffKhz]);

  // Pause/resume sync with timer state
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (!selectedSoundId) {
      generator.stop();
      setIsSoundPlaying(false);
      return;
    }

    if (!isRunning || isPaused || appAudioSettings.muted) {
      generator.pause();
      setIsSoundPlaying(false);
    }
  }, [selectedSoundId, isRunning, isPaused, appAudioSettings.muted]);

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      if (soundGeneratorRef.current) {
        clearAppAudioMediaSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ref.current in cleanup is intentional
        soundGeneratorRef.current.stop();
      }
    };
  }, []);

  // Play sound — preserves iOS gesture context
  const playSound = useCallback((soundId: string) => {
    const generator = soundGeneratorRef.current;
    const normalizedSoundId = normalizeHyperfocusSoundId(soundId);
    if (!generator || !normalizedSoundId || appAudioSettings.muted) return;
    generator.setVolume(ambientVolume);
    generator.setToneCutoffKhz(appAudioSettings.hyperfocusToneCutoffKhz);
    generator.playDirect(normalizedSoundId);
    setToneFilterStatus(generator.getToneFilterStatus());
  }, [ambientVolume, appAudioSettings.hyperfocusToneCutoffKhz, appAudioSettings.muted]);

  const updateToneCutoffKhz = useCallback((value: number): boolean => {
    const normalizedValue = normalizeHyperfocusToneKhz(value);
    if (!setHyperfocusToneCutoffKhz(normalizedValue)) return false;
    setToneFilterStatus(soundGeneratorRef.current.setToneCutoffKhz(normalizedValue));
    return true;
  }, []);

  const pauseAudio = () => {
    soundGeneratorRef.current?.pause();
  };

  const resumeAudioDirect = () => {
    soundGeneratorRef.current?.resumeDirect();
  };

  const toggleSound = () => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (isSoundPlaying) {
      generator.pause();
      setIsSoundPlaying(false);
    } else if (selectedSoundId && !appAudioSettings.muted) {
      generator.setVolume(ambientVolume);
      generator.resumeDirect();
    }
  };

  const handleSoundSelect = (soundId: string | null) => {
    const normalizedSoundId = soundId ? normalizeHyperfocusSoundId(soundId) : null;
    setSelectedSoundId(normalizedSoundId);

    if (normalizedSoundId && isRunning && !isPaused && !appAudioSettings.muted) {
      playSound(normalizedSoundId);
    } else if (!normalizedSoundId) {
      soundGeneratorRef.current?.stop();
      setIsSoundPlaying(false);
    }
  };

  return {
    selectedSoundId,
    isSoundPlaying,
    audioMuted: appAudioSettings.muted,
    audioStatus,
    toneCutoffKhz: toneFilterStatus.cutoffKhz,
    toneFilterStatus,
    setToneCutoffKhz: updateToneCutoffKhz,
    playSound,
    pauseAudio,
    resumeAudioDirect,
    toggleSound,
    handleSoundSelect,
  };
}
