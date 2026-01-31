/**
 * ProgressStoriesViewer - Instagram-style weekly progress stories
 * Part of v1.4.0 Social & Sharing
 *
 * Premium upgrade in Phase 10.5: glassmorphism, gradient text, animations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Share2, Pause, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { StorySlide, MoodTrendData, HabitStatsData, FocusStatsData } from '@/lib/progressStories';
import { generateWeeklyCard, WeeklyProgressData, shareImage, downloadImage } from '@/lib/shareCards';
import { Badge } from '@/types';
import { hapticTap, hapticSuccess } from '@/lib/haptics';

// Premium animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } }
};

// ============================================
// TYPES
// ============================================

interface ProgressStoriesViewerProps {
  slides: StorySlide[];
  onClose: () => void;
  weekRange: string;
  streak?: number;
  newBadges?: Badge[];
}

// ============================================
// PROGRESS BAR COMPONENT
// ============================================

function StoryProgressBar({
  total,
  current,
  progress,
  accentColor,
}: {
  total: number;
  current: number;
  progress: number;
  accentColor?: string;
}) {
  return (
    <div className="flex gap-1.5 px-4 pt-4">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
            }}
            transition={{ duration: 0.1 }}
            style={{
              background: i <= current
                ? `linear-gradient(90deg, white 0%, ${accentColor || 'white'} 100%)`
                : 'white',
              boxShadow: i === current ? `0 0 10px ${accentColor || 'rgba(255,255,255,0.5)'}` : 'none',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================
// SLIDE CONTENT COMPONENTS
// ============================================

function IntroSlide({ slide }: { slide: StorySlide }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Floating sparkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: [0, 0.6, 0],
              y: [-20, -60],
              x: Math.sin(i) * 30,
            }}
            transition={{
              duration: 2 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.4,
            }}
            style={{
              left: `${15 + i * 15}%`,
              top: `${40 + (i % 3) * 10}%`,
            }}
          >
            <Sparkles className="w-4 h-4 text-white/40" />
          </motion.div>
        ))}
      </div>

      <motion.div variants={scaleIn} className="text-7xl mb-6">
        {slide.icon}
      </motion.div>
      <motion.h1 variants={fadeInUp} className="text-3xl font-bold mb-3">
        {slide.title}
      </motion.h1>
      <motion.p variants={fadeInUp} className="text-xl opacity-80">
        {slide.subtitle}
      </motion.p>
    </motion.div>
  );
}

function MoodSlide({ slide, t }: { slide: StorySlide; t: Record<string, string> }) {
  const data = slide.data as MoodTrendData;
  const moodEmojis = ['😢', '😔', '😐', '🙂', '😄'];

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={scaleIn} className="text-7xl mb-4">
        {slide.icon}
      </motion.div>
      <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-2">
        {slide.title}
      </motion.h2>
      <motion.p variants={fadeInUp} className="text-lg opacity-80 mb-6">
        {slide.subtitle}
      </motion.p>

      {/* Mood scale visualization - glassmorphism */}
      <motion.div
        variants={fadeInUp}
        className="flex gap-2 mb-6 p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
        style={{ boxShadow: `0 4px 20px ${slide.accentColor}40` }}
      >
        {moodEmojis.map((emoji, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all',
              Math.round(data?.average || 3) === i + 1
                ? 'bg-white/40 scale-125 shadow-lg'
                : 'bg-white/10 hover:bg-white/20'
            )}
            style={Math.round(data?.average || 3) === i + 1 ? {
              boxShadow: `0 0 20px ${slide.accentColor}`
            } : {}}
          >
            {emoji}
          </motion.div>
        ))}
      </motion.div>

      {/* Gradient text for value */}
      <motion.div
        variants={scaleIn}
        className="text-6xl font-black"
        style={{
          background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {slide.value}
      </motion.div>
      <motion.p variants={fadeInUp} className="text-sm opacity-60 mt-2">
        {t.storyAverageMoodScore || 'average mood score'}
      </motion.p>
    </motion.div>
  );
}

