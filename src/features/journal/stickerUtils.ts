import type { MoodType } from '@/types';

const FLUENT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets';

/**
 * Convert a unicode emoji string to the Fluent Emoji 3D CDN URL.
 * Maps emoji codepoints to the @lobehub/fluent-emoji-3d WebP assets.
 */
export function emojiToFluentUrl(emoji: string): string {
  const codepoints = [...emoji]
    .map(char => (char.codePointAt(0) ?? 0).toString(16))
    .filter(cp => cp !== 'fe0f' && cp !== '200d') // strip variation selector & ZWJ
    .join('-');
  return `${FLUENT_CDN_BASE}/${codepoints}.webp`;
}

export interface StickerCategory {
  key: string;
  labelKey: string;
  icon: string;
  stickers: string[];
}

export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    key: 'emotions',
    labelKey: 'journalStickerEmotions',
    icon: '\u{1F60A}',
    stickers: [
      '\u{1F60A}', '\u{1F602}', '\u{1F970}', '\u{1F60E}', '\u{1F929}', '\u{1F973}', '\u{1F60C}', '\u{1F622}',
      '\u{1F624}', '\u{1F914}', '\u{1F634}', '\u{1FAE0}', '\u{1F4AA}', '\u{1F64F}', '\u2764\uFE0F', '\u{1F496}',
      '\u{1F60D}', '\u{1F618}', '\u{1F917}', '\u{1F92F}', '\u{1F633}', '\u{1F62D}', '\u{1F621}', '\u{1F97A}',
      '\u{1F607}', '\u{1F911}', '\u{1F92B}', '\u{1F60F}', '\u{1F972}', '\u{1F92A}', '\u{1F636}', '\u{1FAE1}',
    ],
  },
  {
    key: 'nature',
    labelKey: 'journalStickerNature',
    icon: '\u{1F33F}',
    stickers: [
      '\u{1F338}', '\u{1F33A}', '\u{1F33B}', '\u{1F337}', '\u{1F340}', '\u{1F33F}', '\u{1F332}', '\u{1F30A}',
      '\u2B50', '\u{1F319}', '\u2600\uFE0F', '\u{1F308}', '\u{1F98B}', '\u{1F41D}', '\u{1F30D}', '\u{1F525}',
      '\u{1F339}', '\u{1F490}', '\u{1F33C}', '\u{1F343}', '\u{1F33E}', '\u{1F334}', '\u{1F335}', '\u2744\uFE0F',
      '\u{1F327}\uFE0F', '\u26C8\uFE0F', '\u{1F31E}', '\u{1F31B}', '\u{1F420}', '\u{1F980}', '\u{1F99A}', '\u{1F43E}',
    ],
  },
  {
    key: 'activities',
    labelKey: 'journalStickerActivities',
    icon: '\u{1F3AF}',
    stickers: [
      '\u{1F3AF}', '\u{1F4DA}', '\u{1F3A8}', '\u{1F3B5}', '\u{1F3C3}', '\u{1F9D8}', '\u{1F4BB}', '\u2708\uFE0F',
      '\u{1F3AE}', '\u{1F3E0}', '\u{1F3AC}', '\u{1F4DD}', '\u{1F9E0}', '\u{1F4A1}', '\u{1F3C6}', '\u{1F389}',
      '\u{1F6B4}', '\u{1F3CA}', '\u{1F3CB}\uFE0F', '\u{1F3B8}', '\u{1F3B9}', '\u{1F3AD}', '\u{1F4F7}', '\u{1F4F0}',
      '\u{1F52C}', '\u{1F9EA}', '\u{1F680}', '\u{1F6EB}', '\u{1F3D5}\uFE0F', '\u{1F30C}', '\u{1F6B2}', '\u{1F3C0}',
    ],
  },
  {
    key: 'food',
    labelKey: 'journalStickerFood',
    icon: '\u{1F355}',
    stickers: [
      '\u2615', '\u{1F355}', '\u{1F34E}', '\u{1F957}', '\u{1F370}', '\u{1F35C}', '\u{1F9C3}', '\u{1F363}',
      '\u{1F950}', '\u{1FAD6}', '\u{1F353}', '\u{1F951}', '\u{1F36B}', '\u{1F9C1}', '\u{1F37F}', '\u{1F32E}',
      '\u{1F382}', '\u{1F366}', '\u{1F369}', '\u{1F37D}\uFE0F', '\u{1F375}', '\u{1F96E}', '\u{1F96D}', '\u{1F34A}',
      '\u{1F347}', '\u{1F352}', '\u{1FAD0}', '\u{1F968}', '\u{1F354}', '\u{1F35F}', '\u{1F372}', '\u{1F371}',
    ],
  },
  {
    key: 'symbols',
    labelKey: 'journalStickerSymbols',
    icon: '\u2728',
    stickers: [
      '\u2728', '\u{1F4AB}', '\u{1F31F}', '\u26A1', '\u{1F380}', '\u{1F3F7}\uFE0F', '\u{1F4CC}', '\u{1F511}',
      '\u{1F381}', '\u{1F48E}', '\u{1FA84}', '\u{1F54A}\uFE0F', '\u{1F90D}', '\u{1F5A4}', '\u{1F49C}', '\u{1F499}',
      '\u{1F4A5}', '\u{1F4A8}', '\u{1F5DD}\uFE0F', '\u{1F451}', '\u{1F48D}', '\u{1F397}\uFE0F', '\u{1F396}\uFE0F', '\u{1F3B0}',
      '\u{1F52E}', '\u{1FA99}', '\u{1F9FF}', '\u{1F4B0}', '\u{1F48C}', '\u{1F5E8}\uFE0F', '\u{1F4AC}', '\u{1F3B6}',
    ],
  },
  {
    key: 'weather',
    labelKey: 'journalStickerWeather',
    icon: '\u{1F326}\uFE0F',
    stickers: [
      '\u2600\uFE0F', '\u{1F324}\uFE0F', '\u26C5', '\u{1F325}\uFE0F', '\u{1F326}\uFE0F', '\u{1F327}\uFE0F', '\u26C8\uFE0F', '\u{1F329}\uFE0F',
      '\u{1F328}\uFE0F', '\u2744\uFE0F', '\u{1F32C}\uFE0F', '\u{1F32A}\uFE0F', '\u{1F30A}', '\u{1F321}\uFE0F', '\u2614', '\u{1F31E}',
      '\u{1F31B}', '\u{1F31C}', '\u{1F319}', '\u{1F31D}', '\u2B50', '\u{1F30C}', '\u{1F308}', '\u{1F301}',
      '\u{1F302}', '\u{1F32B}\uFE0F', '\u{1F525}', '\u{1FAA8}', '\u{1F30B}', '\u26A1', '\u{1F4A7}', '\u{1F30D}',
    ],
  },
  {
    key: 'people',
    labelKey: 'journalStickerPeople',
    icon: '\u{1F465}',
    stickers: [
      '\u{1F465}', '\u{1F46A}', '\u{1F491}', '\u{1F46B}', '\u{1F46D}', '\u{1F46C}', '\u{1F9D1}', '\u{1F474}',
      '\u{1F475}', '\u{1F476}', '\u{1F466}', '\u{1F467}', '\u{1F47C}', '\u{1F934}', '\u{1F478}', '\u{1F385}',
      '\u{1F936}', '\u{1F9B8}', '\u{1F9B9}', '\u{1F9D9}', '\u{1F9DA}', '\u{1F46E}', '\u{1F477}', '\u{1F9D1}\u200D\u2695\uFE0F',
      '\u{1F9D1}\u200D\u{1F3EB}', '\u{1F9D1}\u200D\u{1F373}', '\u{1F9D1}\u200D\u{1F4BB}', '\u{1F9D1}\u200D\u{1F680}', '\u{1F575}\uFE0F', '\u{1F483}', '\u{1F57A}', '\u{1F9D1}\u200D\u{1F3A4}',
    ],
  },
  {
    key: 'health',
    labelKey: 'journalStickerHealth',
    icon: '\u{1F4AA}',
    stickers: [
      '\u{1F4AA}', '\u{1F9D8}', '\u{1F3CB}\uFE0F', '\u{1F6B6}', '\u{1F3C3}', '\u{1F6B4}', '\u{1F3CA}', '\u{1F93A}',
      '\u{1F93C}', '\u{1F938}', '\u{1F9D7}', '\u{1FA78}', '\u{1F48A}', '\u{1FA7A}', '\u{1F489}', '\u{1F912}',
      '\u{1F637}', '\u{1F927}', '\u{1F915}', '\u{1F92E}', '\u{1F634}', '\u{1F6CC}', '\u{1F4A4}', '\u{1F9E0}',
      '\u{1F9B7}', '\u{1FA7C}', '\u{1F499}', '\u{1F49A}', '\u{1FAB6}', '\u{1F33F}', '\u{1F6BF}', '\u{1F9D1}\u200D\u2695\uFE0F',
    ],
  },
  {
    key: 'places',
    labelKey: 'journalStickerPlaces',
    icon: '\u{1F3E0}',
    stickers: [
      '\u{1F3E0}', '\u{1F3E2}', '\u{1F3EB}', '\u{1F3E5}', '\u{1F3EA}', '\u{1F3ED}', '\u{1F3DB}\uFE0F', '\u{1F3D4}\uFE0F',
      '\u{1F3D6}\uFE0F', '\u{1F3D5}\uFE0F', '\u{1F3DE}\uFE0F', '\u{1F3DF}\uFE0F', '\u{1F3F0}', '\u26EA', '\u{1F54C}', '\u{1F54D}',
      '\u{1F680}', '\u2708\uFE0F', '\u{1F682}', '\u{1F697}', '\u{1F6F3}\uFE0F', '\u{1F5FD}', '\u{1F5FC}', '\u{1F6EB}',
      '\u{1F3AA}', '\u{1F3A2}', '\u{1F3AC}', '\u2615', '\u{1F37D}\uFE0F', '\u{1F3E8}', '\u{1F3E6}', '\u{1F3CB}\uFE0F',
    ],
  },
  {
    key: 'celebrations',
    labelKey: 'journalStickerCelebrations',
    icon: '\u{1F389}',
    stickers: [
      '\u{1F389}', '\u{1F38A}', '\u{1F386}', '\u{1F387}', '\u{1F381}', '\u{1F382}', '\u{1F388}', '\u{1F380}',
      '\u{1F390}', '\u{1F38E}', '\u{1F38D}', '\u{1F38F}', '\u{1F384}', '\u{1F383}', '\u{1F31F}', '\u2728',
      '\u{1F3C6}', '\u{1F3C5}', '\u{1F396}\uFE0F', '\u{1F947}', '\u{1F948}', '\u{1F949}', '\u{1F451}', '\u{1F48D}',
      '\u{1F48E}', '\u{1F490}', '\u{1F4AB}', '\u{1FA84}', '\u{1F973}', '\u{1F37E}', '\u{1F379}', '\u{1F942}',
    ],
  },
];

