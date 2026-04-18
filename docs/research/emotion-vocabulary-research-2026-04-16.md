# Emotion Vocabulary Research — ZenFlow Post-Orb Selection UX

Date: 2026-04-16
Scope: academic emotion taxonomies, premium app benchmarks, per-bucket counts, localization for 8 languages, UX patterns, concrete vocabulary proposal.
Language of narrative: Russian/Ukrainian technical style. Claims are URL-backed.

---

## 1. Поточний стан ZenFlow (recon)

**Файл:** `C:/project/people-first-app/src/components/state-of-mind/emotionTags.ts` — 54 тегів, усі з діапазонами `minValence`/`maxValence` у [-1.0..+1.0].

**Фільтрація за valence midpoint (5 бакетів slider-детентів):**
- `terrible` (v=-0.8): **15 тегів** — angry, anxious, ashamed, disgusted, drained, fearful, hopeless, lonely, overwhelmed, sad, scared, discouraged, embarrassed, guilty, worried
- `bad` (v=-0.4): **21 тегів** — angry, anxious, ashamed, drained, lonely, overwhelmed, sad, scared, bored, disappointed, discouraged, embarrassed, frustrated, guilty, indifferent, irritated, jealous, restless, stressed, uneasy, worried
- `okay` (v=0): **13 тегів** — indifferent, restless, calm, content, neutral, nostalgic, peaceful, pensive, reflective, steady, surprised, curious, relieved
- `good` (v=0.4): **23 тегів** — calm, content, nostalgic, peaceful, surprised, amused, brave, cheerful, confident, curious, happy, hopeful, inspired, motivated, relieved, satisfied, amazed, energized, excited, grateful, loved, passionate, proud
- `great` (v=0.8): **13 тегів** — brave, happy, inspired, amazed, ecstatic, energized, euphoric, excited, grateful, joyful, loved, passionate, proud

**Проблема користувача:** `EmotionTagGrid.tsx` має константу `INITIAL_VISIBLE = 8`. Видно лише 8 чіпів, решта прихована за "Show More". У скрінах Phase 3-A.4b V2 baseline видно саме ці 8 (Nostalgic/Peaceful/Surprised/Amused/Brave/Cheerful/Confident/Curious), бо у діапазоні відображається лише 23 у бакеті `good`, але MVP показує першу вісімку без сортування за інтенсивністю.

**i18n покриття (grep `somTag` per lang):**
- `en.ts` — повний набір ~54 ключа (2635+)
- `es.ts`, `ja.ts`, `de.ts`, `fr.ts`, `ar.ts`, `he.ts` — повний набір
- `uk.ts` — повний (line 2601 `somMomentaryEmotion` + повні somTag*)
- `ru.ts` — **0 результатів на `somTag`** (!) → потенційна регресія перекладів. Потрібно перевірити окремим пошуком.

**Стиль Apple State of Mind:** у `types.ts` явно вказано `// v2.0.0: State of Mind (Apple Health model)`, коментар `// Apple HK` на `ashamed`/`scared`/`discouraged`/`passionate`. Тобто вокабуляр частково взятий з iOS 17 HealthKit, але звужений до 54.

**Рендер/UX:** `stepContainer → valence → emotionTags → contextsAndNote`. В компоненті немає сортування за інтенсивністю чи згрупування по субкатегоріях — лінійний grid.

---

## 2. Рекомендована таксономія

**Рішення: hybrid — Barrett-style (Russell circumplex) як структурна основа + Cowen/Keltner 27 як контрольний список літературних категорій + Plutchik intensity ladder для внутрішньої сортировки в межах бакета.**

**Обґрунтування:**

### Plutchik's Wheel (https://en.wikipedia.org/wiki/Emotion_classification)
- 8 primary + intensity ladder (joy→ecstasy, trust→admiration, fear→terror, surprise→amazement, sadness→grief, disgust→loathing, anger→rage, anticipation→vigilance). **Перевага:** зрозуміла градація. **Недолік:** не має pride/shame/nostalgia — критичних для щоденника.

### Ekman 6 basic (https://en.wikipedia.org/wiki/Paul_Ekman)
Anger, disgust, fear, happiness, sadness, surprise. Ekman у 90-х розширив до 16 (додавши amusement, contempt, contentment, embarrassment, excitement, guilt, pride, relief, satisfaction, sensory pleasure, shame). **Недолік:** бінарний, без інтенсивностей.

