/**
 * AI Coach Context
 * Manages coach state, conversation history, and triggers
 */

import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { MoodEntry, Habit, InnerWorld } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';

// Constants
const API_TIMEOUT = 30000; // 30 seconds timeout for API calls

// Types
export type CoachTrigger = 'onboarding' | 'daily_checkin' | 'low_mood' | 'streak_broken' | 'habit_skip' | 'manual';

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: number;
}

export interface OnboardingData {
  mainGoal?: 'wellbeing' | 'productivity' | 'habits' | 'mood';
  currentConcern?: string;
  stressManagement?: string;
  completedAt?: number;
}

interface UserContext {
  recentMoods?: Array<{ mood: string; emotion?: string; date: string }>;
  habits?: Array<{ name: string; completedToday: boolean; streak: number }>;
  currentStreak?: number;
  lastActiveDate?: string;
  goals?: string[];
  stressManagement?: string;
  daysAway?: number;
}

interface UserDataRef {
  moods: MoodEntry[];
  habits: Habit[];
  innerWorld: InnerWorld | null;
}

interface AICoachContextType {
  // State
  isOpen: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  onboardingData: OnboardingData;

  // Actions
  openCoach: (trigger: CoachTrigger, initialMessage?: string) => void;
  closeCoach: () => void;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  saveOnboardingAnswer: (key: keyof OnboardingData, value: string) => void;
  setUserData: (moods: MoodEntry[], habits: Habit[], innerWorld: InnerWorld) => void;

  // Trigger helpers
  triggerLowMoodCheck: (mood: MoodEntry) => void;
  triggerStreakBroken: (daysAway: number) => void;
  triggerHabitSkip: (habitName: string) => void;
}

const AICoachContext = createContext<AICoachContextType | undefined>(undefined);

// Storage keys
const COACH_HISTORY_KEY = 'zenflow_coach_history';
const ONBOARDING_DATA_KEY = 'zenflow_coach_onboarding';

interface AICoachProviderProps {
  children: ReactNode;
}

