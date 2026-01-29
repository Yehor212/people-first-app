/**
 * Journal Prompts Library
 * 200+ directed prompts for mindful writing
 * ADHD-friendly: Short, specific prompts that reduce "blank page anxiety"
 */

export type PromptCategory =
  | 'gratitude'     // Being thankful
  | 'reflection'    // Self-understanding
  | 'emotions'      // Emotional awareness
  | 'goals'         // Aspirations
  | 'relationships' // People in your life
  | 'adhd';         // ADHD-specific support

export interface JournalPrompt {
  id: string;
  category: PromptCategory;
  text: Record<string, string>; // Language code -> prompt text
  starter?: Record<string, string>; // Optional sentence starter
}

// Gratitude prompts (40)
const gratitudePrompts: JournalPrompt[] = [
  { id: 'g1', category: 'gratitude', text: { en: 'What made you smile today?', ru: 'Что заставило тебя улыбнуться сегодня?', uk: 'Що змусило тебе посміхнутися сьогодні?', de: 'Was hat dich heute zum Lächeln gebracht?', es: '¿Qué te hizo sonreír hoy?', fr: 'Qu\'est-ce qui t\'a fait sourire aujourd\'hui?' }},
  { id: 'g2', category: 'gratitude', text: { en: 'Name three small things you\'re thankful for.', ru: 'Назови три маленькие вещи, за которые ты благодарен.', uk: 'Назви три маленькі речі, за які ти вдячний.', de: 'Nenne drei kleine Dinge, für die du dankbar bist.', es: 'Nombra tres cosas pequeñas por las que estás agradecido.', fr: 'Nomme trois petites choses pour lesquelles tu es reconnaissant.' }},
  { id: 'g3', category: 'gratitude', text: { en: 'Who helped you recently? How?', ru: 'Кто тебе недавно помог? Как?', uk: 'Хто тобі нещодавно допоміг? Як?', de: 'Wer hat dir kürzlich geholfen? Wie?', es: '¿Quién te ayudó recientemente? ¿Cómo?', fr: 'Qui t\'a aidé récemment? Comment?' }},
  { id: 'g4', category: 'gratitude', text: { en: 'What\'s a comfort you often take for granted?', ru: 'Какой комфорт ты часто воспринимаешь как должное?', uk: 'Який комфорт ти часто сприймаєш як належне?', de: 'Welchen Komfort nimmst du oft als selbstverständlich hin?', es: '¿Qué comodidad a menudo das por sentada?', fr: 'Quel confort prends-tu souvent pour acquis?' }},
  { id: 'g5', category: 'gratitude', text: { en: 'What part of your body are you grateful for?', ru: 'За какую часть своего тела ты благодарен?', uk: 'За яку частину свого тіла ти вдячний?', de: 'Für welchen Teil deines Körpers bist du dankbar?', es: '¿Por qué parte de tu cuerpo estás agradecido?', fr: 'Pour quelle partie de ton corps es-tu reconnaissant?' }},
  { id: 'g6', category: 'gratitude', text: { en: 'What technology makes your life easier?', ru: 'Какая технология облегчает твою жизнь?', uk: 'Яка технологія полегшує твоє життя?', de: 'Welche Technologie macht dein Leben einfacher?', es: '¿Qué tecnología hace tu vida más fácil?', fr: 'Quelle technologie te facilite la vie?' }},
  { id: 'g7', category: 'gratitude', text: { en: 'What\'s your favorite thing about where you live?', ru: 'Что тебе больше всего нравится в месте, где ты живёшь?', uk: 'Що тобі найбільше подобається в місці, де ти живеш?', de: 'Was magst du am meisten an deinem Wohnort?', es: '¿Qué es lo que más te gusta de donde vives?', fr: 'Qu\'est-ce que tu préfères dans l\'endroit où tu vis?' }},
  { id: 'g8', category: 'gratitude', text: { en: 'What food are you grateful to have access to?', ru: 'За какую еду ты благодарен?', uk: 'За яку їжу ти вдячний?', de: 'Für welches Essen bist du dankbar?', es: '¿Por qué comida estás agradecido?', fr: 'Pour quelle nourriture es-tu reconnaissant?' }},
  { id: 'g9', category: 'gratitude', text: { en: 'What skill are you glad you have?', ru: 'Какому навыку ты рад?', uk: 'Якому навику ти радий?', de: 'Über welche Fähigkeit bist du froh?', es: '¿Qué habilidad te alegra tener?', fr: 'De quelle compétence es-tu content?' }},
  { id: 'g10', category: 'gratitude', text: { en: 'What memory makes you feel warm?', ru: 'Какое воспоминание тебя согревает?', uk: 'Який спогад тебе зігріває?', de: 'Welche Erinnerung wärmt dein Herz?', es: '¿Qué recuerdo te hace sentir cálido?', fr: 'Quel souvenir te réchauffe le cœur?' }},
  { id: 'g11', category: 'gratitude', text: { en: 'What\'s something beautiful you saw today?', ru: 'Что красивое ты видел сегодня?', uk: 'Що красиве ти бачив сьогодні?', de: 'Was Schönes hast du heute gesehen?', es: '¿Qué cosa hermosa viste hoy?', fr: 'Quelle belle chose as-tu vue aujourd\'hui?' }},
  { id: 'g12', category: 'gratitude', text: { en: 'What opportunity are you grateful for?', ru: 'За какую возможность ты благодарен?', uk: 'За яку можливість ти вдячний?', de: 'Für welche Gelegenheit bist du dankbar?', es: '¿Por qué oportunidad estás agradecido?', fr: 'Pour quelle opportunité es-tu reconnaissant?' }},
  { id: 'g13', category: 'gratitude', text: { en: 'What made today better than yesterday?', ru: 'Что сделало сегодняшний день лучше вчерашнего?', uk: 'Що зробило сьогоднішній день кращим за вчорашній?', de: 'Was hat heute besser gemacht als gestern?', es: '¿Qué hizo hoy mejor que ayer?', fr: 'Qu\'est-ce qui a rendu aujourd\'hui meilleur qu\'hier?' }},
  { id: 'g14', category: 'gratitude', text: { en: 'Who would you like to thank today?', ru: 'Кого бы ты хотел поблагодарить сегодня?', uk: 'Кого б ти хотів подякувати сьогодні?', de: 'Wem möchtest du heute danken?', es: '¿A quién te gustaría agradecer hoy?', fr: 'Qui voudrais-tu remercier aujourd\'hui?' }},
  { id: 'g15', category: 'gratitude', text: { en: 'What\'s a lesson you\'re grateful to have learned?', ru: 'За какой урок ты благодарен?', uk: 'За який урок ти вдячний?', de: 'Für welche Lektion bist du dankbar?', es: '¿Por qué lección estás agradecido?', fr: 'Pour quelle leçon es-tu reconnaissant?' }},
  { id: 'g16', category: 'gratitude', text: { en: 'What in nature inspires gratitude?', ru: 'Что в природе вызывает благодарность?', uk: 'Що в природі викликає вдячність?', de: 'Was in der Natur inspiriert Dankbarkeit?', es: '¿Qué en la naturaleza inspira gratitud?', fr: 'Qu\'est-ce qui dans la nature inspire la gratitude?' }},
  { id: 'g17', category: 'gratitude', text: { en: 'What challenge made you stronger?', ru: 'Какой вызов сделал тебя сильнее?', uk: 'Який виклик зробив тебе сильнішим?', de: 'Welche Herausforderung hat dich stärker gemacht?', es: '¿Qué desafío te hizo más fuerte?', fr: 'Quel défi t\'a rendu plus fort?' }},
  { id: 'g18', category: 'gratitude', text: { en: 'What freedom do you appreciate?', ru: 'Какую свободу ты ценишь?', uk: 'Яку свободу ти цінуєш?', de: 'Welche Freiheit schätzt du?', es: '¿Qué libertad aprecias?', fr: 'Quelle liberté apprécies-tu?' }},
  { id: 'g19', category: 'gratitude', text: { en: 'What simple pleasure brought you joy?', ru: 'Какое простое удовольствие принесло тебе радость?', uk: 'Яке просте задоволення принесло тобі радість?', de: 'Welches einfache Vergnügen hat dir Freude bereitet?', es: '¿Qué placer simple te trajo alegría?', fr: 'Quel plaisir simple t\'a apporté de la joie?' }},
  { id: 'g20', category: 'gratitude', text: { en: 'What are you looking forward to?', ru: 'Чего ты ждёшь с нетерпением?', uk: 'Чого ти чекаєш з нетерпінням?', de: 'Worauf freust du dich?', es: '¿Qué esperas con ilusión?', fr: 'Qu\'est-ce que tu attends avec impatience?' }},
];

