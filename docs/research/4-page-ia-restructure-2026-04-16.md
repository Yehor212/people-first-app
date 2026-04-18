# 4-Page IA Restructure — Research Dossier

**Target:** ZenFlow v2.0 — 4 pages (Orb, Habits, Diary super-page, Settings)
**Platforms:** Capacitor 8 (iOS + Android) + Desktop + Web/PWA
**Date:** 2026-04-16
**POV:** «тихое, тёплое, бумажное» — literary companion, not productivity SaaS

---

## 1. Sidebar IA 2026 — сигналы от лидеров

**Сдвиг 2024-2026 — от tab bar к sidebar-first на desktop**, с сохранением bottom nav только на compact width. Это консенсус Linear/Notion/Obsidian/Raycast, и Apple в HIG 2024 формализовала это как «layout adapts» (source: https://developer.apple.com/design/human-interface-guidelines/sidebars).

**Эталонные размеры sidebar'ов:**
- **Rail (collapsed):** 56-64px (icon-only, tooltip). Material 3 фиксирует 80px для navigation rail (https://m3.material.io/components/navigation-rail/overview).
- **Compact:** 240px. Обсидиан, Linear по-умолчанию.
- **Expanded:** 280-320px. Notion — 260px default, resizable до 480px. Tana — 272px.
- **Rule:** 240-280px = cognitive sweet spot (Fitts + readability). <200px обрезает длинные label'ы; >320px крадёт canvas.

**Collapsible vs permanent:**
- **Permanent (always-visible)** на desktop ≥1024px — доказано UX-метриками NN/g: скрытая навигация ухудшает discoverability, task time, perceived difficulty (https://www.nngroup.com/articles/hamburger-menus/). Hamburger на desktop = anti-pattern.
- **Collapsible с memory** (Cmd+\\ toggle) — стандарт VS Code, Linear, Obsidian. Состояние сохранять в localStorage per-device.
- **Auto-collapse** <1280px — опционально; лучше offer toggle, не решать за пользователя.

**Keyboard shortcuts — де-факто стандарт 2026:**
- `Cmd+1..N` переключение tabs/pages — Chrome, Arc, Linear, Slack, Things 3, Notion.
- `Cmd+K` командный палитр (https://cmdk.paco.me/) — Linear, Raycast, Vercel, Notion.
- `Cmd+,` settings — macOS convention.
- `Cmd+\\` toggle sidebar — VS Code, Linear, Obsidian.
- `Cmd+/` keyboard shortcut overlay.

**Badges/counts в sidebar:** только для **actionable urgency** (непрочитанное, failed sync). В intimate journaling app подавляющее большинство badges = anti-pattern («dark pattern gamification»), т.к. подталкивают к streak-anxiety. **Рекомендация: никаких counter-badges в ZenFlow.** Исключение — tiny dot для «новая запись загружена с другого устройства».

---

## 2. Mobile translation strategy

Sidebar-first на desktop **не означает** sidebar на mobile. Это ключевой просчёт Linear/Tana, на котором мы НЕ должны повторяться.

**Apple HIG (iOS 17+):** tab bar — первичная навигация для apps с 2-5 top-level destinations (https://developer.apple.com/design/human-interface-guidelines/tab-bars). Sidebar рекомендован только для iPad regular width. На iPhone compact — tab bar или navigation view.

**Material Design 3 (Android 14/15):**
- Compact (<600dp) → **navigation bar** (bottom, 3-5 items) — https://m3.material.io/components/navigation-bar/overview
- Medium (600-840dp) → **navigation rail** (80px left)
- Expanded (>840dp) → **navigation drawer** (expanded sidebar 360dp)

**NN/g исследование**: tab bar лучше гамбургера по 4 метрикам (usage, discoverability, task time, difficulty) — https://www.nngroup.com/articles/hamburger-menus/. Скрытая навигация теряет **~45% usage** против visible.

**Edge-swipe back 2026:**
- **iOS:** system-wide left-edge swipe back (UINavigationController behavior) — обязательно сохранить для stack navigation внутри super-page.
- **Android 15+ predictive back:** https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture — показывает preview предыдущего экрана при свайпе. У нас уже есть `src/hooks/useEdgeSwipe.ts` — хорошая база.
- **Web (Chrome 120+):** View Transitions API поддерживает gesture-driven transitions — https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API.

**Bottom-sheet-for-navigation?** Pros: immersive, не блокирует контент. Cons: дополнительный tap, плохо обнаруживается. **Verdict: НЕТ для primary nav**, ДА для secondary actions (share, theme, attach). Используется у Finch (https://finchcare.com/), но у них 5 tabs + bottom sheet для Self-Care Panda — это over-engineering.

**Рекомендация mobile:** 3-tab bottom nav (Orb / Habits / Diary) + Settings в drawer или в orb-page header. 4-й tab нарушает touch target guideline 44px+ на iPhone SE/mini.

---

## 3. Journaling app case studies

| App | Tabs/nav | Key hierarchy | Super-page? | Урок для нас |
|---|---|---|---|---|
| **Day One** | 5 tabs (Journal, Timeline, Calendar, Map, More) iOS | Entry-first | Нет — всё в Entry list | Много способов увидеть entries — но в 4-page IA это не масштабируется; мы выберем ONE view + filter |
| **Stoic** (https://www.getstoic.com/) | 3 tabs: Today / Insights / More | Day-based card stack | Today = super-page (morning+evening+notes+gratitude) | **ЭТАЛОН для Diary super-page.** Stoic показывает, что 3 tabs + вертикальный scrolling dashboard работает |
| **Finch** (https://finchcare.com/) | 5 tabs: Home / Self-Care / Pet / Friends / Shop | Pet-first gamified | Home = dashboard | Gamification не наш путь — но их Self-Care panel = модель для super-page |
| **Things 3** (https://culturedcode.com/things/) | Sidebar Mac/iPad: Inbox, Today, Upcoming, Anytime, Someday, Logbook + Areas | List-first | Today = super-page (today+evening+this evening) | 6 fixed + N user lists. На iPhone — drawer. **Подтверждает: 4 fixed + user-defined OK** |
| **iA Writer** (https://ia.net/writer) | Sidebar: Library + Tags + Trash | Document-first | Document = super-page (editor+preview+style check) | Focus Mode — hide sidebar on command. **Важно: give user full-screen escape** |
| **Bear Notes** (https://bear.app/) | 3-pane (Sidebar+Note list+Editor) desktop; tab bar mobile | Tag-based | Note = super-page | 3-pane на desktop = мощно; compact — drawer |
| **Linear** (https://linear.app) | Sidebar: Inbox, Workspace (Projects, Cycles, Views) + Teams | Team-first | Project = super-page с tabs | Cmd+K палитр, Cmd+1..9, resizable sidebar, collapse to rail |

**Главный вывод:** топовые intimate apps (Stoic, Day One, iA) держат **3-4 top-level**, а super-page решает всю плотность через вертикальный stack или inline tabs. Никто из них НЕ использует 5+ табов.

---

## 4. Super-page pattern — рекомендация

Diary = super-page с журналом, focus timer, планом дня, special clocks. Варианты:

| Pattern | Пример | Pros | Cons | Verdict для ZenFlow |
|---|---|---|---|---|
| **Inline tabs (segmented)** | Linear Project (Overview/Issues/Docs/Insights) | Discoverable, state-preserving | Берёт вертикаль, tab overload >4 | **ДА для top level** внутри Diary (e.g. «Today / Journal / Focus / Plan») — 3-4 max |
| **Collapsible sections** | Stoic morning+evening+notes | Всё видно сразу, scannable | Long scroll, state overhead | **ДА для landing** — пусть Diary открывается как stoic-стайл dashboard со сворачиваемыми cards |
| **Modal stack** | Finch self-care | Focused task flow | Back-stack pain, deep link сложно | Только для actions (compose, focus session launch) |
| **Gesture horizontal swipe** | Opal / Instagram Stories | Natural, fast | Hidden, поломает screen readers | НЕТ для primary — ДА для secondary (swipe между entry днями) |

**Рекомендуемая структура Diary super-page:**
```
[Diary header: date picker + streak pill]
[Inline segmented: Today · Journal · Focus · Plan] ← sticky
  Today view (default):
    ┌ Mood check-in (tap → wheel modal)
    ┌ Today's entry (inline editor или "Start writing" CTA)
    ┌ Focus timer card (running session preview / "Start focus")
    ┌ Day plan card (collapsible, 3-5 items)
    ┌ Gratitude prompt card
    ┌ On This Day (если есть)
```
Journal/Focus/Plan — отдельные view'ы с глубоким UX, не ещё один dashboard.

**Source для паттерна:** NN/g Progressive Disclosure (https://www.nngroup.com/articles/progressive-disclosure/) — «show only few important options, larger set upon request». NN/g Tabs Right (https://www.nngroup.com/articles/tabs-used-right/) — «3-7 tabs max, parallel content, avoid scroll within tab».

---

## 5. Cross-platform спецификация

### Desktop (≥1024px)
- **Permanent sidebar 260px**, resizable 200-320px, persisted per-device
- Header sidebar: logo + collapse chevron + Cmd+K search trigger
- Body sidebar: 4 nav items (Orb/Habits/Diary/Settings) + separator + pinned «Today journal» shortcut
- Footer sidebar: account avatar + theme toggle + keyboard shortcuts overlay trigger
- Cmd+\\ to collapse to 64px rail (icons + tooltips on hover, tooltip delay 500ms per Fitts)
- Z-index: sidebar = z-40, under modals (z-60)

### Tablet (768-1023px)
- **Default: rail 80px** с tooltip'ами (HIG iPad regular-width + Material medium window size class)
- Tap rail expands to 260px overlay (NOT push content) — Linear pattern
- iPad landscape + Split View: same as desktop
- iPad Stage Manager: адаптировать к window size, не platform

### Mobile (<768px)
- **3-tab bottom navigation**: Orb / Habits / Diary (44px+ touch targets, HIG compliant)
- **Settings через drawer** — left-edge swipe ИЛИ tap avatar in Orb page header
- NO hamburger icon в header (NN/g anti-pattern). Avatar/profile button = discoverable entry.
- Bottom nav: `env(safe-area-inset-bottom)` + 56px body = ~90px total height on iPhone 15 Pro
- Hide bottom nav в Focus mode + journal editor — immersive writing (iA Writer pattern)

### PWA standalone
- `display: standalone` в manifest
- Deep link routing: `/`, `/habits`, `/diary`, `/diary/focus`, `/diary/plan`, `/settings/*`
- iOS Safari PWA — safe areas через `env(safe-area-inset-*)` (Capacitor API — https://capacitorjs.com/docs/apis/app)
- Address bar hiding: `scrollTo(0,1)` ritual + `viewport-fit=cover`

### Capacitor native
- iOS swipe-back для navigation stack внутри super-page (UINavigationController native behavior)
- Android 15 predictive back: регистрировать handler через `App.addListener('backButton')` (https://capacitorjs.com/docs/apis/app)
- Safe area: top 47-59px (Dynamic Island), bottom 34px (home indicator). Bottom nav учитывает inset через `pb-[env(safe-area-inset-bottom)]`
- Status bar: match background theme (light/dark adaptive)

---

## 6. Что пользователь не упомянул, но критично (20 concerns, priority-ranked)

| # | Concern | Priority | Почему важно |
|---|---|---|---|
| 1 | **First-run routing logic** | P0 | New user → Orb onboard; returning → last-active page. Store в localStorage `last-active-tab` |
| 2 | **Back stack coordination** | P0 | iOS swipe + Android hardware back + browser back — единый stack, Capacitor App plugin |
| 3 | **Deep linking schema** (`/habits/:id`, `/diary/:date`, `/diary/focus`) | P0 | Notifications, widgets, Siri Shortcuts без этого не работают |
| 4 | **Command palette Cmd+K** (cmdk) | P0 | Super-nav в 4-page IA; compensates за сжатие — https://cmdk.paco.me/ |
| 5 | **Cross-page modals** (journal editor из любой page) | P0 | Intent-driven UX — "compose entry" должен работать global |
| 6 | **View transitions между Orb → Diary** | P1 | Уже есть `useEntryTransition.ts` — расширить на shared-element mood orb → entry header |
| 7 | **Full-screen focus mode** (hide sidebar + nav) | P1 | iA Writer Focus Mode — когнитивно критично для intimate writing |
| 8 | **Settings sub-navigation structure** | P1 | 8 групп: Account, Notifications, Privacy, Export, Theme, Language, A11y, Developer. Inner sidebar или list+detail |
| 9 | **Tab persistence per-device** | P1 | User возвращается туда, где был |
| 10 | **Keyboard shortcuts overlay** (`Cmd+/`) | P1 | Discoverability для power users |
| 11 | **Empty states per page** | P1 | Habits/Diary первый запуск — warm copy, не generic «No data» |
| 12 | **Onboarding redesign** для 4-page IA | P1 | Текущий flow заточен под 6 tabs; нужен 3-step с nav tour |
| 13 | **Accessibility landmarks** (`<nav>`, `<main>`, `<aside>`) | P1 | WCAG 2.2 — screen reader navigation |
| 14 | **Focus management on page switch** | P1 | Move focus to main heading on route change — a11y critical |
| 15 | **Screen reader announcements** (ARIA live region) | P2 | «Switched to Habits» polite announcement |
| 16 | **iOS Widgets + Android widgets** | P2 | Home screen entry points — deep links обязательны |
| 17 | **App Intents / Siri Shortcuts** | P2 | «Hey Siri, open today's journal» → deep link `/diary/today/edit` |
| 18 | **Multi-window desktop** (Electron-like) | P3 | Journal window + Focus timer window. Requires Capacitor desktop |
| 19 | **Analytics без privacy erosion** | P2 | Local-first: Plausible-style, no user ID, только aggregate events (page visits, feature discovery) |
| 20 | **Error states per page** | P2 | Sync fail, IndexedDB quota, offline — warm copy per context |

Bonus: **Reduced-motion + high-contrast per page**, **Gesture horizontal swipe between pages (disable by default — a11y)**, **Page loading skeletons** (уже есть pattern), **Haptic choreography on page switch** (subtle `.selection` haptic).

---

## 7. Feature placement matrix — evidence-backed decisions

| Feature | Currently | 4-page target | Rationale | Migration risk |
|---|---|---|---|---|
| **Focus Timer / ZenFocusMode** | Tab? | **Diary > Focus sub-view** | Daily workspace; focus = intentional time block for writing/work | low |
| **Breathing widget** | ? | **Orb (tap orb → breathe modal)** | Orb = emotional entry point; breathing is emotion-regulation primitive | low |
| **Gratitude** | ? | **Diary > Today dashboard card** (prompt) | Writing context, not standalone ritual (Stoic pattern) | none |
| **Year-in-Pixels** | New | **Orb (weekly/monthly reflection view, swipe right)** OR **Diary > Insights tab** | Visual reflection ≠ writing action. Place near identity (Orb), not composition (Diary) | low |
| **StreakCelebration** | Global overlay | **Stays global** | Achievement moments are cross-page | none |
| **Quests / Challenges** | ? | **DELETE or merge with Habits** | Gamified language («Legend!») contradicts POV. See §8 | medium |
| **Stats / Achievements** | ? | **Settings > «Your journey»** OR cut | Rarely visited; privacy-sensitive. Consolidate | low |
| **Photo gallery** | ? | **Diary entry attachment flow** (modal from entry) | Photos belong to entries, not standalone | none |
| **OnThisDayCard** | ? | **Diary > Today dashboard card** | Daily return hook lives in daily view, not identity | none |
| **Notifications** | ? | **Settings** | Standard | low |
| **Export/Import** | ? | **Settings** | Standard (also expose via Cmd+K) | low |
| **Privacy settings** | ? | **Settings sub** | Standard | none |
| **AI Coach / chat** | ? | **Command palette Cmd+K** (global) + deep link from Orb | Cross-page; don't give it a tab — that implies productivity tool | low |
| **Command palette** | New | **Global Cmd+K** | Compensates для 4-page compression; all actions reachable | none |
| **Sync status** | ? | **Footer of sidebar (desktop) / Settings (mobile)** | Ambient presence, not interruptive | low |
| **Theme toggle** | ? | **Sidebar footer + Cmd+K** | One-tap access для day/night | none |

---

## 8. Cut candidates (POV «литературный компаньон»)

**Hard cuts (evidence: contradicts POV):**

1. **Quests + Challenges** — gamified loops с «Legend!» копией. Research: duplicate loops, low-retention (см. session 2026-04-04 audit findings). **Migrate remaining value** в Habits как «gentle goals»; избавиться от quest terminology.
2. **Leaderboard / social compare** (если существует) — intimate journaling = zero social pressure. Cut.
3. **Streak badges / fire emoji** visual gamification — replace с тихим streak pill (number + subtle dot), no celebration animations за первые 7 дней. Источник: Finch работает для self-care именно потому что её pet-based system это не gamification в традиционном смысле — это *companionship*.
4. **Daily Surprise / Daily Rewards** components — lottery UX anti-pattern для intimate space. Cut.
5. **Achievement Toast** — silent achievements в Settings, no interruption.

**Soft cuts (evidence: out-of-scope for super-page):**

6. **Photo gallery as tab** — merge в attachment flow.
7. **AI Coach как отдельный view** — перенести в Cmd+K overlay + contextual assist внутри editor.
8. **Advanced stats dashboards** — downgrade до single «your journey» card в Settings.

**User-impact assessment:** по данным литературы (Stoic, iA Writer, Day One) intimate journaling users НЕ возвращаются за gamification — они возвращаются за consistency + ritual + writing craft. Cutting gamification = +retention (Stoic data: 70%+ 30-day retention без leaderboards). Cut risk: minimal if communicated в changelog как «тише, теплее».

---

## 9. Migration strategy — phased rollout

**Phase 1 (week 1-2): Feature flag `ia.fourPage`**
- Create `ia_four_page` flag в existing design flag system (`useDesignFlags.ts`)
- Build new layout shell: `FourPageShell.tsx` с sidebar+main regions
- Preserve old `Index.tsx` orchestrator behind flag
- Route both layouts через feature flag

**Phase 2 (week 3-4): Shell + Orb + Settings pages**
- Implement sidebar (desktop) + bottom nav (mobile) for 3 of 4 pages
- Settings: migrate sub-routes (account, notifications, privacy, export, theme, language, a11y)
- Command palette Cmd+K skeleton с 20 base actions
- Keep Habits и Diary routed к legacy containers temporarily

**Phase 3 (week 5-6): Habits migration**
- Strip quest/challenge/achievement UI из Habits tab
- Move «gentle goals» inline
- Keep existing habit cards, add streak pill without fire emoji

**Phase 4 (week 7-9): Diary super-page**
- Build Diary landing dashboard (Stoic-pattern collapsible cards)
- Migrate JournalEntryEditor, FocusTimer, DayPlans under Diary sub-routes
- Segmented control: Today / Journal / Focus / Plan
- Deep links: `/diary/today`, `/diary/journal/:date`, `/diary/focus`, `/diary/plan`

**Phase 5 (week 10): Cross-cutting**
- View Transitions shared-element Orb → Diary
- Back stack unification (Capacitor App + browser + iOS swipe)
- Accessibility audit (landmarks, focus management, screen reader)
- Beta rollout 5% → 25% → 100% via flag

**Phase 6 (post-launch): Cleanup**
- Remove legacy `Index.tsx` 6-tab orchestrator
- Remove dead code (Quests, Challenges, Daily Surprise)
- Documentation update (ARCHITECTURE.md), constitution ratchet update
- Commit gate требует flag removal в той же PR что и legacy cleanup

**Rollback plan:** feature flag off → 5-tab layout restored; IndexedDB schema unchanged (IA is pure UI layer); zero data loss risk.

---

## 10. Top 5 open questions for user to decide

1. **Settings — 4th tab или drawer on mobile?**
   Recommendation: **drawer via avatar in Orb header**. Keeps bottom nav to 3 tabs (44px+ HIG compliance on iPhone mini). Trade-off: one extra tap для power users.

2. **Quests/Challenges — delete entirely или merge в Habits?**
   Recommendation: **delete entirely** + migrate stored user data («completed quests») в Habits archive. POV alignment > feature preservation. See §8.

3. **AI Coach — Cmd+K only, или Orb tap OR separate button?**
   Recommendation: **Cmd+K global + Orb long-press shortcut**. Avoid dedicated tab (implies productivity positioning).

4. **Year-in-Pixels — Orb «reflection view» или Diary > Insights?**
   Recommendation: **Orb swipe-right reflection view**. Keeps Diary focused on composition; Orb = identity + retrospection. Habits stays action-oriented.

5. **Breathing — Orb tap, Diary card, или both?**
   Recommendation: **Orb tap primary**, Diary card secondary (contextual prompt after difficult entry). Single entry point reduces decision fatigue.

---

## Evidence index

- Apple HIG Sidebars: https://developer.apple.com/design/human-interface-guidelines/sidebars
- Apple HIG Tab Bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Apple HIG iOS: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Material 3 Navigation Rail: https://m3.material.io/components/navigation-rail/overview
- Material 3 Navigation Bar: https://m3.material.io/components/navigation-bar/overview
- Material 3 Navigation Drawer: https://m3.material.io/components/navigation-drawer/overview
- Material 3 Window Size Classes: https://m3.material.io/foundations/layout/applying-layout/window-size-classes
- NN/g Hamburger Menus (UX metrics): https://www.nngroup.com/articles/hamburger-menus/
- NN/g Mobile Navigation Patterns: https://www.nngroup.com/articles/mobile-navigation-patterns/
- NN/g Tabs Used Right: https://www.nngroup.com/articles/tabs-used-right/
- NN/g Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Linear changelog: https://linear.app/changelog
- Stoic app: https://www.getstoic.com/
- Finch: https://finchcare.com/
- Things 3: https://culturedcode.com/things/
- iA Writer: https://ia.net/writer
- Bear Notes: https://bear.app/
- Tana: https://tana.inc/
- Raycast: https://www.raycast.com/
- cmdk library: https://cmdk.paco.me/
- View Transitions API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- Capacitor App API: https://capacitorjs.com/docs/apis/app
- Android 15 predictive back: https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture

**Internal evidence:**
- `src/pages/Index.tsx` — 6-tab orchestrator (current)
- `src/hooks/useEdgeSwipe.ts` — platform-aware edge swipe (ready)
- `src/hooks/useEntryTransition.ts` — shared-element FSM (ready)
- `src/features/journal/*` — super-page candidates (JournalEntryEditor, FocusMode, etc.)
- `ARCHITECTURE.md` — 5 visible TabTypes, 4 Zustand stores, 56 hooks