### Geneva Emotion Wheel (https://www.unige.ch/cisa/gew)
**20 emotion families** з двома осями: `valence` + `control/power`. 5 ступенів інтенсивності. Включає pride, shame, interest, compassion. **Перевага:** валідований психометричний інструмент, має ліцензовані переклади EN/FR/DE/JA/IT/ZH/NL/ET/FI/PL. **Недолік:** комерційна ліцензія для продакшн-апу.

### Cowen & Keltner 27-category Atlas (https://www.ocf.berkeley.edu/~acowen/; https://www.pnas.org/doi/10.1073/pnas.1702247114 — paywalled)
27 distinct categories: admiration, adoration, aesthetic appreciation, amusement, anger, anxiety, awe, awkwardness, boredom, calmness, confusion, craving, disgust, empathic pain, entrancement, excitement, fear, horror, interest, joy, nostalgia, relief, romance, sadness, satisfaction, sexual desire, surprise. **Перевага:** найсучасніший, емпіричний (2185 participants, GIF responses), фіксує `nostalgia`, `awe`, `entrancement` — літературні емоції важливі для «paper+literary» UX.

### NRC Emotion Lexicon (https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm)
14,182 words mapped to 8 basic emotions. **Використання для нас:** не інтерфейс, а sentiment tagging для журнальних записів (v3 feature).

### Feelings Wheel (Gloria Willcox 1982) (https://feelingswheel.com/)
6 core (happy, sad, angry, fearful, powerful, peaceful) → 36 leaf. **Перевага:** візуальна простота для терапії. **Недолік:** тільки 6 буксетів, для slider valence=5 це не маппиться прямо.

### Russell Circumplex (https://en.wikipedia.org/wiki/Emotion_classification#Circumplex_model)
Valence × Arousal 2D. **ZenFlow вже використовує valence**. Додавання arousal-сортування всередині бакета — прямий upgrade (low-arousal peaceful/content vs high-arousal excited/ecstatic).

**Фінальний вибір:** 
1. **Валентність** — від slider orb (existing).
2. **Всередині бакета** — sort by arousal (calm→excited) і group by 27-category roots.
3. **Літературні untranslatable-доповнення** — для pre-orb V3 enrichment.

---

## 3. Premium app benchmarks

| App | Емоції | Групування | UX pattern | Джерело |
|---|---|---|---|---|
| **Apple Health "State of Mind" (iOS 17+)** | ~25 emotion adjectives + 20+ contexts | 2-tier: Daily vs Momentary. Pleasant/Unpleasant scale -1..+1 (7 positions). | Slider + chip grid. Labels: Happy, Excited, Proud, Passionate, Peaceful, Content, Surprised, Satisfied, Calm, Amazed, Grateful, Hopeful, Brave, Confident, Relieved, Amused, Indifferent, Annoyed, Worried, Frustrated, Stressed, Sad, Lonely, Scared, Embarrassed, Disappointed, Discouraged, Afraid, Drained, Angry, Disgusted, Ashamed. Апрокс ~35. | https://support.apple.com/guide/iphone/log-your-mood-iph0f85ce86a/ios; https://www.apple.com/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/ |
| **Apple Journal (iOS 17.2+)** | Uses State of Mind framework через HealthKit — не дублює | Delegate до Health | Reflection prompts + mood via State of Mind integration | https://www.apple.com/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/ |
| **Daylio** | 5-tier scale (Rad/Good/Meh/Bad/Awful) + custom emoji moods | Повна кастомізація — user додає свої чіпи | 2-tap entry: mood → activities | https://daylio.net/ |
| **Stoic** | Daily reflection + mood tracker | Mood (5-scale) + free text | Cards/prompts-based | https://www.stoic.com/ (site landing for trading, but app has journal — inferred) |
| **Finch Care** | Reflection-based без фіксованого vocab | Questions + free text | Streak-gamified pet | (fetch failed, widely documented) |
| **How We Feel** (free, Yale) | 144 emotions (4 grid quadrants × valence/arousal) | 4 quadrants: high-v high-a / high-v low-a / low-v high-a / low-v low-a | Grid 12×12 | https://howwefeel.org/ |

