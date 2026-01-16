# ZenFlow - Инструкция по публикации

## Предварительные требования

### 1. Supabase Backend
Убедитесь, что в Supabase настроено:

- [ ] **Таблицы созданы** - выполните `supabase/migrations/001_initial_schema.sql` в SQL Editor
- [ ] **RLS включен** - Row Level Security на всех таблицах
- [ ] **Google OAuth** настроен в Authentication → Providers
- [ ] **Edge Functions** задеплоены (если используются push-уведомления)

### 2. Переменные окружения
Создайте `.env.production`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
VITE_VAPID_PUBLIC_KEY=BG...your-vapid-key (опционально для push)
```

---

## Публикация Web (Vercel/Netlify)

### Vercel
```bash
# 1. Установите Vercel CLI
npm i -g vercel

# 2. Залогиньтесь
vercel login

# 3. Задеплойте
vercel --prod
```

### Netlify
```bash
# 1. Установите Netlify CLI
npm i -g netlify-cli

# 2. Залогиньтесь
netlify login

# 3. Создайте сайт и задеплойте
netlify init
netlify deploy --prod
```

### Настройки деплоя:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 18+

---

## Публикация Android (Google Play)

### 1. Подготовка
```bash
# Синхронизируйте Capacitor
npx cap sync android

# Откройте в Android Studio
npx cap open android
```

### 2. Подпись приложения
1. В Android Studio: **Build → Generate Signed Bundle/APK**
2. Создайте keystore (сохраните пароли!)
3. Выберите **Android App Bundle (.aab)**

### 3. Google Play Console
1. Зайдите на [play.google.com/console](https://play.google.com/console)
2. Создайте приложение
3. Заполните:
   - Описание на всех языках
   - Скриншоты (телефон + планшет)
   - Иконка 512x512
   - Feature graphic 1024x500
4. Загрузите .aab в **Production → Create release**
5. Пройдите проверку контента (Content rating)
6. Установите цену (бесплатно)
7. Отправьте на проверку

### Важно для Android:
- `android/app/build.gradle` - версия `versionCode` должна увеличиваться
- Deep links: `com.zenflow.app://login-callback` для OAuth

---

## Публикация iOS (App Store)

### 1. Подготовка
```bash
# Синхронизируйте Capacitor
npx cap sync ios

# Откройте в Xcode
npx cap open ios
```

### 2. Apple Developer Account
1. Зарегистрируйтесь на [developer.apple.com](https://developer.apple.com) ($99/год)
2. Создайте App ID в Certificates, Identifiers & Profiles
3. Создайте приложение в App Store Connect

### 3. В Xcode
1. Выберите Team в Signing & Capabilities
2. Установите Bundle Identifier: `com.zenflow.app`
3. Настройте версию и build number
4. **Product → Archive**
5. **Distribute App → App Store Connect**

### 4. App Store Connect
1. Заполните метаданные на всех языках
2. Загрузите скриншоты (все размеры iPhone + iPad)
3. Установите возрастной рейтинг
4. Добавьте Privacy Policy URL
5. Отправьте на Review

### Важно для iOS:
- URL Scheme `com.zenflow.app` в Info.plist для OAuth
- Associated Domains для universal links

---

## Чеклист перед публикацией

### Функционал
- [ ] Авторизация Google работает
- [ ] Облачная синхронизация работает
- [ ] Локальное хранение работает офлайн
- [ ] Push-уведомления доставляются
- [ ] Все языки отображаются корректно

### Безопасность
- [ ] Нет console.log в production
- [ ] API ключи не в коде (только .env)
- [ ] RLS включен в Supabase
- [ ] HTTPS для всех запросов

### UX
- [ ] Онбординг работает
- [ ] Анимации плавные
- [ ] Темная тема корректна
- [ ] Шрифты загружаются

### Legal
- [ ] Privacy Policy URL
- [ ] Terms of Service URL
- [ ] Соответствие GDPR (для EU)

---

## После публикации

1. **Мониторинг**
   - Настройте алерты в Supabase
   - Следите за crash reports в Play Console / App Store Connect

2. **Обновления**
   - Web: автоматически через CI/CD
   - Android: увеличьте versionCode, пересоберите .aab
   - iOS: увеличьте build number, новый Archive

3. **Маркетинг**
   - ASO (App Store Optimization) - ключевые слова
   - Скриншоты с текстом на родном языке
   - Видео-превью (опционально)

---

## Полезные команды

```bash
# Проверка сборки
npm run build

# Превью production
npm run preview

# Синхронизация Capacitor
npx cap sync

# Обновление Capacitor
npx cap update

# Логи Android
npx cap run android -l

# Логи iOS
npx cap run ios -l
```

---

*Удачной публикации! 🚀*
