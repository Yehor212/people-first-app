/**
 * WelcomeTutorial slide configuration and i18n content
 */

import { Sparkles, Brain, Target, Heart, Timer, Zap, Clock, Palette, BookOpen } from 'lucide-react';

export interface SlideConfig {
  id: string;
  icon: typeof Sparkles;
  gradient: string;
  iconColor: string;
  animation: string;
}

export interface SlideContent {
  title: string;
  subtitle: string;
  description: string;
  features?: string[];
}

// Tutorial slides content - using function to avoid TDZ issues with icon imports
export function getSlides(): SlideConfig[] {
  return [
    {
      id: 'welcome',
      icon: Sparkles,
      gradient: 'from-primary/20 to-accent/20',
      iconColor: 'text-primary',
      animation: 'float',
    },
    {
      id: 'brain',
      icon: Brain,
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-500',
      animation: 'pulse',
    },
    {
      id: 'features',
      icon: Target,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-500',
      animation: 'bounce',
    },
    {
      id: 'dayclock',
      icon: Clock,
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-500',
      animation: 'spin-slow',
    },
    {
      id: 'moodtheme',
      icon: Palette,
      gradient: 'from-violet-500/20 to-fuchsia-500/20',
      iconColor: 'text-violet-500',
      animation: 'color-shift',
    },
    {
      id: 'mood',
      icon: Heart,
      gradient: 'from-red-500/20 to-orange-500/20',
      iconColor: 'text-red-500',
      animation: 'heartbeat',
    },
    {
      id: 'journal',
      icon: BookOpen,
      gradient: 'from-purple-500/20 to-violet-500/20',
      iconColor: 'text-purple-500',
      animation: 'float',
    },
    {
      id: 'focus',
      icon: Timer,
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-500',
      animation: 'spin-slow',
    },
    {
      id: 'ready',
      icon: Zap,
      gradient: 'from-yellow-500/20 to-orange-500/20',
      iconColor: 'text-yellow-500',
      animation: 'zap',
    },
  ];
}

