import { useState, useEffect, useMemo } from 'react';
import { Gift, Sparkles, Brain, Target, Heart, Lightbulb, X, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getToday } from '@/lib/utils';

type SurpriseType = 'quote' | 'fact' | 'challenge' | 'tip' | 'affirmation';

interface DailySurpriseContent {
  type: SurpriseType;
  title: Record<string, string>;
  content: Record<string, string>;
  emoji: string;
  action?: {
    label: Record<string, string>;
    type: 'mood' | 'habit' | 'focus' | 'gratitude';
  };
}

// Daily surprises pool - rotates based on day of year
const surprisesPool: DailySurpriseContent[] = [
  // Quotes
  {
    type: 'quote',
    emoji: '💭',
    title: {
      ru: 'Мысль дня',
      en: 'Thought of the day',
      uk: 'Думка дня',
      es: 'Pensamiento del día',
      de: 'Gedanke des Tages',
      fr: 'Pensée du jour',
    },
    content: {
      ru: '"Маленькие шаги каждый день приводят к большим переменам"',
      en: '"Small steps every day lead to big changes"',
      uk: '"Маленькі кроки щодня ведуть до великих змін"',
      es: '"Pequeños pasos cada día conducen a grandes cambios"',
      de: '"Kleine Schritte jeden Tag führen zu großen Veränderungen"',
      fr: '"De petits pas chaque jour mènent à de grands changements"',
    },
  },
  {
    type: 'quote',
    emoji: '🌟',
    title: {
      ru: 'Вдохновение',
      en: 'Inspiration',
      uk: 'Натхнення',
      es: 'Inspiración',
      de: 'Inspiration',
      fr: 'Inspiration',
    },
    content: {
      ru: '"Ты не обязан быть идеальным, чтобы быть достойным"',
      en: '"You don\'t have to be perfect to be worthy"',
      uk: '"Тобі не треба бути ідеальним, щоб бути гідним"',
      es: '"No tienes que ser perfecto para ser digno"',
      de: '"Du musst nicht perfekt sein, um würdig zu sein"',
      fr: '"Tu n\'as pas besoin d\'être parfait pour être digne"',
    },
  },
  // Facts
  {
    type: 'fact',
    emoji: '🧠',
    title: {
      ru: 'Факт дня',
      en: 'Fact of the day',
      uk: 'Факт дня',
      es: 'Dato del día',
      de: 'Fakt des Tages',
      fr: 'Fait du jour',
    },
    content: {
      ru: 'Запись благодарности снижает уровень кортизола на 23%',
      en: 'Writing gratitude reduces cortisol levels by 23%',
      uk: 'Запис подяки знижує рівень кортизолу на 23%',
      es: 'Escribir gratitud reduce los niveles de cortisol en un 23%',
      de: 'Dankbarkeit aufschreiben senkt den Cortisolspiegel um 23%',
      fr: 'Écrire sa gratitude réduit le cortisol de 23%',
    },
    action: {
      label: {
        ru: 'Записать благодарность',
        en: 'Write gratitude',
        uk: 'Записати подяку',
        es: 'Escribir gratitud',
        de: 'Dankbarkeit schreiben',
        fr: 'Écrire gratitude',
      },
      type: 'gratitude',
    },
  },
  {
    type: 'fact',
    emoji: '⏱️',
    title: {
      ru: 'Ты знал?',
      en: 'Did you know?',
      uk: 'Ти знав?',
      es: '¿Sabías que?',
      de: 'Wusstest du?',
      fr: 'Le savais-tu?',
    },
    content: {
      ru: '25 минут фокуса = 2 часа отвлечённой работы по продуктивности',
      en: '25 min of focus = 2 hours of distracted work in productivity',
      uk: '25 хвилин фокусу = 2 години відволіканої роботи за продуктивністю',
      es: '25 min de enfoque = 2 horas de trabajo distraído en productividad',
      de: '25 Min Fokus = 2 Stunden abgelenkter Arbeit an Produktivität',
      fr: '25 min de focus = 2h de travail distrait en productivité',
    },
    action: {
      label: {
        ru: 'Запустить таймер',
        en: 'Start timer',
        uk: 'Запустити таймер',
        es: 'Iniciar temporizador',
        de: 'Timer starten',
        fr: 'Démarrer minuteur',
      },
      type: 'focus',
    },
  },
  // Challenges
  {
    type: 'challenge',
    emoji: '🎯',
    title: {
      ru: 'Мини-челлендж',
      en: 'Mini challenge',
      uk: 'Міні-челендж',
      es: 'Mini desafío',
      de: 'Mini-Challenge',
      fr: 'Mini défi',
    },
    content: {
      ru: 'Запиши своё настроение 3 раза сегодня: утром, днём и вечером',
      en: 'Record your mood 3 times today: morning, afternoon, evening',
      uk: 'Запиши свій настрій 3 рази сьогодні: вранці, вдень і ввечері',
      es: 'Registra tu estado de ánimo 3 veces hoy: mañana, tarde y noche',
      de: 'Notiere deine Stimmung 3x heute: morgens, mittags, abends',
      fr: 'Note ton humeur 3 fois aujourd\'hui: matin, après-midi, soir',
    },
    action: {
      label: {
        ru: 'Записать настроение',
        en: 'Record mood',
        uk: 'Записати настрій',
        es: 'Registrar ánimo',
        de: 'Stimmung notieren',
        fr: 'Noter humeur',
      },
      type: 'mood',
    },
  },
  {
    type: 'challenge',
    emoji: '💪',
    title: {
      ru: 'Вызов дня',
      en: 'Daily challenge',
      uk: 'Виклик дня',
      es: 'Desafío del día',
      de: 'Tagesherausforderung',
      fr: 'Défi du jour',
    },
    content: {
      ru: 'Выполни все привычки до обеда — получи бонус +50 XP!',
      en: 'Complete all habits before noon — get +50 XP bonus!',
      uk: 'Виконай всі звички до обіду — отримай бонус +50 XP!',
      es: '¡Completa todos los hábitos antes del mediodía — obtén +50 XP!',
      de: 'Erledige alle Gewohnheiten vor Mittag — erhalte +50 XP!',
      fr: 'Complète toutes les habitudes avant midi — gagne +50 XP!',
    },
    action: {
      label: {
        ru: 'К привычкам',
        en: 'Go to habits',
        uk: 'До звичок',
        es: 'Ir a hábitos',
        de: 'Zu Gewohnheiten',
        fr: 'Aux habitudes',
      },
      type: 'habit',
    },
  },
  // Tips
  {
    type: 'tip',
    emoji: '💡',
    title: {
      ru: 'Совет',
      en: 'Tip',
      uk: 'Порада',
      es: 'Consejo',
      de: 'Tipp',
      fr: 'Conseil',
    },
    content: {
      ru: 'Попробуй технику "2 минуты": если дело занимает меньше 2 минут — сделай сейчас',
      en: 'Try the "2-minute rule": if it takes less than 2 minutes — do it now',
      uk: 'Спробуй техніку "2 хвилини": якщо справа займає менше 2 хвилин — зроби зараз',
      es: 'Prueba la regla de "2 minutos": si toma menos de 2 minutos — hazlo ahora',
      de: 'Probiere die "2-Minuten-Regel": dauert es weniger als 2 Min — mach es jetzt',
      fr: 'Essaie la règle des "2 minutes": si ça prend moins de 2 min — fais-le maintenant',
    },
  },
  {
    type: 'tip',
    emoji: '🌊',
    title: {
      ru: 'Лайфхак',
      en: 'Life hack',
      uk: 'Лайфхак',
      es: 'Truco',
      de: 'Lifehack',
      fr: 'Astuce',
    },
    content: {
      ru: 'Глубокий вдох на 4 счёта, задержка на 4, выдох на 4 — мгновенно снижает стресс',
      en: 'Deep breath for 4 counts, hold for 4, exhale for 4 — instantly reduces stress',
      uk: 'Глибокий вдих на 4 рахунки, затримка на 4, видих на 4 — миттєво знижує стрес',
      es: 'Respiración profunda por 4, aguanta 4, exhala 4 — reduce el estrés al instante',
      de: 'Tief einatmen 4 Zähler, halten 4, ausatmen 4 — senkt Stress sofort',
      fr: 'Inspire 4 temps, retiens 4, expire 4 — réduit le stress instantanément',
    },
  },
  // Affirmations
  {
    type: 'affirmation',
    emoji: '✨',
    title: {
      ru: 'Аффирмация',
      en: 'Affirmation',
      uk: 'Афірмація',
      es: 'Afirmación',
      de: 'Affirmation',
      fr: 'Affirmation',
    },
    content: {
      ru: 'Я заслуживаю отдых и заботу о себе',
      en: 'I deserve rest and self-care',
      uk: 'Я заслуговую відпочинок і турботу про себе',
      es: 'Merezco descanso y autocuidado',
      de: 'Ich verdiene Ruhe und Selbstfürsorge',
      fr: 'Je mérite du repos et de prendre soin de moi',
    },
  },
  {
    type: 'affirmation',
    emoji: '🌈',
    title: {
      ru: 'Напоминание',
      en: 'Reminder',
      uk: 'Нагадування',
      es: 'Recordatorio',
      de: 'Erinnerung',
      fr: 'Rappel',
    },
    content: {
      ru: 'Прогресс важнее совершенства. Каждый шаг считается.',
      en: 'Progress over perfection. Every step counts.',
      uk: 'Прогрес важливіший за досконалість. Кожен крок рахується.',
      es: 'El progreso importa más que la perfección. Cada paso cuenta.',
      de: 'Fortschritt vor Perfektion. Jeder Schritt zählt.',
      fr: 'Le progrès compte plus que la perfection. Chaque pas compte.',
    },
  },
];

