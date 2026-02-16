/**
 * useShareFlow - State machine hook for share card generation and actions
 */

import { useReducer, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { downloadImage, shareImage, copyImageToClipboard } from '@/lib/shareActions';
import { hapticSuccess, hapticTap } from '@/lib/haptics';

// ============================================
// TYPES
// ============================================

type ShareStatus = 'idle' | 'generating' | 'preview' | 'error' | 'success';
type ShareAction = 'download' | 'copy' | 'share';

interface ShareState {
  status: ShareStatus;
  imageBlob: Blob | null;
  imageUrl: string | null;
  error: string | null;
  lastAction: ShareAction | null;
}

type ShareEvent =
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_SUCCESS'; blob: Blob; url: string }
  | { type: 'GENERATE_ERROR'; error: string }
  | { type: 'ACTION_SUCCESS'; action: ShareAction }
  | { type: 'CLEAR_SUCCESS' }
  | { type: 'RESET' };

function shareReducer(state: ShareState, event: ShareEvent): ShareState {
  switch (event.type) {
    case 'GENERATE_START':
      return { ...state, status: 'generating', error: null };
    case 'GENERATE_SUCCESS':
      return { ...state, status: 'preview', imageBlob: event.blob, imageUrl: event.url, error: null };
    case 'GENERATE_ERROR':
      return { ...state, status: 'error', error: event.error };
    case 'ACTION_SUCCESS':
      return { ...state, status: 'success', lastAction: event.action };
    case 'CLEAR_SUCCESS':
      return { ...state, status: 'preview', lastAction: null };
    case 'RESET':
      return { status: 'idle', imageBlob: null, imageUrl: null, error: null, lastAction: null };
    default:
      return state;
  }
}

const INITIAL_STATE: ShareState = {
  status: 'idle',
  imageBlob: null,
  imageUrl: null,
  error: null,
  lastAction: null,
};

// ============================================
// HOOK
// ============================================

interface UseShareFlowOptions {
  open: boolean;
  generateFn: () => Promise<Blob>;
  errorMessage: string;
}

export function useShareFlow({ open, generateFn, errorMessage }: UseShareFlowOptions) {
  const [state, dispatch] = useReducer(shareReducer, INITIAL_STATE);
  const isMountedRef = useRef(true);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThrottleRef = useRef<Record<string, number>>({});
  const genIdRef = useRef(0);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Cleanup success timer
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Auto-generate on open, reset on close
  useEffect(() => {
    if (!open) {
      // Cleanup object URL
      if (state.imageUrl) {
        URL.revokeObjectURL(state.imageUrl);
      }
      // Clear any pending success timer (M6)
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      // Invalidate any in-flight generation (H2)
      genIdRef.current++;
      dispatch({ type: 'RESET' });
      return;
    }

    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: generate only on open, not during generation
  }, [open]);

  const generate = useCallback(async () => {
    // Revoke old URL to prevent leak on retry (H1)
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    const id = ++genIdRef.current;
    dispatch({ type: 'GENERATE_START' });
    try {
      const blob = await generateFn();
      // Abort if unmounted or a newer generation started (H2)
      if (!isMountedRef.current || id !== genIdRef.current) return;
      const url = URL.createObjectURL(blob);
      dispatch({ type: 'GENERATE_SUCCESS', blob, url });
    } catch (error) {
      if (!isMountedRef.current || id !== genIdRef.current) return;
      logger.error('[useShareFlow] Generation failed:', error);
      dispatch({ type: 'GENERATE_ERROR', error: errorMessage });
    }
  }, [generateFn, errorMessage, state.imageUrl]);

  const startSuccessTimer = useCallback(() => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) dispatch({ type: 'CLEAR_SUCCESS' });
    }, 2000);
  }, []);

  const throttle = useCallback((key: string): boolean => {
    const now = Date.now();
    if (now - (lastThrottleRef.current[key] || 0) < 1000) return false;
    lastThrottleRef.current[key] = now;
    return true;
  }, []);

  const download = useCallback((filename: string) => {
    if (!state.imageBlob || !throttle('download')) return;
    void hapticTap();
    downloadImage(state.imageBlob, filename);
    dispatch({ type: 'ACTION_SUCCESS', action: 'download' });
    startSuccessTimer();
  }, [state.imageBlob, throttle, startSuccessTimer]);

  const copy = useCallback(async () => {
    if (!state.imageBlob || !throttle('copy')) return;
    void hapticTap();
    try {
      const success = await copyImageToClipboard(state.imageBlob);
      if (!isMountedRef.current) return;
      if (success) {
        void hapticSuccess();
        dispatch({ type: 'ACTION_SUCCESS', action: 'copy' });
        startSuccessTimer();
      }
    } catch (error) {
      logger.error('[useShareFlow] Copy failed:', error);
    }
  }, [state.imageBlob, throttle, startSuccessTimer]);

  const share = useCallback(async (title: string, text?: string) => {
    if (!state.imageBlob || !throttle('share')) return;
    void hapticTap();
    try {
      const success = await shareImage(state.imageBlob, title, text);
      if (!isMountedRef.current) return;
      if (success) {
        void hapticSuccess();
        dispatch({ type: 'ACTION_SUCCESS', action: 'share' });
        startSuccessTimer();
      }
    } catch (error) {
      logger.error('[useShareFlow] Share failed:', error);
    }
  }, [state.imageBlob, throttle, startSuccessTimer]);

  return {
    status: state.status,
    imageUrl: state.imageUrl,
    imageBlob: state.imageBlob,
    error: state.error,
    lastAction: state.lastAction,
    generate,
    download,
    copy,
    share,
  };
}
