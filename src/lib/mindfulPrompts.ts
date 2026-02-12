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
  { id: 'c1', type: 'checkin', duration: 10, emoji: '🤔', text: { en: 'How do you feel right now?', uk: 'Як ти себе почуваєш прямо зараз?', de: 'Wie fühlst du dich gerade?', es: '¿Cómo te sientes ahora mismo?', fr: 'Comment te sens-tu maintenant?', ja: '今の気分はどうですか？', ar: 'كيف تشعر الآن؟', he: 'איך אתה מרגיש עכשיו?' }},
  { id: 'c2', type: 'checkin', duration: 10, emoji: '⚡', text: { en: 'What\'s your energy level?', uk: 'Який у тебе рівень енергії?', de: 'Wie hoch ist dein Energielevel?', es: '¿Cuál es tu nivel de energía?', fr: 'Quel est ton niveau d\'énergie?', ja: 'エネルギーレベルはどのくらい？', ar: 'ما مستوى طاقتك؟', he: 'מה רמת האנרגיה שלך?' }},
  { id: 'c3', type: 'checkin', duration: 10, emoji: '💭', text: { en: 'What\'s on your mind?', uk: 'Про що ти думаєш?', de: 'Was beschäftigt dich?', es: '¿Qué tienes en mente?', fr: 'Qu\'as-tu en tête?', ja: '今、何を考えていますか？', ar: 'ما الذي يشغل بالك؟', he: 'מה עובר לך בראש?' }},
  { id: 'c4', type: 'checkin', duration: 10, emoji: '🎯', text: { en: 'What\'s your focus right now?', uk: 'На чому зараз твій фокус?', de: 'Worauf liegt gerade dein Fokus?', es: '¿Cuál es tu enfoque ahora?', fr: 'Quel est ton focus maintenant?', ja: '今、何に集中していますか？', ar: 'ما تركيزك الآن؟', he: 'על מה אתה ממוקד עכשיו?' }},
  { id: 'c5', type: 'checkin', duration: 10, emoji: '💪', text: { en: 'What do you need right now?', uk: 'Що тобі зараз потрібно?', de: 'Was brauchst du gerade?', es: '¿Qué necesitas ahora mismo?', fr: 'De quoi as-tu besoin maintenant?', ja: '今、何が必要ですか？', ar: 'ماذا تحتاج الآن؟', he: 'מה אתה צריך עכשיו?' }},
  { id: 'c6', type: 'checkin', duration: 10, emoji: '🌊', text: { en: 'Are you present or distracted?', uk: 'Ти присутній чи відволічений?', de: 'Bist du präsent oder abgelenkt?', es: '¿Estás presente o distraído?', fr: 'Es-tu présent ou distrait?', ja: '今ここにいますか、それとも気が散っていますか？', ar: 'هل أنت حاضر الذهن أم مشتت؟', he: 'אתה נוכח או מוסח?' }},
  { id: 'c7', type: 'checkin', duration: 10, emoji: '😌', text: { en: 'Take a moment to just be.', uk: 'Знайди мить просто бути.', de: 'Nimm dir einen Moment, um einfach zu sein.', es: 'Tómate un momento para simplemente ser.', fr: 'Prends un moment pour juste être.', ja: 'ただここにいる時間を取りましょう。', ar: 'خذ لحظة لتكون فقط.', he: 'קח רגע פשוט להיות.' }},
  { id: 'c8', type: 'checkin', duration: 10, emoji: '🧠', text: { en: 'How\'s your mental clarity?', uk: 'Як твоя ментальна ясність?', de: 'Wie ist deine mentale Klarheit?', es: '¿Cómo está tu claridad mental?', fr: 'Comment est ta clarté mentale?', ja: '頭の中はクリアですか？', ar: 'كيف صفاءك الذهني؟', he: 'איך הבהירות המנטלית שלך?' }},
];

