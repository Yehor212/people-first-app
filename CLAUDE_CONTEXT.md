# ZenFlow - Контекст для Claude

> **Этот файл содержит всю необходимую информацию о проекте для продолжения работы в новом чате.**
> **Обновлено:** 2026-01-15

---

## О проекте

**ZenFlow** — PWA-приложение для ментального здоровья и продуктивности, оптимизированное для людей с ADHD.

**Стек:**
- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui
- Dexie.js (IndexedDB для локального хранения)
- Supabase (бэкенд, авторизация, облачная синхронизация)
- Capacitor (мобильные приложения iOS/Android)
- PWA с Service Worker
- Zod (валидация данных)

**Языки интерфейса:** ru, en, uk, es, de, fr

---

## Что уже сделано

### 1. Основной функционал
- [x] Трекер настроения (5 уровней, теги, заметки, редактирование)
- [x] Трекер привычек (ежедневные, еженедельные, по расписанию, с таймером)
- [x] Фокус-таймер (Pomodoro, кастомные сессии, рефлексия)
- [x] Журнал благодарности
- [x] Статистика и аналитика (графики, хитмапы)
- [x] Система достижений и бейджей
- [x] Челленджи (streak, focus, gratitude)
- [x] Hyperfocus Mode с ambient sounds
- [x] Weekly Report (понедельник)

### 2. Gamification & ADHD Hooks
- [x] **Daily Login Rewards** — 7-дневный цикл наград
- [x] **Combo System** — множитель XP (до 10x)
- [x] **Spin Wheel** — колесо удачи
- [x] **Mystery Boxes** — сундуки с наградами
- [x] **Flash Challenges** — срочные задания
- [x] **XP & Levels** — система прогрессии
- [x] **Streak Celebrations** — анимации за серии (Duolingo-style)

### 3. Безопасность (НОВОЕ - 2026-01-15)
- [x] JWT токены валидируются перед установкой сессии
- [x] OAuth ошибки санитизируются (защита от XSS)
- [x] Backup import с Zod валидацией
- [x] Dev-only логгер (нет console.log в production)
- [x] Защита от prototype pollution

**Файлы безопасности:**
- `src/lib/authRedirect.ts` — валидация токенов, санитизация ошибок
- `src/lib/validation.ts` — Zod схемы для всех типов данных
- `src/lib/logger.ts` — безопасный логгер (только dev)
- `src/storage/backup.ts` — валидация импорта

### 4. UX улучшения (НОВОЕ - 2026-01-15)
- [x] **DailyProgress** — компонент прогресса дня с навигацией
- [x] **MoodTracker** — редактирование настроения с подтверждением
- [x] **Celebrations** — анимации при достижениях
- [x] Полная локализация всех компонентов

### 5. Supabase Backend
- [x] SQL миграция с полной схемой БД
- [x] Row Level Security на всех таблицах
- [x] Real-time sync подписки
- [x] TypeScript типы для Supabase

**Таблицы:**
- `profiles`, `moods`, `habits`, `habit_completions`
- `focus_sessions`, `gratitude_entries`, `user_settings`
- `challenges`, `badges`, `adhd_state`, `mystery_boxes`
- `user_backups`, `push_subscriptions`

### 6. i18n
- [x] 6 языков полностью переведены
- [x] Weekly Report переводы
- [x] Streak Celebration переводы
- [x] Daily Progress переводы

---

## Структура проекта (ключевые файлы)

```
src/
├── components/
│   ├── DailyProgress.tsx      # Прогресс дня (NEW)
│   ├── StreakCelebration.tsx  # Анимация серии
│   ├── WeeklyReport.tsx       # Недельный отчет
│   ├── Celebrations.tsx       # Все анимации
│   ├── MoodTracker.tsx        # Трекер настроения
│   ├── HabitTracker.tsx       # Трекер привычек
│   ├── FocusTimer.tsx         # Фокус-таймер
│   └── ...
├── lib/
│   ├── authRedirect.ts        # OAuth + валидация (NEW)
│   ├── validation.ts          # Zod схемы (NEW)
│   ├── logger.ts              # Dev-only логгер (NEW)
│   ├── supabaseClient.ts      # Supabase клиент
│   └── ...
├── storage/
│   ├── backup.ts              # Экспорт/импорт + валидация
│   ├── cloudSync.ts           # Облачная синхронизация
│   └── db.ts                  # Dexie DB схема
├── i18n/
│   └── translations.ts        # Все переводы (518+ ключей)
└── pages/
    └── Index.tsx              # Главная страница

PUBLISH_INSTRUCTIONS.md        # Инструкция по публикации (NEW)
```

---

## Переменные окружения

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BG... (опционально)
```

---

## Команды

```bash
npm run dev      # Запуск dev сервера
npm run build    # Сборка для продакшена
npm run preview  # Превью сборки
npx cap sync     # Синхронизация Capacitor
```

---

## Готовность к публикации

### Backend (Supabase)
- [x] Схема БД готова
- [x] RLS настроен
- [ ] **Нужно:** Применить миграцию в Supabase Dashboard
- [ ] **Нужно:** Настроить Google OAuth provider

### Frontend
- [x] Все компоненты работают
- [x] Локализация полная
- [x] Безопасность усилена
- [x] Билд проходит

### Документация
- [x] CLAUDE_CONTEXT.md актуален
- [x] PUBLISH_INSTRUCTIONS.md создан

---

## Известные ограничения

1. **Bundle size** — index chunk ~742KB (warning, но работает)
2. **ADHD компоненты** — созданы, но не все интегрированы в UI

---

## Troubleshooting: Cloud Sync

Если синхронизация между устройствами не работает:

### 1. Проверить таблицу user_backups в Supabase
```sql
-- Выполнить в Supabase SQL Editor:
SELECT * FROM user_backups LIMIT 5;
```

### 2. Если ошибка "policy already exists"
Используйте безопасную миграцию `supabase/migrations/002_user_backups_safe.sql` - она удаляет старые политики перед созданием новых.

### 3. Проверить RLS
```sql
-- Должен вернуть true
SELECT row_security_active('user_backups');
```

### 4. Ручная синхронизация
Перейдите в Настройки → Облачная синхронизация → нажмите кнопку синхронизации.

---

## Что делать дальше

1. **Применить SQL миграцию** `002_user_backups_safe.sql` в Supabase Dashboard
2. **Настроить OAuth** в Supabase → Authentication → Providers
3. **Задеплоить** на Vercel/Netlify (см. PUBLISH_INSTRUCTIONS.md)
4. **Опубликовать** в Google Play / App Store

---

*Этот файл обновляется при значительных изменениях в проекте.*