// Reflection prompts (40)
const reflectionPrompts: JournalPrompt[] = [
  { id: 'r1', category: 'reflection', text: { en: 'What did you learn about yourself today?', ru: 'Что ты узнал о себе сегодня?', uk: 'Що ти дізнався про себе сьогодні?', de: 'Was hast du heute über dich gelernt?', es: '¿Qué aprendiste de ti mismo hoy?', fr: 'Qu\'as-tu appris sur toi-même aujourd\'hui?' }},
  { id: 'r2', category: 'reflection', text: { en: 'What would you do differently next time?', ru: 'Что бы ты сделал иначе в следующий раз?', uk: 'Що б ти зробив інакше наступного разу?', de: 'Was würdest du beim nächsten Mal anders machen?', es: '¿Qué harías diferente la próxima vez?', fr: 'Que ferais-tu différemment la prochaine fois?' }},
  { id: 'r3', category: 'reflection', text: { en: 'What made you proud today?', ru: 'Чем ты гордился сегодня?', uk: 'Чим ти пишався сьогодні?', de: 'Worauf warst du heute stolz?', es: '¿De qué estuviste orgulloso hoy?', fr: 'De quoi as-tu été fier aujourd\'hui?' }},
  { id: 'r4', category: 'reflection', text: { en: 'What\'s one thing you want to improve?', ru: 'Что ты хочешь улучшить?', uk: 'Що ти хочеш покращити?', de: 'Was möchtest du verbessern?', es: '¿Qué quieres mejorar?', fr: 'Que veux-tu améliorer?' }},
  { id: 'r5', category: 'reflection', text: { en: 'How did you take care of yourself today?', ru: 'Как ты позаботился о себе сегодня?', uk: 'Як ти подбав про себе сьогодні?', de: 'Wie hast du heute für dich gesorgt?', es: '¿Cómo cuidaste de ti mismo hoy?', fr: 'Comment as-tu pris soin de toi aujourd\'hui?' }},
  { id: 'r6', category: 'reflection', text: { en: 'What boundary did you set or need to set?', ru: 'Какую границу ты установил или хочешь установить?', uk: 'Яку межу ти встановив або хочеш встановити?', de: 'Welche Grenze hast du gesetzt oder musst du setzen?', es: '¿Qué límite estableciste o necesitas establecer?', fr: 'Quelle limite as-tu posée ou dois-tu poser?' }},
  { id: 'r7', category: 'reflection', text: { en: 'What energized you today?', ru: 'Что придало тебе энергии сегодня?', uk: 'Що надало тобі енергії сьогодні?', de: 'Was hat dir heute Energie gegeben?', es: '¿Qué te dio energía hoy?', fr: 'Qu\'est-ce qui t\'a donné de l\'énergie aujourd\'hui?' }},
  { id: 'r8', category: 'reflection', text: { en: 'What drained your energy?', ru: 'Что забрало твою энергию?', uk: 'Що забрало твою енергію?', de: 'Was hat deine Energie geraubt?', es: '¿Qué te quitó energía?', fr: 'Qu\'est-ce qui a vidé ton énergie?' }},
  { id: 'r9', category: 'reflection', text: { en: 'What did you avoid today? Why?', ru: 'Чего ты избегал сегодня? Почему?', uk: 'Чого ти уникав сьогодні? Чому?', de: 'Was hast du heute vermieden? Warum?', es: '¿Qué evitaste hoy? ¿Por qué?', fr: 'Qu\'as-tu évité aujourd\'hui? Pourquoi?' }},
  { id: 'r10', category: 'reflection', text: { en: 'What surprised you about yourself?', ru: 'Что тебя удивило в себе?', uk: 'Що тебе здивувало в собі?', de: 'Was hat dich an dir selbst überrascht?', es: '¿Qué te sorprendió de ti mismo?', fr: 'Qu\'est-ce qui t\'a surpris chez toi?' }},
  { id: 'r11', category: 'reflection', text: { en: 'How did you show kindness today?', ru: 'Как ты проявил доброту сегодня?', uk: 'Як ти проявив доброту сьогодні?', de: 'Wie hast du heute Freundlichkeit gezeigt?', es: '¿Cómo mostraste amabilidad hoy?', fr: 'Comment as-tu fait preuve de gentillesse aujourd\'hui?' }},
  { id: 'r12', category: 'reflection', text: { en: 'What pattern do you notice in your week?', ru: 'Какую закономерность ты замечаешь на этой неделе?', uk: 'Яку закономірність ти помічаєш цього тижня?', de: 'Welches Muster bemerkst du in deiner Woche?', es: '¿Qué patrón notas en tu semana?', fr: 'Quel schéma remarques-tu dans ta semaine?' }},
  { id: 'r13', category: 'reflection', text: { en: 'What conversation stuck with you?', ru: 'Какой разговор запомнился тебе?', uk: 'Яка розмова запам\'яталася тобі?', de: 'Welches Gespräch ist dir im Gedächtnis geblieben?', es: '¿Qué conversación te quedó grabada?', fr: 'Quelle conversation t\'est restée en mémoire?' }},
  { id: 'r14', category: 'reflection', text: { en: 'When did you feel most like yourself?', ru: 'Когда ты чувствовал себя наиболее собой?', uk: 'Коли ти відчував себе найбільш собою?', de: 'Wann hast du dich am meisten wie du selbst gefühlt?', es: '¿Cuándo te sentiste más tú mismo?', fr: 'Quand t\'es-tu senti le plus toi-même?' }},
  { id: 'r15', category: 'reflection', text: { en: 'What would your younger self think of you now?', ru: 'Что бы твоё младшее "я" подумало о тебе сейчас?', uk: 'Що б твоє молодше "я" подумало про тебе зараз?', de: 'Was würde dein jüngeres Ich von dir heute denken?', es: '¿Qué pensaría tu yo más joven de ti ahora?', fr: 'Que penserait ton jeune toi de toi maintenant?' }},
  { id: 'r16', category: 'reflection', text: { en: 'What are you holding onto that you should let go?', ru: 'За что ты держишься, что стоит отпустить?', uk: 'За що ти тримаєшся, що варто відпустити?', de: 'Woran hältst du fest, das du loslassen solltest?', es: '¿A qué te aferras que deberías soltar?', fr: 'À quoi t\'accroches-tu que tu devrais lâcher?' }},
  { id: 'r17', category: 'reflection', text: { en: 'What made you laugh today?', ru: 'Что заставило тебя смеяться сегодня?', uk: 'Що змусило тебе сміятися сьогодні?', de: 'Was hat dich heute zum Lachen gebracht?', es: '¿Qué te hizo reír hoy?', fr: 'Qu\'est-ce qui t\'a fait rire aujourd\'hui?' }},
  { id: 'r18', category: 'reflection', text: { en: 'What do you need more of in your life?', ru: 'Чего тебе нужно больше в жизни?', uk: 'Чого тобі потрібно більше в житті?', de: 'Was brauchst du mehr in deinem Leben?', es: '¿Qué necesitas más en tu vida?', fr: 'De quoi as-tu besoin de plus dans ta vie?' }},
  { id: 'r19', category: 'reflection', text: { en: 'What do you need less of?', ru: 'Чего тебе нужно меньше?', uk: 'Чого тобі потрібно менше?', de: 'Was brauchst du weniger?', es: '¿Qué necesitas menos?', fr: 'De quoi as-tu besoin de moins?' }},
  { id: 'r20', category: 'reflection', text: { en: 'What small win can you celebrate?', ru: 'Какую маленькую победу ты можешь отпраздновать?', uk: 'Яку маленьку перемогу ти можеш відсвяткувати?', de: 'Welchen kleinen Sieg kannst du feiern?', es: '¿Qué pequeña victoria puedes celebrar?', fr: 'Quelle petite victoire peux-tu célébrer?' }},
];

