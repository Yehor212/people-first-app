import { memo, useCallback, useEffect, useMemo, useState } from "react";
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

  const closeSurfaces = useCallback(() => {
    setShowQuickGratitude(false);
    setShowQuickBurn(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open && !showQuickGratitude && !showQuickBurn) return undefined;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeSurfaces();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closeSurfaces, open, showQuickBurn, showQuickGratitude]);

  useBackHandler(open, () => setOpen(false));
  useBackHandler(showQuickGratitude, () => setShowQuickGratitude(false));
  useBackHandler(showQuickBurn, () => setShowQuickBurn(false));

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
  const fabBottom = "bottom-[calc(6rem+env(safe-area-inset-bottom))]";
  const mainButtonClasses = inline
    ? "relative h-14 w-14 rounded-full"
    : cn("fixed end-5 lg:end-8 z-[45] h-14 w-14 rounded-full", fabBottom);

  const actionButtonPosition = (index: number) =>
    inline
      ? undefined
      : {
          bottom: `calc(6rem + env(safe-area-inset-bottom) + ${(index + 1) * 56}px)`,
        };

  const actionButtonClasses = inline
    ? "relative flex min-h-[52px] items-center gap-3"
    : cn("fixed end-5 z-[56] flex min-h-[52px] items-center gap-3 rtl:flex-row flex-row-reverse", fabBottom);

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
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <div
            className={cn(
              inline
                ? "relative z-[2] mb-4 flex flex-wrap items-center justify-center gap-2"
                : "contents"
            )}
          >
            {actions.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, y: 12 }}
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
                onClick={item.action}
                aria-label={item.label}
                data-testid={`journal-fab-action-${item.id}`}
                className={actionButtonClasses}
                style={actionButtonPosition(index)}
              >
                <div
                  className={cn(
                    "flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full shadow-lg",
                    item.color
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="whitespace-nowrap rounded-lg bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm">
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
        onClick={() => {
          if (showQuickGratitude || showQuickBurn) {
            closeSurfaces();
            setOpen(true);
            return;
          }
          setOpen((prev) => !prev);
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
