import { useState, useEffect } from 'react';
import {
  isSpotifyConnected,
  getCurrentTrack,
  startFocusPlayback,
  stopFocusPlayback,
  SpotifyTrack
} from '@/lib/spotifyIntegration';

interface UseHyperfocusSpotifyOptions {
  isRunning: boolean;
  isPaused: boolean;
}

export function useHyperfocusSpotify({ isRunning, isPaused }: UseHyperfocusSpotifyOptions) {
  const [spotifyConnected] = useState(isSpotifyConnected());
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyAutoPlay, setSpotifyAutoPlay] = useState(false);

  // Auto-play/pause when timer starts/stops
  useEffect(() => {
    if (!spotifyConnected || !spotifyAutoPlay) return;

    if (isRunning && !isPaused) {
      void startFocusPlayback();
    } else {
      void stopFocusPlayback();
    }
  }, [isRunning, isPaused, spotifyConnected, spotifyAutoPlay]);

  // Poll current track
  useEffect(() => {
    if (!spotifyConnected) return;

    const pollTrack = async () => {
      const track = await getCurrentTrack();
      setSpotifyTrack(track);
    };

    void pollTrack();
    const interval = setInterval(pollTrack, 5000);
    return () => clearInterval(interval);
  }, [spotifyConnected]);

  return {
    spotifyConnected,
    spotifyTrack,
    spotifyAutoPlay,
    setSpotifyAutoPlay,
  };
}
