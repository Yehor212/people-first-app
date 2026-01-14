# ZenFlow - Следующие шаги

## ✅ Что готово

### 1. Система челленджей и бейджей
- ✅ 9 предустановленных челленджей (стрик, фокус, благодарность, общее)
- ✅ 15+ бейджей с уровнями редкости
- ✅ UI компоненты (ChallengesPanel)
- ✅ Локальное хранилище (localStorage)
- ✅ Кнопка доступа в Header
- ✅ Мультиязычная поддержка (RU, EN, UK, ES, DE, FR)

### 2. Социальный шаринг
- ✅ Instagram Stories format (9:16)
- ✅ Square posts format (1:1)
- ✅ Красивые градиенты и дизайн

### 3. Инфраструктура
- ✅ База данных Supabase миграция готова
- ✅ TypeScript типы для Challenge и Badge
- ✅ Утилиты для работы с челленджами

---

## 🚀 Что делать дальше

### Шаг 1: Применить миграцию Supabase

```bash
# 1. Убедитесь, что Supabase CLI установлен
npm install -g supabase

# 2. Войдите в Supabase
supabase login

# 3. Примените миграцию
supabase db push

# Или через веб-интерфейс Supabase:
# 1. Откройте https://supabase.com/dashboard
# 2. Выберите свой проект
# 3. SQL Editor → New Query
# 4. Скопируйте содержимое supabase/migrations/20260113_challenges_badges.sql
# 5. Run
```

### Шаг 2: Создать облачную синхронизацию

**Файл**: `src/storage/challengeSync.ts`

```typescript
import { supabase } from '@/lib/supabaseClient';
import { Challenge, Badge } from '@/types';

export async function syncChallengesWithCloud(
  userId: string,
  localChallenges: Challenge[]
): Promise<Challenge[]> {
  // 1. Pull from cloud
  const { data: cloudChallenges, error } = await supabase
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  // 2. Merge logic: cloud wins for conflicts
  const merged = mergeChall enges(localChallenges, cloudChallenges);

  // 3. Push local changes
  await pushChallenges(userId, merged);

  return merged;
}
```

### Шаг 3: Добавить синхронизацию в Index.tsx

```typescript
// В useEffect после входа пользователя
useEffect(() => {
  if (user) {
    syncChallengesWithCloud(user.id, challenges).then(synced => {
      setChallenges(synced);
    });
  }
}, [user]);
```

### Шаг 4: Создать Hyperfocus Mode

**Файл**: `src/components/HyperfocusMode.tsx`

**Фичи**:
- Полноэкранный режим
- Блокировка уведомлений
- Ambient sounds
- Дыхательная анимация
- Emergency pause кнопка

### Шаг 5: Добавить Task Momentum

**Файл**: `src/lib/taskMomentum.ts`

**Алгоритм приоритизации для ADHD**:
1. Срочные + легкие = первые
2. Короткие задачи = first (quick wins)
3. Интересные задачи = первые (dopamine)

### Шаг 6: Создать виджеты

#### iOS:
1. Создать Widget Extension в Xcode
2. Использовать Shared Data (App Groups)
3. Обновлять через Capacitor Bridge

#### Android:
1. Создать AppWidgetProvider
2. Использовать RemoteViews
3. Обновлять через WorkManager

---

## 📋 Приоритетный список задач

### Критически важно (на этой неделе):
1. ✅ Челленджи UI ← ГОТОВО
2. 🔄 Облачная синхронизация челленджей
3. 🔄 Hyperfocus Mode (базовая версия)

### Важно (следующая неделя):
4. Task Momentum алгоритм
5. Random Quest Generator
6. Dopamine Dashboard настройки

### Можно позже (через 2 недели):
7. Виджеты iOS
8. Виджеты Android
9. Time Blindness Helper
10. Habit Stacking Wizard

---

## 🎯 ADHD-Friendly Features - Детальный план

### 1. Hyperfocus Mode

