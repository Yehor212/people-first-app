# План монетизации ZenFlow через рекламу

## Обзор

Этот документ описывает стратегию внедрения рекламы в ZenFlow с сохранением качества пользовательского опыта и privacy-first подхода.

---

## 1. Рекламные платформы

### Для Native приложений (Android/iOS)

| Платформа | Преимущества | Недостатки |
|-----------|--------------|------------|
| **Google AdMob** | Высокий CPM, простая интеграция с Capacitor | Требует Google account |
| **Meta Audience Network** | Хороший таргетинг | Требует FB Business account |
| **Unity Ads** | Отличные rewarded видео | Больше для игр |
| **AppLovin** | MAX медиация (все сети) | Сложнее настройка |

**Рекомендация**: Начать с **Google AdMob** - есть готовый Capacitor плагин.

### Для Web/PWA

| Платформа | Преимущества | Недостатки |
|-----------|--------------|------------|
| **Google AdSense** | Простота | Низкий CPM для PWA |
| **Carbon Ads** | Dev/tech аудитория, этичная | Только по заявке |
| **EthicalAds** | Privacy-friendly | Низкий охват |

**Рекомендация**: Web версию оставить без рекламы (PWA quality signal).

---

## 2. Типы рекламы

### 2.1 Rewarded Video (Вознаграждаемое видео)
- Пользователь смотрит 15-30 сек видео → получает награду
- **Идеально для ZenFlow**: "Посмотри рекламу → получи бонусные treats для компаньона"
- CPM: $10-30

### 2.2 Interstitial (Полноэкранная)
- Показывается между экранами
- **Использовать осторожно**: только в естественных паузах
- CPM: $5-15

### 2.3 Native Ads (Нативная)
- Встраивается в UI как часть контента
- **Лучший выбор для ZenFlow**: выглядит как часть приложения
- CPM: $3-10

### 2.4 Banner (Баннер)
- Маленький баннер внизу/вверху экрана
- **Не рекомендуется**: портит минималистичный UI ZenFlow
- CPM: $0.5-3

---

## 3. Места размещения рекламы (по приоритету)

### Приоритет 1: Achievement Celebration (После достижения)
```
Момент: Пользователь разблокировал бейдж/достижение
Состояние: Эйфория, празднование победы
Тип рекламы: Native Ad или Rewarded Video
Контент: Wellness бренды, fitness приложения

┌─────────────────────────────────────┐
│   🏆 Новое достижение!              │
│                                     │
│   [Анимация бейджа]                 │
│                                     │
│   "7 дней подряд!"                  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 📱 Рекомендуем попробовать  │   │ ← Native Ad
│   │    Headspace - медитации    │   │
│   └─────────────────────────────┘   │
│                                     │
│   [Продолжить]                      │
└─────────────────────────────────────┘
```

**Файл**: `src/components/AnimatedAchievementCard.tsx`

### Приоритет 2: Rest Mode (День отдыха)
```
Момент: Пользователь активировал режим отдыха
Состояние: Восстановление, забота о себе
Тип рекламы: Native Ad
Контент: Медитация, сон, массаж, спа

┌─────────────────────────────────────┐
│   🌙 День отдыха                    │
│                                     │
│   Отдыхай, стрик сохранён 🔥5       │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 😴 Calm - для лучшего сна   │   │ ← Контекстная реклама
│   │    Попробуй бесплатно       │   │
│   └─────────────────────────────┘   │
│                                     │
│   [Вернуться к активностям]         │
└─────────────────────────────────────┘
```

**Файл**: `src/components/RestModeCard.tsx`

### Приоритет 3: Focus Timer Completion (После фокус-сессии)
```
Момент: Завершена 25/50 мин сессия
Состояние: Продуктивность, достижение
Тип рекламы: Rewarded Video (опционально)
Контент: Продуктивность, офисные товары

┌─────────────────────────────────────┐
│   ✅ Сессия завершена!              │
│                                     │
│   25 минут глубокой работы          │
│   +50 XP                            │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 🎬 Посмотри рекламу         │   │ ← Rewarded Ad
│   │    +10 бонусных treats      │   │
│   └─────────────────────────────┘   │
│                                     │
│   [Пропустить]  [Рефлексия]         │
└─────────────────────────────────────┘
```

