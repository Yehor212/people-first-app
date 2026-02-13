import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { MAX_AUDIO_DURATION_SEC } from './types';
import { logger } from '@/lib/logger';

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

  const isSupported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  // Auto-clear error message after 3s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const start = useCallback(async () => {
    setError(null);
    setAudioData(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      const mime = getAudioMimeType();
      setMimeType(mime.split(';')[0]); // Store clean mime type

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 64000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const base64 = await blobToBase64(blob);
        setAudioData(base64);

        // Cleanup stream
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      recorder.onerror = () => {
        setError('Recording failed');
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= MAX_AUDIO_DURATION_SEC) {
          recorder.stop();
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 1000);
    } catch (err) {
      setError('Microphone access denied');
      logger.error('[useAudioRecorder] Microphone access denied:', err);
      toast.error('Microphone access denied');
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setAudioData(null);
    setDuration(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { isRecording, duration, audioData, mimeType, isSupported, error, start, stop, reset };
}
