/**
 * EmotionThemeContext - Dynamic theme based on Plutchik's 8 primary emotions
 * Changes app colors, animations, and feel based on selected emotion
 * Replaces MoodThemeContext with richer emotion-based theming
 */

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo, useCallback } from 'react';
import { PrimaryEmotion, MoodEntry, EmotionIntensity } from '@/types';
import { getToday } from '@/lib/utils';

// Theme configuration for each emotion
export interface EmotionTheme {
  emotion: PrimaryEmotion | 'neutral';
  // Colors (HSL)
  primaryHue: number;
  accentHue: number;
  saturation: number;
  brightness: number;
  // Gradients
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  // Animations
  animationSpeed: number;    // Multiplier (0.5 = slow, 1 = normal, 1.5 = fast)
  particleIntensity: number; // 0-1 for celebration effects
  // UI feel
  shadowIntensity: number;   // 0-1 for shadow strength
  borderRadius: number;      // Border radius multiplier
  // Support
  supportMessage?: string;
}

const emotionThemes: Record<PrimaryEmotion | 'neutral', EmotionTheme> = {
  joy: {
    emotion: 'joy',
    primaryHue: 45,          // Golden yellow - celebratory
    accentHue: 35,           // Orange-gold
    saturation: 80,
    brightness: 1.15,
    gradientFrom: 'rgba(251, 191, 36, 0.15)',
    gradientVia: 'rgba(253, 224, 71, 0.1)',
    gradientTo: 'rgba(250, 204, 21, 0.1)',
    animationSpeed: 1.4,
    particleIntensity: 1,
    shadowIntensity: 0.8,
    borderRadius: 1.2,
  },
  trust: {
    emotion: 'trust',
    primaryHue: 150,         // Green - warm and safe
    accentHue: 160,          // Teal
    saturation: 60,
    brightness: 1.05,
    gradientFrom: 'rgba(74, 222, 128, 0.12)',
    gradientVia: 'rgba(52, 211, 153, 0.08)',
    gradientTo: 'rgba(34, 197, 94, 0.1)',
    animationSpeed: 1.1,
    particleIntensity: 0.7,
    shadowIntensity: 0.6,
    borderRadius: 1.1,
  },
  fear: {
    emotion: 'fear',
    primaryHue: 175,         // Teal - calming for anxiety
    accentHue: 190,          // Light blue
    saturation: 40,
    brightness: 0.95,
    gradientFrom: 'rgba(94, 234, 212, 0.1)',
    gradientVia: 'rgba(45, 212, 191, 0.08)',
    gradientTo: 'rgba(20, 184, 166, 0.1)',
    animationSpeed: 0.7,
    particleIntensity: 0.2,
    shadowIntensity: 0.3,
    borderRadius: 1.4,
    supportMessage: 'support_fear',
  },
  surprise: {
    emotion: 'surprise',
    primaryHue: 210,         // Sky blue - exciting
    accentHue: 200,          // Light cyan
    saturation: 70,
    brightness: 1.1,
    gradientFrom: 'rgba(96, 165, 250, 0.12)',
    gradientVia: 'rgba(147, 197, 253, 0.1)',
    gradientTo: 'rgba(59, 130, 246, 0.1)',
    animationSpeed: 1.3,
    particleIntensity: 0.9,
    shadowIntensity: 0.7,
    borderRadius: 1.15,
  },
  sadness: {
    emotion: 'sadness',
    primaryHue: 230,         // Indigo - gentle
    accentHue: 250,          // Purple
    saturation: 35,
    brightness: 0.9,
    gradientFrom: 'rgba(129, 140, 248, 0.1)',
    gradientVia: 'rgba(165, 180, 252, 0.08)',
    gradientTo: 'rgba(99, 102, 241, 0.1)',
    animationSpeed: 0.6,
    particleIntensity: 0.1,
    shadowIntensity: 0.25,
    borderRadius: 1.5,
    supportMessage: 'support_sadness',
  },
  disgust: {
    emotion: 'disgust',
    primaryHue: 280,         // Purple - cleansing
    accentHue: 290,          // Magenta
    saturation: 45,
    brightness: 0.95,
    gradientFrom: 'rgba(192, 132, 252, 0.1)',
    gradientVia: 'rgba(168, 85, 247, 0.08)',
    gradientTo: 'rgba(139, 92, 246, 0.1)',
    animationSpeed: 0.8,
    particleIntensity: 0.3,
    shadowIntensity: 0.4,
    borderRadius: 1.2,
    supportMessage: 'support_disgust',
  },
  anger: {
    emotion: 'anger',
    primaryHue: 200,         // Calming blue (NOT red - we want to calm anger)
    accentHue: 210,          // Sky blue
    saturation: 50,
    brightness: 0.95,
    gradientFrom: 'rgba(125, 211, 252, 0.1)',
    gradientVia: 'rgba(96, 165, 250, 0.08)',
    gradientTo: 'rgba(56, 189, 248, 0.1)',
    animationSpeed: 0.5,     // Slow to calm
    particleIntensity: 0,
    shadowIntensity: 0.2,
    borderRadius: 1.6,       // Very soft corners
    supportMessage: 'support_anger',
  },
  anticipation: {
    emotion: 'anticipation',
    primaryHue: 25,          // Orange - energetic
    accentHue: 35,           // Amber
    saturation: 70,
    brightness: 1.08,
    gradientFrom: 'rgba(251, 146, 60, 0.12)',
    gradientVia: 'rgba(253, 186, 116, 0.1)',
    gradientTo: 'rgba(249, 115, 22, 0.1)',
    animationSpeed: 1.2,
    particleIntensity: 0.8,
    shadowIntensity: 0.65,
    borderRadius: 1.1,
  },
  neutral: {
    emotion: 'neutral',
    primaryHue: 250,
    accentHue: 200,
    saturation: 50,
    brightness: 1,
    gradientFrom: 'rgba(139, 92, 246, 0.1)',
    gradientVia: 'rgba(168, 85, 247, 0.05)',
    gradientTo: 'rgba(192, 132, 252, 0.08)',
    animationSpeed: 1,
    particleIntensity: 0.5,
    shadowIntensity: 0.5,
    borderRadius: 1,
  },
};

