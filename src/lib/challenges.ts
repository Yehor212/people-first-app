import { Challenge, ChallengeType } from '@/types';

export const challengeTemplates: Omit<Challenge, 'id' | 'progress' | 'startDate' | 'completed'>[] = [
  // Streak Challenges
  {
    type: 'streak',
    target: 7,
    icon: '🔥',
    title: {
      en: '7 Day Streak',
      ru: '7 дней подряд',
      uk: '7 днів поспіль',
      es: '7 días seguidos',
      de: '7 Tage Streak',
      fr: '7 jours consécutifs'
    },
    description: {
      en: 'Complete your habits for 7 days in a row',
      ru: 'Выполняйте привычки 7 дней подряд',
      uk: 'Виконуйте звички 7 днів поспіль',
      es: 'Completa tus hábitos durante 7 días seguidos',
      de: 'Erfülle deine Gewohnheiten 7 Tage hintereinander',
      fr: 'Complète tes habitudes pendant 7 jours consécutifs'
    },
    reward: 'badge_streak_7'
  },
  {
    type: 'streak',
    target: 30,
    icon: '🌟',
    title: {
      en: '30 Day Challenge',
      ru: '30 дней подряд',
      uk: '30 днів поспіль',
      es: '30 días seguidos',
      de: '30 Tage Challenge',
      fr: '30 jours consécutifs'
    },
    description: {
      en: 'Maintain your streak for a full month',
      ru: 'Сохраняйте свой стрик целый месяц',
      uk: 'Зберігайте свій стрік цілий місяць',
      es: 'Mantén tu racha durante un mes completo',
      de: 'Halte deinen Streak für einen ganzen Monat',
      fr: 'Maintiens ta série pendant un mois complet'
    },
    reward: 'badge_streak_30'
  },
  {
    type: 'streak',
    target: 100,
    icon: '💎',
    title: {
      en: '100 Day Mastery',
      ru: '100 дней мастерства',
      uk: '100 днів майстерності',
      es: '100 días de maestría',
      de: '100 Tage Meisterschaft',
      fr: '100 jours de maîtrise'
    },
    description: {
      en: 'Achieve legendary status with 100 days',
      ru: 'Достигните легендарного статуса за 100 дней',
      uk: 'Досягніть легендарного статусу за 100 днів',
      es: 'Alcanza el estatus legendario con 100 días',
      de: 'Erreiche legendären Status mit 100 Tagen',
      fr: 'Atteins le statut légendaire avec 100 jours'
    },
    reward: 'badge_streak_100'
  },

  // Focus Challenges
  {
    type: 'focus',
    target: 300,
    icon: '🎯',
    title: {
      en: '5 Hours of Focus',
      ru: '5 часов фокуса',
      uk: '5 годин фокусу',
      es: '5 horas de enfoque',
      de: '5 Stunden Fokus',
      fr: '5 heures de concentration'
    },
    description: {
      en: 'Complete 300 minutes of focused work',
      ru: 'Завершите 300 минут сфокусированной работы',
      uk: 'Завершіть 300 хвилин сфокусованої роботи',
      es: 'Completa 300 minutos de trabajo concentrado',
      de: 'Schließe 300 Minuten fokussierte Arbeit ab',
      fr: 'Complète 300 minutes de travail concentré'
    },
    reward: 'badge_focus_300'
  },
  {
    type: 'focus',
    target: 1000,
    icon: '⚡',
    title: {
      en: 'Focus Master',
      ru: 'Мастер фокуса',
      uk: 'Майстер фокусу',
      es: 'Maestro del enfoque',
      de: 'Fokus-Meister',
      fr: 'Maître de la concentration'
    },
    description: {
      en: 'Accumulate 1000 minutes of deep work',
      ru: 'Накопите 1000 минут глубокой работы',
      uk: 'Накопичіть 1000 хвилин глибокої роботи',
      es: 'Acumula 1000 minutos de trabajo profundo',
      de: 'Sammle 1000 Minuten konzentrierte Arbeit',
      fr: 'Accumule 1000 minutes de travail profond'
    },
    reward: 'badge_focus_1000'
  },

  // Gratitude Challenges
  {
    type: 'gratitude',
    target: 30,
    icon: '🙏',
    title: {
      en: '30 Days of Gratitude',
      ru: '30 дней благодарности',
      uk: '30 днів вдячності',
      es: '30 días de gratitud',
      de: '30 Tage Dankbarkeit',
      fr: '30 jours de gratitude'
    },
    description: {
      en: 'Write 30 gratitude entries',
      ru: 'Напишите 30 записей благодарности',
      uk: 'Напишіть 30 записів вдячності',
      es: 'Escribe 30 entradas de gratitud',
      de: 'Schreibe 30 Dankbarkeitseinträge',
      fr: 'Écris 30 entrées de gratitude'
    },
    reward: 'badge_gratitude_30'
  },
  {
    type: 'gratitude',
    target: 100,
    icon: '✨',
    title: {
      en: 'Gratitude Champion',
      ru: 'Чемпион благодарности',
      uk: 'Чемпіон вдячності',
      es: 'Campeón de gratitud',
      de: 'Dankbarkeits-Champion',
      fr: 'Champion de la gratitude'
    },
    description: {
      en: 'Reach 100 gratitude reflections',
      ru: 'Достигните 100 размышлений о благодарности',
      uk: 'Досягніть 100 роздумів про вдячність',
      es: 'Alcanza 100 reflexiones de gratitud',
      de: 'Erreiche 100 Dankbarkeitsreflexionen',
      fr: 'Atteins 100 réflexions de gratitude'
    },
    reward: 'badge_gratitude_100'
  },

  // Total Challenges (Habits)
  {
    type: 'total',
    target: 50,
    icon: '💪',
    title: {
      en: '50 Habit Completions',
      ru: '50 выполнений привычек',
      uk: '50 виконань звичок',
      es: '50 completaciones de hábitos',
      de: '50 Gewohnheitsabschlüsse',
      fr: '50 complétions d\'habitudes'
    },
    description: {
      en: 'Complete any habits 50 times total',
      ru: 'Выполните любые привычки 50 раз',
      uk: 'Виконайте будь-які звички 50 разів',
      es: 'Completa cualquier hábito 50 veces en total',
      de: 'Schließe beliebige Gewohnheiten 50 Mal ab',
      fr: 'Complète n\'importe quelle habitude 50 fois au total'
    },
    reward: 'badge_habit_50'
  },
  {
    type: 'total',
    target: 200,
    icon: '🏆',
    title: {
      en: 'Habit Hero',
      ru: 'Герой привычек',
      uk: 'Герой звичок',
      es: 'Héroe de hábitos',
      de: 'Gewohnheits-Held',
      fr: 'Héros des habitudes'
    },
    description: {
      en: 'Reach 200 total habit completions',
      ru: 'Достигните 200 выполнений привычек',
      uk: 'Досягніть 200 виконань звичок',
      es: 'Alcanza 200 completaciones totales de hábitos',
      de: 'Erreiche 200 Gewohnheitsabschlüsse insgesamt',
      fr: 'Atteins 200 complétions d\'habitudes au total'
    },
    reward: 'badge_habit_200'
  }
];

// Helper function to create a new challenge from template
export function createChallengeFromTemplate(
  templateIndex: number,
  habitId?: string
): Challenge {
  const template = challengeTemplates[templateIndex];
  return {
    ...template,
    id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    progress: 0,
    startDate: new Date().toISOString().split('T')[0],
    completed: false,
    habitId
  };
}

// Get active challenges for a specific habit
export function getHabitChallenges(habitId: string, allChallenges: Challenge[]): Challenge[] {
  return allChallenges.filter(c => c.habitId === habitId && !c.completed);
}

// Get all available challenge templates
export function getAvailableChallenges(type?: ChallengeType) {
  if (type) {
    return challengeTemplates.filter(t => t.type === type);
  }
  return challengeTemplates;
}