**Файл**: `src/components/FocusTimer.tsx`

### Приоритет 4: Weekly Report (Еженедельный отчёт)
```
Момент: Понедельник, автоматический отчёт
Состояние: Анализ, рефлексия
Тип рекламы: Native Ad внизу отчёта

┌─────────────────────────────────────┐
│   📊 Твоя неделя                    │
│                                     │
│   Настроение: 😊 В среднем хорошее  │
│   Привычки: 85% выполнено           │
│   Фокус: 12.5 часов                 │
│                                     │
│   ───────────────────────────────   │
│   Sponsored                         │
│   ┌─────────────────────────────┐   │
│   │ Notion - организуй жизнь    │   │
│   └─────────────────────────────┘   │
│                                     │
│   [Закрыть]                         │
└─────────────────────────────────────┘
```

**Файл**: `src/components/WeeklyReport.tsx`

### Приоритет 5: Habit Completion (После выполнения привычки)
```
Момент: Отметил привычку выполненной
Состояние: Маленькая победа
Тип рекламы: Native Ad (редко, не каждый раз)
Частота: 1 из 5 выполнений

Показывать контекстно:
- Привычка "Тренировка" → реклама фитнес-приложений
- Привычка "Вода" → реклама бутылок/трекеров воды
- Привычка "Чтение" → реклама книжных сервисов
```

**Файл**: `src/components/HabitCompletionCelebration.tsx`

---

## 4. Где НЕ показывать рекламу

| Момент | Причина |
|--------|---------|
| Во время записи настроения | Священный момент, рефлексия |
| Во время таймера фокуса | Flow state, нельзя прерывать |
| При первом запуске | Первое впечатление |
| В настройках приватности | Иронично и неуместно |
| Каждый раз при открытии | Раздражает, теряем пользователей |

---

## 5. Технические требования

### 5.1 Зависимости для установки

```bash
# Capacitor плагин для AdMob
npm install @capacitor-community/admob

# Синхронизация с native проектами
npx cap sync
```

### 5.2 Конфигурация AdMob

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<manifest>
  <application>
    <!-- AdMob App ID -->
    <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
  </application>
</manifest>
```

**iOS** (`ios/App/App/Info.plist`):
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
```

### 5.3 Новые компоненты

```
src/
├── components/
│   └── ads/
│       ├── AdProvider.tsx      # Контекст для рекламы
│       ├── NativeAd.tsx        # Нативная реклама
│       ├── RewardedAd.tsx      # Вознаграждаемая реклама
│       └── AdConsent.tsx       # GDPR согласие для рекламы
├── hooks/
│   └── useAds.ts               # Хук для показа рекламы
└── lib/
    └── ads.ts                  # Инициализация AdMob
```

### 5.4 Пример кода AdProvider

```typescript
// src/components/ads/AdProvider.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { AdMob, AdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

interface AdContextType {
  isReady: boolean;
  showRewarded: (placement: string) => Promise<boolean>;
  showInterstitial: (placement: string) => Promise<void>;
  adsEnabled: boolean;
  setAdsEnabled: (enabled: boolean) => void;
}

const AdContext = createContext<AdContextType | null>(null);

export function AdProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    AdMob.initialize({
      requestTrackingAuthorization: true,
      testingDevices: ['YOUR_TEST_DEVICE_ID'],
      initializeForTesting: __DEV__,
    }).then(() => setIsReady(true));
  }, []);

  const showRewarded = async (placement: string): Promise<boolean> => {
    if (!isReady || !adsEnabled) return false;

    const options: AdOptions = {
      adId: 'ca-app-pub-xxx/rewarded-id',
    };

    try {
      await AdMob.prepareRewardVideoAd(options);
      const result = await AdMob.showRewardVideoAd();
      return result.type === 'rewarded';
    } catch {
      return false;
    }
  };

  return (
    <AdContext.Provider value={{ isReady, showRewarded, showInterstitial, adsEnabled, setAdsEnabled }}>
      {children}
    </AdContext.Provider>
  );
}

export const useAds = () => useContext(AdContext);
```

### 5.5 Интеграция с существующей аналитикой

