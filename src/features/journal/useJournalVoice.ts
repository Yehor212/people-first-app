import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';

/** BCP-47 locale map for Speech Recognition */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ar: 'ar-SA',
  he: 'he-IL',
};

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionType = {
  new(): {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  };
};

function getSpeechRecognition(): SpeechRecognitionType | null {
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition || win.webkitSpeechRecognition) as SpeechRecognitionType | null;
}

export function useJournalVoice(language: string) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ReturnType<SpeechRecognitionType['prototype']['constructor']> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef('');
  const pendingStopRef = useRef<{
    promise: Promise<string>;
    resolve: (value: string) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);

  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognition();

  // Auto-clear error message after 3s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const settlePendingStop = useCallback(() => {
    const pending = pendingStopRef.current;
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingStopRef.current = null;
    pending.resolve(transcriptRef.current);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    setError(null);
    setTranscript('');
    transcriptRef.current = '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LOCALE_MAP[language] || 'en-US';

    const scheduleSilenceStop = () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 60000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcriptParts: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        transcriptParts.push(result[0].transcript);
      }
      const nextTranscript = transcriptParts.join('').trim();
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
      scheduleSilenceStop();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        setError(event.error);
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      settlePendingStop();
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      settlePendingStop();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      scheduleSilenceStop();
    } catch {
      recognitionRef.current = null;
      setError('Failed to start speech recognition');
      setIsListening(false);
      settlePendingStop();
    }
  }, [language, settlePendingStop]);

  const stop = useCallback((): Promise<string> => {
    if (pendingStopRef.current) return pendingStopRef.current.promise;
    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return Promise.resolve(transcriptRef.current);
    }

    let resolveStop!: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolveStop = resolve;
    });
    const timeout = setTimeout(() => {
      try {
        recognition.abort();
      } catch {
        // The recognition service may already have terminated without firing onend.
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      settlePendingStop();
    }, 1500);
    pendingStopRef.current = { promise, resolve: resolveStop, timeout };

    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    try {
      recognition.stop();
    } catch {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      settlePendingStop();
    }
    return promise;
  }, [settlePendingStop]);

  useEffect(() => {
    const stopForBackground = () => {
      void stop().catch((err) =>
        logger.warn('[useJournalVoice] Background dictation stop failed:', err)
      );
    };
    const stopWhenHidden = () => {
      if (document.hidden) stopForBackground();
    };

    document.addEventListener('visibilitychange', stopWhenHidden);
    window.addEventListener('pagehide', stopForBackground);

    let cancelled = false;
    let removePause: (() => void) | null = null;
    if (isNative) {
      void import('@capacitor/app')
        .then(async ({ App }) => {
          const listener = await App.addListener('pause', stopForBackground);
          if (cancelled) {
            void listener.remove();
          } else {
            removePause = () => { void listener.remove(); };
          }
        })
        .catch((err) =>
          logger.warn('[useJournalVoice] Native pause listener unavailable:', err)
        );
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', stopWhenHidden);
      window.removeEventListener('pagehide', stopForBackground);
      removePause?.();
    };
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      settlePendingStop();
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, [settlePendingStop]);

  return useMemo(() => ({
    isListening, transcript, isSupported, error, start, stop,
  }), [isListening, transcript, isSupported, error, start, stop]);
}