// ── Mood-linked sticker suggestions ──

export const MOOD_STICKER_SUGGESTIONS: Record<MoodType, string[]> = {
  great: [
    '\u{1F60A}', '\u{1F929}', '\u{1F973}', '\u{1F970}', '\u{1F60E}', '\u{1F3C6}', '\u{1F389}', '\u2728',
    '\u{1F31F}', '\u{1F4AA}', '\u{1F3AF}', '\u{1F525}', '\u2764\uFE0F', '\u{1F496}', '\u{1F38A}', '\u{1F37E}',
  ],
  good: [
    '\u{1F60A}', '\u{1F60C}', '\u{1F917}', '\u{1F607}', '\u{1F338}', '\u{1F33B}', '\u{1F340}', '\u2600\uFE0F',
    '\u{1F3B5}', '\u{1F3A8}', '\u2615', '\u{1F370}', '\u{1F499}', '\u{1F490}', '\u{1F4DA}', '\u{1F9D8}',
  ],
  okay: [
    '\u{1F914}', '\u{1F636}', '\u{1F60F}', '\u{1FAE0}', '\u{1F324}\uFE0F', '\u26C5', '\u{1F3E0}', '\u2615',
    '\u{1F4DD}', '\u{1F4BB}', '\u{1F9E0}', '\u{1F4A1}', '\u{1F3B6}', '\u{1F355}', '\u{1F957}', '\u{1F4A4}',
  ],
  bad: [
    '\u{1F622}', '\u{1F97A}', '\u{1F633}', '\u{1F634}', '\u{1F327}\uFE0F', '\u{1F302}', '\u{1F4A4}', '\u{1F6CC}',
    '\u{1F48A}', '\u{1F9D1}', '\u{1F465}', '\u{1F46A}', '\u{1F33F}', '\u{1F499}', '\u{1F54A}\uFE0F', '\u{1F64F}',
  ],
  terrible: [
    '\u{1F62D}', '\u{1F621}', '\u{1F912}', '\u{1F637}', '\u{1F915}', '\u{1F92E}', '\u26C8\uFE0F', '\u{1F32A}\uFE0F',
    '\u{1F48A}', '\u{1FA7A}', '\u{1F6CC}', '\u{1F64F}', '\u{1F5A4}', '\u{1F90D}', '\u{1F465}', '\u{1F46A}',
  ],
};