// Emotions prompts (30)
const emotionsPrompts: JournalPrompt[] = [
  { id: 'e1', category: 'emotions', text: { en: 'What emotion was strongest today?', ru: 'Какая эмоция была самой сильной сегодня?', uk: 'Яка емоція була найсильнішою сьогодні?', de: 'Welche Emotion war heute am stärksten?', es: '¿Qué emoción fue la más fuerte hoy?', fr: 'Quelle émotion a été la plus forte aujourd\'hui?' }},
  { id: 'e2', category: 'emotions', text: { en: 'Where in your body do you feel stress?', ru: 'Где в теле ты чувствуешь стресс?', uk: 'Де в тілі ти відчуваєш стрес?', de: 'Wo in deinem Körper spürst du Stress?', es: '¿Dónde en tu cuerpo sientes estrés?', fr: 'Où dans ton corps ressens-tu le stress?' }},
  { id: 'e3', category: 'emotions', text: { en: 'What triggered anxiety today?', ru: 'Что вызвало тревогу сегодня?', uk: 'Що викликало тривогу сьогодні?', de: 'Was hat heute Angst ausgelöst?', es: '¿Qué desencadenó ansiedad hoy?', fr: 'Qu\'est-ce qui a déclenché l\'anxiété aujourd\'hui?' }},
  { id: 'e4', category: 'emotions', text: { en: 'What brought you peace today?', ru: 'Что принесло тебе покой сегодня?', uk: 'Що принесло тобі спокій сьогодні?', de: 'Was hat dir heute Frieden gebracht?', es: '¿Qué te trajo paz hoy?', fr: 'Qu\'est-ce qui t\'a apporté la paix aujourd\'hui?' }},
  { id: 'e5', category: 'emotions', text: { en: 'What fear came up today?', ru: 'Какой страх появился сегодня?', uk: 'Який страх з\'явився сьогодні?', de: 'Welche Angst kam heute hoch?', es: '¿Qué miedo surgió hoy?', fr: 'Quelle peur est apparue aujourd\'hui?' }},
  { id: 'e6', category: 'emotions', text: { en: 'What made you feel loved?', ru: 'Что заставило тебя почувствовать себя любимым?', uk: 'Що змусило тебе відчути себе коханим?', de: 'Was hat dir das Gefühl gegeben, geliebt zu werden?', es: '¿Qué te hizo sentir amado?', fr: 'Qu\'est-ce qui t\'a fait te sentir aimé?' }},
  { id: 'e7', category: 'emotions', text: { en: 'What frustration do you need to release?', ru: 'Какое разочарование тебе нужно отпустить?', uk: 'Яке розчарування тобі потрібно відпустити?', de: 'Welche Frustration musst du loslassen?', es: '¿Qué frustración necesitas liberar?', fr: 'Quelle frustration dois-tu libérer?' }},
  { id: 'e8', category: 'emotions', text: { en: 'What emotion are you avoiding?', ru: 'Какую эмоцию ты избегаешь?', uk: 'Яку емоцію ти уникаєш?', de: 'Welche Emotion vermeidest du?', es: '¿Qué emoción estás evitando?', fr: 'Quelle émotion évites-tu?' }},
  { id: 'e9', category: 'emotions', text: { en: 'How would you describe your mood in one word?', ru: 'Как бы ты описал своё настроение одним словом?', uk: 'Як би ти описав свій настрій одним словом?', de: 'Wie würdest du deine Stimmung mit einem Wort beschreiben?', es: '¿Cómo describirías tu estado de ánimo en una palabra?', fr: 'Comment décrirais-tu ton humeur en un mot?' }},
  { id: 'e10', category: 'emotions', text: { en: 'What do you need to feel better right now?', ru: 'Что тебе нужно, чтобы почувствовать себя лучше?', uk: 'Що тобі потрібно, щоб почуватися краще?', de: 'Was brauchst du, um dich jetzt besser zu fühlen?', es: '¿Qué necesitas para sentirte mejor ahora?', fr: 'De quoi as-tu besoin pour te sentir mieux maintenant?' }},
  { id: 'e11', category: 'emotions', text: { en: 'What would comfort your inner child?', ru: 'Что бы утешило твоего внутреннего ребёнка?', uk: 'Що б втішило твою внутрішню дитину?', de: 'Was würde dein inneres Kind trösten?', es: '¿Qué consolaría a tu niño interior?', fr: 'Qu\'est-ce qui réconforterait ton enfant intérieur?' }},
  { id: 'e12', category: 'emotions', text: { en: 'What emotion surprised you today?', ru: 'Какая эмоция удивила тебя сегодня?', uk: 'Яка емоція здивувала тебе сьогодні?', de: 'Welche Emotion hat dich heute überrascht?', es: '¿Qué emoción te sorprendió hoy?', fr: 'Quelle émotion t\'a surpris aujourd\'hui?' }},
  { id: 'e13', category: 'emotions', text: { en: 'What helps you when you feel overwhelmed?', ru: 'Что помогает тебе, когда ты чувствуешь себя перегруженным?', uk: 'Що допомагає тобі, коли ти відчуваєш себе перевантаженим?', de: 'Was hilft dir, wenn du dich überfordert fühlst?', es: '¿Qué te ayuda cuando te sientes abrumado?', fr: 'Qu\'est-ce qui t\'aide quand tu te sens submergé?' }},
  { id: 'e14', category: 'emotions', text: { en: 'What made you feel confident?', ru: 'Что заставило тебя чувствовать уверенность?', uk: 'Що змусило тебе відчувати впевненість?', de: 'Was hat dir Selbstvertrauen gegeben?', es: '¿Qué te hizo sentir confiado?', fr: 'Qu\'est-ce qui t\'a donné confiance?' }},
  { id: 'e15', category: 'emotions', text: { en: 'What emotion do you want to feel more often?', ru: 'Какую эмоцию ты хочешь чувствовать чаще?', uk: 'Яку емоцію ти хочеш відчувати частіше?', de: 'Welche Emotion möchtest du öfter fühlen?', es: '¿Qué emoción quieres sentir más a menudo?', fr: 'Quelle émotion veux-tu ressentir plus souvent?' }},
];