// Quick breathing prompts (30 sec)
const breathingPrompts: MindfulPrompt[] = [
  { id: 'b1', type: 'breathing', duration: 30, emoji: '🌬️', text: { en: 'Take 3 deep breaths.', uk: 'Зроби 3 глибоких вдихи.', de: 'Nimm 3 tiefe Atemzüge.', es: 'Haz 3 respiraciones profundas.', fr: 'Prends 3 grandes respirations.', ja: '深呼吸を3回しましょう。', ar: 'خذ 3 أنفاس عميقة.', he: 'קח 3 נשימות עמוקות.' }},
  { id: 'b2', type: 'breathing', duration: 30, emoji: '🍃', text: { en: 'Breathe in calm, breathe out tension.', uk: 'Вдихни спокій, видихни напруження.', de: 'Atme Ruhe ein, atme Spannung aus.', es: 'Inhala calma, exhala tensión.', fr: 'Inspire le calme, expire la tension.', ja: '穏やかさを吸い込み、緊張を吐き出しましょう。', ar: 'استنشق الهدوء، وازفر التوتر.', he: 'שאף רוגע, נשוף מתח.' }},
  { id: 'b3', type: 'breathing', duration: 20, emoji: '🌸', text: { en: 'Slow inhale, long exhale.', uk: 'Повільний вдих, довгий видих.', de: 'Langsam einatmen, lang ausatmen.', es: 'Inhala lento, exhala largo.', fr: 'Inspire lentement, expire longuement.', ja: 'ゆっくり吸って、長く吐きましょう。', ar: 'شهيق بطيء، زفير طويل.', he: 'שאיפה איטית, נשיפה ארוכה.' }},
  { id: 'b4', type: 'breathing', duration: 30, emoji: '🧘', text: { en: 'Box breathing: 4 in, 4 hold, 4 out, 4 hold.', uk: 'Квадратне дихання: 4 вдих, 4 пауза, 4 видих, 4 пауза.', de: 'Box-Atmung: 4 ein, 4 halten, 4 aus, 4 halten.', es: 'Respiración cuadrada: 4 inhala, 4 sostén, 4 exhala, 4 sostén.', fr: 'Respiration carrée: 4 inspire, 4 retiens, 4 expire, 4 retiens.', ja: 'ボックス呼吸：4秒吸う、4秒止める、4秒吐く、4秒止める。', ar: 'تنفس مربع: 4 شهيق، 4 حبس، 4 زفير، 4 حبس.', he: 'נשימת קופסה: 4 שאיפה, 4 עצירה, 4 נשיפה, 4 עצירה.' }},
  { id: 'b5', type: 'breathing', duration: 15, emoji: '☁️', text: { en: 'Sigh it out. Release tension.', uk: 'Видихни зітханням. Відпусти напруження.', de: 'Seufz es aus. Lass Spannung los.', es: 'Suspira. Libera la tensión.', fr: 'Soupire. Libère la tension.', ja: 'ため息をついて、緊張をほぐしましょう。', ar: 'تنهّد وأطلق التوتر.', he: 'נשוף באנחה. שחרר מתח.' }},
];

// Gratitude micro-moments (15 sec)
const gratitudePrompts: MindfulPrompt[] = [
  { id: 'gr1', type: 'gratitude', duration: 15, emoji: '✨', text: { en: 'Name one good thing about today.', uk: 'Назви одну гарну річ про сьогоднішній день.', de: 'Nenne eine gute Sache über heute.', es: 'Nombra algo bueno de hoy.', fr: 'Nomme une bonne chose d\'aujourd\'hui.', ja: '今日の良かったことをひとつ挙げましょう。', ar: 'اذكر شيئًا جيدًا عن اليوم.', he: 'תגיד דבר טוב אחד על היום.' }},
  { id: 'gr2', type: 'gratitude', duration: 15, emoji: '🌟', text: { en: 'What made you smile recently?', uk: 'Що нещодавно змусило тебе посміхнутися?', de: 'Was hat dich kürzlich zum Lächeln gebracht?', es: '¿Qué te hizo sonreír recientemente?', fr: 'Qu\'est-ce qui t\'a fait sourire récemment?', ja: '最近、何があなたを笑顔にしましたか？', ar: 'ما الذي جعلك تبتسم مؤخرًا؟', he: 'מה גרם לך לחייך לאחרונה?' }},
  { id: 'gr3', type: 'gratitude', duration: 15, emoji: '💙', text: { en: 'Think of someone you\'re grateful for.', uk: 'Подумай про когось, кому ти вдячний.', de: 'Denk an jemanden, für den du dankbar bist.', es: 'Piensa en alguien por quien estás agradecido.', fr: 'Pense à quelqu\'un pour qui tu es reconnaissant.', ja: '感謝している人のことを思い浮かべましょう。', ar: 'فكّر بشخص تشعر بالامتنان له.', he: 'חשוב על מישהו שאתה אסיר תודה לו.' }},
  { id: 'gr4', type: 'gratitude', duration: 15, emoji: '🙏', text: { en: 'What small thing are you thankful for?', uk: 'За яку маленьку річ ти вдячний?', de: 'Für welche kleine Sache bist du dankbar?', es: '¿Por qué pequeña cosa estás agradecido?', fr: 'Pour quelle petite chose es-tu reconnaissant?', ja: 'どんな小さなことに感謝していますか？', ar: 'ما الشيء الصغير الذي تشعر بالامتنان له؟', he: 'על איזה דבר קטן אתה אסיר תודה?' }},
  { id: 'gr5', type: 'gratitude', duration: 15, emoji: '☀️', text: { en: 'What made today a little better?', uk: 'Що зробило сьогодні трохи кращим?', de: 'Was hat heute ein bisschen besser gemacht?', es: '¿Qué hizo el día un poco mejor?', fr: 'Qu\'est-ce qui a rendu aujourd\'hui un peu mieux?', ja: '今日を少し良くしてくれたことは何ですか？', ar: 'ما الذي جعل اليوم أفضل قليلًا؟', he: 'מה עשה את היום קצת יותר טוב?' }},
];