**UI Компоненты**:
```typescript
// src/components/HyperfocusMode.tsx
interface HyperfocusModeProps {
  duration: number; // минуты
  onComplete: () => void;
  onPause: () => void;
}

export function HyperfocusMode({ duration, onComplete, onPause }: HyperfocusModeProps) {
  return (
    <div className="fixed inset-0 bg-black z-[100]">
      {/* Полноэкранный таймер */}
      <CircularTimer duration={duration} />

      {/* Дыхательная анимация */}
      <BreathingAnimation />

      {/* Ambient sound controls */}
      <AmbientSoundPlayer />

      {/* Emergency pause */}
      <button className="absolute top-4 right-4">
        Pause
      </button>
    </div>
  );
}
```

**Фичи**:
- ✅ Полноэкранный таймер
- ✅ Ambient sounds (белый шум, дождь, кофейня)
- ✅ Дыхательная анимация каждые 25 минут
- ✅ Автоматический перерыв каждые 90 минут
- ✅ "Emergency pause" без чувства вины
- ✅ Блокировка уведомлений (через Capacitor)

### 2. Task Momentum

**Алгоритм**:
```typescript
// src/lib/adhdTaskPriority.ts
interface Task {
  id: string;
  name: string;
  urgent: boolean;
  estimatedMinutes: number;
  userRating: number; // 1-10 (интерес)
  completed: boolean;
}

export function prioritizeForADHD(tasks: Task[]): Task[] {
  return tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      // 1. Срочность (вес: 10)
      const urgencyA = a.urgent ? 10 : 0;
      const urgencyB = b.urgent ? 10 : 0;

      // 2. Короткие задачи (вес: до 30)
      const durationA = Math.max(0, 30 - (a.estimatedMinutes || 30));
      const durationB = Math.max(0, 30 - (b.estimatedMinutes || 30));

      // 3. Интерес (вес: до 10)
      const interestA = a.userRating || 5;
      const interestB = b.userRating || 5;

      // Финальный score
      const scoreA = urgencyA + durationA + interestA;
      const scoreB = urgencyB + durationB + interestB;

      return scoreB - scoreA;
    });
}
```

**UI**:
- Показывать топ-3 задачи
- "Just 2 minutes" для сложных задач
- Стрик бонус (+10 XP за каждую подряд)
- Micro-rewards (конфетти, звуки, вибрация)

### 3. Random Quest Generator

**Компонент**: `src/components/RandomQuest.tsx`

**Примеры квестов**:
```typescript
const DAILY_QUESTS = [
  {
    id: 'morning_rush',
    title: 'Утренний рывок',
    description: 'Выполни 3 привычки до 12:00',
    reward: { xp: 50, badge: 'early_bird' },
    condition: (habits) => {
      const morning = habits.filter(h =>
        h.completedAt < '12:00' && h.date === today
      );
      return morning.length >= 3;
    }
  },
  {
    id: 'focus_sprint',
    title: 'Спринт фокуса',
    description: '30 минут фокуса без перерыва',
    reward: { xp: 75, badge: 'deep_diver' },
    condition: (sessions) => {
      return sessions.some(s => s.duration >= 30 && s.status === 'completed');
    }
  }
];
```

### 4. Dopamine Dashboard

**Настройки**:
```typescript
interface DopamineSettings {
  intensity: 'minimal' | 'normal' | 'adhd';
  animations: boolean;
  sounds: boolean;
  haptics: boolean;
  confetti: boolean;
  streakFire: boolean;
}

// ADHD Mode = ВСЕ ВКЛЮЧЕНО
const adhdMode: DopamineSettings = {
  intensity: 'adhd',
  animations: true,
  sounds: true,
  haptics: true,
  confetti: true,
  streakFire: true
};
```

**Эффекты**:
- Конфетти при завершении привычки
- Звук "Success!" (настраиваемый)
- Вибрация (короткая/длинная)
- Анимация +XP
- Огонь 🔥 для стриков
- Прогресс-бары ВЕЗДЕ