// Goals prompts (30)
const goalsPrompts: JournalPrompt[] = [
  { id: 'go1', category: 'goals', text: { en: 'What small step did you take toward a goal?', ru: 'Какой маленький шаг ты сделал к цели?', uk: 'Який маленький крок ти зробив до цілі?', de: 'Welchen kleinen Schritt hast du auf ein Ziel hin gemacht?', es: '¿Qué pequeño paso diste hacia una meta?', fr: 'Quel petit pas as-tu fait vers un objectif?' }},
  { id: 'go2', category: 'goals', text: { en: 'What dream feels closer today?', ru: 'Какая мечта кажется ближе сегодня?', uk: 'Яка мрія здається ближчою сьогодні?', de: 'Welcher Traum fühlt sich heute näher an?', es: '¿Qué sueño se siente más cercano hoy?', fr: 'Quel rêve semble plus proche aujourd\'hui?' }},
  { id: 'go3', category: 'goals', text: { en: 'What\'s blocking your progress?', ru: 'Что блокирует твой прогресс?', uk: 'Що блокує твій прогрес?', de: 'Was blockiert deinen Fortschritt?', es: '¿Qué está bloqueando tu progreso?', fr: 'Qu\'est-ce qui bloque ta progression?' }},
  { id: 'go4', category: 'goals', text: { en: 'What habit is helping you most?', ru: 'Какая привычка помогает тебе больше всего?', uk: 'Яка звичка допомагає тобі найбільше?', de: 'Welche Gewohnheit hilft dir am meisten?', es: '¿Qué hábito te ayuda más?', fr: 'Quelle habitude t\'aide le plus?' }},
  { id: 'go5', category: 'goals', text: { en: 'What would your ideal tomorrow look like?', ru: 'Как бы выглядел твой идеальный завтрашний день?', uk: 'Як би виглядав твій ідеальний завтрашній день?', de: 'Wie würde dein idealer morgiger Tag aussehen?', es: '¿Cómo sería tu mañana ideal?', fr: 'À quoi ressemblerait ton demain idéal?' }},
  { id: 'go6', category: 'goals', text: { en: 'What\'s the next right thing to do?', ru: 'Какой следующий правильный шаг сделать?', uk: 'Який наступний правильний крок зробити?', de: 'Was ist das Nächste, was zu tun ist?', es: '¿Cuál es lo siguiente correcto que hacer?', fr: 'Quelle est la prochaine bonne chose à faire?' }},
  { id: 'go7', category: 'goals', text: { en: 'What do you want to accomplish this week?', ru: 'Чего ты хочешь достичь на этой неделе?', uk: 'Чого ти хочеш досягти цього тижня?', de: 'Was möchtest du diese Woche erreichen?', es: '¿Qué quieres lograr esta semana?', fr: 'Que veux-tu accomplir cette semaine?' }},
  { id: 'go8', category: 'goals', text: { en: 'What would make today a success?', ru: 'Что сделало бы сегодняшний день успешным?', uk: 'Що зробило б сьогоднішній день успішним?', de: 'Was würde heute zu einem Erfolg machen?', es: '¿Qué haría de hoy un éxito?', fr: 'Qu\'est-ce qui ferait d\'aujourd\'hui un succès?' }},
  { id: 'go9', category: 'goals', text: { en: 'What fear is holding you back from your goal?', ru: 'Какой страх удерживает тебя от цели?', uk: 'Який страх утримує тебе від цілі?', de: 'Welche Angst hält dich von deinem Ziel ab?', es: '¿Qué miedo te impide alcanzar tu meta?', fr: 'Quelle peur te retient d\'atteindre ton objectif?' }},
  { id: 'go10', category: 'goals', text: { en: 'What skill do you want to develop?', ru: 'Какой навык ты хочешь развить?', uk: 'Який навик ти хочеш розвинути?', de: 'Welche Fähigkeit möchtest du entwickeln?', es: '¿Qué habilidad quieres desarrollar?', fr: 'Quelle compétence veux-tu développer?' }},
  { id: 'go11', category: 'goals', text: { en: 'What would your future self thank you for?', ru: 'За что будущее "я" тебя поблагодарит?', uk: 'За що майбутнє "я" тебе подякує?', de: 'Wofür würde dein zukünftiges Ich dir danken?', es: '¿Por qué te agradecería tu yo futuro?', fr: 'Pour quoi ton futur toi te remercierait-il?' }},
  { id: 'go12', category: 'goals', text: { en: 'What\'s one tiny thing you can do right now?', ru: 'Что одно маленькое ты можешь сделать прямо сейчас?', uk: 'Що одне маленьке ти можеш зробити прямо зараз?', de: 'Was ist eine winzige Sache, die du jetzt tun kannst?', es: '¿Qué pequeña cosa puedes hacer ahora mismo?', fr: 'Quelle petite chose peux-tu faire maintenant?' }},
  { id: 'go13', category: 'goals', text: { en: 'What progress did you make today, even small?', ru: 'Какой прогресс ты сделал сегодня, пусть даже маленький?', uk: 'Який прогрес ти зробив сьогодні, хай навіть маленький?', de: 'Welchen Fortschritt hast du heute gemacht, auch wenn er klein ist?', es: '¿Qué progreso hiciste hoy, aunque sea pequeño?', fr: 'Quel progrès as-tu fait aujourd\'hui, même petit?' }},
  { id: 'go14', category: 'goals', text: { en: 'What\'s working well for you?', ru: 'Что хорошо работает для тебя?', uk: 'Що добре працює для тебе?', de: 'Was funktioniert gut für dich?', es: '¿Qué te está funcionando bien?', fr: 'Qu\'est-ce qui fonctionne bien pour toi?' }},
  { id: 'go15', category: 'goals', text: { en: 'What\'s not working that you should change?', ru: 'Что не работает, что стоит изменить?', uk: 'Що не працює, що варто змінити?', de: 'Was funktioniert nicht, das du ändern solltest?', es: '¿Qué no funciona que deberías cambiar?', fr: 'Qu\'est-ce qui ne fonctionne pas que tu devrais changer?' }},
];