// Body awareness prompts (20 sec)
const bodyPrompts: MindfulPrompt[] = [
  { id: 'bo1', type: 'body', duration: 20, emoji: '🙆', text: { en: 'Relax your shoulders. Drop them.', uk: 'Розслаб плечі. Опусти їх.', de: 'Entspanne deine Schultern. Lass sie sinken.', es: 'Relaja los hombros. Déjalos caer.', fr: 'Détends tes épaules. Laisse-les tomber.', ja: '肩の力を抜いて、下ろしましょう。', ar: 'أرخِ كتفيك. أنزلهما.', he: 'הרפה את הכתפיים. הורד אותן.' }},
  { id: 'bo2', type: 'body', duration: 20, emoji: '👀', text: { en: 'Rest your eyes for a moment.', uk: 'Дай очам відпочити на мить.', de: 'Lass deine Augen einen Moment ruhen.', es: 'Descansa los ojos un momento.', fr: 'Repose tes yeux un instant.', ja: '少し目を休ませましょう。', ar: 'أرح عينيك للحظة.', he: 'תן לעיניים לנוח רגע.' }},
  { id: 'bo3', type: 'body', duration: 15, emoji: '😊', text: { en: 'Unclench your jaw.', uk: 'Розслаб щелепу.', de: 'Entspanne deinen Kiefer.', es: 'Relaja la mandíbula.', fr: 'Détends ta mâchoire.', ja: '顎の力を抜きましょう。', ar: 'أرخِ فكّك.', he: 'שחרר את הלסת.' }},
  { id: 'bo4', type: 'body', duration: 20, emoji: '🖐️', text: { en: 'Stretch your fingers and hands.', uk: 'Розтягни пальці та кисті рук.', de: 'Strecke deine Finger und Hände.', es: 'Estira tus dedos y manos.', fr: 'Étire tes doigts et tes mains.', ja: '指と手を伸ばしましょう。', ar: 'مدّد أصابعك ويديك.', he: 'מתח את האצבעות והידיים.' }},
  { id: 'bo5', type: 'body', duration: 20, emoji: '🧍', text: { en: 'Notice your posture. Adjust if needed.', uk: 'Зверни увагу на поставу. Поправ, якщо потрібно.', de: 'Beachte deine Haltung. Korrigiere sie bei Bedarf.', es: 'Nota tu postura. Ajústala si es necesario.', fr: 'Observe ta posture. Ajuste-la si besoin.', ja: '姿勢に気づいて、必要なら整えましょう。', ar: 'انتبه لوضعيتك. عدّلها إن لزم.', he: 'שים לב ליציבה שלך. תקן אם צריך.' }},
  { id: 'bo6', type: 'body', duration: 15, emoji: '💆', text: { en: 'Gently roll your neck.', uk: 'М\'яко покрути шиєю.', de: 'Rolle sanft deinen Nacken.', es: 'Gira suavemente el cuello.', fr: 'Fais rouler doucement ton cou.', ja: 'ゆっくり首を回しましょう。', ar: 'أدِر رقبتك بلطف.', he: 'סובב את הצוואר בעדינות.' }},
];