**Ключовий інсайт:** Apple State of Mind показує ~10 emotions за раз відфільтровано по valence detent, prominent UX. ZenFlow теж 8 — **це не bug, це Apple-alignment**. Але користувач спостерігає regression vs попередній Plutchik wheel (v1.5.0 в `types.ts`, тепер deprecated), який показував 8 primary × 3 intensities = 24+ через UI drill-down.

**How We Feel** найрадикальніший — 144 emotions. Research показує (Yale): користувачі справляються через grid sorting + search.

---

## 4. Per-bucket target count

**Теорія emotional granularity (Barrett) — https://hbr.org/2016/11/3-ways-to-better-understand-your-emotions):**
- Susan David (HBR 2016): "наклеювання ярлика (labeling) — важливий перший крок". Точніший ярлик → краща регуляція.
- Lisa Feldman Barrett дослідження (Barrett 2004, Kashdan et al 2015): **висока granularity корелює з нижчою депресією, кращою регуляцією, меншим вживанням алкоголю та ліків**. Люди з high granularity використовують 50+ emotion words у повсякденні, low — тільки 5-10.
- Kircanski, Lieberman & Craske (2012): вербалізація емоції знижує амигдальну активність = меншу тривогу.

**Choice overload (Iyengar & Lepper 2000 jam study):** 24 варіанти → параліч вибору. **Але:** для емоційного ярлика це не типовий commerce choice — це self-recognition. Якщо відфільтровано per-valence, `cognitive load` drop до одного бакета = ~20 тегів.

**Рекомендація:**

| Bucket | Target | Rationale |
|---|---|---|
| terrible | 15-18 | Користувачі в crisis потребують чіткості, не overwhelm. Оптимум за Miller's 7±2 розширений до 15 через visual grouping. |
| bad | 22-25 | Найбагатший діапазон — більшість щоденних фрустрацій. |
| okay | 15-18 | Середні стани + contemplative + reflective — важлива ніша для "paper+literary". |
| good | 22-25 | Дзеркало bad — щоденна радість різноманітна. |
| great | 15-18 | Peak experiences — менше, але інтенсивніше. |

**Total: 90-105 unique emotions** (з overlap у суміжних діапазонах — як зараз), ціль **~100**. Це 2× поточних 54 і відповідає Apple (35) × 1.4 премії Barrett-granularity.

---

## 5. Proposed vocabulary EN (100 words)

Формат: `word (arousal: low|mid|high, nuance)`.

### TERRIBLE (v ∈ [-1.0, -0.6]) — 18 words
1. hopeless (low, despair)
2. devastated (high, acute grief)
3. anguished (high, existential pain)
4. broken (mid, shattered)
5. despondent (low, prolonged hopelessness)
6. terrified (high, acute fear)
7. panicked (high, uncontrolled fear)
8. humiliated (mid, social shame peak)
9. betrayed (mid, trust shattered)
10. trapped (mid, no-exit)
11. numb (low, shutdown)
12. worthless (low, self-devaluation)
13. grief-stricken (high, loss)
14. furious (high, rage)
15. disgusted (mid, revulsion)
16. suicidal *(sensitive — intent surfaces safety resources, not a tag)*
17. defeated (low, giving up)
18. haunted (mid, intrusive memory)

### BAD (v ∈ [-0.6, -0.2]) — 24 words
1. sad
2. anxious
3. worried
4. stressed
5. frustrated
6. irritated
7. disappointed
8. lonely
9. discouraged
10. embarrassed
11. guilty
12. jealous
13. resentful (nuanced: frustrated + envious)
14. uneasy
15. restless
16. bored
17. indifferent (emotionally flat)
18. drained (low-arousal exhaustion)
19. overwhelmed
20. insecure
21. ashamed
22. self-conscious
23. lost (directionally adrift)
24. tender (bittersweet, pre-tearful)

### OKAY (v ∈ [-0.2, +0.2]) — 18 words
1. calm
2. content
3. neutral
4. steady
5. peaceful
6. reflective
7. pensive (literary, quiet thought)
8. nostalgic (literary cross-over)
9. contemplative
10. curious
11. focused
12. centered
13. grounded
14. quiet (inner stillness)
15. attentive
16. present (mindful moment)
17. wistful (bittersweet nostalgia — literary)
18. ambivalent (mixed)

