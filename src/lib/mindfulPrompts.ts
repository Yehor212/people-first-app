/**
 * Mindful Moments - Micro-mindfulness prompts
 * ADHD-friendly: Quick (10-30 sec) check-ins that don't break flow
 */

export type MindfulMomentType = 'checkin' | 'breathing' | 'gratitude' | 'body' | 'affirmation';

export interface MindfulPrompt {
  id: string;
  type: MindfulMomentType;
  duration: number; // Seconds
  text: Record<string, string>;
  emoji?: string;
}

// Quick check-in prompts (10 sec)
const checkinPrompts: MindfulPrompt[] = [
  { id: 'c1', type: 'checkin', duration: 10, emoji: '🤔', text: { en: 'How do you feel right now?', ru: 'Как ты себя чувствуешь прямо сейчас?', uk: 'Як ти себе почуваєш прямо зараз?', de: 'Wie fühlst du dich gerade?', es: '¿Cómo te sientes ahora mismo?', fr: 'Comment te sens-tu maintenant?' }},
  { id: 'c2', type: 'checkin', duration: 10, emoji: '⚡', text: { en: 'What\'s your energy level?', ru: 'Какой у тебя уровень энергии?', uk: 'Який у тебе рівень енергії?', de: 'Wie hoch ist dein Energielevel?', es: '¿Cuál es tu nivel de energía?', fr: 'Quel est ton niveau d\'énergie?' }},
  { id: 'c3', type: 'checkin', duration: 10, emoji: '💭', text: { en: 'What\'s on your mind?', ru: 'О чём ты думаешь?', uk: 'Про що ти думаєш?', de: 'Was beschäftigt dich?', es: '¿Qué tienes en mente?', fr: 'Qu\'as-tu en tête?' }},
  { id: 'c4', type: 'checkin', duration: 10, emoji: '🎯', text: { en: 'What\'s your focus right now?', ru: 'На чём сейчас твой фокус?', uk: 'На чому зараз твій фокус?', de: 'Worauf liegt gerade dein Fokus?', es: '¿Cuál es tu enfoque ahora?', fr: 'Quel est ton focus maintenant?' }},
  { id: 'c5', type: 'checkin', duration: 10, emoji: '💪', text: { en: 'What do you need right now?', ru: 'Что тебе сейчас нужно?', uk: 'Що тобі зараз потрібно?', de: 'Was brauchst du gerade?', es: '¿Qué necesitas ahora mismo?', fr: 'De quoi as-tu besoin maintenant?' }},
  { id: 'c6', type: 'checkin', duration: 10, emoji: '🌊', text: { en: 'Are you present or distracted?', ru: 'Ты присутствуешь или отвлечён?', uk: 'Ти присутній чи відволічений?', de: 'Bist du präsent oder abgelenkt?', es: '¿Estás presente o distraído?', fr: 'Es-tu présent ou distrait?' }},
  { id: 'c7', type: 'checkin', duration: 10, emoji: '😌', text: { en: 'Take a moment to just be.', ru: 'Найди момент просто быть.', uk: 'Знайди мить просто бути.', de: 'Nimm dir einen Moment, um einfach zu sein.', es: 'Tómate un momento para simplemente ser.', fr: 'Prends un moment pour juste être.' }},
  { id: 'c8', type: 'checkin', duration: 10, emoji: '🧠', text: { en: 'How\'s your mental clarity?', ru: 'Как твоя ментальная ясность?', uk: 'Як твоя ментальна ясність?', de: 'Wie ist deine mentale Klarheit?', es: '¿Cómo está tu claridad mental?', fr: 'Comment est ta clarté mentale?' }},
];

