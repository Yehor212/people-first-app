import { useState, useEffect, useRef, useCallback } from 'react';
import { getAmbientSoundGenerator, AmbientSoundGenerator, AudioStatus } from '@/lib/ambientSounds';

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

  // Subscribe to audio status updates
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    const unsubscribe = generator.addStatusListener((status) => {
      setAudioStatus(status);
      if (status.state === 'playing') {
        setIsSoundPlaying(true);
      } else if (status.state === 'idle' || status.state === 'error') {
        setIsSoundPlaying(false);
      }
    });

    return unsubscribe;
  }, []);

  // Pause/resume sync with timer state
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (!selectedSoundId) {
      generator.stop();
      setIsSoundPlaying(false);
      return;
    }

    if (!isRunning || isPaused) {
      generator.pause();
    }
  }, [selectedSoundId, isRunning, isPaused]);

  // Stop sound on unmount
  useEffect(() => {
    return () => {
      if (soundGeneratorRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ref.current in cleanup is intentional
        soundGeneratorRef.current.stop();
      }
    };
  }, []);

  // Play sound — preserves iOS gesture context
  const playSound = useCallback((soundId: string) => {
    const generator = soundGeneratorRef.current;
    if (!generator || !soundId) return;
    generator.playDirect(soundId);
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
    } else if (selectedSoundId) {
      generator.resumeDirect();
    }
  };

  const handleSoundSelect = (soundId: string | null) => {
    setSelectedSoundId(soundId);

    if (soundId && isRunning && !isPaused) {
      playSound(soundId);
    } else if (!soundId) {
      soundGeneratorRef.current?.stop();
      setIsSoundPlaying(false);
    }
  };

  return {
    selectedSoundId,
    isSoundPlaying,
    audioStatus,
    playSound,
    pauseAudio,
    resumeAudioDirect,
    toggleSound,
    handleSoundSelect,
  };
}
