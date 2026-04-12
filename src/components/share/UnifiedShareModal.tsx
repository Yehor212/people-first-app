/**
 * UnifiedShareModal - Single modal for all share card generation and actions
 * Duolingo-style UX: big preview + prominent Share button + secondary actions
 */

import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Download, Share2, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeToggle";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useShareFlow } from "@/hooks/useShareFlow";
import {
  generateShareCard,
  generateStreakCard,
  generateWeeklyCard,
  generateAchievementCard,
  generateTrophyCard,
} from "@/lib/shareCards";
import type { UnifiedShareModalProps } from "./shareTypes";
import { buildCardTranslations } from "./shareTypes";
import { getShareTitle, getShareText, getModalTitle, getSuccessMessage } from "./shareHelpers";

export type { UnifiedShareModalProps } from "./shareTypes";

// ============================================
// COMPONENT
// ============================================

export function UnifiedShareModal(props: UnifiedShareModalProps) {
  const { open, onOpenChange, username, mode } = props;
  const { t, language } = useLanguage();
  const { effectiveTheme } = useTheme();

  // All state declarations BEFORE hooks that reference them (TDZ)
  const cardTranslations = useMemo(
    () => buildCardTranslations(t as unknown as Record<string, string>),
    [t]
  );

  const theme = effectiveTheme === "dark" ? "dark" : "light";

  // Extract mode-specific data before the switch (H4: proper deps)
  const badgeData = props.mode === "achievement" ? props.badge : null;
  const streakValue = props.mode === "streak" ? props.streak : null;
  const habitName = props.mode === "streak" ? props.habitName : undefined;
  const weeklyData = props.mode === "weekly" ? props.data : null;
  const progressData = props.mode === "progress" ? props.data : null;
  const trophyData = props.mode === "trophy" ? props.data : null;

  // Build the generate function for this mode
  const generateFn = useCallback(async (): Promise<Blob> => {
    if (badgeData) return generateAchievementCard(badgeData, language, username);
    if (streakValue !== null)
      return generateStreakCard(streakValue, cardTranslations, habitName, username, language);
    if (weeklyData)
      return generateWeeklyCard(weeklyData, cardTranslations, theme, username, language);
    if (progressData) return generateShareCard(progressData, language);
    if (trophyData) return generateTrophyCard(trophyData, cardTranslations, theme, language);
    throw new Error("Unknown share mode");
  }, [
    badgeData,
    streakValue,
    habitName,
    weeklyData,
    progressData,
    trophyData,
    language,
    username,
    theme,
    cardTranslations,
  ]);

  const { status, imageUrl, imageBlob, error, lastAction, generate, download, copy, share } =
    useShareFlow({
      open,
      generateFn,
      errorMessage: t.shareGenerateError || "Failed to generate image. Try again.",
    });

  // Hooks that use state (after all declarations)
  useBackHandler(open, () => onOpenChange(false));
  useScrollLock(open);

  // Derived state
  const isGenerating = status === "generating";
  const hasImage = status === "preview" || status === "success";
  const isSuccess = status === "success";
  const isError = status === "error";

  // Cast t for helper functions
  const tRecord = t as unknown as Record<string, string>;

  // Actions
  const handleDownload = useCallback(() => {
    const filename = `zenflow-${mode}-${Date.now()}.png`;
    download(filename);
  }, [mode, download]);

  const handleShare = useCallback(() => {
    const title = getShareTitle(props, tRecord);
    const text = getShareText(props, tRecord, language);
    void share(title, text);
  }, [props, share, language, tRecord]);

  const handleCopy = useCallback(() => {
    void copy();
  }, [copy]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={() => onOpenChange(false)}
        role="button"
        tabIndex={0}
        aria-label={t.close || "Close"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="fixed bottom-0 start-0 end-0 z-[70] rounded-t-[2rem] bg-background max-h-[90dvh] overflow-hidden motion-safe:animate-slide-up pb-safe md:max-w-lg md:mx-auto md:my-6 md:rounded-2xl md:shadow-2xl md:bottom-auto md:inset-x-0 md:top-1/2 md:-translate-y-1/2"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 text-center relative">
          {/* Drag handle */}
          <div
            className="absolute top-3 start-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30"
            aria-hidden="true"
          />

          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 end-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t.close || "Close"}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <h2 id="share-dialog-title" className="text-lg font-semibold mt-2">
            {getModalTitle(props, tRecord)}
          </h2>
        </div>

        {/* Scrollable content */}
        <div className="px-4 overflow-y-auto max-h-[calc(90dvh-80px)]">
          {/* Preview Card — large, full-width */}
          <div className="flex items-center justify-center py-2">
            <motion.div
              className={cn(
                "relative w-full rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
                mode === "weekly" ? "max-w-[360px] aspect-[4/5]" : "max-w-[360px] aspect-square"
              )}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={zenMotion.snappy}
            >
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
                  <Loader2
                    className="w-8 h-8 text-primary animate-spin"
                    aria-label={t.generating || "Generating..."}
                  />
                </div>
              ) : isError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 bg-muted/50">
                  <div
                    className="text-sm text-destructive text-center"
                    role="status"
                    aria-live="polite"
                  >
                    {error}
                  </div>
                  <button
                    onClick={() => void generate()}
                    className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t.shareRetry || "Retry"}
                  </button>
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={t.sharePreview || "Share preview"}
                  className="w-full h-full object-contain"
                />
              ) : null}
            </motion.div>
          </div>

          {/* Success indicator */}
          {isSuccess && lastAction && (
            <div role="status" aria-live="polite" className="text-center mb-2">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-sm font-medium"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Check className="w-4 h-4" />
                {getSuccessMessage(lastAction, tRecord)}
              </motion.div>
            </div>
          )}

          {/* Primary action: Share button — full width, prominent */}
          <div className="pt-2 pb-2">
            <motion.button
              onClick={handleShare}
              disabled={!hasImage || !imageBlob}
              aria-label={t.shareButton || "Share"}
              className={cn(
                "w-full flex items-center justify-center gap-3 h-14 min-h-[44px] rounded-2xl text-base font-semibold transition-all",
                isSuccess && lastAction === "share"
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg"
              )}
              style={{
                boxShadow:
                  isSuccess && lastAction === "share"
                    ? "0 4px 20px rgba(16, 185, 129, 0.4)"
                    : "0 4px 20px rgba(139, 92, 246, 0.4)",
              }}
              {...(hasImage && imageBlob
                ? { whileHover: { scale: 1.01 }, whileTap: { scale: 0.98 } }
                : {})}
            >
              {isSuccess && lastAction === "share" ? (
                <Check className="w-5 h-5" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
              {isSuccess && lastAction === "share"
                ? t.shareSharedSuccess || "Shared!"
                : t.shareButton || "Share"}
            </motion.button>
          </div>

          {/* Secondary actions: Download + Copy */}
          <div className="grid grid-cols-2 gap-3 pb-4">
            {/* Download */}
            <motion.button
              onClick={handleDownload}
              disabled={!hasImage || !imageBlob}
              aria-label={t.shareDownload || "Download"}
              className={cn(
                "flex items-center justify-center gap-2 h-12 min-h-[44px] rounded-xl text-sm font-medium transition-all",
                "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10",
                "hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              {...(hasImage && imageBlob
                ? { whileHover: { scale: 1.01 }, whileTap: { scale: 0.98 } }
                : {})}
            >
              {isSuccess && lastAction === "download" ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Download className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-foreground/80">
                {isSuccess && lastAction === "download"
                  ? t.imageSaved || "Saved!"
                  : t.shareDownload || "Download"}
              </span>
            </motion.button>

            {/* Copy */}
            <motion.button
              onClick={handleCopy}
              disabled={!hasImage || !imageBlob}
              aria-label={
                isSuccess && lastAction === "copy"
                  ? t.shareCopied || "Copied"
                  : t.shareCopyLink || "Copy"
              }
              className={cn(
                "flex items-center justify-center gap-2 h-12 min-h-[44px] rounded-xl text-sm font-medium transition-all",
                isSuccess && lastAction === "copy"
                  ? "bg-emerald-500/15 border border-emerald-500/30"
                  : "bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              {...(hasImage && imageBlob
                ? { whileHover: { scale: 1.01 }, whileTap: { scale: 0.98 } }
                : {})}
            >
              {isSuccess && lastAction === "copy" ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              <span
                className={cn(
                  isSuccess && lastAction === "copy"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground/80"
                )}
              >
                {isSuccess && lastAction === "copy"
                  ? t.shareCopied || "Copied!"
                  : t.shareCopyLink || "Copy"}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default UnifiedShareModal;
