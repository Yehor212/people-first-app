import { Language } from '@/i18n/translations';

interface StreakMessage {
  title: Record<Language, string>;
  message: Record<Language, string>;
  emoji: string;
}

export const streakMessages: Record<number, StreakMessage> = {
  3: {
    emoji: '🔥',
    title: {
      en: 'Great Start!',
      ru: 'Отличное начало!',
      uk: 'Чудовий початок!',
      es: '¡Gran comienzo!',
      de: 'Toller Start!',
      fr: 'Excellent départ!'
    },
    message: {
      en: '3 days in a row! You\'re building momentum!',
      ru: '3 дня подряд! Вы набираете обороты!',
      uk: '3 дні поспіль! Ви набираєте оберти!',
      es: '¡3 días seguidos! ¡Estás ganando impulso!',
      de: '3 Tage in Folge! Du baust Schwung auf!',
      fr: '3 jours d\'affilée ! Vous prenez de l\'élan !'
    }
  },
  7: {
    emoji: '⭐',
    title: {
      en: 'One Week Strong!',
      ru: 'Целая неделя!',
      uk: 'Цілий тиждень!',
      es: '¡Una semana fuerte!',
      de: 'Eine Woche stark!',
      fr: 'Une semaine solide!'
    },
    message: {
      en: 'A full week of consistency! Keep it up!',
      ru: 'Целая неделя постоянства! Продолжайте в том же духе!',
      uk: 'Цілий тиждень постійності! Продовжуйте в тому ж дусі!',
      es: '¡Una semana completa de consistencia! ¡Sigue así!',
      de: 'Eine volle Woche Beständigkeit! Weiter so!',
      fr: 'Une semaine complète de régularité ! Continuez !'
    }
  },
  14: {
    emoji: '💪',
    title: {
      en: 'Two Weeks Champion!',
      ru: 'Чемпион двух недель!',
      uk: 'Чемпіон двох тижнів!',
      es: '¡Campeón de dos semanas!',
      de: 'Zwei-Wochen-Champion!',
      fr: 'Champion de deux semaines!'
    },
    message: {
      en: '14 days! You\'re forming a solid habit!',
      ru: '14 дней! Вы формируете устойчивую привычку!',
      uk: '14 днів! Ви формуєте стійку звичку!',
      es: '¡14 días! ¡Estás formando un hábito sólido!',
      de: '14 Tage! Du formst eine feste Gewohnheit!',
      fr: '14 jours ! Vous formez une habitude solide !'
    }
  },
  30: {
    emoji: '🏆',
    title: {
      en: 'One Month Milestone!',
      ru: 'Месяц достижений!',
      uk: 'Місяць досягнень!',
      es: '¡Hito de un mes!',
      de: 'Ein-Monats-Meilenstein!',
      fr: 'Jalon d\'un mois!'
    },
    message: {
      en: '30 days straight! This is now part of who you are!',
      ru: '30 дней подряд! Это теперь часть вас!',
      uk: '30 днів поспіль! Це тепер частина вас!',
      es: '¡30 días seguidos! ¡Esto ahora es parte de quien eres!',
      de: '30 Tage am Stück! Das ist jetzt Teil von dir!',
      fr: '30 jours d\'affilée ! Cela fait maintenant partie de vous !'
    }
  },
  50: {
    emoji: '🌟',
    title: {
      en: '50 Day Legend!',
      ru: 'Легенда 50 дней!',
      uk: 'Легенда 50 днів!',
      es: '¡Leyenda de 50 días!',
      de: '50-Tage-Legende!',
      fr: 'Légende de 50 jours!'
    },
    message: {
      en: '50 days of dedication! You\'re unstoppable!',
      ru: '50 дней преданности! Вас не остановить!',
      uk: '50 днів відданості! Вас не зупинити!',
      es: '¡50 días de dedicación! ¡Eres imparable!',
      de: '50 Tage Hingabe! Du bist unaufhaltsam!',
      fr: '50 jours de dévouement ! Vous êtes imparable !'
    }
  },
  100: {
    emoji: '👑',
    title: {
      en: 'Century Master!',
      ru: 'Мастер столетия!',
      uk: 'Майстер століття!',
      es: '¡Maestro del siglo!',
      de: 'Jahrhundert-Meister!',
      fr: 'Maître du siècle!'
    },
    message: {
      en: '100 DAYS! You\'ve mastered this habit!',
      ru: '100 ДНЕЙ! Вы освоили эту привычку!',
      uk: '100 ДНІВ! Ви опанували цю звичку!',
      es: '¡100 DÍAS! ¡Has dominado este hábito!',
      de: '100 TAGE! Du hast diese Gewohnheit gemeistert!',
      fr: '100 JOURS ! Vous avez maîtrisé cette habitude !'
    }
  },
  365: {
    emoji: '🎉',
    title: {
      en: 'ONE YEAR LEGEND!',
      ru: 'ЛЕГЕНДА ГОДА!',
      uk: 'ЛЕГЕНДА РОКУ!',
      es: '¡LEYENDA DE UN AÑO!',
      de: 'EIN-JAHRES-LEGENDE!',
      fr: 'LÉGENDE D\'UN AN!'
    },
    message: {
      en: 'A FULL YEAR! You are extraordinary!',
      ru: 'ЦЕЛЫЙ ГОД! Вы необыкновенны!',
      uk: 'ЦІЛИЙ РІК! Ви неймовірні!',
      es: '¡UN AÑO COMPLETO! ¡Eres extraordinario!',
      de: 'EIN GANZES JAHR! Du bist außergewöhnlich!',
      fr: 'UNE ANNÉE COMPLÈTE ! Vous êtes extraordinaire !'
    }
  }
};

export function getStreakMessage(streak: number, language: Language): StreakMessage | null {
  // Get exact match first
  if (streakMessages[streak]) {
    return streakMessages[streak];
  }

  // Get nearest milestone
  const milestones = Object.keys(streakMessages).map(Number).sort((a, b) => a - b);
  const lastPassed = milestones.filter(m => m <= streak).pop();

  return lastPassed ? streakMessages[lastPassed] : null;
}

export function shouldShowStreakMessage(streak: number, lastShownStreak: number): boolean {
  const milestones = Object.keys(streakMessages).map(Number);

  // Show message if we just hit a milestone
  return milestones.some(m => streak === m && lastShownStreak < m);
}
