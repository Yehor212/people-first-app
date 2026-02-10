import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JournalAudioPlayerProps {
  src: string;          // base64 data URL
  duration: number;     // seconds
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function JournalAudioPlayer({ src, duration }: JournalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    audio.addEventListener('loadeddata', () => setLoaded(true));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => { setPlaying(false); setCurrentTime(0); });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('play', () => setPlaying(true));

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current || !loaded) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/15">
      <button
        onClick={togglePlay}
        disabled={!loaded}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
          'bg-primary/15 text-primary',
          'disabled:opacity-40',
          'active:scale-95 transition-transform',
        )}
      >
        {playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ms-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full bg-primary/60 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0">
        {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
      </span>
    </div>
  );
}
