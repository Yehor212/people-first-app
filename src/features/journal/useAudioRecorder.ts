import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MAX_AUDIO_DURATION_SEC } from './types';
import { logger } from '@/lib/logger';
import { isNative } from '@/lib/platform';

export type RecordedAudioCapture = {
  data: string;
  duration: number;
  mimeType: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Get the best supported audio MIME type */
function getAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return 'audio/webm';
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('audio/webm');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');
  const pendingCaptureRef = useRef<Promise<RecordedAudioCapture | null> | null>(null);
  const lastCompletedCaptureRef = useRef<RecordedAudioCapture | null>(null);
  const stopCompletionRef = useRef<{
    discard: boolean;
    duration: number;
    mimeType: string;
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

  const stopActiveRecording = useCallback((options: { discard?: boolean } = {}): Promise<RecordedAudioCapture | null> => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      const elapsed = Math.max(
        durationRef.current,
        Math.floor((Date.now() - startTimeRef.current) / 1000)
      );
      const stopped = new Promise<RecordedAudioCapture | null>((resolve, reject) => {
        stopCompletionRef.current = {
          discard: options.discard === true,
          duration: elapsed,
          mimeType: mimeTypeRef.current,
          reject,
          resolve,
        };
      });
      const pending = stopped.finally(() => {
        if (pendingCaptureRef.current === pending) {
          pendingCaptureRef.current = null;
        }
      });
      pendingCaptureRef.current = pending;
      recorder.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return pending;
    }

    if (!options.discard && pendingCaptureRef.current) return pendingCaptureRef.current;
    if (!options.discard && lastCompletedCaptureRef.current) {
      return Promise.resolve(lastCompletedCaptureRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return Promise.resolve(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioData(null);
    setDuration(0);
    durationRef.current = 0;
    pendingCaptureRef.current = null;
    lastCompletedCaptureRef.current = null;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      const mime = getAudioMimeType();
      const cleanMime = mime.split(';')[0];
      setMimeType(cleanMime); // Store clean mime type
      mimeTypeRef.current = cleanMime;

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const completion = stopCompletionRef.current;
        try {
          if (completion?.discard) {
            chunksRef.current = [];
            lastCompletedCaptureRef.current = null;
            setAudioData(null);
            completion.resolve(null);
            return;
          }

          const blob = new Blob(chunksRef.current, { type: mime });
          const base64 = await blobToBase64(blob);
          const captureDuration = completion?.duration ?? durationRef.current;
          const captureMimeType = completion?.mimeType ?? mimeTypeRef.current;
          setAudioData(base64);
          const capture = {
            data: base64,
            duration: captureDuration,
            mimeType: captureMimeType,
          };
          lastCompletedCaptureRef.current = capture;
          completion?.resolve({
            data: capture.data,
            duration: capture.duration,
            mimeType: capture.mimeType,
          });
        } catch (err) {
          setError('Recording failed');
          stopCompletionRef.current?.reject(err);
        } finally {
          chunksRef.current = [];
          stopCompletionRef.current = null;
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
        stopCompletionRef.current?.reject(new Error('Recording failed'));
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

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
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
      setError('Microphone access denied');
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      logger.error('[useAudioRecorder] Microphone access denied:', err);
      throw err;
    }
  }, [stopActiveRecording]);

  const stop = useCallback(() => stopActiveRecording(), [stopActiveRecording]);
  const discard = useCallback(() => stopActiveRecording({ discard: true }), [stopActiveRecording]);

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
    setAudioData(null);
    setDuration(0);
    setError(null);
    pendingCaptureRef.current = null;
    lastCompletedCaptureRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopActiveRecording({ discard: true });
      if (timerRef.current) clearInterval(timerRef.current);
      chunksRef.current = [];
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopActiveRecording]);

  return useMemo(() => ({
    isRecording, duration, audioData, mimeType, isSupported, error, start, stop, discard, reset,
  }), [isRecording, duration, audioData, mimeType, isSupported, error, start, stop, discard, reset]);
}
