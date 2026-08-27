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
import { claimLongAudio } from '@/lib/audioPlaybackCoordinator';

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
  const releaseOwnershipRef = useRef<(() => void) | null>(null);
  const appAudioSettings = useAppAudioSettings();
  const [toneFilterStatus, setToneFilterStatus] = useState<ToneFilterStatus>(() =>
    soundGeneratorRef.current.getToneFilterStatus(),
  );
  const ambientVolume = resolveHyperfocusAmbientVolume(
    appAudioSettings.volume,
    appAudioSettings.muted,
  );

  const releaseOwnership = useCallback(() => {
    const release = releaseOwnershipRef.current;
    if (!release) return;
    releaseOwnershipRef.current = null;
    release();
  }, []);

  const pauseAndRelease = useCallback(() => {
    soundGeneratorRef.current?.pause();
    setIsSoundPlaying(false);
    releaseOwnership();
    clearAppAudioMediaSession();
  }, [releaseOwnership]);

  const claimOwnership = useCallback(() => {
    if (releaseOwnershipRef.current) return;
    releaseOwnershipRef.current = claimLongAudio('hyperfocus', pauseAndRelease);
  }, [pauseAndRelease]);

  // Subscribe to audio status updates
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    const unsubscribe = generator.addStatusListener((status) => {
      setAudioStatus(status);
      if (status.state === 'playing') {
        claimOwnership();
        setIsSoundPlaying(true);
        setAppAudioMediaSession({
          title: 'ZenFlow Hyperfocus',
          artist: 'Focus ambience',
          onPlay: () => {
            claimOwnership();
            generator.resumeDirect();
          },
          onPause: pauseAndRelease,
          onStop: pauseAndRelease,
        });
      } else if (status.state === 'idle' || status.state === 'paused' || status.state === 'blocked' || status.state === 'error') {
        setIsSoundPlaying(false);
        releaseOwnership();
        clearAppAudioMediaSession();
      }
    });

    return unsubscribe;
  }, [claimOwnership, pauseAndRelease, releaseOwnership]);

  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    generator.setVolume(ambientVolume);

    if (appAudioSettings.muted) {
      pauseAndRelease();
    }
  }, [ambientVolume, appAudioSettings.muted, pauseAndRelease]);

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
      releaseOwnership();
      return;
    }

    if (!isRunning || isPaused || appAudioSettings.muted) {
      pauseAndRelease();
    }
  }, [selectedSoundId, isRunning, isPaused, appAudioSettings.muted, pauseAndRelease, releaseOwnership]);

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      if (soundGeneratorRef.current) {
        clearAppAudioMediaSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ref.current in cleanup is intentional
        soundGeneratorRef.current.stop();
        releaseOwnership();
      }
    };
  }, [releaseOwnership]);

  // Play sound — preserves iOS gesture context
  const playSound = useCallback((soundId: string) => {
    const generator = soundGeneratorRef.current;
    const normalizedSoundId = normalizeHyperfocusSoundId(soundId);
    if (!generator || !normalizedSoundId || appAudioSettings.muted) return;
    generator.setVolume(ambientVolume);
    generator.setToneCutoffKhz(appAudioSettings.hyperfocusToneCutoffKhz);
    claimOwnership();
    try {
      generator.playDirect(normalizedSoundId);
    } catch (error) {
      releaseOwnership();
      throw error;
    }
    setToneFilterStatus(generator.getToneFilterStatus());
  }, [ambientVolume, appAudioSettings.hyperfocusToneCutoffKhz, appAudioSettings.muted, claimOwnership, releaseOwnership]);

  const updateToneCutoffKhz = useCallback((value: number): boolean => {
    const normalizedValue = normalizeHyperfocusToneKhz(value);
    if (!setHyperfocusToneCutoffKhz(normalizedValue)) return false;
    setToneFilterStatus(soundGeneratorRef.current.setToneCutoffKhz(normalizedValue));
    return true;
  }, []);

  const pauseAudio = pauseAndRelease;

  const resumeAudioDirect = () => {
    if (appAudioSettings.muted) return;
    claimOwnership();
    soundGeneratorRef.current?.resumeDirect();
  };

  const toggleSound = () => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (isSoundPlaying) {
      pauseAndRelease();
    } else if (selectedSoundId && !appAudioSettings.muted) {
      generator.setVolume(ambientVolume);
      claimOwnership();
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
      releaseOwnership();
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