```typescript
// src/lib/analytics.ts - добавить методы
export const analytics = {
  // ... существующие методы

  adShown: (placement: string, adType: string) => {
    if (!shouldTrack()) return;
    track('ad_shown', { placement, adType });
  },

  adClicked: (placement: string, adType: string) => {
    if (!shouldTrack()) return;
    track('ad_clicked', { placement, adType });
  },

  adRewardEarned: (placement: string, rewardType: string, amount: number) => {
    if (!shouldTrack()) return;
    track('ad_reward_earned', { placement, rewardType, amount });
  },
};
```

---

## 6. GDPR и Privacy

### 6.1 Согласие на персонализированную рекламу

```typescript
// Добавить в ConsentBanner.tsx
const [adConsent, setAdConsent] = useState<'personalized' | 'non-personalized' | null>(null);

// Варианты:
// 1. Персонализированная реклама (выше CPM)
// 2. Неперсонализированная реклама (ниже CPM, но privacy-friendly)
// 3. Без рекламы (premium подписка)
```

### 6.2 Уважение настроек приватности

```typescript
// Если пользователь включил "Не отслеживать"
if (privacy.noTracking) {
  // Показывать только non-personalized ads
  AdMob.setRequestConfiguration({
    tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false,
    maxAdContentRating: 'G',
  });
}
```

---

## 7. Freemium модель (альтернатива)

### Вместо рекламы или вместе с ней

| Tier | Цена | Функции |
|------|------|---------|
| **Free** | $0 | Базовые функции + реклама |
| **Premium** | $2.99/мес | Без рекламы + темы + бонусы |
| **Lifetime** | $19.99 | Навсегда Premium |

### Premium-only функции (идеи)
- Дополнительные темы оформления
- Эксклюзивные скины для компаньона
- Расширенная статистика
- Экспорт в PDF
- Неограниченные бэкапы

---

## 8. Метрики для отслеживания

### До внедрения рекламы
- DAU/MAU (ежедневные/месячные пользователи)
- Retention (удержание)
- Session length (длина сессии)
- Feature usage (использование функций)

### После внедрения рекламы
- Ad fill rate (% показанных объявлений)
- CPM по placement
- Click-through rate (CTR)
- Reward completion rate
- Churn rate изменение (отток)
- User feedback/ratings

---

## 9. Поэтапный план внедрения

### Фаза 1: Подготовка (1-2 недели)
- [ ] Создать аккаунт Google AdMob
- [ ] Получить App ID и Ad Unit IDs
- [ ] Установить @capacitor-community/admob
- [ ] Создать AdProvider компонент
- [ ] Добавить ad consent в настройки приватности

### Фаза 2: Rewarded Ads (2-3 недели)
- [ ] Интегрировать rewarded video
- [ ] Добавить в FocusTimer completion
- [ ] Добавить "Watch ad for treats" в компаньона
- [ ] Тестирование на реальных устройствах

### Фаза 3: Native Ads (2-3 недели)
- [ ] Создать NativeAd компонент
- [ ] Интегрировать в Achievement celebration
- [ ] Интегрировать в Rest Mode
- [ ] A/B тестирование placement'ов

### Фаза 4: Оптимизация (ongoing)
- [ ] Анализ метрик
- [ ] Оптимизация frequency capping
- [ ] Тестирование разных ad networks
- [ ] Сбор user feedback

---

## 10. Оценка дохода

### Консервативная оценка (1000 DAU)

| Placement | Impressions/day | CPM | Daily Revenue |
|-----------|-----------------|-----|---------------|
| Achievement | 200 | $8 | $1.60 |
| Focus Complete | 500 | $15 (rewarded) | $7.50 |
| Rest Mode | 50 | $5 | $0.25 |
| Weekly Report | 143 (1/7 users) | $3 | $0.43 |

**Итого**: ~$10/day = **~$300/month** на 1000 DAU

### При росте до 10,000 DAU: ~$3,000/month

---

## Заключение

ZenFlow идеально подходит для **ненавязчивой рекламы** благодаря:
1. Множеству естественных пауз (достижения, отдых, завершение сессий)
2. Privacy-first инфраструктуре (уже есть consent)
3. Gamification системе (rewarded ads = бонусы)
4. Wellness контексту (релевантные рекламодатели)

**Главное правило**: Реклама должна дополнять опыт, а не прерывать его.
