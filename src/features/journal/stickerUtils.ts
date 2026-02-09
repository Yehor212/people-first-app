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
];