// Quick breathing prompts (30 sec)
const breathingPrompts: MindfulPrompt[] = [
  { id: 'b1', type: 'breathing', duration: 30, emoji: '🌬️', text: { en: 'Take 3 deep breaths.', ru: 'Сделай 3 глубоких вдоха.', uk: 'Зроби 3 глибоких вдихи.', de: 'Nimm 3 tiefe Atemzüge.', es: 'Haz 3 respiraciones profundas.', fr: 'Prends 3 grandes respirations.' }},
  { id: 'b2', type: 'breathing', duration: 30, emoji: '🍃', text: { en: 'Breathe in calm, breathe out tension.', ru: 'Вдохни спокойствие, выдохни напряжение.', uk: 'Вдихни спокій, видихни напруження.', de: 'Atme Ruhe ein, atme Spannung aus.', es: 'Inhala calma, exhala tensión.', fr: 'Inspire le calme, expire la tension.' }},
  { id: 'b3', type: 'breathing', duration: 20, emoji: '🌸', text: { en: 'Slow inhale, long exhale.', ru: 'Медленный вдох, долгий выдох.', uk: 'Повільний вдих, довгий видих.', de: 'Langsam einatmen, lang ausatmen.', es: 'Inhala lento, exhala largo.', fr: 'Inspire lentement, expire longuement.' }},
  { id: 'b4', type: 'breathing', duration: 30, emoji: '🧘', text: { en: 'Box breathing: 4 in, 4 hold, 4 out, 4 hold.', ru: 'Квадратное дыхание: 4 вдох, 4 пауза, 4 выдох, 4 пауза.', uk: 'Квадратне дихання: 4 вдих, 4 пауза, 4 видих, 4 пауза.', de: 'Box-Atmung: 4 ein, 4 halten, 4 aus, 4 halten.', es: 'Respiración cuadrada: 4 inhala, 4 sostén, 4 exhala, 4 sostén.', fr: 'Respiration carrée: 4 inspire, 4 retiens, 4 expire, 4 retiens.' }},
  { id: 'b5', type: 'breathing', duration: 15, emoji: '☁️', text: { en: 'Sigh it out. Release tension.', ru: 'Выдохни с вздохом. Отпусти напряжение.', uk: 'Видихни зітханням. Відпусти напруження.', de: 'Seufz es aus. Lass Spannung los.', es: 'Suspira. Libera la tensión.', fr: 'Soupire. Libère la tension.' }},
];

// Gratitude micro-moments (15 sec)
const gratitudePrompts: MindfulPrompt[] = [
  { id: 'gr1', type: 'gratitude', duration: 15, emoji: '✨', text: { en: 'Name one good thing about today.', ru: 'Назови одну хорошую вещь о сегодняшнем дне.', uk: 'Назви одну гарну річ про сьогоднішній день.', de: 'Nenne eine gute Sache über heute.', es: 'Nombra algo bueno de hoy.', fr: 'Nomme une bonne chose d\'aujourd\'hui.' }},
  { id: 'gr2', type: 'gratitude', duration: 15, emoji: '🌟', text: { en: 'What made you smile recently?', ru: 'Что недавно заставило тебя улыбнуться?', uk: 'Що нещодавно змусило тебе посміхнутися?', de: 'Was hat dich kürzlich zum Lächeln gebracht?', es: '¿Qué te hizo sonreír recientemente?', fr: 'Qu\'est-ce qui t\'a fait sourire récemment?' }},
  { id: 'gr3', type: 'gratitude', duration: 15, emoji: '💙', text: { en: 'Think of someone you\'re grateful for.', ru: 'Подумай о ком-то, кому ты благодарен.', uk: 'Подумай про когось, кому ти вдячний.', de: 'Denk an jemanden, für den du dankbar bist.', es: 'Piensa en alguien por quien estás agradecido.', fr: 'Pense à quelqu\'un pour qui tu es reconnaissant.' }},
  { id: 'gr4', type: 'gratitude', duration: 15, emoji: '🙏', text: { en: 'What small thing are you thankful for?', ru: 'За какую маленькую вещь ты благодарен?', uk: 'За яку маленьку річ ти вдячний?', de: 'Für welche kleine Sache bist du dankbar?', es: '¿Por qué pequeña cosa estás agradecido?', fr: 'Pour quelle petite chose es-tu reconnaissant?' }},
  { id: 'gr5', type: 'gratitude', duration: 15, emoji: '☀️', text: { en: 'What made today a little better?', ru: 'Что сделало сегодня немного лучше?', uk: 'Що зробило сьогодні трохи кращим?', de: 'Was hat heute ein bisschen besser gemacht?', es: '¿Qué hizo el día un poco mejor?', fr: 'Qu\'est-ce qui a rendu aujourd\'hui un peu mieux?' }},
];