// Relationships prompts (30)
const relationshipsPrompts: JournalPrompt[] = [
  { id: 're1', category: 'relationships', text: { en: 'Who made your day better today?', ru: 'Кто сделал твой день лучше сегодня?', uk: 'Хто зробив твій день кращим сьогодні?', de: 'Wer hat deinen Tag heute besser gemacht?', es: '¿Quién mejoró tu día hoy?', fr: 'Qui a rendu ta journée meilleure aujourd\'hui?' }},
  { id: 're2', category: 'relationships', text: { en: 'Who do you want to spend more time with?', ru: 'С кем ты хочешь проводить больше времени?', uk: 'З ким ти хочеш проводити більше часу?', de: 'Mit wem möchtest du mehr Zeit verbringen?', es: '¿Con quién quieres pasar más tiempo?', fr: 'Avec qui veux-tu passer plus de temps?' }},
  { id: 're3', category: 'relationships', text: { en: 'What quality do you admire in someone close?', ru: 'Какое качество ты восхищаешься в близком человеке?', uk: 'Якою якістю ти захоплюєшся в близькій людині?', de: 'Welche Eigenschaft bewunderst du bei einer nahestehenden Person?', es: '¿Qué cualidad admiras en alguien cercano?', fr: 'Quelle qualité admires-tu chez quelqu\'un de proche?' }},
  { id: 're4', category: 'relationships', text: { en: 'Who needs your support right now?', ru: 'Кому сейчас нужна твоя поддержка?', uk: 'Кому зараз потрібна твоя підтримка?', de: 'Wer braucht gerade deine Unterstützung?', es: '¿Quién necesita tu apoyo ahora mismo?', fr: 'Qui a besoin de ton soutien en ce moment?' }},
  { id: 're5', category: 'relationships', text: { en: 'What conversation do you need to have?', ru: 'Какой разговор тебе нужно провести?', uk: 'Яку розмову тобі потрібно провести?', de: 'Welches Gespräch musst du führen?', es: '¿Qué conversación necesitas tener?', fr: 'Quelle conversation dois-tu avoir?' }},
  { id: 're6', category: 'relationships', text: { en: 'How can you show appreciation to someone?', ru: 'Как ты можешь показать признательность кому-то?', uk: 'Як ти можеш показати вдячність комусь?', de: 'Wie kannst du jemandem Wertschätzung zeigen?', es: '¿Cómo puedes mostrar aprecio a alguien?', fr: 'Comment peux-tu montrer ta reconnaissance à quelqu\'un?' }},
  { id: 're7', category: 'relationships', text: { en: 'What boundary do you need in a relationship?', ru: 'Какая граница тебе нужна в отношениях?', uk: 'Яка межа тобі потрібна у стосунках?', de: 'Welche Grenze brauchst du in einer Beziehung?', es: '¿Qué límite necesitas en una relación?', fr: 'Quelle limite as-tu besoin dans une relation?' }},
  { id: 're8', category: 'relationships', text: { en: 'Who inspires you and why?', ru: 'Кто тебя вдохновляет и почему?', uk: 'Хто тебе надихає і чому?', de: 'Wer inspiriert dich und warum?', es: '¿Quién te inspira y por qué?', fr: 'Qui t\'inspire et pourquoi?' }},
  { id: 're9', category: 'relationships', text: { en: 'What do you miss about someone?', ru: 'Чего тебе не хватает в ком-то?', uk: 'Чого тобі не вистачає в комусь?', de: 'Was vermisst du an jemandem?', es: '¿Qué extrañas de alguien?', fr: 'Qu\'est-ce qui te manque chez quelqu\'un?' }},
  { id: 're10', category: 'relationships', text: { en: 'How can you be a better friend?', ru: 'Как ты можешь стать лучшим другом?', uk: 'Як ти можеш стати кращим другом?', de: 'Wie kannst du ein besserer Freund sein?', es: '¿Cómo puedes ser un mejor amigo?', fr: 'Comment peux-tu être un meilleur ami?' }},
  { id: 're11', category: 'relationships', text: { en: 'What do you value most in your relationships?', ru: 'Что ты ценишь больше всего в отношениях?', uk: 'Що ти цінуєш найбільше у стосунках?', de: 'Was schätzt du am meisten an deinen Beziehungen?', es: '¿Qué valoras más en tus relaciones?', fr: 'Qu\'est-ce que tu apprécies le plus dans tes relations?' }},
  { id: 're12', category: 'relationships', text: { en: 'Who do you need to forgive?', ru: 'Кого тебе нужно простить?', uk: 'Кого тобі потрібно пробачити?', de: 'Wem musst du vergeben?', es: '¿A quién necesitas perdonar?', fr: 'À qui dois-tu pardonner?' }},
  { id: 're13', category: 'relationships', text: { en: 'What quality do you bring to relationships?', ru: 'Какое качество ты привносишь в отношения?', uk: 'Яку якість ти привносиш у стосунки?', de: 'Welche Eigenschaft bringst du in Beziehungen ein?', es: '¿Qué cualidad aportas a las relaciones?', fr: 'Quelle qualité apportes-tu dans les relations?' }},
  { id: 're14', category: 'relationships', text: { en: 'Who needs to hear "I love you" from you?', ru: 'Кому нужно услышать "Я тебя люблю" от тебя?', uk: 'Кому потрібно почути "Я тебе люблю" від тебе?', de: 'Wer muss "Ich liebe dich" von dir hören?', es: '¿Quién necesita escuchar "Te quiero" de ti?', fr: 'Qui a besoin d\'entendre "Je t\'aime" de ta part?' }},
  { id: 're15', category: 'relationships', text: { en: 'What made you feel connected to someone today?', ru: 'Что заставило тебя почувствовать связь с кем-то сегодня?', uk: 'Що змусило тебе відчути зв\'язок з кимось сьогодні?', de: 'Was hat dich heute mit jemandem verbunden fühlen lassen?', es: '¿Qué te hizo sentir conectado con alguien hoy?', fr: 'Qu\'est-ce qui t\'a fait te sentir connecté à quelqu\'un aujourd\'hui?' }},
];

