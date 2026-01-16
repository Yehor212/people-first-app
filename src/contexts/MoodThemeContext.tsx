import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MoodType, MoodEntry } from '@/types';
import { getToday } from '@/lib/utils';

// Theme configuration for each mood
export interface MoodTheme {
  mood: MoodType | 'neutral';
  // Colors
  primaryHue: number;        // HSL hue for primary color
  accentHue: number;         // HSL hue for accent
  saturation: number;        // Color saturation (0-100)
  brightness: number;        // Overall brightness modifier
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
  // Messages
  supportMessage?: string;
}

const moodThemes: Record<MoodType | 'neutral', MoodTheme> = {
  great: {
    mood: 'great',
    primaryHue: 280,         // Purple/violet - celebratory
    accentHue: 45,           // Golden yellow
    saturation: 75,
    brightness: 1.1,
    gradientFrom: 'rgba(168, 85, 247, 0.15)',   // Purple
    gradientVia: 'rgba(251, 191, 36, 0.1)',     // Amber
    gradientTo: 'rgba(34, 211, 238, 0.1)',      // Cyan
    animationSpeed: 1.3,
    particleIntensity: 1,
    shadowIntensity: 0.8,
    borderRadius: 1.2,
  },
  good: {
    mood: 'good',
    primaryHue: 150,         // Green - positive
    accentHue: 200,          // Light blue
    saturation: 60,
    brightness: 1.05,
    gradientFrom: 'rgba(74, 222, 128, 0.12)',   // Green
    gradientVia: 'rgba(147, 197, 253, 0.08)',   // Blue
    gradientTo: 'rgba(192, 132, 252, 0.08)',    // Purple
    animationSpeed: 1.1,
    particleIntensity: 0.7,
    shadowIntensity: 0.6,
    borderRadius: 1.1,
  },
  okay: {
    mood: 'okay',
    primaryHue: 220,         // Blue - neutral
    accentHue: 180,          // Cyan
    saturation: 45,
    brightness: 1,
    gradientFrom: 'rgba(148, 163, 184, 0.1)',   // Slate
    gradientVia: 'rgba(203, 213, 225, 0.05)',   // Light slate
    gradientTo: 'rgba(148, 163, 184, 0.08)',    // Slate
    animationSpeed: 1,
    particleIntensity: 0.4,
    shadowIntensity: 0.4,
    borderRadius: 1,
  },
  bad: {
    mood: 'bad',
    primaryHue: 200,         // Calming blue
    accentHue: 260,          // Soft purple
    saturation: 35,
    brightness: 0.95,
    gradientFrom: 'rgba(125, 211, 252, 0.1)',   // Sky blue - calming
    gradientVia: 'rgba(165, 180, 252, 0.08)',   // Indigo
    gradientTo: 'rgba(196, 181, 253, 0.1)',     // Violet
    animationSpeed: 0.7,
    particleIntensity: 0.2,
    shadowIntensity: 0.3,
    borderRadius: 1.3,       // Softer corners
    supportMessage: 'support_bad',
  },
  terrible: {
    mood: 'terrible',
    primaryHue: 250,         // Soft indigo
    accentHue: 280,          // Gentle purple
    saturation: 25,
    brightness: 0.9,
    gradientFrom: 'rgba(99, 102, 241, 0.08)',   // Indigo - very gentle
    gradientVia: 'rgba(139, 92, 246, 0.05)',    // Violet
    gradientTo: 'rgba(167, 139, 250, 0.08)',    // Purple
    animationSpeed: 0.5,
    particleIntensity: 0,
    shadowIntensity: 0.2,
    borderRadius: 1.5,       // Very soft corners
    supportMessage: 'support_terrible',
  },
  neutral: {
    mood: 'neutral',
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

// Support messages for different languages
export const supportMessages: Record<string, Record<string, string>> = {
  support_bad: {
    ru: 'Тяжёлые дни бывают у всех. Ты справишься.',
    en: "Tough days happen to everyone. You've got this.",
    uk: 'Важкі дні бувають у всіх. Ти впораєшся.',
    es: 'Los días difíciles le pasan a todos. Tú puedes.',
    de: 'Schwere Tage hat jeder. Du schaffst das.',
    fr: 'Les jours difficiles arrivent à tout le monde. Tu vas y arriver.',
  },
  support_terrible: {
    ru: 'Мы здесь для тебя. Не забывай, что просить о помощи — это сила.',
    en: "We're here for you. Remember, asking for help is strength.",
    uk: 'Ми тут для тебе. Не забувай, просити про допомогу — це сила.',
    es: 'Estamos aquí para ti. Recuerda, pedir ayuda es fortaleza.',
    de: 'Wir sind für dich da. Denk daran: Um Hilfe zu bitten ist Stärke.',
    fr: "Nous sommes là pour toi. N'oublie pas, demander de l'aide est une force.",
  },
};

interface MoodThemeContextType {
  currentTheme: MoodTheme;
  currentMood: MoodType | 'neutral';
  setMoodFromEntries: (entries: MoodEntry[]) => void;
  getSupportMessage: (lang: string) => string | null;
  isTransitioning: boolean;
}

const MoodThemeContext = createContext<MoodThemeContextType | null>(null);

export function MoodThemeProvider({ children }: { children: ReactNode }) {
  const [currentMood, setCurrentMood] = useState<MoodType | 'neutral'>('neutral');
  const [currentTheme, setCurrentTheme] = useState<MoodTheme>(moodThemes.neutral);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Update mood from entries
  const setMoodFromEntries = (entries: MoodEntry[]) => {
    const today = getToday();
    const todayEntries = entries.filter(e => e.date === today);

    if (todayEntries.length === 0) {
      if (currentMood !== 'neutral') {
        transitionToMood('neutral');
      }
      return;
    }

    // Get the latest entry for today
    const latestEntry = todayEntries.sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latestEntry.mood !== currentMood) {
      transitionToMood(latestEntry.mood);
    }
  };

  // Smooth transition between moods
  const transitionToMood = (newMood: MoodType | 'neutral') => {
    setIsTransitioning(true);

    // Start transition
    setTimeout(() => {
      setCurrentMood(newMood);
      setCurrentTheme(moodThemes[newMood]);
    }, 150);

    // End transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  };

  // Get support message for current mood
  const getSupportMessage = (lang: string): string | null => {
    if (!currentTheme.supportMessage) return null;
    const messages = supportMessages[currentTheme.supportMessage];
    return messages?.[lang] || messages?.['en'] || null;
  };

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme CSS variables
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

    // Add mood class to body for CSS targeting
    document.body.classList.remove('mood-great', 'mood-good', 'mood-okay', 'mood-bad', 'mood-terrible', 'mood-neutral');
    document.body.classList.add(`mood-${currentMood}`);

  }, [currentTheme, currentMood]);

  return (
    <MoodThemeContext.Provider value={{
      currentTheme,
      currentMood,
      setMoodFromEntries,
      getSupportMessage,
      isTransitioning,
    }}>
      {children}
    </MoodThemeContext.Provider>
  );
}

export function useMoodTheme() {
  const context = useContext(MoodThemeContext);
  if (!context) {
    throw new Error('useMoodTheme must be used within a MoodThemeProvider');
  }
  return context;
}

// Hook to get theme-aware animation duration
export function useThemeAnimation(baseDuration: number): number {
  const { currentTheme } = useMoodTheme();
  return baseDuration / currentTheme.animationSpeed;
}