export function AICoachProvider({ children }: AICoachProviderProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<CoachTrigger>('manual');
  const [daysAwayContext, setDaysAwayContext] = useState(0);
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(COACH_HISTORY_KEY, []);
  const [onboardingData, setOnboardingData] = useLocalStorage<OnboardingData>(ONBOARDING_DATA_KEY, {});

  // Store user data in ref to avoid re-renders
  const userDataRef = useRef<UserDataRef>({
    moods: [],
    habits: [],
    innerWorld: null,
  });

  // P0 Fix: Prevent concurrent API calls
  const sendingRef = useRef(false);

  // P0 Fix: Store setters in refs to avoid re-subscriptions on every render
  const setMessagesRef = useRef(setMessages);
  const setOnboardingDataRef = useRef(setOnboardingData);

  // Keep refs updated
  useEffect(() => {
    setMessagesRef.current = setMessages;
    setOnboardingDataRef.current = setOnboardingData;
  });

  // P1 Fix: Clear user data on logout - use refs to avoid re-subscription
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        userDataRef.current = { moods: [], habits: [], innerWorld: null };
        setMessagesRef.current([]);
        setOnboardingDataRef.current({});
        logger.info('[AICoach] Cleared user data on logout');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty deps - effect runs once, uses refs for setters

  // Set user data (called from Index)
  const setUserData = useCallback((moods: MoodEntry[], habits: Habit[], innerWorld: InnerWorld) => {
    userDataRef.current = { moods, habits, innerWorld };
  }, []);

  // Build context for API
  const buildUserContext = useCallback((): UserContext => {
    const { moods, habits, innerWorld } = userDataRef.current;
    const today = new Date().toISOString().split('T')[0];

    return {
      recentMoods: moods.slice(-7).map(m => ({
        mood: m.mood,
        emotion: m.emotion?.primary,
        date: m.date,
      })),
      habits: habits.map(h => ({
        name: h.name,
        completedToday: h.completedDates?.includes(today) || false,
        streak: h.completedDates?.length || 0,
      })),
      currentStreak: innerWorld?.currentActiveStreak || 0,
      lastActiveDate: innerWorld?.lastActiveDate,
      goals: onboardingData.mainGoal ? [onboardingData.mainGoal] : undefined,
      stressManagement: onboardingData.stressManagement,
      daysAway: daysAwayContext,
    };
  }, [onboardingData, daysAwayContext]);

  // Send message to API
  const sendMessage = useCallback(async (message: string) => {
    // P0 Fix: Prevent empty messages and concurrent requests
    if (!message.trim() || sendingRef.current) return;
    sendingRef.current = true;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // P1 Fix: AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            context: buildUserContext(),
            language,
            trigger: currentTrigger,
            conversationHistory: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'API error');
      }

      const data = await response.json();

      const coachMessage: ChatMessage = {
        id: `msg_${Date.now()}_coach`,
        role: 'coach',
        content: data.message,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, coachMessage]);
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle different error types
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const isAuthError = error instanceof Error && error.message === 'Not authenticated';
      logger.error('[AICoach] Send message error:', isTimeout ? 'Request timeout' : isAuthError ? 'Not authenticated' : error);

      // P0 Fix: Better fallback messages for different error types
      const getFallbackMessage = (): string => {
        if (isAuthError) {
          const authMessages: Record<string, string> = {
            ru: 'Войди в аккаунт в настройках, чтобы использовать AI Coach.',
            en: 'Please sign in from Settings to use AI Coach.',
            uk: 'Увійди в акаунт в налаштуваннях, щоб використовувати AI Coach.',
            es: 'Por favor, inicia sesión en Configuración para usar AI Coach.',
            de: 'Bitte melde dich in den Einstellungen an, um AI Coach zu nutzen.',
            fr: 'Connecte-toi dans les Paramètres pour utiliser AI Coach.',
          };
          return authMessages[language] || authMessages.en;
        }
        if (isTimeout) {
          const timeoutMessages: Record<string, string> = {
            ru: 'Превышено время ожидания. Попробуй позже.',
            en: 'Request timed out. Try again later.',
            uk: 'Час очікування вичерпано. Спробуй пізніше.',
            es: 'Tiempo de espera agotado. Intenta más tarde.',
            de: 'Zeitüberschreitung. Versuche es später.',
            fr: 'Délai dépassé. Réessaie plus tard.',
          };
          return timeoutMessages[language] || timeoutMessages.en;
        }
        const genericMessages: Record<string, string> = {
          ru: 'Извини, сейчас не могу ответить. Попробуй позже.',
          en: 'Sorry, I cannot respond right now. Try again later.',
          uk: 'Вибач, зараз не можу відповісти. Спробуй пізніше.',
          es: 'Lo siento, no puedo responder ahora. Intenta más tarde.',
          de: 'Entschuldige, ich kann gerade nicht antworten. Versuche es später.',
          fr: 'Désolé, je ne peux pas répondre maintenant. Réessaie plus tard.',
        };
        return genericMessages[language] || genericMessages.en;
      };

      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}_fallback`,
        role: 'coach',
        content: getFallbackMessage(),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
      sendingRef.current = false; // P0 Fix: Reset sending flag
    }
  }, [buildUserContext, language, currentTrigger, messages, setMessages]);

  // Open coach with trigger
  const openCoach = useCallback((trigger: CoachTrigger, initialMessage?: string) => {
    setCurrentTrigger(trigger);
    setIsOpen(true);

    // P0 Fix: Add initial message as COACH message, not user message
    // The greeting should appear from the coach, not from the user
    if (initialMessage) {
      const greetingMessage: ChatMessage = {
        id: `msg_${Date.now()}_greeting`,
        role: 'coach', // Coach greeting, not user message
        content: initialMessage,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, greetingMessage]);
    }
  }, [setMessages]);

  // Close coach
  const closeCoach = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  // Save onboarding answer
  const saveOnboardingAnswer = useCallback((key: keyof OnboardingData, value: string) => {
    setOnboardingData(prev => ({ ...prev, [key]: value }));
  }, [setOnboardingData]);

  // Trigger helpers
  const triggerLowMoodCheck = useCallback((mood: MoodEntry) => {
    if (mood.mood === 'bad' || mood.mood === 'terrible') {
      const greetings: Record<string, string> = {
        ru: 'Заметил, что тебе сейчас непросто...',
        en: 'I noticed you are having a hard time...',
        uk: 'Помітив, що тобі зараз нелегко...',
        es: 'Noté que estás pasando por un momento difícil...',
        de: 'Ich habe bemerkt, dass du gerade eine schwere Zeit hast...',
        fr: 'J\'ai remarqué que tu traverses un moment difficile...',
      };
      openCoach('low_mood', greetings[language] || greetings.en);
    }
  }, [openCoach, language]);

  const triggerStreakBroken = useCallback((daysAway: number) => {
    setDaysAwayContext(daysAway);
    const greetings: Record<string, string> = {
      ru: `С возвращением! Ты отсутствовал ${daysAway} дней.`,
      en: `Welcome back! You were away for ${daysAway} days.`,
      uk: `З поверненням! Ти був відсутній ${daysAway} днів.`,
      es: `¡Bienvenido de vuelta! Estuviste ausente ${daysAway} días.`,
      de: `Willkommen zurück! Du warst ${daysAway} Tage weg.`,
      fr: `Bienvenue! Tu étais absent ${daysAway} jours.`,
    };
    openCoach('streak_broken', greetings[language] || greetings.en);
  }, [openCoach, language]);

  const triggerHabitSkip = useCallback((habitName: string) => {
    const messages: Record<string, string> = {
      ru: `Я пропустил привычку "${habitName}"`,
      en: `I skipped the habit "${habitName}"`,
      uk: `Я пропустив звичку "${habitName}"`,
      es: `Me salté el hábito "${habitName}"`,
      de: `Ich habe die Gewohnheit "${habitName}" übersprungen`,
      fr: `J'ai sauté l'habitude "${habitName}"`,
    };
    openCoach('habit_skip', messages[language] || messages.en);
  }, [openCoach, language]);

  const value = useMemo(() => ({
    isOpen,
    isLoading,
    messages,
    onboardingData,
    openCoach,
    closeCoach,
    sendMessage,
    clearHistory,
    saveOnboardingAnswer,
    setUserData,
    triggerLowMoodCheck,
    triggerStreakBroken,
    triggerHabitSkip,
  }), [
    isOpen,
    isLoading,
    messages,
    onboardingData,
    openCoach,
    closeCoach,
    sendMessage,
    clearHistory,
    saveOnboardingAnswer,
    setUserData,
    triggerLowMoodCheck,
    triggerStreakBroken,
    triggerHabitSkip,
  ]);

  return (
    <AICoachContext.Provider value={value}>
      {children}
    </AICoachContext.Provider>
  );
}

export function useAICoach() {
  const context = useContext(AICoachContext);
  if (!context) {
    throw new Error('useAICoach must be used within AICoachProvider');
  }
  return context;
}
