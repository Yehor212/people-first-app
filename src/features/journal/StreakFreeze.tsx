import { memo, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { springs } from "@/config/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { getToday } from "@/lib/utils";
import { shiftJournalDate } from "./journalDateUtils";

// --- Types ---

interface FreezeData {
  used: string[];
  earned: number;
}

const STORAGE_KEY = SK.JOURNAL_STREAK_FREEZES;
const MAX_FREEZES = 3;
const DAYS_PER_FREEZE = 7;
const RETENTION_DAYS = 30;

// --- Helpers ---

function loadFreezeData(): FreezeData {
  const raw = storageGetRaw(STORAGE_KEY, "");
  if (!raw) return { used: [], earned: 0 };
  try {
    const parsed = JSON.parse(raw) as FreezeData;
    if (!Array.isArray(parsed.used)) return { used: [], earned: 0 };
    return parsed;
  } catch {
    return { used: [], earned: 0 };
  }
}

function saveFreezeData(data: FreezeData): void {
  storageSetRaw(STORAGE_KEY, JSON.stringify(data));
}

function recentUsed(used: string[], currentDay = getToday()): string[] {
  const cutoffStr = shiftJournalDate(currentDay, -RETENTION_DAYS);
  return used.filter((d) => d >= cutoffStr);
}

// --- Hook ---

export function useStreakFreeze(
  streak: number,
  lastEntryDate: string | null,
  currentDay = getToday(),
) {
  const [data, setData] = useState<FreezeData>(loadFreezeData);

  const earned = Math.min(Math.floor(streak / DAYS_PER_FREEZE), MAX_FREEZES);
  const recent = useMemo(() => recentUsed(data.used, currentDay), [currentDay, data.used]);
  const availableFreezes = Math.max(earned - recent.length, 0);
  const isStreakFrozen = recent.includes(currentDay);

  const activateFreeze = useCallback(() => {
    if (recent.includes(currentDay) || availableFreezes <= 0) return;
    const next: FreezeData = { used: [...recent, currentDay], earned };
    saveFreezeData(next);
    setData(next);
  }, [availableFreezes, currentDay, earned, recent]);

  const autoCheckFreeze = useCallback((): boolean => {
    const y = shiftJournalDate(currentDay, -1);
    if (lastEntryDate === y || availableFreezes <= 0) return false;
    if (recent.includes(y)) return true;
    const next: FreezeData = { used: [...recent, y], earned };
    saveFreezeData(next);
    setData(next);
    return true;
  }, [availableFreezes, currentDay, earned, lastEntryDate, recent]);

  return { availableFreezes, usedFreezes: recent.length, isStreakFrozen, activateFreeze, autoCheckFreeze };
}

// --- Component ---

interface StreakFreezeIndicatorProps {
  availableFreezes: number;
  isStreakFrozen: boolean;
}

export const StreakFreezeIndicator = memo(function StreakFreezeIndicator({
  availableFreezes,
  isStreakFrozen,
}: StreakFreezeIndicatorProps) {
  const reducedMotion = !useShouldAnimate();
  const { t } = useLanguage();

  if (!isStreakFrozen && availableFreezes <= 0) return null;

  if (isStreakFrozen) {
    return (
      <motion.span
        aria-label={t.journalStreakFrozenToday || "Streak protected today"}
        animate={reducedMotion ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ ...springs.smooth, duration: 3, repeat: Infinity }}
        className="inline-flex items-center text-sm"
      >
        <span role="img" aria-hidden="true">&#10052;&#65039;</span>
      </motion.span>
    );
  }

  return (
    <span
      aria-label={(t.journalStreakFreezesAvailable || "{count} protections available").replace(
        "{count}",
        String(availableFreezes),
      )}
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
    >
      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{availableFreezes}</span>
    </span>
  );
});
