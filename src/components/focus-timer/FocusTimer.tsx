import { memo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { FocusSession } from "@/types";
import { cn } from "@/lib/utils";
import { zenTap } from "@/lib/animationUtils";
import { Coffee } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { HyperfocusMode } from "../HyperfocusMode";
import { useFocusTimer, presetColors } from "@/hooks/useFocusTimer";
import { FocusReflectionModal } from "../FocusReflectionModal";
import { CosmicBackground } from "./CosmicBackground";
import { TimerRing } from "./TimerRing";
import { TimerControls } from "./TimerControls";

interface FocusTimerProps {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
  onMinuteUpdate?: (minutes: number) => void;
  isPrimaryCTA?: boolean;
  onExpandToJournal?: () => void; // IA Blueprint Phase 3: Focus → Journal
}

export const FocusTimer = memo(function FocusTimer({
  sessions,
  onCompleteSession,
  onMinuteUpdate,
  isPrimaryCTA = false,
  onExpandToJournal,
}: FocusTimerProps) {
  const { t } = useLanguage();

  const {
    preset,
    focusMinutes,
    focusInputValue,
    breakInputValue,
    label,
    setLabel,
    setFocusInputValue,
    setBreakInputValue,
    timeLeft,
    isRunning,
    isBreak,
    showReflection,
    reflectionValue,
    setReflectionValue,
    showHyperfocus,
    setShowHyperfocus,
    totalMinutesToday,
    progress,
    presets,
    throttledToggle,
    throttledReset,
    handlePresetSelect,
    handleSaveReflection,
    handleHyperfocusComplete,
    handleFocusInputBlur,
    handleBreakInputBlur,
  } = useFocusTimer({ sessions, onCompleteSession, onMinuteUpdate });

  return (
    <div
      className={cn(
        "rounded-2xl p-6 animate-fade-in transition-all relative",
        isPrimaryCTA
          ? "ring-2 ring-violet-500/40 shadow-lg shadow-violet-500/20"
          : "bg-card zen-shadow-card"
      )}
    >
      {/* Cosmic Background + CTA Header */}
      {isPrimaryCTA && <CosmicBackground startHereLabel={t.startHere} />}

      <div className="mb-4 space-y-3 relative">
        <label
          className={cn(
            "text-sm",
            isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
          )}
        >
          {t.focusLabelPrompt}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.focusLabelPlaceholder}
          className={cn(
            "w-full p-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 transition-colors",
            isPrimaryCTA
              ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/60 focus-visible:ring-violet-500/50"
              : "bg-secondary text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
          )}
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((item) => {
            const colors = presetColors[item.key];
            const isSelected = preset === item.key;
            return (
              <motion.button
                key={item.key}
                onClick={() => handlePresetSelect(item.key)}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  isPrimaryCTA
                    ? isSelected
                      ? `bg-gradient-to-br ${colors.bg} backdrop-blur-sm border border-border text-slate-800 dark:text-white`
                      : "bg-muted backdrop-blur-sm border border-border text-slate-600 dark:text-white/60 hover:bg-secondary hover:text-slate-800 dark:hover:text-white/80"
                    : isSelected
                      ? "bg-primary/10 ring-2 ring-primary text-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
                style={
                  isPrimaryCTA && isSelected
                    ? {
                        boxShadow: `0 0 16px ${colors.glow}`,
                      }
                    : {}
                }
                whileHover={{ scale: 1.05 }}
                whileTap={zenTap.button}
              >
                {item.label}
              </motion.button>
            );
          })}
        </div>
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className={cn(
                  "text-xs",
                  isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
                )}
              >
                {t.focusCustomWork}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={120}
                value={focusInputValue}
                onChange={(e) => setFocusInputValue(e.target.value)}
                onBlur={(e) => handleFocusInputBlur(e.target.value)}
                className={cn(
                  "w-full p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus-visible:ring-amber-500/50"
                    : "bg-secondary text-foreground focus-visible:ring-primary/30"
                )}
                aria-label={t.focusCustomWork || "Custom work minutes"}
              />
            </div>
            <div>
              <label
                className={cn(
                  "text-xs",
                  isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
                )}
              >
                {t.focusCustomBreak}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={breakInputValue}
                onChange={(e) => setBreakInputValue(e.target.value)}
                onBlur={(e) => handleBreakInputBlur(e.target.value)}
                className={cn(
                  "w-full p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus-visible:ring-amber-500/50"
                    : "bg-secondary text-foreground focus-visible:ring-primary/30"
                )}
                aria-label={t.focusCustomBreak || "Custom break minutes"}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-6 relative">
        <h3
          className={cn(
            "text-lg font-semibold",
            isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground"
          )}
        >
          {isBreak ? t.breakTime : t.focus}
        </h3>
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            isPrimaryCTA
              ? "px-3 py-1.5 bg-secondary backdrop-blur-sm rounded-full text-slate-600 dark:text-white/70"
              : "text-muted-foreground"
          )}
        >
          <Coffee className="w-4 h-4" />
          <span>
            {totalMinutesToday} {t.todayMinutes}
          </span>
        </div>
      </div>

      <TimerRing
        timeLeft={timeLeft}
        progress={progress}
        isRunning={isRunning}
        isBreak={isBreak}
        isPrimaryCTA={isPrimaryCTA}
        concentrateLabel={t.concentrate || "Focus time"}
        takeRestLabel={t.takeRest || "Break time"}
      />

      <TimerControls
        isPrimaryCTA={isPrimaryCTA}
        isRunning={isRunning}
        isBreak={isBreak}
        onToggle={throttledToggle}
        onReset={throttledReset}
        onShowHyperfocus={() => setShowHyperfocus(true)}
        labels={{
          pause: t.pause || "Pause timer",
          start: t.start || "Start timer",
          resetTimer: t.resetTimer,
          hyperfocusMode: t.hyperfocusMode,
        }}
      />

      {showReflection && (
        <FocusReflectionModal
          reflectionValue={reflectionValue}
          onSelectValue={setReflectionValue}
          onSave={handleSaveReflection}
          onDismiss={() => handleSaveReflection(null)}
          onExpandToJournal={onExpandToJournal}
        />
      )}

      {/* Hyperfocus Mode Modal — Portal to escape PullToRefresh transform stacking context */}
      {showHyperfocus &&
        createPortal(
          <HyperfocusMode
            duration={focusMinutes}
            onComplete={handleHyperfocusComplete}
            onExit={() => setShowHyperfocus(false)}
          />,
          document.body
        )}
    </div>
  );
});
