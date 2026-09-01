import { memo } from "react";
import { createPortal } from "react-dom";
import type { FocusSession } from "@/types";
import type { FocusCommitBoundary } from "@/types/focusTimerTypes";
import { cn } from "@/lib/utils";
import { Coffee } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { HyperfocusMode } from "../HyperfocusMode";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { FocusReflectionModal } from "../FocusReflectionModal";
import { CosmicBackground } from "./CosmicBackground";
import { TimerRing } from "./TimerRing";
import { TimerControls } from "./TimerControls";

interface FocusTimerProps {
  sessions: FocusSession[];
  onCompleteSession: (
    session: FocusSession,
    boundary?: FocusCommitBoundary
  ) => void | Promise<void>;
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
  const { t, language } = useLanguage();

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
    handleCancelReflection,
    handleHyperfocusComplete,
    handleFocusInputBlur,
    handleBreakInputBlur,
  } = useFocusTimer({ sessions, onCompleteSession, onMinuteUpdate });
  const numberLocale = language === "ar" ? "ar-u-nu-arab" : language;
  const formattedTotalMinutes = new Intl.NumberFormat(numberLocale).format(totalMinutesToday);

  return (
    <div className="lg:max-w-xl lg:mx-auto">
      <div
        className={cn(
          "relative rounded-2xl border border-border bg-card p-6 motion-safe:animate-fade-in",
          isPrimaryCTA && "border-primary/40"
        )}
      >
        {isPrimaryCTA && <CosmicBackground startHereLabel={t.startHere} />}

        <div className="mb-4 space-y-3 relative">
          <label
            htmlFor="focus-session-label"
            className={cn(
              "text-sm",
              "text-muted-foreground"
            )}
          >
            {t.focusLabelPrompt}
          </label>
          <input
            id="focus-session-label"
            name="focus-session-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label={t.focusLabelPrompt}
            placeholder={t.focusLabelPlaceholder}
            className="min-h-11 w-full rounded-xl border border-input bg-background p-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors"
          />
          <div className="flex flex-wrap gap-2">
            {presets.map((item) => {
              const isSelected = preset === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handlePresetSelect(item.key)}
                  className={cn(
                    "min-h-11 rounded-xl border px-4 py-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="focus-custom-work-minutes"
                  className={cn(
                    "text-xs",
                    "text-muted-foreground"
                  )}
                >
                  {t.focusCustomWork}
                </label>
                <input
                  type="number"
                  id="focus-custom-work-minutes"
                  name="focus-custom-work-minutes"
                  inputMode="numeric"
                  min={5}
                  max={120}
                  value={focusInputValue}
                  onChange={(e) => setFocusInputValue(e.target.value)}
                  onBlur={(e) => handleFocusInputBlur(e.target.value)}
                  className={cn(
                    "w-full p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2",
                    "border border-border bg-secondary text-foreground focus-visible:ring-primary/30"
                  )}
                  aria-label={t.focusCustomWork || "Custom work minutes"}
                />
              </div>
              <div>
                <label
                  htmlFor="focus-custom-break-minutes"
                  className={cn(
                    "text-xs",
                    "text-muted-foreground"
                  )}
                >
                  {t.focusCustomBreak}
                </label>
                <input
                  type="number"
                  id="focus-custom-break-minutes"
                  name="focus-custom-break-minutes"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={breakInputValue}
                  onChange={(e) => setBreakInputValue(e.target.value)}
                  onBlur={(e) => handleBreakInputBlur(e.target.value)}
                  className={cn(
                    "w-full p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2",
                    "border border-border bg-secondary text-foreground focus-visible:ring-primary/30"
                  )}
                  aria-label={t.focusCustomBreak || "Custom break minutes"}
                />
              </div>
            </div>
          )}
        </div>
        <div className="mb-6 relative flex min-w-0 flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <h2
            className={cn(
              "min-w-0 break-words text-lg font-semibold [hyphens:manual] [overflow-wrap:normal]",
              "text-foreground"
            )}
          >
            {isBreak ? t.breakTime : t.focus}
          </h2>
          <div
            className={cn(
              "flex min-w-0 max-w-full flex-wrap items-center gap-2 whitespace-normal text-sm",
              "text-muted-foreground"
            )}
          >
            <Coffee className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words [hyphens:manual] [overflow-wrap:normal]">
              <bdi dir="auto">{formattedTotalMinutes}</bdi> {t.todayMinutes}
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
            onDismiss={() => void handleSaveReflection(null)}
            onCancel={handleCancelReflection}
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
    </div>
  );
});
