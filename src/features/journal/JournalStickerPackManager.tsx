import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { hapticTap } from "@/lib/haptics";
import { STICKER_CATEGORIES } from "./stickerUtils";
import type { StickerPackPrefs } from "./stickerUtils";
import { StickerRenderer } from "./StickerRenderer";

interface JournalStickerPackManagerProps {
  prefs: StickerPackPrefs;
  onToggle: (key: string) => void;
  isNew: (key: string) => boolean;
  enabledCount: number;
  onClose: () => void;
}

export function JournalStickerPackManager({
  prefs,
  onToggle,
  isNew,
  enabledCount,
  onClose,
}: JournalStickerPackManagerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  useBackHandler(true, onClose);
  useModalA11y(true, onClose);
  useScrollLock(true);

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[66] bg-black/40 animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed bottom-0 inset-x-0 z-[67]",
          "bg-card/95 backdrop-blur-xl border-t border-border/40",
          "rounded-t-2xl shadow-lg animate-slide-up",
          "max-h-[70dvh] flex flex-col",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
          <span className="text-sm font-semibold text-foreground">
            {ts.journalStickerPacks || "Sticker Packs"}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.close || "Close"}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Pack list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {STICKER_CATEGORIES.map((cat) => {
            const enabled = prefs.enabled[cat.key];
            const isNewPack = isNew(cat.key);
            const isLastEnabled = enabled && enabledCount <= 1;

            return (
              <motion.div
                key={cat.key}
                layout
                className={cn(
                  "rounded-xl border p-3 transition-all duration-200",
                  enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/10 border-border/10",
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Pack icon */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-2",
                      enabled
                        ? "ring-primary/30 bg-primary/10"
                        : "ring-border/10 bg-muted/20",
                    )}
                  >
                    <StickerRenderer emoji={cat.icon} size="sm" />
                  </div>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          enabled ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {ts[cat.labelKey] || cat.key}
                      </span>
                      {isNewPack && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                          {ts.journalStickerPackNew || "NEW"}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">
                      {cat.stickers.length} {ts.stickers || "stickers"}
                    </span>
                  </div>

                  {/* Toggle */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (isLastEnabled) return;
                      void hapticTap();
                      onToggle(cat.key);
                    }}
                    disabled={isLastEnabled}
                    className={cn(
                      "relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0",
                      "min-w-[48px] min-h-[44px] flex items-center",
                      enabled ? "bg-primary" : "bg-muted/40",
                      isLastEnabled && "opacity-50 cursor-not-allowed",
                    )}
                    aria-label={
                      enabled
                        ? ts.journalStickerPackEnabled || "Enabled"
                        : ts.journalStickerPackEnable || "Tap to enable"
                    }
                  >
                    <motion.div
                      layout
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className={cn(
                        "w-5 h-5 rounded-full bg-white shadow-sm",
                        enabled ? "ms-auto me-1" : "ms-1",
                      )}
                    />
                  </motion.button>
                </div>

                {/* Preview row */}
                <motion.div
                  initial={false}
                  animate={{ opacity: enabled ? 1 : 0.4 }}
                  className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide"
                >
                  {cat.stickers.slice(0, 8).map((s, i) => (
                    <div key={i} className="flex-shrink-0">
                      <StickerRenderer emoji={s} size="sm" />
                    </div>
                  ))}
                  {cat.stickers.length > 8 && (
                    <span className="text-[10px] text-muted-foreground/60 self-center ms-1 flex-shrink-0">
                      +{cat.stickers.length - 8}
                    </span>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}
