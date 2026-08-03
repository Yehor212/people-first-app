import { useState, useRef, useEffect, memo } from 'react';
import { Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerAudioBackgroundPauseHandler } from '@/lib/audioLifecycle';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';

interface JournalAudioPlayerProps {
  src: string;          // base64 data URL
  duration: number;     // seconds
  index?: number;
}

let activeJournalAudio: HTMLAudioElement | null = null;

function claimJournalAudioPlayback(audio: HTMLAudioElement): void {
  if (activeJournalAudio && activeJournalAudio !== audio) {
    activeJournalAudio.pause();
  }
  activeJournalAudio = audio;
}

function releaseJournalAudioPlayback(audio: HTMLAudioElement): void {
  if (activeJournalAudio === audio) activeJournalAudio = null;
}

function formatTime(sec: number): string {
  const safeSeconds = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const m = Math.floor(safeSeconds / 60);
  const s = Math.floor(safeSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (value, [key, replacement]) => value.replace(`{${key}}`, String(replacement)),
    template,
  );
}

export const JournalAudioPlayer = memo(function JournalAudioPlayer({
  src,
  duration,
  index = 1,
}: JournalAudioPlayerProps) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(duration);
  const [playbackError, setPlaybackError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setPlaying(false);
    setCurrentTime(0);
    setMediaDuration(duration);
    setPlaybackError(false);
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoaded = () => {
      setLoaded(true);
      setPlaybackError(false);
    };
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setMediaDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      releaseJournalAudioPlayback(audio);
      setPlaying(false);
      setCurrentTime(0);
    };
    const onPause = () => {
      releaseJournalAudioPlayback(audio);
      setPlaying(false);
    };
    const onPlay = () => {
      claimJournalAudioPlayback(audio);
      setPlaying(true);
    };
    const onError = () => {
      setLoaded(false);
      setPlaying(false);
      setPlaybackError(true);
    };

    audio.addEventListener('loadeddata', onLoaded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('error', onError);
    const unregisterBackgroundPause = registerAudioBackgroundPauseHandler(() => audio.pause());

    return () => {
      unregisterBackgroundPause();
      audio.removeEventListener('loadeddata', onLoaded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('error', onError);
      audio.pause();
      releaseJournalAudioPlayback(audio);
      audio.src = '';
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [duration, loadAttempt, src]);

  const togglePlay = () => {
    if (!audioRef.current || !loaded) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      const audio = audioRef.current;
      claimJournalAudioPlayback(audio);
      audio.play().catch(err => {
        releaseJournalAudioPlayback(audio);
        setPlaying(false);
        setPlaybackError(true);
        logger.warn('[Audio]', 'Playback failed:', err);
      });
    }
  };

  const effectiveDuration = Number.isFinite(mediaDuration) && mediaDuration > 0
    ? mediaDuration
    : Number.isFinite(duration) && duration > 0
      ? duration
      : 0;
  const recordingLabel = fill(
    t.journalAudioRecordingLabel || 'Audio recording {number}, {duration}',
    { number: index, duration: formatTime(effectiveDuration) },
  );
  const playLabel = fill(t.journalAudioPlay || 'Play {label}', { label: recordingLabel });
  const pauseLabel = fill(t.journalAudioPause || 'Pause {label}', { label: recordingLabel });
  const progressLabel = fill(
    t.journalAudioProgress || '{label} playback progress',
    { label: recordingLabel },
  );
  const retryLabel = fill(t.journalAudioRetry || 'Try {label} again', { label: recordingLabel });
  const loadingLabel = fill(t.journalAudioLoading || 'Loading {label}', { label: recordingLabel });

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !loaded) return;
    const nextTime = Math.min(effectiveDuration, Math.max(0, Number(event.target.value)));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div
      className="rounded-xl border p-2.5 text-[var(--journal-paper-text,var(--diary-text,hsl(var(--foreground))))]"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--journal-paper-text, var(--diary-text, hsl(var(--foreground)))) 6%, transparent)',
        borderColor: 'color-mix(in srgb, var(--journal-paper-muted, var(--diary-border, hsl(var(--border)))) 28%, transparent)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          dir="auto"
          onClick={togglePlay}
          disabled={!loaded || playbackError}
          aria-label={!loaded && !playbackError ? loadingLabel : playing ? pauseLabel : playLabel}
          aria-busy={!loaded && !playbackError}
          className={cn(
            'min-h-[48px] min-w-[48px] rounded-full flex items-center justify-center flex-shrink-0',
            'text-[var(--journal-paper-text,var(--diary-text,hsl(var(--foreground))))]',
            'disabled:opacity-40',
            'active:scale-95 motion-safe:transition-transform',
          )}
          style={{
            backgroundColor: 'color-mix(in srgb, var(--journal-paper-text, var(--diary-text, hsl(var(--foreground)))) 12%, transparent)',
          }}
        >
          {!loaded && !playbackError ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 ms-0.5" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="range"
            dir="auto"
            aria-label={progressLabel}
            aria-valuetext={`${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`}
            min={0}
            max={effectiveDuration}
            step={0.1}
            value={Math.min(Math.max(0, currentTime), effectiveDuration)}
            disabled={!loaded || playbackError || effectiveDuration <= 0}
            onChange={handleSeek}
            className="h-12 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              accentColor: 'var(--journal-paper-text, var(--diary-text, hsl(var(--foreground))))',
            }}
          />
        </div>

        <span
          dir="auto"
          className="flex-shrink-0 whitespace-normal text-xs tabular-nums text-[var(--journal-paper-muted,var(--diary-muted,hsl(var(--muted-foreground))))]"
        >
          {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(effectiveDuration)}
        </span>
      </div>

      {playbackError && (
        <div
          role="alert"
          className="mt-2 flex items-center gap-2 text-xs leading-relaxed text-[var(--journal-paper-muted,var(--diary-muted,hsl(var(--muted-foreground))))]"
        >
          <span className="min-w-0 flex-1">
            {t.journalAudioPlaybackError || 'This recording could not be played. Try again.'}
          </span>
          <button
            type="button"
            dir="auto"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            aria-label={retryLabel}
            title={retryLabel}
            className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full text-[var(--journal-paper-text,var(--diary-text,hsl(var(--foreground))))] motion-safe:transition-opacity hover:opacity-80"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
});
