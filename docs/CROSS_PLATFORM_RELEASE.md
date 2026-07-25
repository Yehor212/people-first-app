# ZenFlow Cross-Platform Release Runbook

Единый маршрут доведения любого изменения до всех платформ. Источник правды для «release parity»: user-facing изменение считается завершённым только когда оно дошло до каждой shipped-платформы (см. Cross-Platform Mandate в `AGENTS.md`).

## Платформенная матрица

| Платформа | Хостинг / канал | Деплой | Проверка обновления |
|---|---|---|---|
| Web / PWA | GitHub Pages (`yehor212.github.io/people-first-app`) | Авто из `main` через `deploy.yml` | Деплой = SHA main; PWA отдаёт update prompt |
| Android | Google Play (AAB) | Ручная сборка + загрузка в Play Console | `versionCode` растёт, релиз в треке |
| iOS | App Store | Xcode archive + App Store Connect | `CFBundleVersion` растёт, релиз в review |
| Desktop | Tauri (`desktop-release.yml`, GitHub Releases) | `workflow_dispatch` | Release asset за текущий SHA |
| Netlify / Vercel (зеркала) | `netlify.toml` / `vercel.json` | Авто из `main`, если подключены | Проверка в дашборде хостинга |

## Пайплайн для каждого PR (путь до «апрува агентов»)

1. Ветка → PR → 4 обязательных гейта: `build`, `android-gate`, `ios-gate`, `production-data-integrity` + остальные проверки.
2. Squash-мерж в `main` → авто-деплой Web/PWA.
3. Live-smoke (`public-auth-smoke`, `public-privacy-smoke`) против живого сайта.
4. Если изменение user-facing — открыть «release parity» задачу на нативные платформы (см. ниже).

## Android release

```bash
# Требования: android/zenflow-release.keystore + android/key.properties (НЕ в git!)
cd android && ./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

- `versionCode`/`versionName` в `android/app/build.gradle` — поднимать КАЖДЫЙ релиз.
- Keystore: потеря = невозможность обновлять приложение. Хранить минимум в 2 местах вне репо (менеджер паролей + офлайн-диск). Пароли — только в менеджере паролей.
- Загрузка AAB в Play Console → internal track → staged rollout (10% → 50% → 100%).

## iOS release

```bash
npx cap sync ios
# Xcode → Product → Archive → Distribute → App Store Connect
```

- Требуется Apple Developer аккаунт владельца (Team ID, сертификаты) — не автоматизируется без него.
- `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` поднимать каждый релиз.
- Review занимает 1–2 дня — учитывать в parity-плане.

## Desktop release (Tauri)

```bash
# Через CI: Actions → Desktop Release → Run workflow (workflow_dispatch на main)
```

- Windows-подпись: secrets `ZENFLOW_WINDOWS_CERT_PFX_BASE64` + `ZENFLOW_WINDOWS_CERT_PASSWORD` (если не заданы — Windows-нога пропускается/падает, macOS собирается без них).
- Артефакты попадают в GitHub Releases.

## Политика версий и parity

- Одна `versionName`/`MARKETING_VERSION` на все платформы за один релизный цикл; web-версия — из `package.json`.
- Нативные платформы допустимо отставать от web не более чем на один релизный цикл; security-фиксы — без отставания.
- Каждый user-facing PR обновляет `CHANGELOG.md`; релизный цикл закрывается тегом.

## Обязательные проверки перед релизом (анти-«белый экран»)

- `npm run build` + `npm run check:production-data-integrity:bundle` — зелёные.
- Live-smoke после web-деплоя — зелёный.
- Android: установка release AAB на реальное устройство, прогон auth + diary lock flow.
- iOS: TestFlight-прогон auth + diary lock flow перед submit.
- PWA: проверка в режиме «установленное приложение», не только во вкладке.