function HabitsSlide({ slide, t }: { slide: StorySlide; t: Record<string, string> }) {
  const data = slide.data as HabitStatsData;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={scaleIn} className="text-7xl mb-4">
        {slide.icon}
      </motion.div>
      <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-2">
        {slide.title}
      </motion.h2>

      {/* Big percentage with gradient */}
      <motion.div
        variants={scaleIn}
        className="text-7xl font-black mb-2"
        style={{
          background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {slide.value}
      </motion.div>
      <motion.p variants={fadeInUp} className="text-lg opacity-80 mb-6">
        {t.storyCompletionRate || 'completion rate'}
      </motion.p>

      {/* Top habit - glassmorphism card */}
      {data?.topHabit && (
        <motion.div
          variants={fadeInUp}
          className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20"
          style={{ boxShadow: `0 4px 20px ${slide.accentColor}40` }}
        >
          <p className="text-sm opacity-60 mb-1">{t.storyTopHabit || 'Top habit'}</p>
          <p className="text-xl font-semibold">
            {data.topHabit.icon} {data.topHabit.name}
          </p>
          <p className="text-sm opacity-80">{data.topHabit.completions} {t.storyCompletions || 'completions'}</p>
        </motion.div>
      )}

      {/* Perfect days with glow */}
      {data?.perfectDays > 0 && (
        <motion.p
          variants={fadeInUp}
          className="mt-4 text-sm px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm"
        >
          ⭐ {data.perfectDays} {t.storyPerfectDays || 'perfect days this week'}
        </motion.p>
      )}
    </motion.div>
  );
}

function FocusSlide({ slide, t }: { slide: StorySlide; t: Record<string, string> }) {
  const data = slide.data as FocusStatsData;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={scaleIn} className="text-7xl mb-4">
        {slide.icon}
      </motion.div>
      <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-2">
        {slide.title}
      </motion.h2>

      {/* Total time with gradient */}
      <motion.div
        variants={scaleIn}
        className="text-6xl font-black mb-2"
        style={{
          background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {slide.value}
      </motion.div>
      <motion.p variants={fadeInUp} className="text-lg opacity-80 mb-6">
        {slide.subtitle}
      </motion.p>

      {/* Stats grid - glassmorphism */}
      <motion.div
        variants={fadeInUp}
        className="grid grid-cols-2 gap-4 w-full max-w-xs"
      >
        <div
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20"
          style={{ boxShadow: `0 4px 15px ${slide.accentColor}30` }}
        >
          <p
            className="text-2xl font-bold"
            style={{ color: slide.accentColor }}
          >
            {data?.averageSession}m
          </p>
          <p className="text-xs opacity-60">{t.storyAvgSession || 'avg session'}</p>
        </div>
        <div
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20"
          style={{ boxShadow: `0 4px 15px ${slide.accentColor}30` }}
        >
          <p
            className="text-2xl font-bold"
            style={{ color: slide.accentColor }}
          >
            {data?.longestSession}m
          </p>
          <p className="text-xs opacity-60">{t.storyLongestSession || 'longest'}</p>
        </div>
      </motion.div>

      {data?.topLabel && (
        <motion.p
          variants={fadeInUp}
          className="mt-4 text-sm px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm"
        >
          {t.storyMostFocusedOn || 'Most focused on:'} {data.topLabel}
        </motion.p>
      )}
    </motion.div>
  );
}

function StreakSlide({ slide }: { slide: StorySlide }) {
  const streak = slide.value as number;
  const fireCount = Math.min(streak, 7);

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8 relative"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Fire glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${slide.accentColor}40 0%, transparent 60%)`,
        }}
      />

      {/* Fire emojis with animation */}
      <motion.div
        variants={fadeInUp}
        className="text-4xl mb-4 flex gap-1"
      >
        {[...Array(fireCount)].map((_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1 * i, type: 'spring', stiffness: 300 }}
            className="inline-block"
            style={{
              filter: `drop-shadow(0 0 8px ${slide.accentColor})`,
            }}
          >
            🔥
          </motion.span>
        ))}
      </motion.div>

      {/* Big streak number with glow */}
      <motion.div
        variants={scaleIn}
        className="text-8xl font-black mb-2 relative"
        style={{
          background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: `0 0 40px ${slide.accentColor}`,
        }}
      >
        {streak}
      </motion.div>
      <motion.h2
        variants={fadeInUp}
        className="text-2xl font-bold tracking-wide uppercase mb-4"
      >
        Day Streak
      </motion.h2>

      <motion.p variants={fadeInUp} className="text-xl opacity-90">
        {slide.subtitle}
      </motion.p>
    </motion.div>
  );
}