// Helper function to get icon for surprise type - avoids module-level const with component refs
function getTypeIcon(type: SurpriseType) {
  switch (type) {
    case 'quote': return Sparkles;
    case 'fact': return Brain;
    case 'challenge': return Target;
    case 'tip': return Lightbulb;
    case 'affirmation': return Heart;
    default: return Gift;
  }
}

// Helper function to get color for surprise type
function getTypeColor(type: SurpriseType) {
  switch (type) {
    case 'quote': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
    case 'fact': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
    case 'challenge': return 'from-orange-500/20 to-amber-500/20 border-orange-500/30';
    case 'tip': return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    case 'affirmation': return 'from-rose-500/20 to-pink-500/20 border-rose-500/30';
    default: return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
  }
}

interface DailySurpriseProps {
  onNavigate?: (section: 'mood' | 'habits' | 'focus' | 'gratitude') => void;
}

export function DailySurprise({ onNavigate }: DailySurpriseProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenToday, setHasSeenToday] = useState(false);

  // Get today's surprise based on day of year
  const todaySurprise = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return surprisesPool[dayOfYear % surprisesPool.length];
  }, []);

  // Check if already seen today
  useEffect(() => {
    const seenDate = localStorage.getItem('zenflow-daily-surprise-seen');
    const today = getToday();
    if (seenDate === today) {
      setHasSeenToday(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    const today = getToday();
    localStorage.setItem('zenflow-daily-surprise-seen', today);
    setHasSeenToday(true);
  };

  const handleAction = () => {
    if (todaySurprise.action && onNavigate) {
      const sectionMap: Record<string, 'mood' | 'habits' | 'focus' | 'gratitude'> = {
        mood: 'mood',
        habit: 'habits',
        focus: 'focus',
        gratitude: 'gratitude',
      };
      onNavigate(sectionMap[todaySurprise.action.type]);
      setIsOpen(false);
    }
  };

  const Icon = getTypeIcon(todaySurprise.type);

  // Collapsed card (shows when not yet opened today)
  if (!hasSeenToday) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          "w-full p-4 rounded-2xl border transition-all",
          "bg-gradient-to-r", getTypeColor(todaySurprise.type),
          "hover:scale-[1.02] active:scale-[0.98]",
          "animate-pulse-subtle"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-foreground">
              {language === 'ru' ? 'Сюрприз дня' :
               language === 'uk' ? 'Сюрприз дня' :
               language === 'es' ? 'Sorpresa del día' :
               language === 'de' ? 'Tagesüberraschung' :
               language === 'fr' ? 'Surprise du jour' :
               language === 'ja' ? '今日のサプライズ' :
               'Daily Surprise'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ru' ? 'Нажми, чтобы открыть!' :
               language === 'uk' ? 'Натисни, щоб відкрити!' :
               language === 'es' ? '¡Toca para abrir!' :
               language === 'de' ? 'Tippe zum Öffnen!' :
               language === 'fr' ? 'Appuie pour ouvrir!' :
               language === 'ja' ? 'タップして開こう！' :
               'Tap to reveal!'}
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
      </button>
    );
  }

  // Already seen - show mini reminder
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full p-3 rounded-xl border transition-all opacity-70 hover:opacity-100",
          "bg-gradient-to-r", getTypeColor(todaySurprise.type),
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{todaySurprise.emoji}</span>
          <p className="text-sm text-muted-foreground flex-1 text-left truncate">
            {todaySurprise.title[language] || todaySurprise.title.en}
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
    );
  }

  // Full expanded card
  return (
    <div className={cn(
      "relative p-5 rounded-2xl border transition-all animate-scale-in",
      "bg-gradient-to-br", getTypeColor(todaySurprise.type),
    )}>
      {/* Close button */}
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/10 transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white/10 rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {todaySurprise.title[language] || todaySurprise.title.en}
          </p>
          <p className="text-xs text-muted-foreground">
            {getToday()}
          </p>
        </div>
        <span className="text-2xl ml-auto">{todaySurprise.emoji}</span>
      </div>

      {/* Content */}
      <p className="text-foreground/90 leading-relaxed mb-4">
        {todaySurprise.content[language] || todaySurprise.content.en}
      </p>

      {/* Action button */}
      {todaySurprise.action && (
        <button
          onClick={handleAction}
          className={cn(
            "w-full py-2.5 rounded-xl font-medium transition-all",
            "bg-primary/20 hover:bg-primary/30 text-primary",
            "flex items-center justify-center gap-2"
          )}
        >
          <span>{todaySurprise.action.label[language] || todaySurprise.action.label.en}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
