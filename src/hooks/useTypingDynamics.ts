import { useEffect, useRef, useState } from 'react';

/** Internal keystroke event stored in the circular buffer. */
interface KeystrokeEvent {
  timestamp: number;
  isBackspace: boolean;
}

/**
 * Real-time typing dynamics derived from keystroke analysis.
 *
 * All values are computed over a 30-second rolling window and updated at 30 FPS.
 *
 * @property wpm - Words per minute (word-boundary keystrokes normalized to per-minute)
 * @property rhythmRegularity - Normalized regularity of inter-keystroke intervals (0 = erratic, 1 = steady)
 * @property backspaceRate - Ratio of backspace keystrokes to total keystrokes (0–1)
 * @property isPaused - True when no keystrokes received for >3 seconds
 * @property isTyping - True when keystrokes received within the last 5 seconds
 */
export interface TypingDynamics {
  wpm: number;
  rhythmRegularity: number;
  backspaceRate: number;
  isPaused: boolean;
  isTyping: boolean;
}

const DEFAULT_DYNAMICS: TypingDynamics = {
  wpm: 0,
  rhythmRegularity: 0,
  backspaceRate: 0,
  isPaused: true,
  isTyping: false,
};

const WINDOW_MS = 30_000; // 30-second rolling window
const PAUSE_THRESHOLD_MS = 3_000; // >3s = paused
const TYPING_THRESHOLD_MS = 5_000; // within 5s = isTyping
const BUFFER_CAPACITY = 900; // ~900 events max at fast typing in 30s
const FRAME_INTERVAL_MS = 1000 / 30; // 30 FPS throttle (~33ms)

// Average word length in English is ~5 characters + space = 6 keystrokes per word
const KEYSTROKES_PER_WORD = 6;

/**
 * Analyzes keystroke patterns on an editor element and exposes real-time typing dynamics.
 *
 * Attaches passive `keydown` listeners to the referenced element and computes
 * WPM, rhythm regularity, backspace rate, pause state, and typing state
 * over a 30-second rolling window. Updates are throttled to 30 FPS via
 * `requestAnimationFrame` to avoid render storms.
 *
 * Uses `useRef` for the mutable circular buffer — individual keystrokes
 * do not trigger React re-renders.
 *
 * @param editorRef - Ref to the editor DOM element to monitor
 * @returns Current typing dynamics (updated at 30 FPS)
 *
 * @example
 * ```tsx
 * const editorRef = useRef<HTMLDivElement>(null);
 * const dynamics = useTypingDynamics(editorRef);
 * // dynamics.wpm, dynamics.rhythmRegularity, etc.
 * ```
 */
