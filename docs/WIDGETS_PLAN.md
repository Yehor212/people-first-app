# 📱 Виджеты iOS/Android - План реализации

## 🎯 Цель

Создать виджеты для iOS и Android, чтобы пользователи могли видеть свой прогресс без открытия приложения.

---

## 📊 Виджеты для iOS (WidgetKit)

### Требования
- iOS 14+ (WidgetKit)
- Swift + SwiftUI
- Capacitor plugin для передачи данных

### Размеры виджетов

#### Small (2×2 ячейки)
**Контент:**
- 🔥 Текущий стрик
- 📅 Дата

**Пример:**
```
┌─────────┐
│  🔥 7   │
│  Days   │
│         │
│ Jan 14  │
└─────────┘
```

#### Medium (4×2 ячейки)
**Контент:**
- 🔥 Стрик
- ✅ Привычки сегодня (3/5)
- 🎯 Прогресс-бар

**Пример:**
```
┌──────────────────┐
│ 🔥 7 Days        │
│                  │
│ Today: 3/5 ✅    │
│ ████████░░ 60%   │
└──────────────────┘
```

#### Large (4×4 ячейки)
**Контент:**
- 🔥 Стрик
- ✅ Привычки (список)
- ⏱️ Фокус минуты
- 🏆 Последний бейдж

**Пример:**
```
┌──────────────────┐
│ 🔥 Streak: 7     │
│                  │
│ ✅ Morning Run   │
│ ✅ Meditation    │
│ ⬜ Read 30min    │
│                  │
│ ⏱️ Focus: 45min  │
│ 🏆 Week Warrior  │
└──────────────────┘
```

---

## 🤖 Виджеты для Android (App Widget API)

### Требования
- Android 4.0+ (API 14+)
- Kotlin + XML layouts
- Capacitor plugin для передачи данных

### Размеры виджетов

#### Small (2×1 или 2×2)
- Стрик + дата

#### Medium (4×2)
- Стрик + привычки сегодня

#### Large (4×4)
- Полная статистика

---

## 🔧 Техническая реализация

### 1. Capacitor Plugin для виджетов

**Создать:** `src/plugins/WidgetPlugin.ts`

```typescript
import { registerPlugin } from '@capacitor/core';

export interface WidgetPlugin {
  updateWidget(data: WidgetData): Promise<void>;
  getWidgetData(): Promise<WidgetData>;
}

export interface WidgetData {
  streak: number;
  habitsToday: number;
  habitsTotalToday: number;
  focusMinutes: number;
  lastBadge?: string;
  habits: Array<{
    name: string;
    completed: boolean;
  }>;
}

const Widget = registerPlugin<WidgetPlugin>('Widget');

export default Widget;
```

### 2. iOS Implementation

**Файлы:**
```
ios/App/
  ├── Widgets/
  │   ├── ZenFlowWidget.swift
  │   ├── WidgetView.swift
  │   ├── WidgetProvider.swift
  │   └── Info.plist
  └── Plugins/
      └── WidgetPlugin.swift
```

**ZenFlowWidget.swift:**
```swift
import WidgetKit
import SwiftUI

@main
struct ZenFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        ZenFlowSmallWidget()
        ZenFlowMediumWidget()
        ZenFlowLargeWidget()
    }
}

struct ZenFlowSmallWidget: Widget {
    let kind: String = "ZenFlowSmallWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Streak")
        .description("Your current streak")
        .supportedFamilies([.systemSmall])
    }
}
```

**WidgetView.swift:**
```swift
struct SmallWidgetView: View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 139/255, green: 92/255, blue: 246/255),
                        Color(red: 236/255, green: 72/255, blue: 153/255)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(spacing: 8) {
                Text("🔥")
                    .font(.system(size: 40))

                Text("\(entry.streak)")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)

                Text("Days")
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.8))
            }
        }
    }
}
```

**WidgetProvider.swift:**
```swift
import WidgetKit

struct WidgetEntry: TimelineEntry {
    let date: Date
    let streak: Int
    let habitsToday: Int
    let habitsTotalToday: Int
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: Date(), streak: 7, habitsToday: 3, habitsTotalToday: 5)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> ()) {
        // Load from UserDefaults or App Group
        let sharedDefaults = UserDefaults(suiteName: "group.com.zenflow.app")
        let streak = sharedDefaults?.integer(forKey: "streak") ?? 0
        let entry = WidgetEntry(date: Date(), streak: streak, habitsToday: 0, habitsTotalToday: 0)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        // Update every hour
        let currentDate = Date()
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!

        let entry = getSnapshot(in: context) { entry in
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}
```

**WidgetPlugin.swift (Capacitor):**
```swift
import Capacitor

@objc(WidgetPlugin)
public class WidgetPlugin: CAPPlugin {
    @objc func updateWidget(_ call: CAPPluginCall) {
        guard let streak = call.getInt("streak"),
              let habitsToday = call.getInt("habitsToday"),
              let habitsTotalToday = call.getInt("habitsTotalToday") else {
            call.reject("Missing required parameters")
            return
        }

        // Save to App Group for widget access
        let sharedDefaults = UserDefaults(suiteName: "group.com.zenflow.app")
        sharedDefaults?.set(streak, forKey: "streak")
        sharedDefaults?.set(habitsToday, forKey: "habitsToday")
        sharedDefaults?.set(habitsTotalToday, forKey: "habitsTotalToday")

        // Reload all widgets
        WidgetCenter.shared.reloadAllTimelines()

        call.resolve()
    }
}
```

### 3. Android Implementation

