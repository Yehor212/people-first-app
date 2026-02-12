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
      en: 'Great Start!', uk: 'Чудовий початок!', es: '¡Gran comienzo!',
      de: 'Toller Start!', fr: 'Excellent départ!',
      ja: '素晴らしいスタート！', ar: 'بداية رائعة!', he: 'התחלה מצוינת!',
    },
    message: {
      en: '3 days in a row! You\'re building momentum!',
      uk: '3 дні поспіль! Ви набираєте оберти!',
      es: '¡3 días seguidos! ¡Estás ganando impulso!',
      de: '3 Tage in Folge! Du baust Schwung auf!',
      fr: '3 jours d\'affilée ! Vous prenez de l\'élan !',
      ja: '3日連続！勢いがついてきたね！',
      ar: '3 أيام متتالية! أنت تكتسب زخمًا!',
      he: '3 ימים ברצף! אתה צובר תאוצה!',
    }
  },
  7: {
    emoji: '⭐',
    title: {
      en: 'One Week Strong!', uk: 'Цілий тиждень!', es: '¡Una semana fuerte!',
      de: 'Eine Woche stark!', fr: 'Une semaine solide!',
      ja: '1週間達成！', ar: 'أسبوع كامل!', he: 'שבוע חזק!',
    },
    message: {
      en: 'A full week of consistency! Keep it up!',
      uk: 'Цілий тиждень постійності! Продовжуйте в тому ж дусі!',
      es: '¡Una semana completa de consistencia! ¡Sigue así!',
      de: 'Eine volle Woche Beständigkeit! Weiter so!',
      fr: 'Une semaine complète de régularité ! Continuez !',
      ja: '丸1週間の継続！その調子！',
      ar: 'أسبوع كامل من الاستمرارية! واصل!',
      he: 'שבוע שלם של עקביות! המשך כך!',
    }
  },
  14: {
    emoji: '💪',
    title: {
      en: 'Two Weeks Champion!', uk: 'Чемпіон двох тижнів!', es: '¡Campeón de dos semanas!',
      de: 'Zwei-Wochen-Champion!', fr: 'Champion de deux semaines!',
      ja: '2週間チャンピオン！', ar: 'بطل أسبوعين!', he: 'אלוף שבועיים!',
    },
    message: {
      en: '14 days! You\'re forming a solid habit!',
      uk: '14 днів! Ви формуєте стійку звичку!',
      es: '¡14 días! ¡Estás formando un hábito sólido!',
      de: '14 Tage! Du formst eine feste Gewohnheit!',
      fr: '14 jours ! Vous formez une habitude solide !',
      ja: '14日間！しっかりした習慣が身についてきたね！',
      ar: '14 يومًا! أنت تبني عادة قوية!',
      he: '14 ימים! אתה מגבש הרגל יציב!',
    }
  },
  30: {
    emoji: '🏆',
    title: {
      en: 'One Month Milestone!', uk: 'Місяць досягнень!', es: '¡Hito de un mes!',
      de: 'Ein-Monats-Meilenstein!', fr: 'Jalon d\'un mois!',
      ja: '1ヶ月の節目！', ar: 'إنجاز شهر كامل!', he: 'אבן דרך של חודש!',
    },
    message: {
      en: '30 days straight! This is now part of who you are!',
      uk: '30 днів поспіль! Це тепер частина вас!',
      es: '¡30 días seguidos! ¡Esto ahora es parte de quien eres!',
      de: '30 Tage am Stück! Das ist jetzt Teil von dir!',
      fr: '30 jours d\'affilée ! Cela fait maintenant partie de vous !',
      ja: '30日間連続！もうあなたの一部だね！',
      ar: '30 يومًا متتاليًا! هذا أصبح جزءًا منك!',
      he: '30 ימים ברציפות! זה כבר חלק ממי שאתה!',
    }
  },
  50: {
    emoji: '🌟',
    title: {
      en: '50 Day Legend!', uk: 'Легенда 50 днів!', es: '¡Leyenda de 50 días!',
      de: '50-Tage-Legende!', fr: 'Légende de 50 jours!',
      ja: '50日の伝説！', ar: 'أسطورة 50 يومًا!', he: 'אגדה של 50 יום!',
    },
    message: {
      en: '50 days of dedication! You\'re unstoppable!',
      uk: '50 днів відданості! Вас не зупинити!',
      es: '¡50 días de dedicación! ¡Eres imparable!',
      de: '50 Tage Hingabe! Du bist unaufhaltsam!',
      fr: '50 jours de dévouement ! Vous êtes imparable !',
      ja: '50日間の献身！もう止められない！',
      ar: '50 يومًا من التفاني! لا يمكن إيقافك!',
      he: '50 ימים של מסירות! אי אפשר לעצור אותך!',
    }
  },
  100: {
    emoji: '👑',
    title: {
      en: 'Century Master!', uk: 'Майстер століття!', es: '¡Maestro del siglo!',
      de: 'Jahrhundert-Meister!', fr: 'Maître du siècle!',
      ja: '100日マスター！', ar: 'سيد المائة!', he: 'אדון המאה!',
    },
    message: {
      en: '100 DAYS! You\'ve mastered this habit!',
      uk: '100 ДНІВ! Ви опанували цю звичку!',
      es: '¡100 DÍAS! ¡Has dominado este hábito!',
      de: '100 TAGE! Du hast diese Gewohnheit gemeistert!',
      fr: '100 JOURS ! Vous avez maîtrisé cette habitude !',
      ja: '100日達成！この習慣を完全に身につけたね！',
      ar: '100 يوم! لقد أتقنت هذه العادة!',
      he: '100 ימים! שלטת בהרגל הזה!',
    }
  },
  365: {
    emoji: '🎉',
    title: {
      en: 'ONE YEAR LEGEND!', uk: 'ЛЕГЕНДА РОКУ!', es: '¡LEYENDA DE UN AÑO!',
      de: 'EIN-JAHRES-LEGENDE!', fr: 'LÉGENDE D\'UN AN!',
      ja: '1年の伝説！', ar: 'أسطورة عام كامل!', he: 'אגדה של שנה!',
    },
    message: {
      en: 'A FULL YEAR! You are extraordinary!',
      uk: 'ЦІЛИЙ РІК! Ви неймовірні!',
      es: '¡UN AÑO COMPLETO! ¡Eres extraordinario!',
      de: 'EIN GANZES JAHR! Du bist außergewöhnlich!',
      fr: 'UNE ANNÉE COMPLÈTE ! Vous êtes extraordinaire !',
      ja: '丸1年！あなたは素晴らしい！',
      ar: 'عام كامل! أنت استثنائي!',
      he: 'שנה שלמה! אתה יוצא דופן!',
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