export function useTypingDynamics(
  editorRef: React.RefObject<HTMLElement | null>
): TypingDynamics {
  const bufferRef = useRef<KeystrokeEvent[]>([]);
  const bufferIndexRef = useRef(0);
  const bufferCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafIdRef = useRef(0);

  const [dynamics, setDynamics] = useState<TypingDynamics>(DEFAULT_DYNAMICS);

  // Stable ref for the handler to avoid re-attaching listeners
  const handlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;

    // Initialize buffer
    const buffer: KeystrokeEvent[] = new Array(BUFFER_CAPACITY);
    bufferRef.current = buffer;
    bufferIndexRef.current = 0;
    bufferCountRef.current = 0;

    // --- Circular buffer helpers ---
    function pushEvent(event: KeystrokeEvent): void {
      buffer[bufferIndexRef.current] = event;
      bufferIndexRef.current = (bufferIndexRef.current + 1) % BUFFER_CAPACITY;
      if (bufferCountRef.current < BUFFER_CAPACITY) {
        bufferCountRef.current++;
      }
    }

    function getEvents(): KeystrokeEvent[] {
      const count = bufferCountRef.current;
      if (count === 0) return [];

      const result: KeystrokeEvent[] = [];
      const startIdx =
        count < BUFFER_CAPACITY
          ? 0
          : bufferIndexRef.current; // oldest element when buffer is full

      for (let i = 0; i < count; i++) {
        result.push(buffer[(startIdx + i) % BUFFER_CAPACITY]);
      }
      return result;
    }

    function evictOlderThan(cutoff: number): void {
      // Remove events older than cutoff from the logical start
      const events = getEvents();
      let removed = 0;
      for (let i = 0; i < events.length; i++) {
        if (events[i].timestamp < cutoff) {
          removed++;
        } else {
          break; // Events are in chronological order
        }
      }
      if (removed > 0) {
        bufferCountRef.current = Math.max(0, bufferCountRef.current - removed);
        // Advance the logical start by adjusting the index
        if (bufferCountRef.current === 0) {
          bufferIndexRef.current = 0;
        }
      }
    }

    // --- Metrics computation ---
    function computeMetrics(): TypingDynamics {
      const now = performance.now();
      const cutoff = now - WINDOW_MS;
      evictOlderThan(cutoff);

      const events = getEvents();
      const totalKeystrokes = events.length;

      if (totalKeystrokes === 0) {
        return DEFAULT_DYNAMICS;
      }

      const lastEvent = events[events.length - 1];
      const timeSinceLast = now - lastEvent.timestamp;
      const isPaused = timeSinceLast > PAUSE_THRESHOLD_MS;
      const isTyping = timeSinceLast <= TYPING_THRESHOLD_MS;

      // WPM: total non-backspace keystrokes in window, normalized to per-minute
      const nonBackspaceCount = events.filter((e) => !e.isBackspace).length;
      const windowDurationMs = Math.max(
        now - events[0].timestamp,
        1 // avoid division by zero
      );
      const windowDurationMin = windowDurationMs / 60_000;
      const wpm =
        windowDurationMin > 0
          ? nonBackspaceCount / KEYSTROKES_PER_WORD / windowDurationMin
          : 0;

      // Backspace rate
      const backspaceCount = totalKeystrokes - nonBackspaceCount;
      const backspaceRate = Math.min(
        1,
        Math.max(0, backspaceCount / totalKeystrokes)
      );

      // Rhythm regularity: normalized std dev of inter-keystroke intervals
      let rhythmRegularity = 0;
      if (totalKeystrokes >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < events.length; i++) {
          const interval = events[i].timestamp - events[i - 1].timestamp;
          // Only count intervals within reasonable typing range (< 2s)
          if (interval < 2000) {
            intervals.push(interval);
          }
        }

        if (intervals.length >= 2) {
          const mean =
            intervals.reduce((sum, v) => sum + v, 0) / intervals.length;

          if (mean > 0) {
            const variance =
              intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
              intervals.length;
            const stdDev = Math.sqrt(variance);

            // Coefficient of variation (CV) — lower = more regular
            const cv = stdDev / mean;

            // Map CV to 0-1 range: CV=0 → regularity=1, CV>=2 → regularity≈0
            // Using exponential decay: e^(-cv)
            rhythmRegularity = Math.exp(-cv);
          }
        }
      }

      return {
        wpm: Math.round(wpm * 10) / 10, // 1 decimal place
        rhythmRegularity: Math.round(rhythmRegularity * 1000) / 1000,
        backspaceRate: Math.round(backspaceRate * 1000) / 1000,
        isPaused,
        isTyping,
      };
    }

    // --- Keystroke handler (passive) ---
    const onKeyDown = (e: KeyboardEvent): void => {
      const isBackspace =
        e.key === 'Backspace' || e.key === 'Delete';
      pushEvent({
        timestamp: performance.now(),
        isBackspace,
      });
    };

    handlerRef.current = onKeyDown;
    element.addEventListener('keydown', onKeyDown, { passive: true });

    // --- Animation loop (30 FPS throttled) ---
    let isActive = true;

    function animationLoop(timestamp: number): void {
      if (!isActive) return;

      if (timestamp - lastFrameTimeRef.current >= FRAME_INTERVAL_MS) {
        lastFrameTimeRef.current = timestamp;
        const newDynamics = computeMetrics();
        setDynamics(newDynamics);
      }

      rafIdRef.current = requestAnimationFrame(animationLoop);
    }

    rafIdRef.current = requestAnimationFrame(animationLoop);

    // --- Cleanup ---
    return () => {
      isActive = false;
      element.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(rafIdRef.current);
      bufferCountRef.current = 0;
      bufferIndexRef.current = 0;
    };
  }, [editorRef]);

  return dynamics;
}
