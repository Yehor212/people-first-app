/**
 * GoalInput — Inline text input that appears at the edge endpoint
 * when creating a new goal (root or subtask).
 *
 * Glassmorphic mini-panel with icon picker, text input, and submit/cancel.
 * Uses useModalA11y for Escape + Android back.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Target, BookOpen, Heart, Zap, Star, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { zenMotion } from "@/lib/animationUtils";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Available goal icons — shared with GoalNode for rendering */
export const GOAL_ICON_MAP: Record<string, LucideIcon> = {
  Target,
  BookOpen,
  Heart,
  Zap,
  Star,
  Flame,
};

const ICON_KEYS = Object.keys(GOAL_ICON_MAP);

interface GoalInputProps {
  isVisible: boolean;
  /** Canvas-absolute X center position */
  anchorX: number;
  /** Canvas-absolute Y position */
  anchorY: number;
  placeholder?: string;
  onSubmit: (title: string, icon?: string) => void;
  onCancel: () => void;
}

const INPUT_WIDTH = 220;

export function GoalInput({
  isVisible,
  anchorX,
  anchorY,
  placeholder = "What's your goal?",
  onSubmit,
  onCancel,
}: GoalInputProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + auto-focus when shown
  useEffect(() => {
    if (isVisible) {
      setValue("");
      setSelectedIcon(undefined);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible]);

  const { modalProps } = useModalA11y(isVisible, onCancel);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    void haptics.buttonPress();
    onSubmit(trimmed, selectedIcon);
    // Self-reset for batch entry: clear value and refocus for next input
    setValue("");
    setSelectedIcon(undefined);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [value, selectedIcon, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleCancel = useCallback(() => {
    void haptics.light();
    onCancel();
  }, [onCancel]);

  const handleIconTap = useCallback((key: string) => {
    void haptics.light();
    setSelectedIcon((prev) => (prev === key ? undefined : key));
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 10 }}
          transition={zenMotion.gentle}
          className="absolute z-30"
          style={{
            left: anchorX - INPUT_WIDTH / 2,
            top: anchorY - 10,
            width: INPUT_WIDTH,
          }}
          {...modalProps}
        >
          <div
            className={cn(
              "rounded-xl p-3",
              "border border-white/10",
              "shadow-zen-lg",
              "bg-[var(--surface-glass)] backdrop-blur-[var(--surface-glass-blur,20px)] [-webkit-backdrop-filter:blur(var(--surface-glass-blur,20px))]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon picker row */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
              {ICON_KEYS.map((key) => {
                const Icon = GOAL_ICON_MAP[key];
                const isSelected = selectedIcon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleIconTap(key)}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      isSelected
                        ? "bg-white/15 ring-1 ring-white/30 text-white"
                        : "text-white/30 hover:text-white/60 hover:bg-white/5"
                    )}
                    aria-label={`Icon: ${key}`}
                    aria-pressed={isSelected}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={100}
              className={cn(
                "w-full rounded-lg px-3 py-2 mb-2",
                "bg-white/5 border border-white/10",
                "text-white text-sm placeholder:text-white/60",
                "focus:outline-none focus:ring-1 focus:ring-white/20"
              )}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-sm font-medium",
                  value.trim()
                    ? "bg-emerald-500/80 text-white hover:bg-emerald-500"
                    : "bg-white/5 text-white/30 cursor-not-allowed",
                  "transition-colors"
                )}
                aria-label={t.createGoal || "Create goal"}
              >
                <Check className="w-3.5 h-3.5" />
                Create
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={cn(
                  "p-2.5 rounded-lg",
                  "text-white/60 hover:text-white/70 hover:bg-white/10",
                  "transition-colors"
                )}
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