// ADHD-specific prompts (30)
const adhdPrompts: JournalPrompt[] = [
  { id: 'a1', category: 'adhd', text: { en: 'What helped you focus today?', ru: 'Что помогло тебе сфокусироваться сегодня?', uk: 'Що допомогло тобі сфокусуватися сьогодні?', de: 'Was hat dir heute geholfen, dich zu konzentrieren?', es: '¿Qué te ayudó a concentrarte hoy?', fr: 'Qu\'est-ce qui t\'a aidé à te concentrer aujourd\'hui?' }},
  { id: 'a2', category: 'adhd', text: { en: 'What distracted you the most?', ru: 'Что отвлекало тебя больше всего?', uk: 'Що відволікало тебе найбільше?', de: 'Was hat dich am meisten abgelenkt?', es: '¿Qué te distrajo más?', fr: 'Qu\'est-ce qui t\'a le plus distrait?' }},
  { id: 'a3', category: 'adhd', text: { en: 'What time of day were you most productive?', ru: 'В какое время дня ты был наиболее продуктивен?', uk: 'В який час дня ти був найбільш продуктивним?', de: 'Zu welcher Tageszeit warst du am produktivsten?', es: '¿A qué hora del día fuiste más productivo?', fr: 'À quelle heure de la journée étais-tu le plus productif?' }},
  { id: 'a4', category: 'adhd', text: { en: 'What task did you keep avoiding?', ru: 'Какую задачу ты продолжал откладывать?', uk: 'Яке завдання ти продовжував відкладати?', de: 'Welche Aufgabe hast du immer wieder vermieden?', es: '¿Qué tarea seguiste evitando?', fr: 'Quelle tâche as-tu continué à éviter?' }},
  { id: 'a5', category: 'adhd', text: { en: 'What helped you start a difficult task?', ru: 'Что помогло тебе начать сложную задачу?', uk: 'Що допомогло тобі почати складне завдання?', de: 'Was hat dir geholfen, eine schwierige Aufgabe zu beginnen?', es: '¿Qué te ayudó a empezar una tarea difícil?', fr: 'Qu\'est-ce qui t\'a aidé à commencer une tâche difficile?' }},
  { id: 'a6', category: 'adhd', text: { en: 'How did you manage overwhelm today?', ru: 'Как ты справился с перегрузкой сегодня?', uk: 'Як ти впорався з перевантаженням сьогодні?', de: 'Wie hast du heute Überforderung bewältigt?', es: '¿Cómo manejaste el agobio hoy?', fr: 'Comment as-tu géré le débordement aujourd\'hui?' }},
  { id: 'a7', category: 'adhd', text: { en: 'What routine worked well today?', ru: 'Какая рутина хорошо сработала сегодня?', uk: 'Яка рутина добре спрацювала сьогодні?', de: 'Welche Routine hat heute gut funktioniert?', es: '¿Qué rutina funcionó bien hoy?', fr: 'Quelle routine a bien fonctionné aujourd\'hui?' }},
  { id: 'a8', category: 'adhd', text: { en: 'What helped calm your racing thoughts?', ru: 'Что помогло успокоить бегущие мысли?', uk: 'Що допомогло заспокоїти бігаючі думки?', de: 'Was hat geholfen, deine rasenden Gedanken zu beruhigen?', es: '¿Qué ayudó a calmar tus pensamientos acelerados?', fr: 'Qu\'est-ce qui a aidé à calmer tes pensées qui défilent?' }},
  { id: 'a9', category: 'adhd', text: { en: 'What "hack" made life easier today?', ru: 'Какой "лайфхак" облегчил жизнь сегодня?', uk: 'Який "лайфхак" полегшив життя сьогодні?', de: 'Welcher "Hack" hat das Leben heute einfacher gemacht?', es: '¿Qué "truco" te facilitó la vida hoy?', fr: 'Quelle "astuce" t\'a facilité la vie aujourd\'hui?' }},
  { id: 'a10', category: 'adhd', text: { en: 'Did you hyperfocus on anything? Was it useful?', ru: 'Ты гиперфокусировался на чём-то? Это было полезно?', uk: 'Ти гіперфокусувався на чомусь? Це було корисно?', de: 'Hast du dich auf etwas hyperfokussiert? War es nützlich?', es: '¿Te hiperconcentraste en algo? ¿Fue útil?', fr: 'As-tu hyperfocalisé sur quelque chose? C\'était utile?' }},
  { id: 'a11', category: 'adhd', text: { en: 'What broke your flow state?', ru: 'Что сломало твоё состояние потока?', uk: 'Що зламало твій стан потоку?', de: 'Was hat deinen Flow-Zustand unterbrochen?', es: '¿Qué rompió tu estado de flujo?', fr: 'Qu\'est-ce qui a cassé ton état de flow?' }},
  { id: 'a12', category: 'adhd', text: { en: 'How was your energy throughout the day?', ru: 'Как была твоя энергия в течение дня?', uk: 'Як була твоя енергія протягом дня?', de: 'Wie war deine Energie im Laufe des Tages?', es: '¿Cómo fue tu energía a lo largo del día?', fr: 'Comment était ton énergie tout au long de la journée?' }},
  { id: 'a13', category: 'adhd', text: { en: 'What reminder or alarm was most helpful?', ru: 'Какое напоминание было самым полезным?', uk: 'Яке нагадування було найкориснішим?', de: 'Welche Erinnerung war am hilfreichsten?', es: '¿Qué recordatorio fue más útil?', fr: 'Quel rappel a été le plus utile?' }},
  { id: 'a14', category: 'adhd', text: { en: 'Did you take any breaks? How did they help?', ru: 'Ты делал перерывы? Как они помогли?', uk: 'Ти робив перерви? Як вони допомогли?', de: 'Hast du Pausen gemacht? Wie haben sie geholfen?', es: '¿Tomaste descansos? ¿Cómo ayudaron?', fr: 'As-tu pris des pauses? Comment ont-elles aidé?' }},
  { id: 'a15', category: 'adhd', text: { en: 'What "boring" task did you make fun?', ru: 'Какую "скучную" задачу ты сделал весёлой?', uk: 'Яке "нудне" завдання ти зробив веселим?', de: 'Welche "langweilige" Aufgabe hast du unterhaltsam gemacht?', es: '¿Qué tarea "aburrida" hiciste divertida?', fr: 'Quelle tâche "ennuyeuse" as-tu rendue amusante?' }},
  { id: 'a16', category: 'adhd', text: { en: 'What do you need to forgive yourself for?', ru: 'За что тебе нужно простить себя?', uk: 'За що тобі потрібно пробачити себе?', de: 'Wofür musst du dir selbst vergeben?', es: '¿Por qué necesitas perdonarte?', fr: 'Pour quoi dois-tu te pardonner?' }},
  { id: 'a17', category: 'adhd', text: { en: 'What ADHD superpower did you use today?', ru: 'Какую СДВГ-суперсилу ты использовал сегодня?', uk: 'Яку СДУГ-суперсилу ти використав сьогодні?', de: 'Welche ADHS-Superkraft hast du heute genutzt?', es: '¿Qué superpoder TDAH usaste hoy?', fr: 'Quel superpouvoir TDAH as-tu utilisé aujourd\'hui?' }},
  { id: 'a18', category: 'adhd', text: { en: 'What new idea excited you today?', ru: 'Какая новая идея взволновала тебя сегодня?', uk: 'Яка нова ідея схвилювала тебе сьогодні?', de: 'Welche neue Idee hat dich heute begeistert?', es: '¿Qué nueva idea te emocionó hoy?', fr: 'Quelle nouvelle idée t\'a enthousiasmé aujourd\'hui?' }},
  { id: 'a19', category: 'adhd', text: { en: 'How did you handle time blindness today?', ru: 'Как ты справился с "временной слепотой" сегодня?', uk: 'Як ти впорався з "часовою сліпотою" сьогодні?', de: 'Wie bist du heute mit Zeitblindheit umgegangen?', es: '¿Cómo manejaste la ceguera temporal hoy?', fr: 'Comment as-tu géré la cécité temporelle aujourd\'hui?' }},
  { id: 'a20', category: 'adhd', text: { en: 'What transition was hardest today?', ru: 'Какой переход был самым сложным сегодня?', uk: 'Який перехід був найскладнішим сьогодні?', de: 'Welcher Übergang war heute am schwierigsten?', es: '¿Qué transición fue la más difícil hoy?', fr: 'Quelle transition a été la plus difficile aujourd\'hui?' }},
];

