import { Badge, BadgeCategory } from '@/types';

export const badgeDefinitions: Badge[] = [
  // Streak Badges
  {
    id: 'badge_streak_7',
    category: 'streak',
    icon: '🔥',
    title: {
      en: 'Week Warrior',
      ru: 'Воин недели',
      uk: 'Воїн тижня',
      es: 'Guerrero semanal',
      de: 'Wochen-Krieger',
      fr: 'Guerrier hebdomadaire'
    },
    description: {
      en: 'Maintained a 7-day streak',
      ru: 'Поддерживали стрик 7 дней',
      uk: 'Підтримували стрік 7 днів',
      es: 'Mantuviste una racha de 7 días',
      de: 'Habe einen 7-Tage-Streak gehalten',
      fr: 'Maintenu une série de 7 jours'
    },
    requirement: 7,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_streak_30',
    category: 'streak',
    icon: '🌟',
    title: {
      en: 'Monthly Master',
      ru: 'Мастер месяца',
      uk: 'Майстер місяця',
      es: 'Maestro mensual',
      de: 'Monats-Meister',
      fr: 'Maître mensuel'
    },
    description: {
      en: 'Completed a full month streak',
      ru: 'Завершили месячный стрик',
      uk: 'Завершили місячний стрік',
      es: 'Completaste una racha de un mes completo',
      de: 'Habe einen ganzen Monat durchgehalten',
      fr: 'Complété une série d\'un mois'
    },
    requirement: 30,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_streak_100',
    category: 'streak',
    icon: '💎',
    title: {
      en: 'Century Legend',
      ru: 'Легенда столетия',
      uk: 'Легенда століття',
      es: 'Leyenda centenaria',
      de: 'Jahrhundert-Legende',
      fr: 'Légende centenaire'
    },
    description: {
      en: 'Achieved legendary 100-day streak',
      ru: 'Достигли легендарного 100-дневного стрика',
      uk: 'Досягли легендарного 100-денного стріка',
      es: 'Lograste una legendaria racha de 100 días',
      de: 'Erreichte legendären 100-Tage-Streak',
      fr: 'Atteint une série légendaire de 100 jours'
    },
    requirement: 100,
    unlocked: false,
    rarity: 'legendary'
  },

  // Focus Badges
  {
    id: 'badge_focus_300',
    category: 'focus',
    icon: '🎯',
    title: {
      en: 'Focus Initiate',
      ru: 'Посвященный в фокус',
      uk: 'Посвячений в фокус',
      es: 'Iniciado en concentración',
      de: 'Fokus-Eingeweihter',
      fr: 'Initié à la concentration'
    },
    description: {
      en: 'Completed 5 hours of focus time',
      ru: 'Завершили 5 часов фокус-времени',
      uk: 'Завершили 5 годин фокус-часу',
      es: 'Completaste 5 horas de tiempo de concentración',
      de: 'Habe 5 Stunden Fokuszeit abgeschlossen',
      fr: 'Complété 5 heures de temps de concentration'
    },
    requirement: 300,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_focus_1000',
    category: 'focus',
    icon: '⚡',
    title: {
      en: 'Deep Work Master',
      ru: 'Мастер глубокой работы',
      uk: 'Майстер глибокої роботи',
      es: 'Maestro del trabajo profundo',
      de: 'Deep-Work-Meister',
      fr: 'Maître du travail profond'
    },
    description: {
      en: 'Accumulated 1000 minutes of deep work',
      ru: 'Накопили 1000 минут глубокой работы',
      uk: 'Накопичили 1000 хвилин глибокої роботи',
      es: 'Acumulaste 1000 minutos de trabajo profundo',
      de: 'Habe 1000 Minuten konzentrierte Arbeit gesammelt',
      fr: 'Accumulé 1000 minutes de travail profond'
    },
    requirement: 1000,
    unlocked: false,
    rarity: 'epic'
  },
  {
    id: 'badge_focus_3000',
    category: 'focus',
    icon: '🧠',
    title: {
      en: 'Concentration Virtuoso',
      ru: 'Виртуоз концентрации',
      uk: 'Віртуоз концентрації',
      es: 'Virtuoso de la concentración',
      de: 'Konzentrations-Virtuose',
      fr: 'Virtuose de la concentration'
    },
    description: {
      en: 'Achieved 3000 minutes of focused work',
      ru: 'Достигли 3000 минут сфокусированной работы',
      uk: 'Досягли 3000 хвилин сфокусованої роботи',
      es: 'Lograste 3000 minutos de trabajo concentrado',
      de: 'Habe 3000 Minuten fokussierte Arbeit erreicht',
      fr: 'Atteint 3000 minutes de travail concentré'
    },
    requirement: 3000,
    unlocked: false,
    rarity: 'legendary'
  },

  // Gratitude Badges
  {
    id: 'badge_gratitude_30',
    category: 'gratitude',
    icon: '🙏',
    title: {
      en: 'Grateful Soul',
      ru: 'Благодарная душа',
      uk: 'Вдячна душа',
      es: 'Alma agradecida',
      de: 'Dankbare Seele',
      fr: 'Âme reconnaissante'
    },
    description: {
      en: 'Wrote 30 gratitude entries',
      ru: 'Написали 30 записей благодарности',
      uk: 'Написали 30 записів вдячності',
      es: 'Escribiste 30 entradas de gratitud',
      de: 'Habe 30 Dankbarkeitseinträge geschrieben',
      fr: 'Écrit 30 entrées de gratitude'
    },
    requirement: 30,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_gratitude_100',
    category: 'gratitude',
    icon: '✨',
    title: {
      en: 'Gratitude Guardian',
      ru: 'Хранитель благодарности',
      uk: 'Хранитель вдячності',
      es: 'Guardián de gratitud',
      de: 'Dankbarkeits-Wächter',
      fr: 'Gardien de la gratitude'
    },
    description: {
      en: 'Reached 100 gratitude reflections',
      ru: 'Достигли 100 размышлений о благодарности',
      uk: 'Досягли 100 роздумів про вдячність',
      es: 'Alcanzaste 100 reflexiones de gratitud',
      de: 'Habe 100 Dankbarkeitsreflexionen erreicht',
      fr: 'Atteint 100 réflexions de gratitude'
    },
    requirement: 100,
    unlocked: false,
    rarity: 'epic'
  },

  // Habit Badges
  {
    id: 'badge_habit_50',
    category: 'habit',
    icon: '💪',
    title: {
      en: 'Habit Builder',
      ru: 'Строитель привычек',
      uk: 'Будівельник звичок',
      es: 'Constructor de hábitos',
      de: 'Gewohnheits-Erbauer',
      fr: 'Constructeur d\'habitudes'
    },
    description: {
      en: 'Completed 50 habits',
      ru: 'Выполнили 50 привычек',
      uk: 'Виконали 50 звичок',
      es: 'Completaste 50 hábitos',
      de: 'Habe 50 Gewohnheiten abgeschlossen',
      fr: 'Complété 50 habitudes'
    },
    requirement: 50,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_habit_200',
    category: 'habit',
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
      en: 'Completed 200 habits',
      ru: 'Выполнили 200 привычек',
      uk: 'Виконали 200 звичок',
      es: 'Completaste 200 hábitos',
      de: 'Habe 200 Gewohnheiten abgeschlossen',
      fr: 'Complété 200 habitudes'
    },
    requirement: 200,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_habit_500',
    category: 'habit',
    icon: '👑',
    title: {
      en: 'Habit Royalty',
      ru: 'Королевская привычка',
      uk: 'Королівська звичка',
      es: 'Realeza de hábitos',
      de: 'Gewohnheits-Königtum',
      fr: 'Royauté des habitudes'
    },
    description: {
      en: 'Completed 500 habits',
      ru: 'Выполнили 500 привычек',
      uk: 'Виконали 500 звичок',
      es: 'Completaste 500 hábitos',
      de: 'Habe 500 Gewohnheiten abgeschlossen',
      fr: 'Complété 500 habitudes'
    },
    requirement: 500,
    unlocked: false,
    rarity: 'epic'
  },

  // Special Badges
  {
    id: 'badge_special_first_habit',
    category: 'special',
    icon: '🌱',
    title: {
      en: 'First Steps',
      ru: 'Первые шаги',
      uk: 'Перші кроки',
      es: 'Primeros pasos',
      de: 'Erste Schritte',
      fr: 'Premiers pas'
    },
    description: {
      en: 'Completed your first habit',
      ru: 'Выполнили первую привычку',
      uk: 'Виконали першу звичку',
      es: 'Completaste tu primer hábito',
      de: 'Habe deine erste Gewohnheit abgeschlossen',
      fr: 'Complété ta première habitude'
    },
    requirement: 1,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_special_perfectionist',
    category: 'special',
    icon: '⭐',
    title: {
      en: 'Perfectionist',
      ru: 'Перфекционист',
      uk: 'Перфекціоніст',
      es: 'Perfeccionista',
      de: 'Perfektionist',
      fr: 'Perfectionniste'
    },
    description: {
      en: 'Completed all habits in a day 10 times',
      ru: 'Выполнили все привычки за день 10 раз',
      uk: 'Виконали всі звички за день 10 разів',
      es: 'Completaste todos los hábitos en un día 10 veces',
      de: 'Habe alle Gewohnheiten an einem Tag 10 Mal abgeschlossen',
      fr: 'Complété toutes les habitudes en un jour 10 fois'
    },
    requirement: 10,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_special_early_bird',
    category: 'special',
    icon: '🌅',
    title: {
      en: 'Early Bird',
      ru: 'Ранняя пташка',
      uk: 'Рання пташка',
      es: 'Madrugador',
      de: 'Frühaufsteher',
      fr: 'Lève-tôt'
    },
    description: {
      en: 'Completed habits before 8 AM 20 times',
      ru: 'Выполнили привычки до 8 утра 20 раз',
      uk: 'Виконали звички до 8 ранку 20 разів',
      es: 'Completaste hábitos antes de las 8 AM 20 veces',
      de: 'Habe Gewohnheiten vor 8 Uhr 20 Mal abgeschlossen',
      fr: 'Complété des habitudes avant 8h 20 fois'
    },
    requirement: 20,
    unlocked: false,
    rarity: 'epic'
  },
  {
    id: 'badge_special_night_owl',
    category: 'special',
    icon: '🦉',
    title: {
      en: 'Night Owl',
      ru: 'Ночная сова',
      uk: 'Нічна сова',
      es: 'Ave nocturna',
      de: 'Nachteule',
      fr: 'Oiseau de nuit'
    },
    description: {
      en: 'Completed habits after 10 PM 20 times',
      ru: 'Выполнили привычки после 10 вечера 20 раз',
      uk: 'Виконали звички після 10 вечора 20 разів',
      es: 'Completaste hábitos después de las 10 PM 20 veces',
      de: 'Habe Gewohnheiten nach 22 Uhr 20 Mal abgeschlossen',
      fr: 'Complété des habitudes après 22h 20 fois'
    },
    requirement: 20,
    unlocked: false,
    rarity: 'epic'
  },
  {
    id: 'badge_special_zen_master',
    category: 'special',
    icon: '🧘',
    title: {
      en: 'Zen Master',
      ru: 'Мастер дзен',
      uk: 'Майстер дзен',
      es: 'Maestro Zen',
      de: 'Zen-Meister',
      fr: 'Maître Zen'
    },
    description: {
      en: 'Maintained perfect balance for 30 days',
      ru: 'Поддерживали идеальный баланс 30 дней',
      uk: 'Підтримували ідеальний баланс 30 днів',
      es: 'Mantuviste el equilibrio perfecto durante 30 días',
      de: 'Habe perfekte Balance 30 Tage gehalten',
      fr: 'Maintenu un équilibre parfait pendant 30 jours'
    },
    requirement: 30,
    unlocked: false,
    rarity: 'legendary'
  }
];

// Helper functions
export function getBadgeById(badgeId: string): Badge | undefined {
  return badgeDefinitions.find(b => b.id === badgeId);
}

export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return badgeDefinitions.filter(b => b.category === category);
}

export function getUnlockedBadges(badges: Badge[]): Badge[] {
  return badges.filter(b => b.unlocked);
}

export function getRarityColor(rarity: Badge['rarity']): string {
  switch (rarity) {
    case 'common':
      return 'text-gray-400';
    case 'rare':
      return 'text-blue-400';
    case 'epic':
      return 'text-purple-400';
    case 'legendary':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

export function getRarityGradient(rarity: Badge['rarity']): string {
  switch (rarity) {
    case 'common':
      return 'from-gray-500 to-gray-600';
    case 'rare':
      return 'from-blue-500 to-blue-600';
    case 'epic':
      return 'from-purple-500 to-purple-600';
    case 'legendary':
      return 'from-yellow-400 via-orange-500 to-red-500';
    default:
      return 'from-gray-500 to-gray-600';
  }
}