### 5. Time Blindness Helper

**Компонент**: `src/components/TimeHelper.tsx`

**Фичи**:
- Визуальный круговой таймер
- Звуковые пинги каждые 15 минут
- "Time left" индикаторы
- Прогноз: "Если начнешь сейчас → закончишь в 15:30"
- Цветовая индикация (зеленый → желтый → красный)

---

## 🔧 Технические детали

### Capacitor Plugins для ADHD Features

```bash
# Блокировка уведомлений
npm install @capacitor/local-notifications

# Вибрация
npm install @capacitor/haptics

# Ambient sounds
npm install capacitor-audio-plugin

# Виджеты (кастомный)
# Нужно создать собственный плагин
```

### Ambient Sounds

**Файлы**: `public/sounds/`
- white-noise.mp3
- rain.mp3
- coffee-shop.mp3
- ocean-waves.mp3
- forest.mp3

**Плеер**:
```typescript
// src/lib/ambientPlayer.ts
import { Audio } from 'capacitor-audio-plugin';

export class AmbientPlayer {
  private audio: HTMLAudioElement | null = null;

  async play(sound: string) {
    this.audio = new Audio(`/sounds/${sound}.mp3`);
    this.audio.loop = true;
    this.audio.volume = 0.3;
    await this.audio.play();
  }

  stop() {
    this.audio?.pause();
    this.audio = null;
  }
}
```

---

## 📊 Метрики для отслеживания

### После внедрения ADHD features:

1. **Retention**:
   - D1 (Day 1): > 70%
   - D7 (Week 1): > 40%
   - D30 (Month 1): > 20%

2. **Engagement**:
   - Session length: > 5 min
   - Sessions per day: > 2
   - Streak completion: > 60%

3. **Feature Usage**:
   - Hyperfocus Mode: > 30% users
   - Random Quests: > 50% completion
   - Dopamine Dashboard: > 80% enabled

---

## 🎨 Дизайн для ADHD

### Принципы:
1. **Яркие цвета** (но не слишком)
2. **Анимации** (плавные, не резкие)
3. **Немедленная обратная связь**
4. **Прогресс везде** (прогресс-бары, проценты, стрики)
5. **Минимум текста** (иконки, эмодзи)

### Цветовая палитра для стимуляции:
- Success: `#10B981` (зеленый)
- Warning: `#F59E0B` (оранжевый)
- Danger: `#EF4444` (красный)
- Primary: `#8B5CF6` (фиолетовый - допамин!)
- Accent: `#EC4899` (розовый - энергия!)

---

## 🚀 Запуск

### Тестирование с фокус-группой:
1. Найти 10-20 пользователей с ADHD
2. Дать ранний доступ к ADHD features
3. Собрать feedback через Google Forms
4. Итеративно улучшать

### Вопросы для feedback:
- Помогает ли Hyperfocus Mode концентрироваться?
- Достаточно ли мотивирует Task Momentum?
- Нравятся ли случайные квесты?
- Не слишком ли много анимаций?
- Помогает ли Time Blindness Helper?

---

## 📝 Итог

### Что сделано:
✅ Челленджи и бейджи
✅ Социальный шаринг
✅ База данных готова

### Что делать сейчас:
1. Применить Supabase миграцию
2. Реализовать облачную синхронизацию
3. Создать Hyperfocus Mode
4. Добавить Task Momentum

### Уникальность:
**ZenFlow - единственное приложение для привычек, созданное СПЕЦИАЛЬНО для ADHD-шников** 🧠✨

**Наш "крючок"**:
- Hyperfocus Mode (никто не делает)
- Task Momentum (уникальный алгоритм)
- Random Quests (элемент сюрприза)
- Dopamine Dashboard (ADHD нужен допамин!)
- Time Blindness Helper (критично для ADHD)
- Streak Protection Shield (снижает стресс)

---

**Готовы сделать ZenFlow #1 приложением для ADHD? 🚀**