// Positive affirmations (10 sec)
const affirmationPrompts: MindfulPrompt[] = [
  { id: 'af1', type: 'affirmation', duration: 10, emoji: '💪', text: { en: 'You\'re doing better than you think.', uk: 'Ти справляєшся краще, ніж думаєш.', de: 'Du machst das besser, als du denkst.', es: 'Lo estás haciendo mejor de lo que crees.', fr: 'Tu fais mieux que tu ne le penses.', ja: '思っているよりもうまくやっていますよ。', ar: 'أنت أفضل مما تظن.', he: 'אתה מצליח יותר ממה שאתה חושב.' }},
  { id: 'af2', type: 'affirmation', duration: 10, emoji: '🌈', text: { en: 'Progress, not perfection.', uk: 'Прогрес, а не досконалість.', de: 'Fortschritt, nicht Perfektion.', es: 'Progreso, no perfección.', fr: 'Progrès, pas perfection.', ja: '完璧でなくても、進歩が大切。', ar: 'تقدّم، لا كمال.', he: 'התקדמות, לא שלמות.' }},
  { id: 'af3', type: 'affirmation', duration: 10, emoji: '⭐', text: { en: 'You deserve rest.', uk: 'Ти заслуговуєш на відпочинок.', de: 'Du verdienst Ruhe.', es: 'Mereces descanso.', fr: 'Tu mérites du repos.', ja: '休む権利がありますよ。', ar: 'أنت تستحق الراحة.', he: 'מגיע לך לנוח.' }},
  { id: 'af4', type: 'affirmation', duration: 10, emoji: '🌱', text: { en: 'Small steps count.', uk: 'Маленькі кроки важливі.', de: 'Kleine Schritte zählen.', es: 'Los pequeños pasos cuentan.', fr: 'Les petits pas comptent.', ja: '小さな一歩も大切です。', ar: 'الخطوات الصغيرة مهمة.', he: 'צעדים קטנים נחשבים.' }},
  { id: 'af5', type: 'affirmation', duration: 10, emoji: '🎯', text: { en: 'One thing at a time.', uk: 'Одна річ за раз.', de: 'Eins nach dem anderen.', es: 'Una cosa a la vez.', fr: 'Une chose à la fois.', ja: 'ひとつずつ、着実に。', ar: 'شيء واحد في كل مرة.', he: 'דבר אחד בכל פעם.' }},
  { id: 'af6', type: 'affirmation', duration: 10, emoji: '🤗', text: { en: 'Be kind to yourself.', uk: 'Будь добрим до себе.', de: 'Sei gut zu dir selbst.', es: 'Sé amable contigo mismo.', fr: 'Sois gentil avec toi-même.', ja: '自分に優しくしてね。', ar: 'كن لطيفًا مع نفسك.', he: 'היה עדין עם עצמך.' }},
  { id: 'af7', type: 'affirmation', duration: 10, emoji: '🌟', text: { en: 'You\'ve got this.', uk: 'У тебе вийде.', de: 'Du schaffst das.', es: 'Tú puedes.', fr: 'Tu peux le faire.', ja: 'あなたならできます。', ar: 'بإمكانك فعلها.', he: 'אתה יכול.' }},
  { id: 'af8', type: 'affirmation', duration: 10, emoji: '💖', text: { en: 'Your effort matters.', uk: 'Твої зусилля важливі.', de: 'Deine Mühe zählt.', es: 'Tu esfuerzo importa.', fr: 'Tes efforts comptent.', ja: 'あなたの努力には意味があります。', ar: 'جهدك له قيمة.', he: 'המאמץ שלך חשוב.' }},
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
  checkin: { en: 'Check-in', uk: 'Чек-ін', de: 'Check-in', es: 'Check-in', fr: 'Check-in', ja: 'チェックイン', ar: 'تسجيل حالة', he: "צ'ק-אין" },
  breathing: { en: 'Breathe', uk: 'Дихання', de: 'Atmen', es: 'Respirar', fr: 'Respirer', ja: '呼吸', ar: 'تنفّس', he: 'נשימה' },
  gratitude: { en: 'Gratitude', uk: 'Вдячність', de: 'Dankbarkeit', es: 'Gratitud', fr: 'Gratitude', ja: '感謝', ar: 'امتنان', he: 'הכרת תודה' },
  body: { en: 'Body', uk: 'Тіло', de: 'Körper', es: 'Cuerpo', fr: 'Corps', ja: '体', ar: 'الجسم', he: 'גוף' },
  affirmation: { en: 'Affirmation', uk: 'Афірмація', de: 'Affirmation', es: 'Afirmación', fr: 'Affirmation', ja: 'アファメーション', ar: 'تأكيد إيجابي', he: 'אישור עצמי' },
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
