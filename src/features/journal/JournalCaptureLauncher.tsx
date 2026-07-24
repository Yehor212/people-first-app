import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { V2_JOURNAL_ICONS } from "@/lib/v2IconSystem";
import type { GratitudeEntry } from "@/types";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";

interface JournalCaptureAction {
  id: "new-entry" | "gratitude" | "burn";
  label: string;
  icon: LucideIcon;
  color: string;
  action: () => void;
}

interface JournalCaptureLauncherProps {
  onNewEntry: () => void;
  onAddGratitude?: (entry: GratitudeEntry) => void | Promise<void>;
  onFocusEntry?: () => void;
  onReleaseThought?: () => void | Promise<void>;
  variant?: "floating" | "inline";
}

export const JournalCaptureLauncher = memo(function JournalCaptureLauncher({
  onNewEntry,
  onAddGratitude,
  onReleaseThought,
  variant = "floating",
}: JournalCaptureLauncherProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [showQuickGratitude, setShowQuickGratitude] = useState(false);
  const [showQuickBurn, setShowQuickBurn] = useState(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  const restoreMainButtonFocus = useCallback(() => {
    const focusMainButton = () => mainButtonRef.current?.focus();
    if (typeof window === "undefined") {
      focusMainButton();
      return;
    }
    window.requestAnimationFrame(focusMainButton);
  }, []);

  const closeSurfaces = useCallback((restoreFocus = false) => {
    setShowQuickGratitude(false);
    setShowQuickBurn(false);
    setOpen(false);
    if (restoreFocus) restoreMainButtonFocus();
  }, [restoreMainButtonFocus]);

  useEffect(() => {
    if (!open && !showQuickGratitude && !showQuickBurn) return undefined;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeSurfaces(true);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closeSurfaces, open, showQuickBurn, showQuickGratitude]);

  useBackHandler(open, () => {
    setOpen(false);
    restoreMainButtonFocus();
  });
  useBackHandler(showQuickGratitude, () => setShowQuickGratitude(false));
  useBackHandler(showQuickBurn, () => setShowQuickBurn(false));

  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === "undefined") {
      firstActionRef.current?.focus();
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => firstActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleNewEntry = useCallback(() => {
    closeSurfaces();
    onNewEntry();
  }, [closeSurfaces, onNewEntry]);

  const handleQuickGratitude = useCallback(() => {
    setOpen(false);
    setShowQuickBurn(false);
    setShowQuickGratitude(true);
  }, []);

  const handleQuickBurn = useCallback(() => {
    setOpen(false);
    setShowQuickGratitude(false);
    setShowQuickBurn(true);
  }, []);

  const actions = useMemo<JournalCaptureAction[]>(
    () => [
      {
        id: "new-entry",
        label: ts.journalFabNewEntry || "New Entry",
        icon: V2_JOURNAL_ICONS.newEntry,
        color: "bg-primary text-primary-foreground",
        action: handleNewEntry,
      },
      ...(onAddGratitude
        ? [
            {
              id: "gratitude" as const,
              label: ts.journalQuickGratitude || "Quick Gratitude",
              icon: V2_JOURNAL_ICONS.gratitude,
              color: "bg-emerald-500 text-white",
              action: handleQuickGratitude,
            },
          ]
        : []),
      {
        id: "burn",
        label: ts.journalBurnAThought || "Burn a Thought",
        icon: V2_JOURNAL_ICONS.quietRelease,
        color: "bg-[hsl(var(--cosmic-nebula-purple)/0.18)] text-[hsl(var(--cosmic-nebula-purple))] ring-1 ring-[hsl(var(--cosmic-nebula-purple)/0.28)]",
        action: handleQuickBurn,
      },
    ],
    [
      handleNewEntry,
      handleQuickBurn,
      handleQuickGratitude,
      onAddGratitude,
      ts.journalBurnAThought,
      ts.journalFabNewEntry,
      ts.journalQuickGratitude,
    ]
  );

  const inline = variant === "inline";
  const fabBottom = "bottom-[calc(6rem+var(--safe-bottom))]";
  const mainButtonClasses = inline
    ? "relative h-14 w-14 rounded-full"
    : cn(
        "fixed end-[max(1.25rem,var(--safe-inline-end))] lg:end-[max(2rem,var(--safe-inline-end))] z-[45] h-14 w-14 rounded-full",
        fabBottom
      );

  const actionButtonClasses = inline
    ? "relative flex min-h-14 touch-manipulation items-center gap-3"
    : "relative flex min-h-14 min-w-0 max-w-full touch-manipulation items-center gap-3 rtl:flex-row flex-row-reverse";

  const launcherBody = (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label={ts.close || "Close"}
            className={cn(
              inline ? "absolute inset-0 z-[1] rounded-[1.5rem]" : "fixed inset-0 z-[54]",
              "cursor-default bg-black/20 dark:bg-black/20"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeSurfaces(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <div
            className={cn(
              inline
                ? "relative z-[2] mb-4 flex flex-wrap items-center justify-center gap-2"
                : "fixed end-[max(1.25rem,var(--safe-inline-end))] bottom-[calc(10rem+var(--safe-bottom))] z-[56] flex max-h-[calc(100svh-11rem-var(--safe-top)-var(--safe-bottom))] max-w-[calc(100vw-2.5rem-var(--safe-inline-start)-var(--safe-inline-end))] flex-col items-end gap-2 overflow-y-auto overscroll-contain py-1 lg:end-[max(2rem,var(--safe-inline-end))]"
            )}
          >
            {actions.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : {
                        delay: index * 0.08,
                        type: "spring",
                        stiffness: 400,
                        damping: 22,
                      }
                }
                ref={index === 0 ? firstActionRef : undefined}
                onClick={item.action}
                aria-label={item.label}
                data-testid={`journal-fab-action-${item.id}`}
                className={actionButtonClasses}
              >
                <div
                  className={cn(
                    "flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full shadow-lg",
                    item.color
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="max-w-[min(12rem,calc(100vw-7rem-var(--safe-left)-var(--safe-right)))] whitespace-normal break-words rounded-lg bg-card/90 px-3 py-1.5 text-start text-xs font-medium text-foreground shadow-md backdrop-blur-sm">
                  {item.label}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: inline ? 1 : 1.05 }}
        ref={mainButtonRef}
        onClick={() => {
          if (showQuickGratitude || showQuickBurn) {
            closeSurfaces();
            setOpen(true);
            return;
          }
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
        }}
        aria-label={open ? ts.close || "Close" : ts.journalFabNewEntry || "New entry"}
        aria-expanded={open}
        data-testid="journal-entry-main-fab"
        className={cn(
          mainButtonClasses,
          "flex items-center justify-center",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "shadow-[0_4px_20px_hsl(var(--primary)/0.35)]",
          "motion-safe:transition-[box-shadow,transform]"
        )}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={zenMotion.snappy}>
          <Plus className="h-6 w-6" aria-hidden="true" />
        </motion.div>
      </motion.button>
    </>
  );

  return (
    <>
      {inline ? (
        <div
          data-testid="journal-capture-launcher-inline"
          className="relative flex min-h-[7rem] w-full flex-col items-center justify-center"
        >
          {launcherBody}
        </div>
      ) : (
        launcherBody
      )}

      <AnimatePresence>
        {showQuickGratitude && onAddGratitude && (
          <motion.div
            data-testid="journal-quick-gratitude-scene"
            className="mb-4 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={zenMotion.gentle}
          >
            <GratitudeBloomWidget
              onClose={() => setShowQuickGratitude(false)}
              onPlant={(entry) => {
                void onAddGratitude(entry);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickBurn && (
          <motion.div
            className="mb-4 w-full"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={zenMotion.gentle}
          >
            <BurnThoughtWidget
              onClose={() => setShowQuickBurn(false)}
              onReleased={onReleaseThought}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
});