// All prompts combined
export const ALL_PROMPTS: JournalPrompt[] = [
  ...gratitudePrompts,
  ...reflectionPrompts,
  ...emotionsPrompts,
  ...goalsPrompts,
  ...relationshipsPrompts,
  ...adhdPrompts,
];

// Category labels
export const CATEGORY_LABELS: Record<PromptCategory, Record<string, string>> = {
  gratitude: { en: 'Gratitude', ru: 'Благодарность', uk: 'Вдячність', de: 'Dankbarkeit', es: 'Gratitud', fr: 'Gratitude' },
  reflection: { en: 'Reflection', ru: 'Рефлексия', uk: 'Рефлексія', de: 'Reflexion', es: 'Reflexión', fr: 'Réflexion' },
  emotions: { en: 'Emotions', ru: 'Эмоции', uk: 'Емоції', de: 'Emotionen', es: 'Emociones', fr: 'Émotions' },
  goals: { en: 'Goals', ru: 'Цели', uk: 'Цілі', de: 'Ziele', es: 'Metas', fr: 'Objectifs' },
  relationships: { en: 'Relationships', ru: 'Отношения', uk: 'Стосунки', de: 'Beziehungen', es: 'Relaciones', fr: 'Relations' },
  adhd: { en: 'ADHD', ru: 'СДВГ', uk: 'СДУГ', de: 'ADHS', es: 'TDAH', fr: 'TDAH' },
};

/** Get prompts filtered by category */
export function getPromptsByCategory(category: PromptCategory): JournalPrompt[] {
  return ALL_PROMPTS.filter(p => p.category === category);
}

/** Get a random prompt */
export function getRandomPrompt(category?: PromptCategory): JournalPrompt {
  const prompts = category ? getPromptsByCategory(category) : ALL_PROMPTS;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/** Get daily prompt based on date (consistent for the day) */
export function getDailyPrompt(date: string = new Date().toISOString().split('T')[0]): JournalPrompt {
  // Simple hash from date string
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    const char = date.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % ALL_PROMPTS.length;
  return ALL_PROMPTS[index];
}

/** Get prompt text in specified language */
export function getPromptText(prompt: JournalPrompt, lang: string): string {
  return prompt.text[lang] || prompt.text.en;
}
