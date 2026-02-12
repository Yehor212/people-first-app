import { Badge, BadgeCategory } from '@/types';

export const badgeDefinitions: Badge[] = [
  // Streak Badges
  {
    id: 'badge_streak_7',
    category: 'streak',
    icon: '🔥',
    iconName: 'fire',
    title: {
      en: 'Week Warrior',
      uk: 'Воїн тижня',
      es: 'Guerrero semanal',
      de: 'Wochen-Krieger',
      fr: 'Guerrier hebdomadaire',
      ja: 'ウィークウォリアー',
      ar: 'محارب الأسبوع',
      he: 'לוחם השבוע'
    },
    description: {
      en: 'Maintained a 7-day streak',
      uk: 'Підтримували стрік 7 днів',
      es: 'Mantuviste una racha de 7 días',
      de: 'Habe einen 7-Tage-Streak gehalten',
      fr: 'Maintenu une série de 7 jours',
      ja: '7日間のストリークを達成',
      ar: 'حافظت على سلسلة 7 أيام',
      he: 'שמרת על רצף של 7 ימים'
    },
    requirement: 7,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_streak_30',
    category: 'streak',
    icon: '🌟',
    iconName: 'star',
    title: {
      en: 'Monthly Master',
      uk: 'Майстер місяця',
      es: 'Maestro mensual',
      de: 'Monats-Meister',
      fr: 'Maître mensuel',
      ja: 'マンスリーマスター',
      ar: 'سيد الشهر',
      he: 'אלוף החודש'
    },
    description: {
      en: 'Completed a full month streak',
      uk: 'Завершили місячний стрік',
      es: 'Completaste una racha de un mes completo',
      de: 'Habe einen ganzen Monat durchgehalten',
      fr: 'Complété une série d\'un mois',
      ja: '1ヶ月間のストリークを達成',
      ar: 'أكملت سلسلة شهر كامل',
      he: 'השלמת רצף של חודש שלם'
    },
    requirement: 30,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_streak_100',
    category: 'streak',
    icon: '💎',
    iconName: 'diamond',
    title: {
      en: 'Century Legend',
      uk: 'Легенда століття',
      es: 'Leyenda centenaria',
      de: 'Jahrhundert-Legende',
      fr: 'Légende centenaire',
      ja: 'センチュリーレジェンド',
      ar: 'أسطورة المئة',
      he: 'אגדת המאה'
    },
    description: {
      en: 'Achieved legendary 100-day streak',
      uk: 'Досягли легендарного 100-денного стріка',
      es: 'Lograste una legendaria racha de 100 días',
      de: 'Erreichte legendären 100-Tage-Streak',
      fr: 'Atteint une série légendaire de 100 jours',
      ja: '伝説の100日ストリークを達成',
      ar: 'حققت سلسلة أسطورية من 100 يوم',
      he: 'השגת רצף אגדי של 100 ימים'
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
    iconName: 'target',
    title: {
      en: 'Focus Initiate',
      uk: 'Посвячений в фокус',
      es: 'Iniciado en concentración',
      de: 'Fokus-Eingeweihter',
      fr: 'Initié à la concentration',
      ja: 'フォーカス入門',
      ar: 'مبتدئ التركيز',
      he: 'חניך המיקוד'
    },
    description: {
      en: 'Completed 5 hours of focus time',
      uk: 'Завершили 5 годин фокус-часу',
      es: 'Completaste 5 horas de tiempo de concentración',
      de: 'Habe 5 Stunden Fokuszeit abgeschlossen',
      fr: 'Complété 5 heures de temps de concentration',
      ja: '5時間の集中時間を達成',
      ar: 'أكملت 5 ساعات من وقت التركيز',
      he: 'השלמת 5 שעות של זמן מיקוד'
    },
    requirement: 300,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_focus_1000',
    category: 'focus',
    icon: '⚡',
    iconName: 'lightning',
    title: {
      en: 'Deep Work Master',
      uk: 'Майстер глибокої роботи',
      es: 'Maestro del trabajo profundo',
      de: 'Deep-Work-Meister',
      fr: 'Maître du travail profond',
      ja: 'ディープワークマスター',
      ar: 'سيد العمل العميق',
      he: 'אלוף העבודה העמוקה'
    },
    description: {
      en: 'Accumulated 1000 minutes of deep work',
      uk: 'Накопичили 1000 хвилин глибокої роботи',
      es: 'Acumulaste 1000 minutos de trabajo profundo',
      de: 'Habe 1000 Minuten konzentrierte Arbeit gesammelt',
      fr: 'Accumulé 1000 minutes de travail profond',
      ja: '1000分のディープワークを達成',
      ar: 'جمعت 1000 دقيقة من العمل العميق',
      he: 'צברת 1000 דקות של עבודה עמוקה'
    },
    requirement: 1000,
    unlocked: false,
    rarity: 'epic'
  },
  {
    id: 'badge_focus_3000',
    category: 'focus',
    icon: '🧠',
    iconName: 'brain',
    title: {
      en: 'Concentration Virtuoso',
      uk: 'Віртуоз концентрації',
      es: 'Virtuoso de la concentración',
      de: 'Konzentrations-Virtuose',
      fr: 'Virtuose de la concentration',
      ja: '集中の達人',
      ar: 'خبير التركيز',
      he: 'וירטואוז הריכוז'
    },
    description: {
      en: 'Achieved 3000 minutes of focused work',
      uk: 'Досягли 3000 хвилин сфокусованої роботи',
      es: 'Lograste 3000 minutos de trabajo concentrado',
      de: 'Habe 3000 Minuten fokussierte Arbeit erreicht',
      fr: 'Atteint 3000 minutes de travail concentré',
      ja: '3000分の集中作業を達成',
      ar: 'حققت 3000 دقيقة من العمل المركز',
      he: 'השגת 3000 דקות של עבודה ממוקדת'
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
      uk: 'Вдячна душа',
      es: 'Alma agradecida',
      de: 'Dankbare Seele',
      fr: 'Âme reconnaissante',
      ja: '感謝の心',
      ar: 'روح ممتنة',
      he: 'נשמה אסירת תודה'
    },
    description: {
      en: 'Wrote 30 gratitude entries',
      uk: 'Написали 30 записів вдячності',
      es: 'Escribiste 30 entradas de gratitud',
      de: 'Habe 30 Dankbarkeitseinträge geschrieben',
      fr: 'Écrit 30 entrées de gratitude',
      ja: '感謝の記録を30件達成',
      ar: 'كتبت 30 إدخال امتنان',
      he: 'כתבת 30 רשומות הכרת תודה'
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
      uk: 'Хранитель вдячності',
      es: 'Guardián de gratitud',
      de: 'Dankbarkeits-Wächter',
      fr: 'Gardien de la gratitude',
      ja: '感謝の守護者',
      ar: 'حارس الامتنان',
      he: 'שומר ההכרת תודה'
    },
    description: {
      en: 'Reached 100 gratitude reflections',
      uk: 'Досягли 100 роздумів про вдячність',
      es: 'Alcanzaste 100 reflexiones de gratitud',
      de: 'Habe 100 Dankbarkeitsreflexionen erreicht',
      fr: 'Atteint 100 réflexions de gratitude',
      ja: '100件の感謝の振り返りを達成',
      ar: 'وصلت إلى 100 تأمل امتنان',
      he: 'הגעת ל-100 הרהורי הכרת תודה'
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
    iconName: 'heart',
    title: {
      en: 'Habit Builder',
      uk: 'Будівельник звичок',
      es: 'Constructor de hábitos',
      de: 'Gewohnheits-Erbauer',
      fr: 'Constructeur d\'habitudes',
      ja: '習慣ビルダー',
      ar: 'بانٍ للعادات',
      he: 'בונה הרגלים'
    },
    description: {
      en: 'Completed 50 habits',
      uk: 'Виконали 50 звичок',
      es: 'Completaste 50 hábitos',
      de: 'Habe 50 Gewohnheiten abgeschlossen',
      fr: 'Complété 50 habitudes',
      ja: '50回の習慣を達成',
      ar: 'أكملت 50 عادة',
      he: 'השלמת 50 הרגלים'
    },
    requirement: 50,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_habit_200',
    category: 'habit',
    icon: '🏆',
    iconName: 'trophy',
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
      en: 'Completed 200 habits',
      uk: 'Виконали 200 звичок',
      es: 'Completaste 200 hábitos',
      de: 'Habe 200 Gewohnheiten abgeschlossen',
      fr: 'Complété 200 habitudes',
      ja: '200回の習慣を達成',
      ar: 'أكملت 200 عادة',
      he: 'השלמת 200 הרגלים'
    },
    requirement: 200,
    unlocked: false,
    rarity: 'rare'
  },
  {
    id: 'badge_habit_500',
    category: 'habit',
    icon: '👑',
    iconName: 'crown',
    title: {
      en: 'Habit Royalty',
      uk: 'Королівська звичка',
      es: 'Realeza de hábitos',
      de: 'Gewohnheits-Königtum',
      fr: 'Royauté des habitudes',
      ja: '習慣ロイヤリティ',
      ar: 'ملوك العادات',
      he: 'מלכות ההרגלים'
    },
    description: {
      en: 'Completed 500 habits',
      uk: 'Виконали 500 звичок',
      es: 'Completaste 500 hábitos',
      de: 'Habe 500 Gewohnheiten abgeschlossen',
      fr: 'Complété 500 habitudes',
      ja: '500回の習慣を達成',
      ar: 'أكملت 500 عادة',
      he: 'השלמת 500 הרגלים'
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
      uk: 'Перші кроки',
      es: 'Primeros pasos',
      de: 'Erste Schritte',
      fr: 'Premiers pas',
      ja: '最初の一歩',
      ar: 'الخطوات الأولى',
      he: 'צעדים ראשונים'
    },
    description: {
      en: 'Completed your first habit',
      uk: 'Виконали першу звичку',
      es: 'Completaste tu primer hábito',
      de: 'Habe deine erste Gewohnheit abgeschlossen',
      fr: 'Complété ta première habitude',
      ja: '最初の習慣を達成',
      ar: 'أكملت عادتك الأولى',
      he: 'השלמת את ההרגל הראשון שלך'
    },
    requirement: 1,
    unlocked: false,
    rarity: 'common'
  },
  {
    id: 'badge_special_perfectionist',
    category: 'special',
    icon: '⭐',
    iconName: 'star',
    title: {
      en: 'Perfectionist',
      uk: 'Перфекціоніст',
      es: 'Perfeccionista',
      de: 'Perfektionist',
      fr: 'Perfectionniste',
      ja: 'パーフェクショニスト',
      ar: 'مثالي',
      he: 'פרפקציוניסט'
    },
    description: {
      en: 'Completed all habits in a day 10 times',
      uk: 'Виконали всі звички за день 10 разів',
      es: 'Completaste todos los hábitos en un día 10 veces',
      de: 'Habe alle Gewohnheiten an einem Tag 10 Mal abgeschlossen',
      fr: 'Complété toutes les habitudes en un jour 10 fois',
      ja: '1日で全習慣を10回達成',
      ar: 'أكملت جميع العادات في يوم واحد 10 مرات',
      he: 'השלמת את כל ההרגלים ביום אחד 10 פעמים'
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
      uk: 'Рання пташка',
      es: 'Madrugador',
      de: 'Frühaufsteher',
      fr: 'Lève-tôt',
      ja: '早起き鳥',
      ar: 'الطائر المبكر',
      he: 'ציפור מוקדמת'
    },
    description: {
      en: 'Completed habits before 8 AM 20 times',
      uk: 'Виконали звички до 8 ранку 20 разів',
      es: 'Completaste hábitos antes de las 8 AM 20 veces',
      de: 'Habe Gewohnheiten vor 8 Uhr 20 Mal abgeschlossen',
      fr: 'Complété des habitudes avant 8h 20 fois',
      ja: '朝8時前に習慣を20回達成',
      ar: 'أكملت العادات قبل الساعة 8 صباحًا 20 مرة',
      he: 'השלמת הרגלים לפני 8 בבוקר 20 פעמים'
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
      uk: 'Нічна сова',
      es: 'Ave nocturna',
      de: 'Nachteule',
      fr: 'Oiseau de nuit',
      ja: '夜更かし族',
      ar: 'بومة الليل',
      he: 'ינשוף הלילה'
    },
    description: {
      en: 'Completed habits after 10 PM 20 times',
      uk: 'Виконали звички після 10 вечора 20 разів',
      es: 'Completaste hábitos después de las 10 PM 20 veces',
      de: 'Habe Gewohnheiten nach 22 Uhr 20 Mal abgeschlossen',
      fr: 'Complété des habitudes après 22h 20 fois',
      ja: '夜10時以降に習慣を20回達成',
      ar: 'أكملت العادات بعد الساعة 10 مساءً 20 مرة',
      he: 'השלמת הרגלים אחרי 10 בלילה 20 פעמים'
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
      uk: 'Майстер дзен',
      es: 'Maestro Zen',
      de: 'Zen-Meister',
      fr: 'Maître Zen',
      ja: '禅マスター',
      ar: 'سيد الزن',
      he: 'מאסטר זן'
    },
    description: {
      en: 'Maintained perfect balance for 30 days',
      uk: 'Підтримували ідеальний баланс 30 днів',
      es: 'Mantuviste el equilibrio perfecto durante 30 días',
      de: 'Habe perfekte Balance 30 Tage gehalten',
      fr: 'Maintenu un équilibre parfait pendant 30 jours',
      ja: '30日間完璧なバランスを維持',
      ar: 'حافظت على التوازن المثالي لمدة 30 يومًا',
      he: 'שמרת על איזון מושלם למשך 30 ימים'
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
