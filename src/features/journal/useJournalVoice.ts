import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

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

  const isSupported = typeof window !== 'undefined' && !!getSpeechRecognition();

  // Auto-clear error message after 3s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    setError(null);
    setTranscript('');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LOCALE_MAP[language] || 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(prev => prev + finalTranscript + (interimTranscript ? ` ${interimTranscript}` : ''));

      // Reset auto-stop timer on activity
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 60000); // Auto-stop after 60s silence
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        setError(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setError('Failed to start speech recognition');
    }
  }, [language]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    isListening, transcript, isSupported, error, start, stop,
  }), [isListening, transcript, isSupported, error, start, stop]);
}