// Support messages for different emotions in all 6 languages
export const emotionSupportMessages: Record<string, Record<string, string>> = {
  support_fear: {
    ru: 'Страх - это нормально. Ты в безопасности здесь.',
    en: "Fear is normal. You're safe here.",
    uk: 'Страх - це нормально. Ти в безпеці тут.',
    es: 'El miedo es normal. Estás a salvo aquí.',
    de: 'Angst ist normal. Du bist hier sicher.',
    fr: "La peur est normale. Tu es en sécurité ici.",
  },
  support_sadness: {
    ru: 'Грусть пройдёт. Позволь себе её прожить.',
    en: "Sadness will pass. Let yourself feel it.",
    uk: 'Смуток мине. Дозволь собі це пережити.',
    es: 'La tristeza pasará. Permítete sentirla.',
    de: 'Traurigkeit wird vergehen. Erlaube dir, sie zu fühlen.',
    fr: "La tristesse passera. Permets-toi de la ressentir.",
  },
  support_anger: {
    ru: 'Глубокий вдох. Твои чувства важны.',
    en: "Deep breath. Your feelings matter.",
    uk: 'Глибокий вдих. Твої почуття важливі.',
    es: 'Respira profundo. Tus sentimientos importan.',
    de: 'Tief durchatmen. Deine Gefühle sind wichtig.',
    fr: "Respire profondément. Tes sentiments comptent.",
  },
  support_disgust: {
    ru: 'Неприятные эмоции тоже часть жизни.',
    en: "Unpleasant emotions are also part of life.",
    uk: 'Неприємні емоції теж частина життя.',
    es: 'Las emociones desagradables también son parte de la vida.',
    de: 'Unangenehme Gefühle gehören auch zum Leben.',
    fr: "Les émotions désagréables font aussi partie de la vie.",
  },
};

interface EmotionThemeContextType {
  currentTheme: EmotionTheme;
  currentEmotion: PrimaryEmotion | 'neutral';
  setEmotionFromEntries: (entries: MoodEntry[]) => void;
  setEmotionDirectly: (emotion: PrimaryEmotion | 'neutral') => void;
  getSupportMessage: (lang: string) => string | null;
  isTransitioning: boolean;
}

const EmotionThemeContext = createContext<EmotionThemeContextType | null>(null);