function AchievementSlide({ slide, language }: { slide: StorySlide; language: string }) {
  const badges = (slide.data as Badge[]) || [];

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={scaleIn} className="text-7xl mb-4">
        {slide.icon}
      </motion.div>
      <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-6">
        {slide.title}
      </motion.h2>

      {/* Badges grid - premium cards */}
      <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-4 max-w-xs">
        {badges.slice(0, 4).map((badge, i) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.5, rotateY: -30 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 200 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20 hover:bg-white/20 transition-colors"
            style={{
              boxShadow: `0 4px 20px ${slide.accentColor}40`,
            }}
          >
            <div
              className="text-4xl mb-2"
              style={{ filter: `drop-shadow(0 0 8px ${slide.accentColor})` }}
            >
              {badge.icon}
            </div>
            <p className="text-xs opacity-80 line-clamp-2">
              {badge.title[language as keyof typeof badge.title] || badge.title['en']}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function SummarySlide({ slide }: { slide: StorySlide }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={scaleIn}
        className="text-7xl mb-6"
        style={{ filter: `drop-shadow(0 0 20px ${slide.accentColor})` }}
      >
        {slide.icon}
      </motion.div>
      <motion.h2
        variants={fadeInUp}
        className="text-2xl font-bold mb-4"
        style={{
          background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {slide.title}
      </motion.h2>
      <motion.p variants={fadeInUp} className="text-lg opacity-80">
        {slide.subtitle}
      </motion.p>
    </motion.div>
  );
}

function OutroSlide({ slide, t }: { slide: StorySlide; t: Record<string, string> }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-white text-center px-8 relative"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${slide.accentColor}30 0%, transparent 50%)`,
        }}
      />

      {/* Floating sparkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              y: [-10, -40],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2.5 + i * 0.2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
            style={{
              left: `${10 + i * 12}%`,
              top: `${30 + (i % 4) * 15}%`,
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: slide.accentColor }} />
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={scaleIn}
        className="text-7xl mb-6"
        style={{ filter: `drop-shadow(0 0 25px ${slide.accentColor})` }}
      >
        {slide.icon}
      </motion.div>
      <motion.h1 variants={fadeInUp} className="text-3xl font-bold mb-2">
        {slide.title}
      </motion.h1>
      <motion.p variants={fadeInUp} className="text-xl opacity-80">
        {slide.subtitle}
      </motion.p>

      <motion.div
        variants={fadeInUp}
        className="mt-12 px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
      >
        <p className="text-sm opacity-60">{t.storyTrackYourJourney || 'Track your journey with'}</p>
        <p
          className="font-bold text-xl"
          style={{
            background: `linear-gradient(135deg, white 0%, ${slide.accentColor} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          ZenFlow
        </p>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProgressStoriesViewer({
  slides,
  onClose,
  weekRange,
  streak = 0,
  newBadges = [],
}: ProgressStoriesViewerProps) {
  const { t, language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const SLIDE_DURATION = 5000; // 5 seconds per slide
  const PROGRESS_INTERVAL = 50; // Update progress every 50ms

  const currentSlide = slides[currentIndex];

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || isSharing) return;

    let isMounted = true;

    timerRef.current = setInterval(() => {
      if (!isMounted) return;

      setProgress(prev => {
        const newProgress = prev + (PROGRESS_INTERVAL / SLIDE_DURATION) * 100;

        if (newProgress >= 100) {
          // Move to next slide
          if (currentIndex < slides.length - 1) {
            setCurrentIndex(i => i + 1);
            return 0;
          } else {
            // End of story - clear interval first, then close
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              if (isMounted) onClose();
            }, 0);
            return 100;
          }
        }

        return newProgress;
      });
    }, PROGRESS_INTERVAL);

    return () => {
      isMounted = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentIndex, isPaused, isSharing, slides.length, onClose]);

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const goToPrevious = useCallback(() => {
    hapticTap();
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    hapticTap();
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, slides.length, onClose]);

  const togglePause = useCallback(() => {
    hapticTap();
    setIsPaused(p => !p);
  }, []);

  const handleShare = useCallback(async () => {
    hapticTap();
    setIsSharing(true);
    setIsPaused(true);

    try {
      // Extract real data from slides using proper types
      const moodSlide = slides.find(s => s.type === 'mood');
      const habitSlide = slides.find(s => s.type === 'habits');
      const focusSlide = slides.find(s => s.type === 'focus');

      const moodData = moodSlide?.data as MoodTrendData | undefined;
      const habitData = habitSlide?.data as HabitStatsData | undefined;
      const focusData = focusSlide?.data as FocusStatsData | undefined;

      // Calculate habitsTotal from completionRate
      // completionRate = (totalCompletions / totalPossible) * 100
      // So: totalPossible = totalCompletions / (completionRate / 100)
      const totalCompletions = habitData?.totalCompletions || 0;
      const completionRate = habitData?.completionRate || 0;
      const habitsTotal = completionRate > 0
        ? Math.round(totalCompletions / (completionRate / 100))
        : totalCompletions;

      // Generate weekly card with actual data from slides
      const weeklyData: WeeklyProgressData = {
        weekRange,
        moodAverage: moodData?.average || 0,
        habitsCompleted: totalCompletions,
        habitsTotal: Math.max(habitsTotal, totalCompletions), // Ensure total >= completed
        focusMinutes: focusData?.totalMinutes || 0,
        streak,
        newBadges,
      };

      const blob = await generateWeeklyCard(weeklyData, undefined, language);
      const shared = await shareImage(
        blob,
        t.myProgress || 'My Weekly Progress',
        t.shareText || 'Check out my progress!'
      );

      if (shared) {
        hapticSuccess();
      }
    } catch (error) {
      logger.error('Failed to share:', error);
    } finally {
      setIsSharing(false);
    }
  }, [weekRange, streak, newBadges, language, t, slides]);

  // Handle touch/click navigation
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      goToPrevious();
    } else if (x > width * 0.7) {
      goToNext();
    } else {
      togglePause();
    }
  }, [goToPrevious, goToNext, togglePause]);

  // Render slide content based on type
  const renderSlideContent = () => {
    switch (currentSlide.type) {
      case 'intro':
        return <IntroSlide slide={currentSlide} />;
      case 'mood':
        return <MoodSlide slide={currentSlide} t={t} />;
      case 'habits':
        return <HabitsSlide slide={currentSlide} t={t} />;
      case 'focus':
        return <FocusSlide slide={currentSlide} t={t} />;
      case 'streak':
        return <StreakSlide slide={currentSlide} />;
      case 'achievement':
        return <AchievementSlide slide={currentSlide} language={language} />;
      case 'summary':
        return <SummarySlide slide={currentSlide} />;
      case 'outro':
        return <OutroSlide slide={currentSlide} t={t} />;
      default:
        return <SummarySlide slide={currentSlide} />;
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t.weeklyStory || 'Weekly Story'} className="fixed inset-0 z-[100] bg-black">
      {/* Story container */}
      <div
        className="relative w-full h-full"
        style={{ background: currentSlide.gradient }}
        onClick={handleTap}
      >
        {/* Progress bars */}
        <StoryProgressBar
          total={slides.length}
          current={currentIndex}
          progress={progress}
          accentColor={currentSlide.accentColor}
        />

        {/* Header controls */}
        <div className="absolute top-8 left-0 right-0 flex items-center justify-between px-4 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticTap();
              onClose();
            }}
            className="p-2 rounded-full bg-black/20 text-white"
            aria-label={t.close || 'Close'}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
              className="p-2 rounded-full bg-black/20 text-white"
              aria-label={isPaused ? (t.play || 'Play') : (t.pause || 'Pause')}
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              disabled={isSharing}
              className="p-2 rounded-full bg-black/20 text-white"
              aria-label={t.shareButton || 'Share'}
            >
              <Share2 className={cn('w-5 h-5', isSharing && 'animate-pulse')} />
            </button>
          </div>
        </div>

        {/* Slide content */}
        <div className="absolute inset-0 pt-20 pb-16">
          {renderSlideContent()}
        </div>

        {/* Navigation hints */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-white/40 text-xs">
          <span>{t.storyTapLeft || '← Tap left'}</span>
          <span>{t.storyTapCenter || 'Tap center to pause'}</span>
          <span>{t.storyTapRight || 'Tap right →'}</span>
        </div>

        {/* Pause indicator */}
        {isPaused && !isSharing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="bg-white/20 rounded-full p-4">
              <Pause className="w-12 h-12 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProgressStoriesViewer;