// ── Sticker search ──

export interface StickerSearchResult {
  emoji: string;
  packKey: string;
}

const KEYWORD_ASSOCIATIONS: [string[], string, string][] = [
  // [keywords, emoji, packKey]
  // Emotions
  [['happy', 'smile', 'joy'], '\u{1F60A}', 'emotions'],
  [['laugh', 'lol', 'funny'], '\u{1F602}', 'emotions'],
  [['love', 'heart', 'adore'], '\u{1F970}', 'emotions'],
  [['cool', 'sunglasses'], '\u{1F60E}', 'emotions'],
  [['star', 'excited', 'wow'], '\u{1F929}', 'emotions'],
  [['party', 'celebrate'], '\u{1F973}', 'emotions'],
  [['relax', 'calm', 'peaceful'], '\u{1F60C}', 'emotions'],
  [['cry', 'sad', 'tears'], '\u{1F622}', 'emotions'],
  [['angry', 'mad', 'rage'], '\u{1F624}', 'emotions'],
  [['think', 'wonder', 'hmm'], '\u{1F914}', 'emotions'],
  [['sleep', 'tired', 'zzz'], '\u{1F634}', 'emotions'],
  [['strong', 'muscle', 'power'], '\u{1F4AA}', 'emotions'],
  [['pray', 'hope', 'wish'], '\u{1F64F}', 'emotions'],
  [['heart', 'love', 'red'], '\u2764\uFE0F', 'emotions'],
  // Weather
  [['sun', 'sunny', 'clear'], '\u2600\uFE0F', 'weather'],
  [['cloud', 'cloudy', 'overcast'], '\u26C5', 'weather'],
  [['rain', 'rainy', 'wet'], '\u{1F327}\uFE0F', 'weather'],
  [['snow', 'snowy', 'cold', 'winter'], '\u2744\uFE0F', 'weather'],
  [['storm', 'thunder', 'lightning'], '\u26C8\uFE0F', 'weather'],
  [['wind', 'windy', 'breeze'], '\u{1F32C}\uFE0F', 'weather'],
  [['rainbow'], '\u{1F308}', 'weather'],
  [['umbrella'], '\u2614', 'weather'],
  [['fog', 'foggy', 'mist'], '\u{1F32B}\uFE0F', 'weather'],
  [['hot', 'warm', 'heat'], '\u{1F525}', 'weather'],
  [['moon', 'night'], '\u{1F319}', 'weather'],
  // People
  [['family'], '\u{1F46A}', 'people'],
  [['couple', 'partner', 'date'], '\u{1F491}', 'people'],
  [['friends', 'group', 'together'], '\u{1F465}', 'people'],
  [['baby', 'child', 'kid'], '\u{1F476}', 'people'],
  [['alone', 'solo', 'self'], '\u{1F9D1}', 'people'],
  [['dance', 'dancing'], '\u{1F483}', 'people'],
  // Health
  [['exercise', 'workout', 'gym'], '\u{1F3CB}\uFE0F', 'health'],
  [['yoga', 'meditate', 'zen'], '\u{1F9D8}', 'health'],
  [['run', 'jog', 'running'], '\u{1F3C3}', 'health'],
  [['swim', 'swimming', 'pool'], '\u{1F3CA}', 'health'],
  [['bike', 'cycling', 'bicycle'], '\u{1F6B4}', 'health'],
  [['sick', 'ill', 'fever'], '\u{1F912}', 'health'],
  [['medicine', 'pill', 'drug'], '\u{1F48A}', 'health'],
  [['doctor', 'hospital'], '\u{1FA7A}', 'health'],
  [['brain', 'mind', 'mental'], '\u{1F9E0}', 'health'],
  [['sleep', 'rest', 'bed'], '\u{1F6CC}', 'health'],
  // Places
  [['home', 'house'], '\u{1F3E0}', 'places'],
  [['work', 'office', 'job'], '\u{1F3E2}', 'places'],
  [['school', 'study', 'learn'], '\u{1F3EB}', 'places'],
  [['cafe', 'coffee', 'shop'], '\u2615', 'places'],
  [['park', 'garden', 'nature'], '\u{1F3DE}\uFE0F', 'places'],
  [['airport', 'travel', 'fly'], '\u2708\uFE0F', 'places'],
  [['beach', 'sea', 'ocean'], '\u{1F3D6}\uFE0F', 'places'],
  [['mountain', 'hike', 'climb'], '\u{1F3D4}\uFE0F', 'places'],
  [['church', 'temple', 'mosque'], '\u26EA', 'places'],
  // Food
  [['coffee', 'tea', 'drink'], '\u2615', 'food'],
  [['pizza'], '\u{1F355}', 'food'],
  [['cake', 'birthday'], '\u{1F382}', 'food'],
  [['fruit', 'apple', 'healthy'], '\u{1F34E}', 'food'],
  [['chocolate', 'sweet', 'candy'], '\u{1F36B}', 'food'],
  // Celebrations
  [['birthday', 'party'], '\u{1F382}', 'celebrations'],
  [['gift', 'present'], '\u{1F381}', 'celebrations'],
  [['fireworks'], '\u{1F386}', 'celebrations'],
  [['trophy', 'win', 'award'], '\u{1F3C6}', 'celebrations'],
  [['medal', 'achievement'], '\u{1F3C5}', 'celebrations'],
  [['wedding', 'ring'], '\u{1F48D}', 'celebrations'],
  [['flower', 'bouquet'], '\u{1F490}', 'celebrations'],
  [['champagne', 'cheers'], '\u{1F37E}', 'celebrations'],
];