export function EmotionThemeProvider({ children }: { children: ReactNode }) {
  const [currentEmotion, setCurrentEmotion] = useState<PrimaryEmotion | 'neutral'>('neutral');
  const [currentTheme, setCurrentTheme] = useState<EmotionTheme>(emotionThemes.neutral);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // P1 Fix: Store timeout refs for cleanup
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const endTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth transition between emotions
  // P1 Fix: Use refs and cleanup previous timeouts to prevent race conditions
  // IMPORTANT: This must be defined BEFORE setEmotionFromEntries and setEmotionDirectly
  const transitionToEmotion = useCallback((newEmotion: PrimaryEmotion | 'neutral') => {
    // Clear any pending timeouts
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    if (endTransitionTimeoutRef.current) {
      clearTimeout(endTransitionTimeoutRef.current);
    }

    setIsTransitioning(true);

    // Start transition
    transitionTimeoutRef.current = setTimeout(() => {
      setCurrentEmotion(newEmotion);
      setCurrentTheme(emotionThemes[newEmotion]);
    }, 150);

    // End transition
    endTransitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, []);

  // Update emotion from mood entries (looks at today's latest entry)
  // P1 Fix: Wrap in useCallback for stable reference
  const setEmotionFromEntries = useCallback((entries: MoodEntry[]) => {
    const today = getToday();
    const todayEntries = entries.filter(e => e.date === today);

    if (todayEntries.length === 0) {
      transitionToEmotion('neutral');
      return;
    }

    // Get the latest entry for today
    const latestEntry = todayEntries.sort((a, b) => b.timestamp - a.timestamp)[0];

    // Use emotion.primary if available, otherwise stay neutral
    const emotion = latestEntry.emotion?.primary || 'neutral';
    transitionToEmotion(emotion);
  }, [transitionToEmotion]);

  // Set emotion directly (for previews, testing)
  // P1 Fix: Wrap in useCallback for stable reference
  const setEmotionDirectly = useCallback((emotion: PrimaryEmotion | 'neutral') => {
    transitionToEmotion(emotion);
  }, [transitionToEmotion]);

  // P1 Fix: Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      if (endTransitionTimeoutRef.current) {
        clearTimeout(endTransitionTimeoutRef.current);
      }
    };
  }, []);

  // Get support message for current emotion
  // P1 Fix: Wrap in useCallback for stable reference
  const getSupportMessage = useCallback((lang: string): string | null => {
    if (!currentTheme.supportMessage) return null;
    const messages = emotionSupportMessages[currentTheme.supportMessage];
    return messages?.[lang] || messages?.['en'] || null;
  }, [currentTheme.supportMessage]);

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme CSS variables
    root.style.setProperty('--emotion-primary-hue', String(currentTheme.primaryHue));
    root.style.setProperty('--emotion-accent-hue', String(currentTheme.accentHue));
    root.style.setProperty('--emotion-saturation', `${currentTheme.saturation}%`);
    root.style.setProperty('--emotion-brightness', String(currentTheme.brightness));
    root.style.setProperty('--emotion-gradient-from', currentTheme.gradientFrom);
    root.style.setProperty('--emotion-gradient-via', currentTheme.gradientVia);
    root.style.setProperty('--emotion-gradient-to', currentTheme.gradientTo);
    root.style.setProperty('--emotion-animation-speed', String(currentTheme.animationSpeed));
    root.style.setProperty('--emotion-particle-intensity', String(currentTheme.particleIntensity));
    root.style.setProperty('--emotion-shadow-intensity', String(currentTheme.shadowIntensity));
    root.style.setProperty('--emotion-border-radius', String(currentTheme.borderRadius));

    // Also set the old mood variables for backward compatibility
    root.style.setProperty('--mood-primary-hue', String(currentTheme.primaryHue));
    root.style.setProperty('--mood-accent-hue', String(currentTheme.accentHue));
    root.style.setProperty('--mood-saturation', `${currentTheme.saturation}%`);
    root.style.setProperty('--mood-brightness', String(currentTheme.brightness));
    root.style.setProperty('--mood-gradient-from', currentTheme.gradientFrom);
    root.style.setProperty('--mood-gradient-via', currentTheme.gradientVia);
    root.style.setProperty('--mood-gradient-to', currentTheme.gradientTo);
    root.style.setProperty('--mood-animation-speed', String(currentTheme.animationSpeed));
    root.style.setProperty('--mood-particle-intensity', String(currentTheme.particleIntensity));
    root.style.setProperty('--mood-shadow-intensity', String(currentTheme.shadowIntensity));
    root.style.setProperty('--mood-border-radius', String(currentTheme.borderRadius));

    // Remove old mood classes and add new emotion class
    const allEmotionClasses = [
      'emotion-joy', 'emotion-trust', 'emotion-fear', 'emotion-surprise',
      'emotion-sadness', 'emotion-disgust', 'emotion-anger', 'emotion-anticipation',
      'emotion-neutral',
      // Also remove legacy mood classes
      'mood-great', 'mood-good', 'mood-okay', 'mood-bad', 'mood-terrible', 'mood-neutral'
    ];
    document.body.classList.remove(...allEmotionClasses);
    document.body.classList.add(`emotion-${currentEmotion}`);

  }, [currentTheme, currentEmotion]);

  // P1 Fix: Memoize provider value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentTheme,
    currentEmotion,
    setEmotionFromEntries,
    setEmotionDirectly,
    getSupportMessage,
    isTransitioning,
  }), [currentTheme, currentEmotion, setEmotionFromEntries, setEmotionDirectly, getSupportMessage, isTransitioning]);

  return (
    <EmotionThemeContext.Provider value={value}>
      {children}
    </EmotionThemeContext.Provider>
  );
}

export function useEmotionTheme() {
  const context = useContext(EmotionThemeContext);
  if (!context) {
    throw new Error('useEmotionTheme must be used within an EmotionThemeProvider');
  }
  return context;
}

// Hook to get theme-aware animation duration
export function useEmotionAnimation(baseDuration: number): number {
  const { currentTheme } = useEmotionTheme();
  return baseDuration / currentTheme.animationSpeed;
}

// Export themes for external use (e.g., in charts)
export { emotionThemes };
