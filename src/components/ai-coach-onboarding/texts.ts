/**
 * AI Coach Onboarding — i18n texts, types, and constants
 * Extracted from AICoachOnboarding.tsx for TD-20 decomposition
 */

import { Heart, Target, Zap, Brain } from 'lucide-react';

export type Step = 'intro' | 'goal' | 'concern' | 'stress';
export type GoalId = 'wellbeing' | 'productivity' | 'habits' | 'mood';

export const GOALS: readonly { id: GoalId; icon: typeof Heart; emoji: string }[] = [
  { id: 'wellbeing', icon: Heart, emoji: '\u{1F9D8}' },
  { id: 'productivity', icon: Target, emoji: '\u{1F3AF}' },
  { id: 'habits', icon: Zap, emoji: '\u2728' },
  { id: 'mood', icon: Brain, emoji: '\u{1F4AD}' },
];

export const texts = {
  intro: {
    title: {
      en: 'Hi! I\'m your AI coach',
      uk: '\u041F\u0440\u0438\u0432\u0456\u0442! \u042F \u0442\u0432\u0456\u0439 AI-\u043A\u043E\u0443\u0447',
      es: '\u00A1Hola! Soy tu coach de IA',
      de: 'Hallo! Ich bin dein AI-Coach',
      fr: 'Salut! Je suis ton coach IA',
      ja: '\u3053\u3093\u306B\u3061\u306F\uFF01\u79C1\u306F\u3042\u306A\u305F\u306EAI\u30B3\u30FC\u30C1\u3067\u3059',
      ar: '\u0645\u0631\u062D\u0628\u064B\u0627! \u0623\u0646\u0627 \u0645\u062F\u0631\u0628\u0643 \u0627\u0644\u0630\u0643\u064A',
      he: '\u05D4\u05D9\u05D9! \u05D0\u05E0\u05D9 \u05D4\u05DE\u05D0\u05DE\u05DF AI \u05E9\u05DC\u05DA',
    },
    subtitle: {
      en: 'I\'ll help you achieve goals and support you in difficult moments',
      uk: '\u0414\u043E\u043F\u043E\u043C\u043E\u0436\u0443 \u0442\u043E\u0431\u0456 \u0434\u043E\u0441\u044F\u0433\u0430\u0442\u0438 \u0446\u0456\u043B\u0435\u0439 \u0456 \u043F\u0456\u0434\u0442\u0440\u0438\u043C\u0430\u044E \u0432 \u0432\u0430\u0436\u043A\u0456 \u043C\u043E\u043C\u0435\u043D\u0442\u0438',
      es: 'Te ayudar\u00E9 a alcanzar metas y te apoyar\u00E9 en momentos dif\u00EDciles',
      de: 'Ich helfe dir, Ziele zu erreichen und unterst\u00FCtze dich in schweren Momenten',
      fr: 'Je t\'aiderai \u00E0 atteindre tes objectifs et te soutiendrai dans les moments difficiles',
      ja: '\u76EE\u6A19\u9054\u6210\u3092\u30B5\u30DD\u30FC\u30C8\u3057\u3001\u56F0\u96E3\u306A\u6642\u306B\u652F\u3048\u307E\u3059',
      ar: '\u0633\u0623\u0633\u0627\u0639\u062F\u0643 \u0639\u0644\u0649 \u062A\u062D\u0642\u064A\u0642 \u0623\u0647\u062F\u0627\u0641\u0643 \u0648\u0623\u062F\u0639\u0645\u0643 \u0641\u064A \u0627\u0644\u0623\u0648\u0642\u0627\u062A \u0627\u0644\u0635\u0639\u0628\u0629',
      he: '\u05D0\u05E2\u05D6\u05D5\u05E8 \u05DC\u05DA \u05DC\u05D4\u05E9\u05D9\u05D2 \u05DE\u05D8\u05E8\u05D5\u05EA \u05D5\u05D0\u05EA\u05DE\u05D5\u05DA \u05D1\u05DA \u05D1\u05E8\u05D2\u05E2\u05D9\u05DD \u05E7\u05E9\u05D9\u05DD',
    },
  },
  goal: {
    title: {
      en: 'What brings you to ZenFlow?',
      uk: '\u0429\u043E \u043F\u0440\u0438\u0432\u0435\u043B\u043E \u0442\u0435\u0431\u0435 \u0432 ZenFlow?',
      es: '\u00BFQu\u00E9 te trae a ZenFlow?',
      de: 'Was bringt dich zu ZenFlow?',
      fr: 'Qu\'est-ce qui t\'am\u00E8ne \u00E0 ZenFlow?',
      ja: 'ZenFlow\u3092\u59CB\u3081\u305F\u304D\u3063\u304B\u3051\u306F\uFF1F',
      ar: '\u0645\u0627 \u0627\u0644\u0630\u064A \u062C\u0644\u0628\u0643 \u0625\u0644\u0649 ZenFlow\u061F',
      he: '\u05DE\u05D4 \u05D4\u05D1\u05D9\u05D0 \u05D0\u05D5\u05EA\u05DA \u05DC-ZenFlow?',
    },
    subtitle: {
      en: 'This helps me personalize your experience',
      uk: '\u0426\u0435 \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0435 \u043C\u0435\u043D\u0456 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u0456\u0437\u0443\u0432\u0430\u0442\u0438 \u0442\u0432\u0456\u0439 \u0434\u043E\u0441\u0432\u0456\u0434',
      es: 'Esto me ayuda a personalizar tu experiencia',
      de: 'Das hilft mir, dein Erlebnis zu personalisieren',
      fr: 'Cela m\'aide \u00E0 personnaliser ton exp\u00E9rience',
      ja: '\u3042\u306A\u305F\u306B\u5408\u3063\u305F\u4F53\u9A13\u3092\u63D0\u4F9B\u3059\u308B\u305F\u3081\u306B\u6559\u3048\u3066\u304F\u3060\u3055\u3044',
      ar: '\u0647\u0630\u0627 \u064A\u0633\u0627\u0639\u062F\u0646\u064A \u0639\u0644\u0649 \u062A\u062E\u0635\u064A\u0635 \u062A\u062C\u0631\u0628\u062A\u0643',
      he: '\u05D6\u05D4 \u05E2\u05D5\u05D6\u05E8 \u05DC\u05D9 \u05DC\u05D4\u05EA\u05D0\u05D9\u05DD \u05D0\u05EA \u05D4\u05D7\u05D5\u05D5\u05D9\u05D4 \u05E9\u05DC\u05DA',
    },
  },
  concern: {
    title: {
      en: 'What\'s on your mind lately?',
      uk: '\u0429\u043E \u0442\u0435\u0431\u0435 \u0437\u0430\u0440\u0430\u0437 \u0442\u0443\u0440\u0431\u0443\u0454?',
      es: '\u00BFQu\u00E9 tienes en mente \u00FAltimamente?',
      de: 'Was besch\u00E4ftigt dich gerade?',
      fr: 'Qu\'est-ce qui te pr\u00E9occupe en ce moment?',
      ja: '\u6700\u8FD1\u6C17\u306B\u306A\u3063\u3066\u3044\u308B\u3053\u3068\u306F\uFF1F',
      ar: '\u0645\u0627 \u0627\u0644\u0630\u064A \u064A\u0634\u063A\u0644 \u0628\u0627\u0644\u0643 \u0645\u0624\u062E\u0631\u064B\u0627\u061F',
      he: '\u05DE\u05D4 \u05DE\u05E2\u05E1\u05D9\u05E7 \u05D0\u05D5\u05EA\u05DA \u05DC\u05D0\u05D7\u05E8\u05D5\u05E0\u05D4?',
    },
    subtitle: {
      en: 'Share what you\'d like to work on',
      uk: '\u041F\u043E\u0434\u0456\u043B\u0438\u0441\u044C \u0442\u0438\u043C, \u043D\u0430\u0434 \u0447\u0438\u043C \u0445\u043E\u0447\u0435\u0448 \u043F\u043E\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u0442\u0438',
      es: 'Comparte en qu\u00E9 te gustar\u00EDa trabajar',
      de: 'Teile mit, woran du arbeiten m\u00F6chtest',
      fr: 'Partage ce sur quoi tu aimerais travailler',
      ja: '\u53D6\u308A\u7D44\u307F\u305F\u3044\u3053\u3068\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044',
      ar: '\u0634\u0627\u0631\u0643 \u0645\u0627 \u062A\u0631\u064A\u062F \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u064A\u0647',
      he: '\u05E9\u05EA\u05E3 \u05D1\u05DE\u05D4 \u05E9\u05D4\u05D9\u05D9\u05EA \u05E8\u05D5\u05E6\u05D4 \u05DC\u05E2\u05D1\u05D5\u05D3 \u05E2\u05DC\u05D9\u05D5',
    },
    placeholder: {
      en: 'e.g., hard to focus, procrastination...',
      uk: '\u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: \u0432\u0430\u0436\u043A\u043E \u0437\u043E\u0441\u0435\u0440\u0435\u0434\u0438\u0442\u0438\u0441\u044C, \u043F\u0440\u043E\u043A\u0440\u0430\u0441\u0442\u0438\u043D\u0430\u0446\u0456\u044F...',
      es: 'ej., dif\u00EDcil concentrarse, procrastinaci\u00F3n...',
      de: 'z.B., schwer zu fokussieren, Prokrastination...',
      fr: 'ex., difficile de se concentrer, procrastination...',
      ja: '\u4F8B\uFF1A\u96C6\u4E2D\u3067\u304D\u306A\u3044\u3001\u5148\u5EF6\u3070\u3057...',
      ar: '\u0645\u062B\u0644\u0627\u064B: \u0635\u0639\u0648\u0628\u0629 \u0627\u0644\u062A\u0631\u0643\u064A\u0632\u060C \u0627\u0644\u062A\u0633\u0648\u064A\u0641...',
      he: '\u05DC\u05DE\u05E9\u05DC: \u05E7\u05E9\u05D4 \u05DC\u05D4\u05EA\u05E8\u05DB\u05D6, \u05D3\u05D7\u05D9\u05D9\u05E0\u05D5\u05EA...',
    },
  },
  stress: {
    title: {
      en: 'How do you usually handle stress?',
      uk: '\u042F\u043A \u0442\u0438 \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0441\u043F\u0440\u0430\u0432\u043B\u044F\u0454\u0448\u0441\u044F \u0437\u0456 \u0441\u0442\u0440\u0435\u0441\u043E\u043C?',
      es: '\u00BFC\u00F3mo manejas el estr\u00E9s normalmente?',
      de: 'Wie gehst du normalerweise mit Stress um?',
      fr: 'Comment g\u00E8res-tu le stress habituellement?',
      ja: '\u30B9\u30C8\u30EC\u30B9\u89E3\u6D88\u6CD5\u306F\uFF1F',
      ar: '\u0643\u064A\u0641 \u062A\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u062A\u0648\u062A\u0631 \u0639\u0627\u062F\u0629\u064B\u061F',
      he: '\u05D0\u05D9\u05DA \u05D0\u05EA\u05D4 \u05DE\u05EA\u05DE\u05D5\u05D3\u05D3 \u05E2\u05DD \u05DC\u05D7\u05E5 \u05D1\u05D3\u05E8\u05DA \u05DB\u05DC\u05DC?',
    },
    subtitle: {
      en: 'I\'ll remind you of this when needed',
      uk: '\u042F \u043D\u0430\u0433\u0430\u0434\u0430\u044E \u0442\u043E\u0431\u0456 \u043F\u0440\u043E \u0446\u0435, \u043A\u043E\u043B\u0438 \u0431\u0443\u0434\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E',
      es: 'Te lo recordar\u00E9 cuando sea necesario',
      de: 'Ich erinnere dich daran, wenn n\u00F6tig',
      fr: 'Je te le rappellerai quand ce sera n\u00E9cessaire',
      ja: '\u5FC5\u8981\u306A\u3068\u304D\u306B\u304A\u77E5\u3089\u305B\u3057\u307E\u3059',
      ar: '\u0633\u0623\u0630\u0643\u0651\u0631\u0643 \u0628\u0647\u0630\u0627 \u0639\u0646\u062F \u0627\u0644\u062D\u0627\u062C\u0629',
      he: '\u05D0\u05D6\u05DB\u05D9\u05E8 \u05DC\u05DA \u05D0\u05EA \u05D6\u05D4 \u05DB\u05E9\u05D9\u05D4\u05D9\u05D4 \u05E6\u05D5\u05E8\u05DA',
    },
    placeholder: {
      en: 'e.g., walk, listen to music, breathe...',
      uk: '\u041D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434: \u0433\u0443\u043B\u044F\u044E, \u0441\u043B\u0443\u0445\u0430\u044E \u043C\u0443\u0437\u0438\u043A\u0443, \u0434\u0438\u0445\u0430\u044E...',
      es: 'ej., caminar, escuchar m\u00FAsica, respirar...',
      de: 'z.B., spazieren, Musik h\u00F6ren, atmen...',
      fr: 'ex., marcher, \u00E9couter de la musique, respirer...',
      ja: '\u4F8B\uFF1A\u6563\u6B69\u3001\u97F3\u697D\u3092\u8074\u304F\u3001\u6DF1\u547C\u5438...',
      ar: '\u0645\u062B\u0644\u0627\u064B: \u0627\u0644\u0645\u0634\u064A\u060C \u0627\u0644\u0627\u0633\u062A\u0645\u0627\u0639 \u0644\u0644\u0645\u0648\u0633\u064A\u0642\u0649\u060C \u0627\u0644\u062A\u0646\u0641\u0633...',
      he: '\u05DC\u05DE\u05E9\u05DC: \u05D4\u05DC\u05D9\u05DB\u05D4, \u05D4\u05D0\u05D6\u05E0\u05D4 \u05DC\u05DE\u05D5\u05D6\u05D9\u05E7\u05D4, \u05E0\u05E9\u05D9\u05DE\u05D5\u05EA...',
    },
  },
  goals: {
    wellbeing: {
      en: 'Wellbeing',
      uk: '\u0411\u043B\u0430\u0433\u043E\u043F\u043E\u043B\u0443\u0447\u0447\u044F',
      es: 'Bienestar',
      de: 'Wohlbefinden',
      fr: 'Bien-\u00EAtre',
      ja: '\u30A6\u30A7\u30EB\u30D3\u30FC\u30A4\u30F3\u30B0',
      ar: '\u0627\u0644\u0631\u0641\u0627\u0647\u064A\u0629',
      he: '\u05E8\u05D5\u05D5\u05D7\u05D4',
    },
    productivity: {
      en: 'Productivity',
      uk: '\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0456\u0441\u0442\u044C',
      es: 'Productividad',
      de: 'Produktivit\u00E4t',
      fr: 'Productivit\u00E9',
      ja: '\u751F\u7523\u6027',
      ar: '\u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629',
      he: '\u05E4\u05E8\u05D5\u05D3\u05D5\u05E7\u05D8\u05D9\u05D1\u05D9\u05D5\u05EA',
    },
    habits: {
      en: 'Habits',
      uk: '\u0417\u0432\u0438\u0447\u043A\u0438',
      es: 'H\u00E1bitos',
      de: 'Gewohnheiten',
      fr: 'Habitudes',
      ja: '\u7FD2\u6163',
      ar: '\u0627\u0644\u0639\u0627\u062F\u0627\u062A',
      he: '\u05D4\u05E8\u05D2\u05DC\u05D9\u05DD',
    },
    mood: {
      en: 'Mood',
      uk: '\u041D\u0430\u0441\u0442\u0440\u0456\u0439',
      es: 'Estado de \u00E1nimo',
      de: 'Stimmung',
      fr: 'Humeur',
      ja: '\u6C17\u5206',
      ar: '\u0627\u0644\u0645\u0632\u0627\u062C',
      he: '\u05DE\u05E6\u05D1 \u05E8\u05D5\u05D7',
    },
  },
  buttons: {
    skip: {
      en: 'Skip',
      uk: '\u041F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u0438',
      es: 'Omitir',
      de: '\u00DCberspringen',
      fr: 'Passer',
      ja: '\u30B9\u30AD\u30C3\u30D7',
      ar: '\u062A\u062E\u0637\u064A',
      he: '\u05D3\u05DC\u05D2',
    },
    next: {
      en: 'Next',
      uk: '\u0414\u0430\u043B\u0456',
      es: 'Siguiente',
      de: 'Weiter',
      fr: 'Suivant',
      ja: '\u6B21\u3078',
      ar: '\u0627\u0644\u062A\u0627\u0644\u064A',
      he: '\u05D4\u05D1\u05D0',
    },
    start: {
      en: 'Start',
      uk: '\u041F\u043E\u0447\u0430\u0442\u0438',
      es: 'Empezar',
      de: 'Starten',
      fr: 'Commencer',
      ja: '\u958B\u59CB',
      ar: '\u0627\u0628\u062F\u0623',
      he: '\u05D4\u05EA\u05D7\u05DC',
    },
    letsGo: {
      en: 'Let\'s go!',
      uk: '\u041F\u043E\u0457\u0445\u0430\u043B\u0438!',
      es: '\u00A1Vamos!',
      de: 'Los geht\'s!',
      fr: 'C\'est parti!',
      ja: '\u30EC\u30C3\u30C4\u30B4\u30FC\uFF01',
      ar: '\u0647\u064A\u0627 \u0628\u0646\u0627!',
      he: '\u05D9\u05D0\u05DC\u05DC\u05D4!',
    },
  },
  introDescription: {
    en: 'I\'ll answer questions, help with motivation and support you in difficult moments',
    uk: '\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u043C \u043D\u0430 \u043F\u0438\u0442\u0430\u043D\u043D\u044F, \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0443 \u0437 \u043C\u043E\u0442\u0438\u0432\u0430\u0446\u0456\u0454\u044E \u0456 \u043F\u0456\u0434\u0442\u0440\u0438\u043C\u0430\u044E \u0432 \u0432\u0430\u0436\u043A\u0456 \u043C\u043E\u043C\u0435\u043D\u0442\u0438',
    es: 'Responder\u00E9 preguntas, ayudar\u00E9 con la motivaci\u00F3n y te apoyar\u00E9 en momentos dif\u00EDciles',
    de: 'Ich beantworte Fragen, helfe bei der Motivation und unterst\u00FCtze in schwierigen Momenten',
    fr: 'Je r\u00E9pondrai aux questions, aiderai avec la motivation et soutiendrai dans les moments difficiles',
    ja: '\u8CEA\u554F\u306B\u7B54\u3048\u3001\u30E2\u30C1\u30D9\u30FC\u30B7\u30E7\u30F3\u3092\u9AD8\u3081\u3001\u56F0\u96E3\u306A\u6642\u306B\u30B5\u30DD\u30FC\u30C8\u3057\u307E\u3059',
    ar: '\u0633\u0623\u062C\u064A\u0628 \u0639\u0644\u0649 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0623\u0633\u0627\u0639\u062F \u0641\u064A \u0627\u0644\u062A\u062D\u0641\u064A\u0632 \u0648\u0623\u062F\u0639\u0645\u0643 \u0641\u064A \u0627\u0644\u0623\u0648\u0642\u0627\u062A \u0627\u0644\u0635\u0639\u0628\u0629',
    he: '\u05D0\u05E2\u05E0\u05D4 \u05E2\u05DC \u05E9\u05D0\u05DC\u05D5\u05EA, \u05D0\u05E2\u05D6\u05D5\u05E8 \u05E2\u05DD \u05DE\u05D5\u05D8\u05D9\u05D1\u05E6\u05D9\u05D4 \u05D5\u05D0\u05EA\u05DE\u05D5\u05DA \u05D1\u05E8\u05D2\u05E2\u05D9\u05DD \u05E7\u05E9\u05D9\u05DD',
  },
} as const;

export const getText = (
  section: keyof typeof texts,
  key: string,
  language: string,
): string => {
  if (section === 'introDescription') {
    const desc = texts.introDescription as Record<string, string>;
    return desc[language] || desc.en || '';
  }
  const sectionTexts = texts[section] as Record<string, Record<string, string>>;
  return sectionTexts[key]?.[language] || sectionTexts[key]?.en || '';
};