// Body awareness prompts (20 sec)
const bodyPrompts: MindfulPrompt[] = [
  { id: 'bo1', type: 'body', duration: 20, emoji: '🙆', text: { en: 'Relax your shoulders. Drop them.', ru: 'Расслабь плечи. Опусти их.', uk: 'Розслаб плечі. Опусти їх.', de: 'Entspanne deine Schultern. Lass sie sinken.', es: 'Relaja los hombros. Déjalos caer.', fr: 'Détends tes épaules. Laisse-les tomber.' }},
  { id: 'bo2', type: 'body', duration: 20, emoji: '👀', text: { en: 'Rest your eyes for a moment.', ru: 'Дай глазам отдохнуть на мгновение.', uk: 'Дай очам відпочити на мить.', de: 'Lass deine Augen einen Moment ruhen.', es: 'Descansa los ojos un momento.', fr: 'Repose tes yeux un instant.' }},
  { id: 'bo3', type: 'body', duration: 15, emoji: '😊', text: { en: 'Unclench your jaw.', ru: 'Расслабь челюсть.', uk: 'Розслаб щелепу.', de: 'Entspanne deinen Kiefer.', es: 'Relaja la mandíbula.', fr: 'Détends ta mâchoire.' }},
  { id: 'bo4', type: 'body', duration: 20, emoji: '🖐️', text: { en: 'Stretch your fingers and hands.', ru: 'Растяни пальцы и кисти рук.', uk: 'Розтягни пальці та кисті рук.', de: 'Strecke deine Finger und Hände.', es: 'Estira tus dedos y manos.', fr: 'Étire tes doigts et tes mains.' }},
  { id: 'bo5', type: 'body', duration: 20, emoji: '🧍', text: { en: 'Notice your posture. Adjust if needed.', ru: 'Обрати внимание на осанку. Поправь, если нужно.', uk: 'Зверни увагу на поставу. Поправ, якщо потрібно.', de: 'Beachte deine Haltung. Korrigiere sie bei Bedarf.', es: 'Nota tu postura. Ajústala si es necesario.', fr: 'Observe ta posture. Ajuste-la si besoin.' }},
  { id: 'bo6', type: 'body', duration: 15, emoji: '💆', text: { en: 'Gently roll your neck.', ru: 'Мягко покрути шеей.', uk: 'М\'яко покрути шиєю.', de: 'Rolle sanft deinen Nacken.', es: 'Gira suavemente el cuello.', fr: 'Fais rouler doucement ton cou.' }},
];