const STICKER_KEYWORD_MAP: Map<string, StickerSearchResult[]> = (() => {
  const map = new Map<string, StickerSearchResult[]>();
  for (const [keywords, emoji, packKey] of KEYWORD_ASSOCIATIONS) {
    for (const kw of keywords) {
      const existing = map.get(kw) || [];
      if (!existing.some(r => r.emoji === emoji)) {
        existing.push({ emoji, packKey });
      }
      map.set(kw, existing);
    }
  }
  return map;
})();

export function searchStickers(query: string): StickerSearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const seen = new Set<string>();
  const results: StickerSearchResult[] = [];

  for (const [keyword, items] of STICKER_KEYWORD_MAP) {
    if (keyword.startsWith(q) || keyword.includes(q)) {
      for (const item of items) {
        if (!seen.has(item.emoji)) {
          seen.add(item.emoji);
          results.push(item);
        }
      }
    }
  }
  return results;
}

// ── Default pack preferences ──

export interface StickerPackPrefs {
  enabled: Record<string, boolean>;
  seen: Record<string, boolean>;
}

export const DEFAULT_STICKER_PACK_PREFS: StickerPackPrefs = {
  enabled: {
    emotions: true, nature: true, activities: true, food: true, symbols: true,
    weather: false, people: false, health: false, places: false, celebrations: false,
  },
  seen: {
    emotions: true, nature: true, activities: true, food: true, symbols: true,
    weather: false, people: false, health: false, places: false, celebrations: false,
  },
};