**Файлы:**
```
android/app/src/main/
  ├── java/widgets/
  │   ├── ZenFlowWidgetProvider.kt
  │   ├── WidgetUpdateWorker.kt
  │   └── WidgetPlugin.kt
  └── res/
      ├── layout/
      │   ├── widget_small.xml
      │   ├── widget_medium.xml
      │   └── widget_large.xml
      └── xml/
          └── widget_info.xml
```

**ZenFlowWidgetProvider.kt:**
```kotlin
class ZenFlowWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val sharedPref = context.getSharedPreferences("ZenFlowWidget", Context.MODE_PRIVATE)
        val streak = sharedPref.getInt("streak", 0)
        val habitsToday = sharedPref.getInt("habitsToday", 0)
        val habitsTotalToday = sharedPref.getInt("habitsTotalToday", 0)

        val views = RemoteViews(context.packageName, R.layout.widget_small)
        views.setTextViewText(R.id.streak_text, "$streak")
        views.setTextViewText(R.id.habits_text, "$habitsToday/$habitsTotalToday")

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
```

**widget_small.xml:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="16dp">

    <TextView
        android:id="@+id/streak_emoji"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="🔥"
        android:textSize="40sp"
        android:layout_gravity="center" />

    <TextView
        android:id="@+id/streak_text"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="7"
        android:textSize="32sp"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:layout_gravity="center" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Days"
        android:textSize="14sp"
        android:textColor="#CCFFFFFF"
        android:layout_gravity="center" />
</LinearLayout>
```

### 4. React Integration

**Создать:** `src/hooks/useWidgetSync.ts`

```typescript
import { useEffect } from 'react';
import Widget from '@/plugins/WidgetPlugin';
import { Capacitor } from '@capacitor/core';

export function useWidgetSync(
  streak: number,
  habits: Habit[],
  focusMinutes: number,
  lastBadge?: string
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const today = getToday();
    const habitsToday = habits.filter(h =>
      getHabitCompletedDates(h).includes(today)
    );

    const widgetData = {
      streak,
      habitsToday: habitsToday.length,
      habitsTotalToday: habits.length,
      focusMinutes,
      lastBadge,
      habits: habits.map(h => ({
        name: h.name,
        completed: getHabitCompletedDates(h).includes(today)
      }))
    };

    Widget.updateWidget(widgetData).catch(err => {
      console.error('Failed to update widget:', err);
    });
  }, [streak, habits, focusMinutes, lastBadge]);
}
```

**Использование в Index.tsx:**
```typescript
import { useWidgetSync } from '@/hooks/useWidgetSync';

export function Index() {
  // ... existing code

  const currentStreak = streaks.current;
  const lastBadge = badges.find(b => b.unlockedAt)?.name;

  useWidgetSync(currentStreak, habits, todayMinutes, lastBadge);

  // ... rest of component
}
```

---

## 📝 Checklist реализации

### iOS
- [ ] Создать Widget Extension в Xcode
- [ ] Настроить App Group (`group.com.zenflow.app`)
- [ ] Реализовать WidgetProvider
- [ ] Создать 3 размера виджетов (Small, Medium, Large)
- [ ] Реализовать Capacitor plugin
- [ ] Добавить иконки и ассеты
- [ ] Тестирование на реальном устройстве

### Android
- [ ] Создать AppWidgetProvider
- [ ] Создать XML layouts для виджетов
- [ ] Реализовать SharedPreferences sync
- [ ] Создать 3 размера виджетов
- [ ] Реализовать Capacitor plugin
- [ ] Добавить drawable ресурсы
- [ ] Тестирование на реальном устройстве

### React
- [ ] Создать `useWidgetSync` hook
- [ ] Интегрировать в Index.tsx
- [ ] Добавить обработку ошибок
- [ ] Оптимизировать частоту обновлений
- [ ] Тестирование на iOS и Android

---

## 🎨 Дизайн виджетов

### Цветовая схема
- Gradient: `#8B5CF6` → `#EC4899` (фиолетовый → розовый)
- Text: White `#FFFFFF`
- Secondary text: White 80% opacity

### Шрифты
- Заголовки: Bold, SF Pro (iOS) / Roboto (Android)
- Тело: Regular

### Иконки
- Стрик: 🔥
- Привычки: ✅
- Фокус: ⏱️
- Бейджи: 🏆

---

## ⏱️ Оценка времени

- iOS виджеты: 8-12 часов
- Android виджеты: 6-10 часов
- Capacitor plugin: 4-6 часов
- Тестирование: 4-6 часов
- **Всего:** 22-34 часа

---

## 🚀 Приоритет

**Medium** - Виджеты улучшают retention, но не критичны для запуска MVP.

Рекомендуется реализовать после:
1. ✅ Базовый функционал
2. ✅ ADHD-фичи (Hyperfocus, Task Momentum, Quests)
3. ✅ Multi-device sync
4. 🔄 Beta тестирование
5. 📱 Виджеты ← **Вы здесь**

---

## 📚 Полезные ссылки

### iOS
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [App Groups Setup](https://developer.apple.com/documentation/xcode/configuring-app-groups)

### Android
- [App Widget Documentation](https://developer.android.com/develop/ui/views/appwidgets)
- [RemoteViews Guide](https://developer.android.com/reference/android/widget/RemoteViews)

### Capacitor
- [Creating Plugins](https://capacitorjs.com/docs/plugins/creating-plugins)
- [iOS Plugin Guide](https://capacitorjs.com/docs/plugins/ios)
- [Android Plugin Guide](https://capacitorjs.com/docs/plugins/android)