// Positive affirmations (10 sec)
const affirmationPrompts: MindfulPrompt[] = [
  { id: 'af1', type: 'affirmation', duration: 10, emoji: '💪', text: { en: 'You\'re doing better than you think.', ru: 'Ты справляешься лучше, чем думаешь.', uk: 'Ти справляєшся краще, ніж думаєш.', de: 'Du machst das besser, als du denkst.', es: 'Lo estás haciendo mejor de lo que crees.', fr: 'Tu fais mieux que tu ne le penses.' }},
  { id: 'af2', type: 'affirmation', duration: 10, emoji: '🌈', text: { en: 'Progress, not perfection.', ru: 'Прогресс, а не совершенство.', uk: 'Прогрес, а не досконалість.', de: 'Fortschritt, nicht Perfektion.', es: 'Progreso, no perfección.', fr: 'Progrès, pas perfection.' }},
  { id: 'af3', type: 'affirmation', duration: 10, emoji: '⭐', text: { en: 'You deserve rest.', ru: 'Ты заслуживаешь отдых.', uk: 'Ти заслуговуєш на відпочинок.', de: 'Du verdienst Ruhe.', es: 'Mereces descanso.', fr: 'Tu mérites du repos.' }},
  { id: 'af4', type: 'affirmation', duration: 10, emoji: '🌱', text: { en: 'Small steps count.', ru: 'Маленькие шаги важны.', uk: 'Маленькі кроки важливі.', de: 'Kleine Schritte zählen.', es: 'Los pequeños pasos cuentan.', fr: 'Les petits pas comptent.' }},
  { id: 'af5', type: 'affirmation', duration: 10, emoji: '🎯', text: { en: 'One thing at a time.', ru: 'Одна вещь за раз.', uk: 'Одна річ за раз.', de: 'Eins nach dem anderen.', es: 'Una cosa a la vez.', fr: 'Une chose à la fois.' }},
  { id: 'af6', type: 'affirmation', duration: 10, emoji: '🤗', text: { en: 'Be kind to yourself.', ru: 'Будь добр к себе.', uk: 'Будь добрим до себе.', de: 'Sei gut zu dir selbst.', es: 'Sé amable contigo mismo.', fr: 'Sois gentil avec toi-même.' }},
  { id: 'af7', type: 'affirmation', duration: 10, emoji: '🌟', text: { en: 'You\'ve got this.', ru: 'У тебя получится.', uk: 'У тебе вийде.', de: 'Du schaffst das.', es: 'Tú puedes.', fr: 'Tu peux le faire.' }},
  { id: 'af8', type: 'affirmation', duration: 10, emoji: '💖', text: { en: 'Your effort matters.', ru: 'Твои усилия важны.', uk: 'Твої зусилля важливі.', de: 'Deine Mühe zählt.', es: 'Tu esfuerzo importa.', fr: 'Tes efforts comptent.' }},
];

// All prompts
export const ALL_MINDFUL_PROMPTS: MindfulPrompt[] = [
  ...checkinPrompts,
  ...breathingPrompts,
  ...gratitudePrompts,
  ...bodyPrompts,
  ...affirmationPrompts,
];

// Type labels
export const MINDFUL_TYPE_LABELS: Record<MindfulMomentType, Record<string, string>> = {
  checkin: { en: 'Check-in', ru: 'Чек-ин', uk: 'Чек-ін', de: 'Check-in', es: 'Check-in', fr: 'Check-in' },
  breathing: { en: 'Breathe', ru: 'Дыхание', uk: 'Дихання', de: 'Atmen', es: 'Respirar', fr: 'Respirer' },
  gratitude: { en: 'Gratitude', ru: 'Благодарность', uk: 'Вдячність', de: 'Dankbarkeit', es: 'Gratitud', fr: 'Gratitude' },
  body: { en: 'Body', ru: 'Тело', uk: 'Тіло', de: 'Körper', es: 'Cuerpo', fr: 'Corps' },
  affirmation: { en: 'Affirmation', ru: 'Аффирмация', uk: 'Афірмація', de: 'Affirmation', es: 'Afirmación', fr: 'Affirmation' },
};

/** Get random mindful prompt */
export function getRandomMindfulPrompt(type?: MindfulMomentType): MindfulPrompt {
  const prompts = type
    ? ALL_MINDFUL_PROMPTS.filter(p => p.type === type)
    : ALL_MINDFUL_PROMPTS;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/** Get prompt text in language */
export function getMindfulPromptText(prompt: MindfulPrompt, lang: string): string {
  return prompt.text[lang] || prompt.text.en;
}

/** Get prompts suitable for post-focus (shorter, calming) */
export function getPostFocusPrompts(): MindfulPrompt[] {
  return ALL_MINDFUL_PROMPTS.filter(
    p => p.type === 'breathing' || p.type === 'body' || p.type === 'affirmation'
  );
}

/** Get random post-focus prompt */
export function getRandomPostFocusPrompt(): MindfulPrompt {
  const prompts = getPostFocusPrompts();
  return prompts[Math.floor(Math.random() * prompts.length)];
}
