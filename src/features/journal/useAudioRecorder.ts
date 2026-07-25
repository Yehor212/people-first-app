import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MAX_AUDIO_DURATION_SEC } from './types';
import { logger } from '@/lib/logger';
import { isNative } from '@/lib/platform';

export type RecordedAudioCapture = {
  data: string;
  duration: number;
  mimeType: string;
};

const AUDIO_FINALIZATION_TIMEOUT_MS = 15_000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Get the best supported audio MIME type */
function getAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return null;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('audio/webm');
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseMsRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');
  const pendingCaptureRef = useRef<Promise<RecordedAudioCapture | null> | null>(null);
  const lastCompletedCaptureRef = useRef<RecordedAudioCapture | null>(null);
  const startRequestGenerationRef = useRef(0);
  const stopCompletionRef = useRef<{
    discard: boolean;
    duration: number;
    mimeType: string;
    settled: boolean;
    timeoutId: ReturnType<typeof setTimeout> | null;
    reject: (error: unknown) => void;
    resolve: (capture: RecordedAudioCapture | null) => void;
  } | null>(null);

  const isSupported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Auto-clear error message after 3s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const cancelPendingStart = useCallback(() => {
    startRequestGenerationRef.current += 1;
    setIsRequestingPermission(false);
  }, []);

  const stopActiveRecording = useCallback((options: { discard?: boolean } = {}): Promise<RecordedAudioCapture | null> => {
    cancelPendingStart();
    const recorder = mediaRecorderRef.current;
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) {
      const activeSegmentMs = recorder.state === 'recording'
        ? Math.max(0, Date.now() - startTimeRef.current)
        : 0;
      const elapsed = Math.min(
        MAX_AUDIO_DURATION_SEC,
        Math.max(durationRef.current, Math.floor((elapsedBeforePauseMsRef.current + activeSegmentMs) / 1000))
      );
      const stopped = new Promise<RecordedAudioCapture | null>((resolve, reject) => {
        const completion = {
          discard: options.discard === true,
          duration: elapsed,
          mimeType: mimeTypeRef.current,
          settled: false,
          timeoutId: null as ReturnType<typeof setTimeout> | null,
          reject,
          resolve,
        };
        stopCompletionRef.current = completion;
        completion.timeoutId = setTimeout(() => {
          if (completion.settled) return;
          completion.settled = true;
          if (stopCompletionRef.current === completion) stopCompletionRef.current = null;
          chunksRef.current = [];
          setError('Recording failed');
          setIsFinalizing(false);
          completion.reject(new Error('Recording finalization timed out'));
        }, AUDIO_FINALIZATION_TIMEOUT_MS);
      });
      const pending = stopped.finally(() => {
        if (pendingCaptureRef.current === pending) {
          pendingCaptureRef.current = null;
        }
      });
      pendingCaptureRef.current = pending;
      setIsFinalizing(true);
      recorder.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return pending;
    }

    if (options.discard && pendingCaptureRef.current) {
      if (stopCompletionRef.current) stopCompletionRef.current.discard = true;
      lastCompletedCaptureRef.current = null;
      setAudioData(null);
      return Promise.resolve(null);
    }
    if (!options.discard && pendingCaptureRef.current) return pendingCaptureRef.current;
    if (!options.discard && lastCompletedCaptureRef.current) {
      return Promise.resolve(lastCompletedCaptureRef.current);
    }

    if (options.discard) {
      lastCompletedCaptureRef.current = null;
      setAudioData(null);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    setIsFinalizing(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return Promise.resolve(null);
  }, [cancelPendingStart]);

  const start = useCallback(async () => {
    const requestGeneration = startRequestGenerationRef.current + 1;
    startRequestGenerationRef.current = requestGeneration;
    setIsRequestingPermission(true);
    setError(null);
    setAudioData(null);
    setDuration(0);
    setIsFinalizing(false);
    durationRef.current = 0;
    elapsedBeforePauseMsRef.current = 0;
    pendingCaptureRef.current = null;
    lastCompletedCaptureRef.current = null;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      if (startRequestGenerationRef.current !== requestGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setIsRequestingPermission(false);
      streamRef.current = stream;

      const preferredMime = getAudioMimeType();
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 64000,
        ...(preferredMime ? { mimeType: preferredMime } : {}),
      };
      const recorder = new MediaRecorder(stream, recorderOptions);
      const recordedMime = recorder.mimeType || preferredMime || 'audio/webm';
      const cleanMime = recordedMime.split(';')[0];
      setMimeType(cleanMime);
      mimeTypeRef.current = cleanMime;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const completion = stopCompletionRef.current;
        try {
          if (!completion || completion.settled) return;
          if (completion?.discard) {
            chunksRef.current = [];
            lastCompletedCaptureRef.current = null;
            setAudioData(null);
            completion.settled = true;
            if (completion.timeoutId) clearTimeout(completion.timeoutId);
            completion.resolve(null);
            return;
          }

          const blob = new Blob(chunksRef.current, { type: recordedMime });
          if (blob.size === 0) {
            throw new Error('Recording produced no audio data');
          }
          const base64 = await blobToBase64(blob);
          if (completion.settled) return;
          if (completion.discard) {
            lastCompletedCaptureRef.current = null;
            setAudioData(null);
            completion.settled = true;
            if (completion.timeoutId) clearTimeout(completion.timeoutId);
            completion.resolve(null);
            return;
          }
          const captureDuration = completion?.duration ?? durationRef.current;
          const captureMimeType = completion?.mimeType ?? mimeTypeRef.current;
          setAudioData(base64);
          const capture = {
            data: base64,
            duration: captureDuration,
            mimeType: captureMimeType,
          };
          lastCompletedCaptureRef.current = capture;
          completion.settled = true;
          if (completion.timeoutId) clearTimeout(completion.timeoutId);
          completion.resolve({
            data: capture.data,
            duration: capture.duration,
            mimeType: capture.mimeType,
          });
        } catch (err) {
          if (!completion || completion.settled) return;
          completion.settled = true;
          if (completion.timeoutId) clearTimeout(completion.timeoutId);
          if (completion.discard) {
            completion.resolve(null);
          } else {
            setError('Recording failed');
            completion.reject(err);
          }
        } finally {
          chunksRef.current = [];
          if (stopCompletionRef.current === completion) stopCompletionRef.current = null;
          if (!completion || completion.settled) setIsFinalizing(false);
          // Cleanup stream when it was not already stopped by an explicit stop call.
          if (streamRef.current === stream) {
            stream.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      recorder.onerror = () => {
        setError('Recording failed');
        setIsRecording(false);
        setIsFinalizing(false);
        const completion = stopCompletionRef.current;
        if (completion && !completion.settled) {
          completion.settled = true;
          if (completion.timeoutId) clearTimeout(completion.timeoutId);
          completion.reject(new Error('Recording failed'));
        }
        stopCompletionRef.current = null;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (elapsedBeforePauseMsRef.current + Math.max(0, Date.now() - startTimeRef.current)) / 1000
        );
        durationRef.current = elapsed;
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= MAX_AUDIO_DURATION_SEC) {
          void stopActiveRecording().catch((err) =>
            logger.warn('[useAudioRecorder] Max-duration stop failed:', err)
          );
        }
      }, 1000);
    } catch (err) {
      if (startRequestGenerationRef.current !== requestGeneration) return;
      setIsRequestingPermission(false);
      const errorName =
        typeof err === 'object' && err !== null && 'name' in err ? String(err.name) : '';
      const permissionDenied =
        ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(errorName);
      setError(permissionDenied ? 'Microphone access denied' : 'Microphone start failed');
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      logger.error('[useAudioRecorder] Microphone could not start:', err);
      throw err;
    }
  }, [stopActiveRecording]);

  const stop = useCallback(() => stopActiveRecording(), [stopActiveRecording]);
  const discard = useCallback(() => stopActiveRecording({ discard: true }), [stopActiveRecording]);
  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    elapsedBeforePauseMsRef.current += Math.max(0, Date.now() - startTimeRef.current);
    recorder.pause();
    const elapsed = Math.min(
      MAX_AUDIO_DURATION_SEC,
      Math.floor(elapsedBeforePauseMsRef.current / 1000)
    );
    durationRef.current = elapsed;
    setDuration(elapsed);
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    startTimeRef.current = Date.now();
    setIsPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (elapsedBeforePauseMsRef.current + Math.max(0, Date.now() - startTimeRef.current)) / 1000
      );
      durationRef.current = elapsed;
      setDuration(elapsed);
      if (elapsed >= MAX_AUDIO_DURATION_SEC) {
        void stopActiveRecording().catch((err) =>
          logger.warn('[useAudioRecorder] Max-duration stop failed:', err)
        );
      }
    }, 1000);
  }, [stopActiveRecording]);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.hidden) {
        void stopActiveRecording().catch((err) =>
          logger.warn('[useAudioRecorder] Hidden-page stop failed:', err)
        );
      }
    };

    const stopOnPageHide = () => {
      void stopActiveRecording().catch((err) =>
        logger.warn('[useAudioRecorder] Pagehide stop failed:', err)
      );
    };

    document.addEventListener('visibilitychange', stopOnHidden);
    window.addEventListener('pagehide', stopOnPageHide);

    return () => {
      document.removeEventListener('visibilitychange', stopOnHidden);
      window.removeEventListener('pagehide', stopOnPageHide);
    };
  }, [stopActiveRecording]);

  useEffect(() => {
    if (!isNative) return undefined;

    let cancelled = false;
    let removePause: (() => void) | null = null;

    void import('@capacitor/app')
      .then(async ({ App }) => {
        const listener = await App.addListener('pause', () => {
          void stopActiveRecording().catch((err) =>
            logger.warn('[useAudioRecorder] Native pause stop failed:', err)
          );
        });
        if (cancelled) {
          void listener.remove();
        } else {
          removePause = () => { void listener.remove(); };
        }
      })
      .catch((err) => logger.warn('[useAudioRecorder] Native pause listener unavailable:', err));

    return () => {
      cancelled = true;
      removePause?.();
    };
  }, [stopActiveRecording]);

  const reset = useCallback(() => {
    cancelPendingStart();
    setAudioData(null);
    setDuration(0);
    setIsPaused(false);
    setError(null);
    setIsFinalizing(false);
    pendingCaptureRef.current = null;
    lastCompletedCaptureRef.current = null;
    chunksRef.current = [];
  }, [cancelPendingStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPendingStart();
      if (
        mediaRecorderRef.current?.state === 'recording' ||
        mediaRecorderRef.current?.state === 'paused'
      ) {
        // Preserve the capture long enough for the editor teardown to link it
        // into the encrypted recovery draft.
        void stopActiveRecording();
      } else {
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cancelPendingStart, stopActiveRecording]);

  return useMemo(() => ({
    isRecording, isPaused, isFinalizing, isRequestingPermission, duration, audioData, mimeType, isSupported, error, start, pause, resume, stop, discard, reset,
  }), [isRecording, isPaused, isFinalizing, isRequestingPermission, duration, audioData, mimeType, isSupported, error, start, pause, resume, stop, discard, reset]);
}
