import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SK } from '@/lib/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { STICKER_CATEGORIES, DEFAULT_STICKER_PACK_PREFS } from './stickerUtils';
import type { StickerCategory, StickerPackPrefs } from './stickerUtils';

export function useStickerPacks() {
  const [prefs, setPrefs] = useState<StickerPackPrefs>(() => {
    const stored = safeLocalStorageGet<StickerPackPrefs>(SK.JOURNAL_STICKER_PACKS, null);
    if (!stored) return DEFAULT_STICKER_PACK_PREFS;
    // Merge with defaults to handle newly added packs
    return {
      enabled: { ...DEFAULT_STICKER_PACK_PREFS.enabled, ...stored.enabled },
      seen: { ...DEFAULT_STICKER_PACK_PREFS.seen, ...stored.seen },
    };
  });

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  const persist = useCallback((next: StickerPackPrefs) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      safeLocalStorageSet(SK.JOURNAL_STICKER_PACKS, next);
    }, 300);
  }, []);

  const togglePack = useCallback((key: string) => {
    setPrefs(prev => {
      // Guard: prevent disabling last enabled pack
      const enabledCount = Object.values(prev.enabled).filter(Boolean).length;
      if (prev.enabled[key] && enabledCount <= 1) return prev;

      const next: StickerPackPrefs = {
        enabled: { ...prev.enabled, [key]: !prev.enabled[key] },
        seen: { ...prev.seen, [key]: true },
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const markSeen = useCallback((key: string) => {
    setPrefs(prev => {
      if (prev.seen[key]) return prev;
      const next: StickerPackPrefs = {
        ...prev,
        seen: { ...prev.seen, [key]: true },
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const isNew = useCallback((key: string) => !prefs.seen[key], [prefs.seen]);

  const enabledCategories: StickerCategory[] = useMemo(
    () => STICKER_CATEGORIES.filter(c => prefs.enabled[c.key]),
    [prefs.enabled],
  );

  const enabledCount = useMemo(
    () => Object.values(prefs.enabled).filter(Boolean).length,
    [prefs.enabled],
  );

  return useMemo(() => ({
    prefs,
    enabledCategories,
    enabledCount,
    togglePack,
    markSeen,
    isNew,
  }), [prefs, enabledCategories, enabledCount, togglePack, markSeen, isNew]);
}
