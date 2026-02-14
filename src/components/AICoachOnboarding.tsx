/**
 * AI Coach Onboarding - Personalization questions
 * Shows after WelcomeTutorial, before OnboardingFlow
 */

import { useState } from 'react';
import { Sparkles, Target, Brain, Heart, Zap, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAICoach } from '@/contexts/AICoachContext';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface AICoachOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

type Step = 'intro' | 'goal' | 'concern' | 'stress';
type GoalId = 'wellbeing' | 'productivity' | 'habits' | 'mood';

const GOALS: readonly { id: GoalId; icon: typeof Heart; emoji: string }[] = [
  { id: 'wellbeing', icon: Heart, emoji: '🧘' },
  { id: 'productivity', icon: Target, emoji: '🎯' },
  { id: 'habits', icon: Zap, emoji: '✨' },
  { id: 'mood', icon: Brain, emoji: '💭' },
];

export function AICoachOnboarding({ onComplete, onSkip }: AICoachOnboardingProps) {
  const { t: _t, language } = useLanguage();
  const { saveOnboardingAnswer } = useAICoach();

  const [step, setStep] = useState<Step>('intro');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [concern, setConcern] = useState('');
  const [stressMethod, setStressMethod] = useState('');

  // Translations
  const texts = {
    intro: {
      title: {
        en: 'Hi! I\'m your AI coach',
        uk: 'Привіт! Я твій AI-коуч',
        es: '¡Hola! Soy tu coach de IA',
        de: 'Hallo! Ich bin dein AI-Coach',
        fr: 'Salut! Je suis ton coach IA',
        ja: 'こんにちは！私はあなたのAIコーチです',
        ar: 'مرحبًا! أنا مدربك الذكي',
        he: 'היי! אני המאמן AI שלך',
      },
      subtitle: {
        en: 'I\'ll help you achieve goals and support you in difficult moments',
        uk: 'Допоможу тобі досягати цілей і підтримаю в важкі моменти',
        es: 'Te ayudaré a alcanzar metas y te apoyaré en momentos difíciles',
        de: 'Ich helfe dir, Ziele zu erreichen und unterstütze dich in schweren Momenten',
        fr: 'Je t\'aiderai à atteindre tes objectifs et te soutiendrai dans les moments difficiles',
        ja: '目標達成をサポートし、困難な時に支えます',
        ar: 'سأساعدك على تحقيق أهدافك وأدعمك في الأوقات الصعبة',
        he: 'אעזור לך להשיג מטרות ואתמוך בך ברגעים קשים',
      },
    },
    goal: {
      title: {
        en: 'What brings you to ZenFlow?',
        uk: 'Що привело тебе в ZenFlow?',
        es: '¿Qué te trae a ZenFlow?',
        de: 'Was bringt dich zu ZenFlow?',
        fr: 'Qu\'est-ce qui t\'amène à ZenFlow?',
        ja: 'ZenFlowを始めたきっかけは？',
        ar: 'ما الذي جلبك إلى ZenFlow؟',
        he: 'מה הביא אותך ל-ZenFlow?',
      },
      subtitle: {
        en: 'This helps me personalize your experience',
        uk: 'Це допоможе мені персоналізувати твій досвід',
        es: 'Esto me ayuda a personalizar tu experiencia',
        de: 'Das hilft mir, dein Erlebnis zu personalisieren',
        fr: 'Cela m\'aide à personnaliser ton expérience',
        ja: 'あなたに合った体験を提供するために教えてください',
        ar: 'هذا يساعدني على تخصيص تجربتك',
        he: 'זה עוזר לי להתאים את החוויה שלך',
      },
    },
    concern: {
      title: {
        en: 'What\'s on your mind lately?',
        uk: 'Що тебе зараз турбує?',
        es: '¿Qué tienes en mente últimamente?',
        de: 'Was beschäftigt dich gerade?',
        fr: 'Qu\'est-ce qui te préoccupe en ce moment?',
        ja: '最近気になっていることは？',
        ar: 'ما الذي يشغل بالك مؤخرًا؟',
        he: 'מה מעסיק אותך לאחרונה?',
      },
      subtitle: {
        en: 'Share what you\'d like to work on',
        uk: 'Поділись тим, над чим хочеш попрацювати',
        es: 'Comparte en qué te gustaría trabajar',
        de: 'Teile mit, woran du arbeiten möchtest',
        fr: 'Partage ce sur quoi tu aimerais travailler',
        ja: '取り組みたいことを教えてください',
        ar: 'شارك ما تريد العمل عليه',
        he: 'שתף במה שהיית רוצה לעבוד עליו',
      },
      placeholder: {
        en: 'e.g., hard to focus, procrastination...',
        uk: 'Наприклад: важко зосередитись, прокрастинація...',
        es: 'ej., difícil concentrarse, procrastinación...',
        de: 'z.B., schwer zu fokussieren, Prokrastination...',
        fr: 'ex., difficile de se concentrer, procrastination...',
        ja: '例：集中できない、先延ばし...',
        ar: 'مثلاً: صعوبة التركيز، التسويف...',
        he: 'למשל: קשה להתרכז, דחיינות...',
      },
    },
    stress: {
      title: {
        en: 'How do you usually handle stress?',
        uk: 'Як ти зазвичай справляєшся зі стресом?',
        es: '¿Cómo manejas el estrés normalmente?',
        de: 'Wie gehst du normalerweise mit Stress um?',
        fr: 'Comment gères-tu le stress habituellement?',
        ja: 'ストレス解消法は？',
        ar: 'كيف تتعامل مع التوتر عادةً؟',
        he: 'איך אתה מתמודד עם לחץ בדרך כלל?',
      },
      subtitle: {
        en: 'I\'ll remind you of this when needed',
        uk: 'Я нагадаю тобі про це, коли буде потрібно',
        es: 'Te lo recordaré cuando sea necesario',
        de: 'Ich erinnere dich daran, wenn nötig',
        fr: 'Je te le rappellerai quand ce sera nécessaire',
        ja: '必要なときにお知らせします',
        ar: 'سأذكّرك بهذا عند الحاجة',
        he: 'אזכיר לך את זה כשיהיה צורך',
      },
      placeholder: {
        en: 'e.g., walk, listen to music, breathe...',
        uk: 'Наприклад: гуляю, слухаю музику, дихаю...',
        es: 'ej., caminar, escuchar música, respirar...',
        de: 'z.B., spazieren, Musik hören, atmen...',
        fr: 'ex., marcher, écouter de la musique, respirer...',
        ja: '例：散歩、音楽を聴く、深呼吸...',
        ar: 'مثلاً: المشي، الاستماع للموسيقى، التنفس...',
        he: 'למשל: הליכה, האזנה למוזיקה, נשימות...',
      },
    },
    goals: {
      wellbeing: {
        en: 'Wellbeing',
        uk: 'Благополуччя',
        es: 'Bienestar',
        de: 'Wohlbefinden',
        fr: 'Bien-être',
        ja: 'ウェルビーイング',
        ar: 'الرفاهية',
        he: 'רווחה',
      },
      productivity: {
        en: 'Productivity',
        uk: 'Продуктивність',
        es: 'Productividad',
        de: 'Produktivität',
        fr: 'Productivité',
        ja: '生産性',
        ar: 'الإنتاجية',
        he: 'פרודוקטיביות',
      },
      habits: {
        en: 'Habits',
        uk: 'Звички',
        es: 'Hábitos',
        de: 'Gewohnheiten',
        fr: 'Habitudes',
        ja: '習慣',
        ar: 'العادات',
        he: 'הרגלים',
      },
      mood: {
        en: 'Mood',
        uk: 'Настрій',
        es: 'Estado de ánimo',
        de: 'Stimmung',
        fr: 'Humeur',
        ja: '気分',
        ar: 'المزاج',
        he: 'מצב רוח',
      },
    },
    buttons: {
      skip: {
        en: 'Skip',
        uk: 'Пропустити',
        es: 'Omitir',
        de: 'Überspringen',
        fr: 'Passer',
        ja: 'スキップ',
        ar: 'تخطي',
        he: 'דלג',
      },
      next: {
        en: 'Next',
        uk: 'Далі',
        es: 'Siguiente',
        de: 'Weiter',
        fr: 'Suivant',
        ja: '次へ',
        ar: 'التالي',
        he: 'הבא',
      },
      start: {
        en: 'Start',
        uk: 'Почати',
        es: 'Empezar',
        de: 'Starten',
        fr: 'Commencer',
        ja: '開始',
        ar: 'ابدأ',
        he: 'התחל',
      },
      letsGo: {
        en: 'Let\'s go!',
        uk: 'Поїхали!',
        es: '¡Vamos!',
        de: 'Los geht\'s!',
        fr: 'C\'est parti!',
        ja: 'レッツゴー！',
        ar: 'هيا بنا!',
        he: 'יאללה!',
      },
    },
  };

  const getText = (section: keyof typeof texts, key: string) => {
    const sectionTexts = texts[section] as Record<string, Record<string, string>>;
    return sectionTexts[key]?.[language] || sectionTexts[key]?.en || '';
  };

  const handleGoalSelect = (goalId: GoalId) => {
    void haptics.buttonTap();
    setSelectedGoal(goalId);
    saveOnboardingAnswer('mainGoal', goalId);
  };

  const handleNext = () => {
    void haptics.buttonTap();
    if (step === 'intro') {
      setStep('goal');
    } else if (step === 'goal' && selectedGoal) {
      setStep('concern');
    } else if (step === 'concern') {
      if (concern.trim()) {
        saveOnboardingAnswer('currentConcern', concern);
      }
      setStep('stress');
    } else if (step === 'stress') {
      if (stressMethod.trim()) {
        saveOnboardingAnswer('stressManagement', stressMethod);
      }
      onComplete();
    }
  };

  const handleSkip = () => {
    void haptics.buttonTap();
    onSkip();
  };

  const steps: Step[] = ['intro', 'goal', 'concern', 'stress'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center p-4 motion-safe:animate-fade-in">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center motion-safe:animate-scale-in">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {step === 'intro' ? getText('intro', 'title') :
             step === 'goal' ? getText('goal', 'title') :
             step === 'concern' ? getText('concern', 'title') :
             getText('stress', 'title')}
          </h1>
          <p className="text-muted-foreground">
            {step === 'intro' ? getText('intro', 'subtitle') :
             step === 'goal' ? getText('goal', 'subtitle') :
             step === 'concern' ? getText('concern', 'subtitle') :
             getText('stress', 'subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl p-6 shadow-xl">
          {step === 'intro' && (
            <div className="text-center py-4">
              <div className="flex justify-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-2xl">💪</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">🧠</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {{ en: 'I\'ll answer questions, help with motivation and support you in difficult moments',
                   uk: 'Відповім на питання, допоможу з мотивацією і підтримаю в важкі моменти',
                   es: 'Responderé preguntas, ayudaré con la motivación y te apoyaré en momentos difíciles',
                   de: 'Ich beantworte Fragen, helfe bei der Motivation und unterstütze in schwierigen Momenten',
                   fr: 'Je répondrai aux questions, aiderai avec la motivation et soutiendrai dans les moments difficiles',
                   ja: '質問に答え、モチベーションを高め、困難な時にサポートします',
                   ar: 'سأجيب على الأسئلة وأساعد في التحفيز وأدعمك في الأوقات الصعبة',
                   he: 'אענה על שאלות, אעזור עם מוטיבציה ואתמוך ברגעים קשים',
                }[language] || 'I\'ll answer questions, help with motivation and support you in difficult moments'}
              </p>
            </div>
          )}

          {step === 'goal' && (
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => handleGoalSelect(goal.id)}
                  className={cn(
                    "p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95",
                    selectedGoal === goal.id
                      ? "bg-primary text-primary-foreground ring-2 ring-primary"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  <span className="text-3xl">{goal.emoji}</span>
                  <span className="text-sm font-medium text-center">
                    {getText('goals', goal.id)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 'concern' && (
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder={getText('concern', 'placeholder')}
              className="w-full h-32 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          )}

          {step === 'stress' && (
            <textarea
              value={stressMethod}
              onChange={(e) => setStressMethod(e.target.value)}
              placeholder={getText('stress', 'placeholder')}
              className="w-full h-32 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSkip}
            className="flex-1 py-4 bg-secondary/50 text-secondary-foreground rounded-xl font-semibold hover:bg-secondary transition-colors active:scale-[0.98]"
          >
            {getText('buttons', 'skip')}
          </button>
          <button
            onClick={handleNext}
            disabled={step === 'goal' && !selectedGoal}
            className={cn(
              "flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
              (step !== 'goal' || selectedGoal)
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {step === 'intro' ? getText('buttons', 'letsGo') :
             step === 'stress' ? getText('buttons', 'start') :
             getText('buttons', 'next')}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-2 rounded-full transition-all",
                i === currentStepIndex ? "w-6 bg-primary" :
                i < currentStepIndex ? "w-2 bg-primary/50" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