// Tutorial content with translations
export function getSlideContent(id: string, t: Record<string, string>): SlideContent {
  const content: Record<string, SlideContent> = {
    welcome: {
      title: t.tutorialWelcomeTitle || 'Welcome to ZenFlow',
      subtitle: t.tutorialWelcomeSubtitle || 'Your personal wellness companion',
      description: t.tutorialWelcomeDesc || 'An app designed to help you stay focused, build healthy habits, and feel better every day.',
    },
    brain: {
      title: t.tutorialBrainTitle || 'Built for your brain',
      subtitle: t.tutorialBrainSubtitle || 'Whether you have ADHD or just struggle with focus',
      description: t.tutorialBrainDesc || 'ZenFlow uses science-backed techniques to help you manage attention, time, and energy. No diagnosis needed - if you struggle with focus, this app is for you.',
    },
    features: {
      title: t.tutorialFeaturesTitle || 'What you can do',
      subtitle: t.tutorialFeaturesSubtitle || 'Simple tools, big impact',
      description: t.tutorialFeaturesDesc || 'Track your progress and build momentum:',
      features: [
        t.tutorialFeature1 || 'Track daily mood and energy',
        t.tutorialFeature2 || 'Build habits step by step',
        t.tutorialFeature2b || '✨ Customize icons, colors & goals!',
        t.tutorialFeature3 || 'Focus sessions with ambient sounds',
        t.tutorialFeature4 || 'Gratitude diary',
      ],
    },
    dayclock: {
      title: t.tutorialDayClockTitle || 'Your Day at a Glance',
      subtitle: t.tutorialDayClockSubtitle || 'Visual energy meter for ADHD brains',
      description: t.tutorialDayClockDesc || 'See your day as a circle with morning, afternoon, and evening zones. Watch your energy grow as you complete activities!',
      features: [
        t.tutorialDayClockFeature1 || '⚡ Energy meter fills up with progress',
        t.tutorialDayClockFeature2 || '😊 Mascot reacts to your achievements',
        t.tutorialDayClockFeature3 || '🎯 Track all activities in one place',
        t.tutorialDayClockFeature4 || '🏆 Reach 100% for Perfect Day!',
      ],
    },
    moodtheme: {
      title: t.tutorialMoodThemeTitle || 'App Adapts to You',
      subtitle: t.tutorialMoodThemeSubtitle || 'Design changes with your mood',
      description: t.tutorialMoodThemeDesc || 'When you feel great, the app celebrates with vibrant colors. When you feel down, it becomes calm and supportive.',
      features: [
        t.tutorialMoodThemeFeature1 || '😄 Great mood: Vibrant purple & gold',
        t.tutorialMoodThemeFeature2 || '🙂 Good mood: Warm greens',
        t.tutorialMoodThemeFeature3 || '😔 Bad mood: Calming blues',
        t.tutorialMoodThemeFeature4 || '😢 Tough times: Gentle, minimal design',
      ],
    },
    mood: {
      title: t.tutorialMoodTitle || 'Understand yourself',
      subtitle: t.tutorialMoodSubtitle || 'Track moods to find patterns',
      description: t.tutorialMoodDesc || 'Quick daily check-ins help you notice what affects your energy and focus. Over time, you\'ll understand yourself better.',
    },
    journal: {
      title: t.tutorialJournalTitle || 'Diary',
      subtitle: t.tutorialJournalSubtitle || 'Your private space to reflect',
      description: t.tutorialJournalDesc || 'Write about your day, capture thoughts, and track your journey. Your diary is always private and secure.',
      features: [
        t.tutorialJournalFeature1 || '✍️ Text, photos, and audio entries',
        t.tutorialJournalFeature2 || '🔒 Lock with PIN for privacy',
        t.tutorialJournalFeature3 || '📊 Writing streaks and stats',
        t.tutorialJournalFeature4 || '🎨 Templates to get you started',
      ],
    },
    focus: {
      title: t.tutorialFocusTitle || 'Deep focus mode',
      subtitle: t.tutorialFocusSubtitle || 'Block distractions, get things done',
      description: t.tutorialFocusDesc || 'Use the Pomodoro technique with calming ambient sounds. Perfect for work, study, or creative projects.',
    },
    ready: {
      title: t.tutorialReadyTitle || 'Ready to start?',
      subtitle: t.tutorialReadySubtitle || 'Your journey begins now',
      description: t.tutorialReadyDesc || 'Start small - just check in with how you\'re feeling today. Every step counts!',
    },
  };
  return content[id] || { title: '', subtitle: '', description: '' };
}

/** CSS animations used by the tutorial slides */
export const tutorialAnimationStyles = `
  @keyframes heartbeat {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.1); }
    35% { transform: scale(0.95); }
    45% { transform: scale(1.05); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes zap {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
    25% { transform: scale(1.2) rotate(-5deg); opacity: 0.8; }
    50% { transform: scale(0.9) rotate(5deg); opacity: 1; }
    75% { transform: scale(1.1) rotate(-3deg); opacity: 0.9; }
  }
  .animate-heartbeat {
    animation: heartbeat 1.5s ease-in-out infinite;
  }
  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }
  .animate-zap {
    animation: zap 2s ease-in-out infinite;
  }
  @keyframes color-shift {
    0%, 100% {
      filter: hue-rotate(0deg);
      transform: scale(1);
    }
    25% {
      filter: hue-rotate(60deg);
      transform: scale(1.05);
    }
    50% {
      filter: hue-rotate(120deg);
      transform: scale(1);
    }
    75% {
      filter: hue-rotate(180deg);
      transform: scale(1.05);
    }
  }
  .animate-color-shift {
    animation: color-shift 4s ease-in-out infinite;
  }
`;
