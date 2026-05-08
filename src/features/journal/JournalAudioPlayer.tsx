import { useState, useRef, useEffect, memo } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface JournalAudioPlayerProps {
  src: string;          // base64 data URL
  duration: number;     // seconds
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const JournalAudioPlayer = memo(function JournalAudioPlayer({ src, duration }: JournalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoaded = () => setLoaded(true);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    audio.addEventListener('loadeddata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('loadeddata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current || !loaded) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => logger.warn('[Audio]', 'Playback failed:', err));
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/15">
      <button
        onClick={togglePlay}
        disabled={!loaded}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
          'bg-primary/15 text-primary',
          'disabled:opacity-40',
          'active:scale-95 motion-safe:transition-transform',
        )}
      >
        {playing ? (
          <Pause className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Play className="w-4 h-4 ms-0.5" aria-hidden="true" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full bg-primary/60 rounded-full motion-safe:transition-all motion-safe:duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0">
        {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
      </span>
    </div>
  );
});
