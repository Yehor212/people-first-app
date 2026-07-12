import { memo, useState, useCallback, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield } from "lucide-react";
import { springs } from "@/config/animations";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

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

function recentUsed(used: string[]): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return used.filter((d) => d >= cutoffStr);
}

// --- Hook ---

export function useStreakFreeze(streak: number, lastEntryDate: string | null) {
  const [data, setData] = useState<FreezeData>(loadFreezeData);

  const earned = Math.min(Math.floor(streak / DAYS_PER_FREEZE), MAX_FREEZES);
  const recent = useMemo(() => recentUsed(data.used), [data.used]);
  const availableFreezes = Math.max(earned - recent.length, 0);
  const isStreakFrozen = recent.includes(today());

  const activateFreeze = useCallback(() => {
    const t = today();
    if (recent.includes(t) || availableFreezes <= 0) return;
    const next: FreezeData = { used: [...recent, t], earned };
    saveFreezeData(next);
    setData(next);
  }, [recent, availableFreezes, earned]);

  const autoCheckFreeze = useCallback((): boolean => {
    const y = yesterday();
    if (lastEntryDate === y || availableFreezes <= 0) return false;
    if (recent.includes(y)) return true;
    const next: FreezeData = { used: [...recent, y], earned };
    saveFreezeData(next);
    setData(next);
    return true;
  }, [lastEntryDate, availableFreezes, recent, earned]);

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
  const reducedMotion = useReducedMotion();

  if (!isStreakFrozen && availableFreezes <= 0) return null;

  if (isStreakFrozen) {
    return (
      <motion.span
        aria-label="Streak frozen today"
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
      aria-label={`Streak freeze: ${availableFreezes} available`}
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
    >
      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{availableFreezes}</span>
    </span>
  );
});