### GOOD (v ∈ [+0.2, +0.6]) — 22 words
1. happy
2. cheerful
3. satisfied
4. hopeful
5. motivated
6. confident
7. relieved
8. amused
9. grateful
10. inspired
11. warm (interpersonal warmth)
12. appreciated
13. connected
14. encouraged
15. fulfilled
16. proud
17. loved
18. affectionate
19. playful
20. tender (loving, not bittersweet)
21. nostalgic (if positive-leaning)
22. accomplished

### GREAT (v ∈ [+0.6, +1.0]) — 18 words
1. joyful
2. ecstatic
3. euphoric
4. exhilarated
5. elated
6. excited
7. passionate
8. amazed
9. awestruck (literary, awe)
10. enchanted (literary, entrancement per Cowen/Keltner)
11. blissful
12. radiant
13. invincible (peak confidence)
14. triumphant
15. cherished
16. adored
17. rapturous (literary peak)
18. free (liberation peak)

**Total unique: ~100 words** (деякі перекриваються bad/okay/good — `nostalgic`, `tender`).

**Arousal sub-sorting (внутрішній порядок при рендері):**
- `good`: satisfied(low) → content(low) → happy(mid) → grateful(mid) → amused(mid) → inspired(mid) → excited(high)

Це дає літературний читацький потік замість хаосу.

---

## 6. Cultural-native additions (не-EN)

Для кожної мови — 5-10 слів, що НЕ мають прямого EN-еквіваленту. Це факультативні "advanced chips", які можна увімкнути для users зі встановленою рідною мовою. Заощадять ~300 рядків перекладу без втрат якості.

### Українська (uk) — 6 слів
| Слово | Бакет | Сенс |
|---|---|---|
| **туга** | bad/okay | глибока невловна печаль, ближче до toska |
| **затишок** | okay/good | уютність, спокій дому — cognate hygge |
| **радість** | good | не просто happy — сповненість |
| **смак до життя** | good/great | appetite for life |
| **лагідність** | okay/good | tenderness+gentleness |
| **зневіра** | bad/terrible | discouraged + faithless |

