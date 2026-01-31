/**
 * ProgressStoriesViewer - Instagram-style weekly progress stories
 * Part of v1.4.0 Social & Sharing
 *
 * Phase 12.5: RADICAL PREMIUM REDESIGN - "8 Unique Worlds"
 * Each slide is a completely different visual world:
 * - Intro: Space Portal
 * - Mood: Living Weather Sky
 * - Habits: Magic Garden
 * - Focus: Space Station
 * - Streak: Volcano of Power
 * - Achievement: Trophy Temple
 * - Summary: Crystal Sphere
 * - Outro: New Day Sunrise
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Share2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { StorySlide, MoodTrendData, HabitStatsData, FocusStatsData } from '@/lib/progressStories';
import { generateWeeklyCard, WeeklyProgressData, shareImage } from '@/lib/shareCards';
import { Badge } from '@/types';
import { hapticTap, hapticSuccess } from '@/lib/haptics';

// Import premium slide components
import {
  IntroSlide,
  MoodSlide,
  HabitsSlide,
  FocusSlide,
  StreakSlide,
  AchievementSlide,
  SummarySlide,
  OutroSlide,
} from './stories/slides';

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
