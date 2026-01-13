# 🚀 ZenFlow Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Критические проверки

- [x] **Безопасность**
  - [x] generateId() использует nanoid (не Math.random)
  - [x] Нет console.log в production коде
  - [x] CSP headers настроены в vercel.json
  - [x] HTTPS-only enforcement
  - [x] .env файлы в .gitignore

- [x] **PWA**
  - [x] manifest.webmanifest оптимизирован
  - [x] Service Worker с кешированием
  - [x] offline.html fallback
  - [x] Icons 192x192 и 512x512 (требуется создать!)

- [x] **Legal**
  - [x] privacy.html готов
  - [x] terms.html готов
  - [x] sitemap.xml добавлен

- [x] **Performance**
  - [x] Code splitting настроен
  - [x] Терсификация включена
  - [x] Gzip compression

### ⚠️ Требуется перед деплоем

1. **Создать PWA иконки**:
```bash
# Используйте pwa-asset-generator (бесплатно)
npx @vite-pwa/assets-generator --preset minimal public/logo.svg public
```

2. **Настроить Supabase**:
   - Создать проект на [supabase.com](https://supabase.com)
   - Скопировать URL и anon key
   - Добавить в Vercel environment variables

3. **Проверить сборку**:
```bash
npm run build
npm run preview
```

---

## 🌐 Deployment на Vercel (Бесплатно)

### Способ 1: Через GitHub (Рекомендуется)

1. **Push в GitHub**:
```bash
git add .
git commit -m "Production ready"
git push origin main
```

2. **Подключить к Vercel**:
   - Зайти на [vercel.com](https://vercel.com)
   - New Project → Import Git Repository
   - Выбрать ваш репозиторий
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Environment Variables** в Vercel:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

4. **Deploy** → Автоматически при каждом push в main

### Способ 2: Через Vercel CLI

```bash
# Установить Vercel CLI
npm i -g vercel

# Логин
vercel login

# Deploy production
vercel --prod

# Добавить env variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

---

## 🗄️ Supabase Setup (Бесплатно)

### 1. Создать проект

1. Зайти на [supabase.com](https://supabase.com)
2. New Project → Выбрать Free tier
3. Region: **eu-central-1** (GDPR compliant)

### 2. Создать таблицу для backup

```sql
-- Таблица для cloud sync
CREATE TABLE user_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backups"
  ON user_backups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own backups"
  ON user_backups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own backups"
  ON user_backups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own backups"
  ON user_backups FOR DELETE
  USING (auth.uid() = user_id);
```

### 3. Включить Auth Providers (опционально)

- Email/Password: по умолчанию включен
- OAuth (Google, GitHub): настроить в Authentication → Providers

### 4. Получить credentials

- Settings → API → Project URL → `VITE_SUPABASE_URL`
- Settings → API → anon/public key → `VITE_SUPABASE_ANON_KEY`

---

## 📱 PWA Installation Testing

### Desktop (Chrome/Edge)

1. Открыть app в браузере
2. Адресная строка → Install icon (⊕)
3. Или Menu → Install ZenFlow

### Android (Chrome)

1. Открыть app
2. Menu (⋮) → Add to Home screen
3. Или Install app

### iOS (Safari)

1. Открыть app в Safari
2. Share button → Add to Home Screen
3. **Note**: iOS не поддерживает все PWA фичи (нет Service Worker full support)

---

## 🧪 Testing Checklist

### Функциональное тестирование

- [ ] **Mood Tracker**: добавить настроение, проверить сохранение
- [ ] **Habits**: создать привычку, отметить выполнение
- [ ] **Focus Timer**: запустить таймер, завершить сессию
- [ ] **Gratitude**: добавить запись благодарности
- [ ] **Stats**: проверить отображение статистики
- [ ] **Settings**: импорт/экспорт данных
- [ ] **Cloud Sync**: синхронизация (если Supabase настроен)

### Gamification Testing

- [ ] **First Achievement**: должно появиться при первом действии
- [ ] **XP Award**: XP должен увеличиваться
- [ ] **Level Up**: набрать 100 XP → уровень 2
- [ ] **Toast Notification**: уведомление при достижении
- [ ] **Progress Bars**: проверить обновление прогресса
- [ ] **Achievements Panel**: открыть, проверить табы

### PWA Testing

- [ ] **Offline Mode**: отключить интернет, приложение работает
- [ ] **Install Banner**: проверить появление
- [ ] **Shortcuts**: долгий тап на иконке → shortcuts
- [ ] **Standalone Mode**: запуск без браузерной панели
- [ ] **Update Prompt**: обновить app, проверить prompt

### Performance Testing

- [ ] **Lighthouse Score**: > 90 на всех метриках
- [ ] **First Load**: < 3 секунды
- [ ] **Bundle Size**: проверить dist/ < 1MB gzip

---

## 🔧 Post-Deployment

### 1. Мониторинг

**Бесплатные инструменты:**

- **Vercel Analytics** (бесплатно):
  - Dashboard → Analytics
  - Web Vitals, Traffic, Top Pages

- **Supabase Dashboard**:
  - Database → Storage usage
  - Authentication → Users count

### 2. SEO

**Проверить индексацию:**

```bash
# Google Search Console
https://search.google.com/search-console

# Добавить sitemap:
https://your-app.vercel.app/sitemap.xml
```

### 3. Security Headers Test

```bash
# Проверить CSP и headers
https://securityheaders.com/?q=https://your-app.vercel.app
```

---

## 🐛 Troubleshooting

### Build Errors

**Error**: `Cannot find module 'nanoid'`
```bash
rm -rf node_modules package-lock.json
npm install
```

**Error**: `Workbox: globPatterns undefined`
- Проверить vite.config.ts → workbox.globPatterns

### Runtime Errors

**Error**: Supabase auth не работает
- Проверить VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
- Убедиться что RLS включён на таблицах

**Error**: Service Worker не обновляется
- Hard reload: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- Clear cache: DevTools → Application → Clear storage

### PWA Issues

**Install button не появляется:**
- Проверить HTTPS (localhost OK для dev)
- Проверить manifest.webmanifest доступен
- Проверить Service Worker зарегистрирован (DevTools → Application)

**Offline mode не работает:**
- Проверить Network tab → Offline checkbox
- Проверить Service Worker → Update on reload выключен
- Проверить workbox caching strategies в vite.config.ts

---

## 📊 Success Metrics

### KPIs для отслеживания

**Technical:**
- Lighthouse Performance: > 90
- PWA Install Rate: > 20%
- Offline Usage: > 10%
- Error Rate: < 1%

**User Engagement:**
- DAU (Daily Active Users)
- Retention Day 7: > 40%
- Retention Day 30: > 20%
- Avg. Session Duration: > 3 min

**Gamification:**
- Users with 1+ achievement: > 80%
- Users with Level 3+: > 50%
- Streak 7+ days: > 30%

---

## 🎉 Launch Checklist

### Pre-Launch (за 1 день)

- [ ] Final build test на staging
- [ ] Lighthouse audit (все > 90)
- [ ] Security scan (securityheaders.com)
- [ ] Mobile testing (iOS + Android)
- [ ] Legal pages review (privacy, terms)

### Launch Day

- [ ] Deploy на production
- [ ] Smoke test всех функций
- [ ] Проверить analytics подключён
- [ ] Объявить в соцсетях/community

### Post-Launch (первая неделя)

- [ ] Мониторинг ошибок ежедневно
- [ ] Собрать feedback от первых пользователей
- [ ] Hot-fix критических багов
- [ ] Обновить README с актуальной ссылкой

---

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **PWA Docs**: https://web.dev/progressive-web-apps/

---

**Готово к деплою! 🚀**

Удачи с запуском ZenFlow! Если возникнут вопросы, обращайтесь в Issues на GitHub.