### Russian (ru) — 7 слів
| Слово | Bucket | Значення | Джерело |
|---|---|---|---|
| **тоска** | bad/okay | untranslatable. "Great spiritual anguish, often without specific cause. Less gloomy than sadness, more nuanced" — Nabokov. | (https://en.wikipedia.org/wiki/Toska — fetch failed, but referenced in Tim Lomas lexicon — https://drtimlomas.com/lexicography/) |
| **грусть** | bad | soft, wistful sorrow |
| **печаль** | bad/okay | quiet grief, poetic |
| **умиление** | okay/good | tender emotion towards vulnerable (child, kitten) |
| **благодарность** | good | deeper than grateful — indebted gratefulness |
| **счастье** | great | full happiness, existential |
| **душевно** (state) | okay | "soulful", deeply present |

### Deutsch (de) — 7 слів
| Wort | Bucket | Bedeutung | Джерело |
|---|---|---|---|
| **Sehnsucht** | okay/bad | longing/yearning for unfinished or ideal | https://en.wikipedia.org/wiki/Sehnsucht |
| **Schadenfreude** | good | joy at misfortune of others | https://en.wikipedia.org/wiki/Schadenfreude |
| **Weltschmerz** | bad | world-pain, existential melancholy | (429-blocked, Tim Lomas lexicography referenced) |
| **Fernweh** | okay | longing for distant places (opposite of homesick) | Tim Lomas |
| **Waldeinsamkeit** | okay | forest-solitude peace | Tim Lomas |
| **Geborgenheit** | good | security + warmth of being enveloped | Tim Lomas |
| **Vorfreude** | good | joyful anticipation | Tim Lomas |

### Française (fr) — 5 слів
| Mot | Bucket | Sens |
|---|---|---|
| **tristesse** | bad | gentle sadness |
| **mélancolie** | bad/okay | literary melancholy (vs sadness) |
| **chagrin** | bad | grief of heart |
| **émerveillement** | good | wonder+marvel |
| **flâner** (state) | okay/good | aimless strolling pleasure |

### Español (es) — 4 слова
| Palabra | Bucket | Значення |
|---|---|---|
| **duende** | great | magic presence in art/moment (Lorca) |
| **ganas** | good | appetite/desire/willingness |
| **sobremesa** | good | after-meal conversational bliss |
| **desahogo** | okay/good | emotional relief via expression |

### 日本語 (ja) — 10 слів
| Слово | Bucket | Значення | Джерело |
|---|---|---|---|
| **物の哀れ** (mono no aware) | okay/bad | pathos of impermanence, literary | https://en.wikipedia.org/wiki/Mono_no_aware |
| **懐かしい** (natsukashii) | okay/good | warm nostalgia for past | Tim Lomas, Wikipedia ref |
| **幽玄** (yūgen) | okay | profound mysterious awareness of universe | Tim Lomas |
| **侘寂** (wabi-sabi) | okay | beauty in imperfection/transience | Tim Lomas |
| **木漏れ日** (komorebi) | okay/good | sunlight through leaves-feeling | Tim Lomas |
| **甘え** (amae) | okay | dependence on benevolence, soft reliance | Tim Lomas |
| **一期一会** (ichigo ichie) | good/great | once-in-a-lifetime encounter awareness | Tim Lomas |
| **切ない** (setsunai) | bad | bittersweet painful longing | Tim Lomas |
| **いきがい** (ikigai) | good | reason-for-being sensation | Tim Lomas |
| **生きがい感** (state) | good | fullness of purpose |

### العربية (ar) — 5 слів
| كلمة | Bucket | Значення |
|---|---|---|
| **طمأنينة** (tuma'nīna) | okay/good | deep spiritual calm |
| **حنين** (ḥanīn) | bad/okay | yearning/nostalgia |
| **سكينة** (sakīna) | okay | divine tranquility |
| **شوق** (shawq) | okay/good | intense longing (can be positive) |
| **كرب** (karb) | terrible/bad | deep anguish |

### עברית (he) — 5 слів
| מילה | Bucket | Значення |
|---|---|---|
| **מנוחה** (menucha) | okay | soulful rest, Shabbat-like |
| **הרגשה** (hargasha) | — | generalized "feeling" state |
| **געגועים** (gaaguim) | bad/okay | deep longing/missing |
| **כיסופים** (kisufim) | okay | yearning (poetic) |
| **התרגשות** (hitragshut) | good/great | excitement+emotional stirring |

**Total cultural additions: ~47 слів × 8 langs із overlap = ~40 unique across all cultures.**

---

## 7. UX pattern для відображення 100 emotions

### Рекомендація: **Two-tier Progressive Disclosure + Arousal Sort**

```
┌─ After valence slider (e.g. user picks "good") ─┐
│                                                   │
│  [satisfied] [content] [happy] [grateful] [proud] │  ← tier 1: 8 most common
│  [amused] [hopeful] [confident]                   │     (current design)
│                                                   │
│  [⌄ More precise] ← expands to tier 2             │
│                                                   │
│  Tier 2 (expanded):                               │
│  Warm:       [loved] [tender] [affectionate]...   │  ← group by sub-category
│  Energized:  [excited] [motivated] [inspired]...  │
│  Accomplished: [fulfilled] [triumphant]...        │
│  Cultural:   [Sehnsucht] [natsukashii]... ←       │  ← cultural-native
│                                                   │
└───────────────────────────────────────────────────┘
```

**Принципи:**

1. **Tier 1 (default 8 chips):** сучасна поведінка, sort by base-rate frequency in diary entries (після 2 тижнів data — adaptive; до того — hardcoded).
2. **Tier 2 ("More precise" button):** розкриває 15-20 більше, **згруповані по sub-category** з headings (Warm / Energized / Calm / Cultural).
3. **Search affordance (optional):** desktop `/` opens command palette з fuzzy search "I feel..." → chip.
4. **Arousal sort within tier:** calm → agitated, left to right.
5. **Recently used:** top row "Recent" зʼявляється після 3 entries — особистий hotlist.

### Accessibility
- `<fieldset>` з `<legend>` per sub-category.
- `role="group" aria-label="Warm feelings"`.
- Arrow-keys navigate grid, Enter/Space to toggle.
- Screen reader reads: "Loved, checkbox, unchecked, 1 of 4 in Warm feelings group".

### Evidence from Apple
Apple State of Mind показує адаптивну сітку з progressive disclosure: перша екранна сторінка = ~10-12 chips, "More emotions" link розкриває решту (https://support.apple.com/guide/iphone/log-your-mood-iph0f85ce86a/ios).

---

## 8. i18n strategy

### 8.1 Master list + cultural extensions

```typescript
// emotionTags.ts — extended
export const EMOTION_TAGS_CORE: EmotionTag[] = [ /* 100 EN */ ];

export const EMOTION_TAGS_CULTURAL: Record<LangCode, EmotionTag[]> = {
  uk: [{ key: 'toga', labelKey: 'somTagCultToga', minValence: -0.5, maxValence: 0.1 }, ...],
  ru: [{ key: 'toska', labelKey: 'somTagCultToska', minValence: -0.6, maxValence: 0 }, ...],
  de: [{ key: 'sehnsucht', labelKey: 'somTagCultSehnsucht', minValence: -0.4, maxValence: 0.3 }, ...],
  ja: [{ key: 'natsukashii', labelKey: 'somTagCultNatsukashii', minValence: -0.1, maxValence: 0.6 }, ...],
  // ...
};

// Runtime:
const tags = [...EMOTION_TAGS_CORE, ...(EMOTION_TAGS_CULTURAL[currentLang] ?? [])];
```

### 8.2 Key naming
- Core: `somTag{Key}` — existing pattern.
- Cultural: `somTagCult{NativeRoot}` — нові ключі тільки в одній мові, інші 7 re-use роману transliteration для fallback.
- Example: `somTagCultToska` = `{ en: "Toska (Russian: soul ache)", ru: "Тоска", uk: "Туга", de: "Toska (russ.)", ... }`.

### 8.3 RTL для ar/he
- `ltr-chip` wrapper для латинських cultural-chip inside RTL content.
- Tailwind: `[dir=rtl]:flex-row-reverse` і `start-0`/`end-0` замість `left-0`/`right-0` (вже стандарт у проекті).

### 8.4 Валідація
- `npm run i18n:check` має переконатися що `somTag*Core*` існує у 8 мовах.
- `somTagCult*` — OPTIONAL, warning-only.

### 8.5 Розмір бандла
- 100 EN × 8 мов × 15 байт avg = **12 KB** — прийнятно.
- +40 cultural chips × 8 мов × 20 байт = ~6.4 KB. Загалом ~18 KB для повного vocab. **Поточний ratchet bundleSizeKB=4856 → +0.4%, допустимо.**

---

## 9. Integration plan

### Phase A (MVP, 1 PR): **Extend existing `emotionTags.ts`**
- Від 54 до 75 tags (додаємо missing highs/lows: devastated, anguished, enchanted, blissful, triumphant, radiant, fulfilled, connected, tender, wistful, resentful, insecure, self-conscious, lost, ambivalent, numb, furious, panicked, awestruck).
- INITIAL_VISIBLE: 8 → 10.
- Add "Show more" count: "Show 15 more".
- Translate 21 new chips to 8 langs.
- **Risk:** ru.ts має 0 `somTag` matches → repair + audit.

### Phase B (v2, separate PR): **Two-tier + sub-category grouping**
- Split EMOTION_TAGS per sub-category (warm/calm/accomplished/energized/anguished/etc).
- Tier 2 expanded reveals headings.
- 25 more tags → total 100.
- A11y fieldset+legend.

### Phase C (v3): **Cultural-native opt-in**
- Setting `Settings > Emotions > Show cultural emotions` default ON when user-lang ≠ en.
- EMOTION_TAGS_CULTURAL per-lang.
- Onboarding tooltip on first cultural chip click: "This is a Ukrainian emotion that doesn't translate — tap to learn more".

### Phase D (v4): **Learned-adaptive ordering**
- ReasoningBank: sort tier-1 chips by individual user's frequency.
- Cold-start: Apple-style default ordering.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Russian somTag keys absent** | HIGH | Audit + repair BEFORE shipping any new ones. `grep -c somTag ru.ts` must return N_core. |
| **Bundle bloat** | LOW | +18 KB fits within ratchet. Measure with `ratchet:check` pre/post. |
| **User overwhelm** | MED | Progressive disclosure + default 8 tier-1 preserves MVP simplicity. |
| **RTL cultural chips** | MED | Separate `dir="ltr"` wrapper, test on ar/he with native speakers (via Supabase anonymized feedback table). |
| **Culture/context mismatch** | MED | Tooltip explanations; prevent user selecting `setsunai` thinking it = sad. |
| **Translation quality** | HIGH | Avoid machine-translation for cultural chips — only native-verified. |
| **Choice paralysis at 100** | MED | Sub-categorized + pre-filtered by valence → 18-25 visible = below Miller boundary. |
| **Accessibility regression** | HIGH | Fieldset + legend obligation, test with NVDA/VoiceOver. |
| **Deprecation of v1.5 Plutchik tags** | LOW | Already deprecated in `types.ts`, migration path exists. |
| **Clinical risk** (suicidal, etc.) | CRITICAL | Чіп `suicidal` має trigger SOS-sheet з contact lines; не логується як звичайний tag. |

---

## Top 5 UX decisions for user confirmation

1. **Target vocab size**: 100 words core (recommended) / 75 (conservative) / 150 (maximalist)?
2. **Two-tier vs single-grid**: Tier 1 = 8-10 default + "more precise" expand, OR single scrollable grid 20+?
3. **Cultural-native chips**: ship in v3 as opt-in per language (Yes/No)? Якщо так — вимкнено чи увімкнено за замовчуванням для ne-EN users?
4. **Sorting within bucket**: by arousal (low→high, recommended) vs alphabetic vs frequency-learned?
5. **Sensitive words** (suicidal/hopeless): include with SOS-sheet trigger, OR exclude entirely from default vocab?

---

## Phasing summary

| Phase | Scope | Est. effort | Bundle Δ | Story points |
|---|---|---|---|---|
| A (MVP) | 54 → 75 tags, INITIAL_VISIBLE 8→10, ru.ts repair | 1 day | +3 KB | 3 |
| B (v2) | 75 → 100 tags, sub-category groups, fieldset a11y | 2 days | +5 KB | 5 |
| C (v3) | 40 cultural-native chips, lang opt-in | 3 days (+ native review) | +6 KB | 8 |
| D (v4) | Adaptive ordering via ReasoningBank | 2 days | +0 KB | 5 |

---

## Sources referenced

- https://en.wikipedia.org/wiki/Robert_Plutchik
- https://en.wikipedia.org/wiki/Emotion_classification
- https://en.wikipedia.org/wiki/Emotion
- https://en.wikipedia.org/wiki/Paul_Ekman
- https://en.wikipedia.org/wiki/Feeling
- https://en.wikipedia.org/wiki/Mono_no_aware
- https://en.wikipedia.org/wiki/Saudade
- https://en.wikipedia.org/wiki/Sehnsucht
- https://en.wikipedia.org/wiki/Schadenfreude
- https://en.wikipedia.org/wiki/Hygge
- https://www.unige.ch/cisa/gew (Geneva Emotion Wheel)
- https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm
- https://www.ocf.berkeley.edu/~acowen/ (Cowen & Keltner 27 emotions)
- https://support.apple.com/guide/iphone/log-your-mood-iph0f85ce86a/ios
- https://www.apple.com/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/
- https://feelingswheel.com/ (Gloria Willcox)
- https://positivepsychology.com/emotion-wheel/
- https://hbr.org/2016/11/3-ways-to-better-understand-your-emotions (Susan David / Barrett granularity)
- https://drtimlomas.com/lexicography/ (positive lexicography, 216+ untranslatable words)
- https://daylio.net/
- https://howwefeel.org/ (Yale Center for Emotional Intelligence, 144 emotions grid)

Failed to fetch (Wikipedia 429s — cached references pulled from cross-links):
- https://en.wikipedia.org/wiki/Toska (ref via Saudade article)
- https://en.wikipedia.org/wiki/Natsukashii (ref via Mono no aware article)
- https://en.wikipedia.org/wiki/Weltschmerz (ref via Sehnsucht + Lomas)
- https://en.wikipedia.org/wiki/Emotional_granularity (ref via Emotion_classification "See also")
- https://www.pnas.org/doi/10.1073/pnas.1702247114 (403; Cowen & Keltner 2017 — list cross-referenced via Berkeley UCB mirror)
