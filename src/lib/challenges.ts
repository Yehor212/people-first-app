import { Challenge, ChallengeType } from '@/types';
import { formatDate } from './utils';
import { generateSecureId } from './validation';

export const challengeTemplates: Omit<Challenge, 'id' | 'progress' | 'startDate' | 'completed'>[] = [
  // Streak Challenges
  {
    type: 'streak',
    target: 7,
    icon: '🔥',
    title: {
      en: '7 Day Streak',
      uk: '7 днів поспіль',
      es: '7 días seguidos',
      de: '7 Tage Streak',
      fr: '7 jours consécutifs',
      ja: '7日間ストリーク',
      ar: 'سلسلة 7 أيام',
      he: 'רצף 7 ימים'
    },
    description: {
      en: 'Complete your habits for 7 days in a row',
      uk: 'Виконуйте звички 7 днів поспіль',
      es: 'Completa tus hábitos durante 7 días seguidos',
      de: 'Erfülle deine Gewohnheiten 7 Tage hintereinander',
      fr: 'Complète tes habitudes pendant 7 jours consécutifs',
      ja: '7日間連続で習慣を達成しよう',
      ar: 'أكمل عاداتك لمدة 7 أيام متتالية',
      he: 'השלם את ההרגלים שלך 7 ימים ברצף'
    },
    reward: 'badge_streak_7'
  },
  {
    type: 'streak',
    target: 30,
    icon: '🌟',
    title: {
      en: '30 Day Challenge',
      uk: '30 днів поспіль',
      es: '30 días seguidos',
      de: '30 Tage Challenge',
      fr: '30 jours consécutifs',
      ja: '30日チャレンジ',
      ar: 'تحدي 30 يومًا',
      he: 'אתגר 30 יום'
    },
    description: {
      en: 'Maintain your streak for a full month',
      uk: 'Зберігайте свій стрік цілий місяць',
      es: 'Mantén tu racha durante un mes completo',
      de: 'Halte deinen Streak für einen ganzen Monat',
      fr: 'Maintiens ta série pendant un mois complet',
      ja: '1ヶ月間ストリークを維持しよう',
      ar: 'حافظ على سلسلتك لمدة شهر كامل',
      he: 'שמור על הרצף שלך חודש שלם'
    },
    reward: 'badge_streak_30'
  },
  {
    type: 'streak',
    target: 100,
    icon: '💎',
    title: {
      en: '100 Day Mastery',
      uk: '100 днів майстерності',
      es: '100 días de maestría',
      de: '100 Tage Meisterschaft',
      fr: '100 jours de maîtrise',
      ja: '100日マスタリー',
      ar: 'إتقان 100 يوم',
      he: 'שליטה ב-100 יום'
    },
    description: {
      en: 'Achieve legendary status with 100 days',
      uk: 'Досягніть легендарного статусу за 100 днів',
      es: 'Alcanza el estatus legendario con 100 días',
      de: 'Erreiche legendären Status mit 100 Tagen',
      fr: 'Atteins le statut légendaire avec 100 jours',
      ja: '100日で伝説のステータスを達成しよう',
      ar: 'حقق المكانة الأسطورية مع 100 يوم',
      he: 'השג מעמד אגדי עם 100 ימים'
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
      uk: '5 годин фокусу',
      es: '5 horas de enfoque',
      de: '5 Stunden Fokus',
      fr: '5 heures de concentration',
      ja: '5時間の集中',
      ar: '5 ساعات من التركيز',
      he: '5 שעות מיקוד'
    },
    description: {
      en: 'Complete 300 minutes of focused work',
      uk: 'Завершіть 300 хвилин сфокусованої роботи',
      es: 'Completa 300 minutos de trabajo concentrado',
      de: 'Schließe 300 Minuten fokussierte Arbeit ab',
      fr: 'Complète 300 minutes de travail concentré',
      ja: '300分の集中作業を達成しよう',
      ar: 'أكمل 300 دقيقة من العمل المركز',
      he: 'השלם 300 דקות של עבודה ממוקדת'
    },
    reward: 'badge_focus_300'
  },
  {
    type: 'focus',
    target: 1000,
    icon: '⚡',
    title: {
      en: 'Focus Master',
      uk: 'Майстер фокусу',
      es: 'Maestro del enfoque',
      de: 'Fokus-Meister',
      fr: 'Maître de la concentration',
      ja: '集中マスター',
      ar: 'سيد التركيز',
      he: 'אלוף המיקוד'
    },
    description: {
      en: 'Accumulate 1000 minutes of deep work',
      uk: 'Накопичіть 1000 хвилин глибокої роботи',
      es: 'Acumula 1000 minutos de trabajo profundo',
      de: 'Sammle 1000 Minuten konzentrierte Arbeit',
      fr: 'Accumule 1000 minutes de travail profond',
      ja: '1000分のディープワークを積み上げよう',
      ar: 'اجمع 1000 دقيقة من العمل العميق',
      he: 'צבור 1000 דקות של עבודה עמוקה'
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
      uk: '30 днів вдячності',
      es: '30 días de gratitud',
      de: '30 Tage Dankbarkeit',
      fr: '30 jours de gratitude',
      ja: '30日間の感謝',
      ar: '30 يومًا من الامتنان',
      he: '30 ימים של הכרת תודה'
    },
    description: {
      en: 'Write 30 gratitude entries',
      uk: 'Напишіть 30 записів вдячності',
      es: 'Escribe 30 entradas de gratitud',
      de: 'Schreibe 30 Dankbarkeitseinträge',
      fr: 'Écris 30 entrées de gratitude',
      ja: '感謝の記録を30件書こう',
      ar: 'اكتب 30 إدخال امتنان',
      he: 'כתוב 30 רשומות הכרת תודה'
    },
    reward: 'badge_gratitude_30'
  },
  {
    type: 'gratitude',
    target: 100,
    icon: '✨',
    title: {
      en: 'Gratitude Champion',
      uk: 'Чемпіон вдячності',
      es: 'Campeón de gratitud',
      de: 'Dankbarkeits-Champion',
      fr: 'Champion de la gratitude',
      ja: '感謝チャンピオン',
      ar: 'بطل الامتنان',
      he: 'אלוף ההכרת תודה'
    },
    description: {
      en: 'Reach 100 gratitude reflections',
      uk: 'Досягніть 100 роздумів про вдячність',
      es: 'Alcanza 100 reflexiones de gratitud',
      de: 'Erreiche 100 Dankbarkeitsreflexionen',
      fr: 'Atteins 100 réflexions de gratitude',
      ja: '感謝の振り返りを100件達成しよう',
      ar: 'حقق 100 تأمل امتنان',
      he: 'הגע ל-100 הרהורי הכרת תודה'
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
      uk: '50 виконань звичок',
      es: '50 completaciones de hábitos',
      de: '50 Gewohnheitsabschlüsse',
      fr: '50 complétions d\'habitudes',
      ja: '50回の習慣達成',
      ar: '50 إنجاز عادة',
      he: '50 השלמות הרגלים'
    },
    description: {
      en: 'Complete any habits 50 times total',
      uk: 'Виконайте будь-які звички 50 разів',
      es: 'Completa cualquier hábito 50 veces en total',
      de: 'Schließe beliebige Gewohnheiten 50 Mal ab',
      fr: 'Complète n\'importe quelle habitude 50 fois au total',
      ja: '合計50回、習慣を達成しよう',
      ar: 'أكمل أي عادات 50 مرة إجمالاً',
      he: 'השלם הרגלים כלשהם 50 פעמים סה"כ'
    },
    reward: 'badge_habit_50'
  },
  {
    type: 'total',
    target: 200,
    icon: '🏆',
    title: {
      en: 'Habit Hero',
      uk: 'Герой звичок',
      es: 'Héroe de hábitos',
      de: 'Gewohnheits-Held',
      fr: 'Héros des habitudes',
      ja: '習慣ヒーロー',
      ar: 'بطل العادات',
      he: 'גיבור ההרגלים'
    },
    description: {
      en: 'Reach 200 total habit completions',
      uk: 'Досягніть 200 виконань звичок',
      es: 'Alcanza 200 completaciones totales de hábitos',
      de: 'Erreiche 200 Gewohnheitsabschlüsse insgesamt',
      fr: 'Atteins 200 complétions d\'habitudes au total',
      ja: '合計200回の習慣達成を目指そう',
      ar: 'حقق 200 إنجاز عادة إجمالاً',
      he: 'הגע ל-200 השלמות הרגלים סה"כ'
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
    id: generateSecureId('challenge'),
    progress: 0,
    startDate: formatDate(new Date()),
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
