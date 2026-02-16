import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FocusSession } from '@/types';
import { formatTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Play, Pause, RotateCcw, Coffee, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { HyperfocusMode } from './HyperfocusMode';
import { useFocusTimer, presetColors } from '@/hooks/useFocusTimer';
import { FocusReflectionModal, CosmicStar, cosmicStars } from './FocusReflectionModal';

interface FocusTimerProps {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
  onMinuteUpdate?: (minutes: number) => void;
  isPrimaryCTA?: boolean;
}

export const FocusTimer = memo(function FocusTimer({ sessions, onCompleteSession, onMinuteUpdate, isPrimaryCTA = false }: FocusTimerProps) {
  const { t } = useLanguage();

  const {
    preset, focusMinutes,
    focusInputValue, breakInputValue, label,
    setLabel, setFocusInputValue, setBreakInputValue,
    timeLeft, isRunning, isBreak,
    showReflection, reflectionValue, setReflectionValue,
    showHyperfocus, setShowHyperfocus,
    totalMinutesToday, progress, focusDuration, breakDuration, presets,
    throttledToggle, throttledReset, handlePresetSelect,
    handleSaveReflection, handleHyperfocusComplete,
    handleFocusInputBlur, handleBreakInputBlur,
  } = useFocusTimer({ sessions, onCompleteSession, onMinuteUpdate });

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative",
      isPrimaryCTA
        ? "ring-2 ring-violet-500/40 shadow-lg shadow-violet-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Cosmic Background - Theme-aware */}
      {isPrimaryCTA && (
        <>
          {/* Light mode background */}
          <div className="absolute inset-0 bg-gradient-to-b from-violet-100 via-indigo-50 to-slate-100 dark:bg-none" />
          {/* Dark mode cosmic gradient */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background: `radial-gradient(ellipse at center,
                hsl(var(--focus-cosmic-light)) 0%, hsl(var(--focus-cosmic-mid)) 40%, hsl(var(--focus-cosmic-dark)) 100%)`
            }}
          />
          {/* Star particles */}
          {cosmicStars.map((star) => (
            <CosmicStar key={star.id} {...star} />
          ))}
          {/* Nebula glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 5, repeat: Infinity }}
            style={{
              background: `
                radial-gradient(circle at 30% 30%, hsl(var(--focus-violet) / 0.15) 0%, transparent 40%),
                radial-gradient(circle at 70% 70%, hsl(var(--focus-pink) / 0.1) 0%, transparent 40%)
              `
            }}
          />
        </>
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <motion.div
          className="relative flex items-center justify-center gap-2 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-500/25 backdrop-blur-sm rounded-full border border-violet-500/30">
            <Sparkles className="w-4 h-4 text-violet-700 dark:text-violet-300" />
            <span className="text-sm font-bold text-violet-700 dark:text-violet-200">{t.startHere}</span>
          </div>
        </motion.div>
      )}

      <div className="mb-4 space-y-3 relative">
        <label className={cn(
          "text-sm",
          isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
        )}>{t.focusLabelPrompt}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.focusLabelPlaceholder}
          className={cn(
            "w-full p-3 rounded-xl focus:outline-none focus:ring-2 transition-colors",
            isPrimaryCTA
              ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/40 focus:ring-violet-500/50"
              : "bg-secondary text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
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
                style={isPrimaryCTA && isSelected ? {
                  boxShadow: `0 0 16px ${colors.glow}`
                } : {}}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.label}
              </motion.button>
            );
          })}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={cn(
                "text-xs",
                isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
              )}>{t.focusCustomWork}</label>
              <input
                type="number"
                min={5}
                max={120}
                value={focusInputValue}
                onChange={(e) => setFocusInputValue(e.target.value)}
                onBlur={(e) => handleFocusInputBlur(e.target.value)}
                className={cn(
                  "w-full p-2 rounded-lg focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus:ring-amber-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "text-xs",
                isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
              )}>{t.focusCustomBreak}</label>
              <input
                type="number"
                min={1}
                max={60}
                value={breakInputValue}
                onChange={(e) => setBreakInputValue(e.target.value)}
                onBlur={(e) => handleBreakInputBlur(e.target.value)}
                className={cn(
                  "w-full p-2 rounded-lg focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-secondary backdrop-blur-sm border border-border text-slate-800 dark:text-white focus:ring-amber-500/50"
                    : "bg-secondary text-foreground focus:ring-primary/30"
                )}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mb-6 relative">
        <h3 className={cn(
          "text-lg font-semibold",
          isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground"
        )}>
          {isBreak ? t.breakTime : t.focus}
        </h3>
        <div className={cn(
          "flex items-center gap-2 text-sm",
          isPrimaryCTA
            ? "px-3 py-1.5 bg-secondary backdrop-blur-sm rounded-full text-slate-600 dark:text-white/70"
            : "text-muted-foreground"
        )}>
          <Coffee className="w-4 h-4" />
          <span>{totalMinutesToday} {t.todayMinutes}</span>
        </div>
      </div>

      <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto mb-6">
        {/* Premium multi-layer timer */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Layer 1: Orbit path (dashed) */}
          {isPrimaryCTA && (
            <circle
              cx="50"
              cy="50"
              r="47"
              fill="none"
              stroke="hsl(0 0% 100% / 0.1)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Layer 2: Background track */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isPrimaryCTA ? "hsl(0 0% 100% / 0.1)" : "hsl(var(--secondary))"}
            strokeWidth="6"
          />

          {/* Layer 3: Progress ring with glow */}
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={isPrimaryCTA
              ? isBreak ? "url(#breakGradient)" : "url(#focusGradient)"
              : isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"
            }
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
            style={isPrimaryCTA ? {
              filter: `drop-shadow(0 0 8px ${isBreak ? 'hsl(var(--focus-pink) / 0.6)' : 'hsl(var(--focus-violet) / 0.6)'})`
            } : {}}
            initial={false}
            animate={{ strokeDashoffset: `${2 * Math.PI * 42 * (1 - progress / 100)}` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--focus-violet))" />
              <stop offset="50%" stopColor="hsl(var(--focus-purple))" />
              <stop offset="100%" stopColor="hsl(var(--focus-pink))" />
            </linearGradient>
            <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--focus-pink))" />
              <stop offset="50%" stopColor="hsl(var(--focus-pink-mid))" />
              <stop offset="100%" stopColor="hsl(var(--focus-rose))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Inner breathing glow */}
        {isPrimaryCTA && isRunning && (
          <motion.div
            className="absolute inset-6 rounded-full pointer-events-none"
            style={{
              background: isBreak
                ? 'radial-gradient(circle, hsl(var(--focus-pink) / 0.15) 0%, transparent 70%)'
                : 'radial-gradient(circle, hsl(var(--focus-violet) / 0.15) 0%, transparent 70%)'
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <div
          role="timer"
          aria-label={isBreak ? (t.takeRest || 'Break time') : (t.concentrate || 'Focus time')}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <motion.span
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "text-5xl font-bold tracking-tight",
              isPrimaryCTA
                ? "text-violet-700 dark:text-white"
                : isBreak ? "text-accent" : "text-primary"
            )}
            style={isPrimaryCTA ? {
              textShadow: isBreak
                ? '0 0 20px hsl(var(--focus-pink) / 0.5)'
                : '0 0 20px hsl(var(--focus-violet) / 0.5)'
            } : {}}
            key={timeLeft}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {formatTime(timeLeft)}
          </motion.span>
          <span className={cn(
            "text-sm mt-2",
            isPrimaryCTA ? "text-slate-600 dark:text-white/60" : "text-muted-foreground"
          )} aria-hidden="true">
            {isBreak ? t.takeRest : t.concentrate}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        {isPrimaryCTA ? (
          <>
            {/* Premium Play/Pause Button */}
            <motion.button
              onClick={throttledToggle}
              aria-label={isRunning ? (t.pause || 'Pause timer') : (t.start || 'Start timer')}
              className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center",
                "transition-all",
                isBreak
                  ? "bg-gradient-to-br from-pink-500 to-rose-600"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
              )}
              style={{
                boxShadow: isBreak
                  ? '0 0 24px hsl(var(--focus-pink) / 0.5)'
                  : '0 0 24px hsl(var(--focus-violet) / 0.5)'
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse ring when paused */}
              {!isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/30"
                  animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              {isRunning ? (
                <Pause className="w-7 h-7 text-white" aria-hidden="true" />
              ) : (
                <Play className="w-7 h-7 text-white ms-1" aria-hidden="true" />
              )}
            </motion.button>

            {/* Premium Reset Button */}
            <motion.button
              onClick={throttledReset}
              aria-label={t.resetTimer}
              className="w-14 h-14 rounded-full flex items-center justify-center bg-secondary backdrop-blur-sm border border-border text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-secondary/80 transition-colors"
              whileHover={{ scale: 1.1, rotate: -90 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          </>
        ) : (
          <>
            <Button
              variant="gradient"
              size="icon-lg"
              onClick={throttledToggle}
              aria-label={isRunning ? (t.pause || 'Pause timer') : (t.start || 'Start timer')}
              className={cn(
                isBreak && "zen-gradient-warm"
              )}
            >
              {isRunning ? <Pause className="w-6 h-6" aria-hidden="true" /> : <Play className="w-6 h-6" aria-hidden="true" />}
            </Button>
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={throttledReset}
              aria-label={t.resetTimer}
            >
              <RotateCcw className="w-6 h-6" aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {/* Hyperfocus Mode Button */}
      {isPrimaryCTA ? (
        <motion.button
          onClick={() => setShowHyperfocus(true)}
          disabled={isRunning}
          className={cn(
            "w-full py-3.5 rounded-xl flex items-center justify-center gap-2",
            "font-semibold transition-all relative z-10",
            isRunning
              ? "bg-secondary text-slate-400 dark:text-white/40 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500/80 to-violet-500/80 text-white hover:from-cyan-500 hover:to-violet-500"
          )}
          style={!isRunning ? {
            boxShadow: '0 0 20px hsl(var(--focus-violet) / 0.3)'
          } : {}}
          whileHover={!isRunning ? { scale: 1.02 } : {}}
          whileTap={!isRunning ? { scale: 0.98 } : {}}
        >
          <Zap className="w-5 h-5" />
          {t.hyperfocusMode}
        </motion.button>
      ) : (
        <Button
          variant={isRunning ? "secondary" : "gradient"}
          size="lg"
          onClick={() => setShowHyperfocus(true)}
          disabled={isRunning}
          className={cn(
            "w-full relative z-10",
            !isRunning && "zen-gradient-calm"
          )}
        >
          <Zap className="w-5 h-5" />
          {t.hyperfocusMode}
        </Button>
      )}

      {showReflection && (
        <FocusReflectionModal
          reflectionValue={reflectionValue}
          onSelectValue={setReflectionValue}
          onSave={handleSaveReflection}
          onDismiss={() => handleSaveReflection(null)}
        />
      )}

      {/* Hyperfocus Mode Modal — Portal to escape PullToRefresh transform stacking context */}
      {showHyperfocus && createPortal(
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
