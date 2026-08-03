import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("Mood first-run copy", () => {
  it.each([
    [en, "Choose when you felt this way: now, at a specific time, or all day"],
    [uk, "Обери, коли ти так почувався: зараз, у певний час або весь день"],
    [es, "Elige cuándo te sentías así: ahora, a una hora concreta o durante todo el día"],
    [de, "Wähle, wann du dich so gefühlt hast: jetzt, zu einer bestimmten Zeit oder den ganzen Tag"],
    [fr, "Choisis le moment concerné : maintenant, une heure précise ou toute la journée"],
    [ja, "いつの気分かを選ぶ（今、特定の時刻、または一日全体）"],
    [ar, "اختر متى شعرت بهذا: الآن، في وقت محدد، أو طوال اليوم"],
    [he, "בחר מתי הרגשת כך: עכשיו, בשעה מסוימת או במשך כל היום"],
  ])("describes the actual time choice without internal scope jargon", (translations, expected) => {
    expect(translations.orbFirstRunStep2).toBe(expected);
  });

  it.each([
    [en, "Add an emotion or note if you want, then save your mood and start today's entry"],
    [uk, "За бажанням додай емоцію або нотатку, а потім збережи настрій і почни сьогоднішній запис"],
    [es, "Si quieres, añade una emoción o una nota; luego guarda tu estado de ánimo y empieza la entrada de hoy"],
    [de, "Füge bei Bedarf eine Emotion oder Notiz hinzu, speichere dann deine Stimmung und starte den heutigen Eintrag"],
    [fr, "Si tu veux, ajoute une émotion ou une note, puis enregistre ton humeur et commence l’entrée du jour"],
    [ja, "必要なら感情やメモを追加して、気分を保存し、今日の記録を始める"],
    [ar, "أضف شعورًا أو ملاحظة إن شئت، ثم احفظ مزاجك وابدأ مدخل اليوم"],
    [he, "אפשר להוסיף רגש או הערה, ואז לשמור את מצב הרוח ולהתחיל את הרשומה להיום"],
  ])("keeps optional details optional and names the real next action", (translations, expected) => {
    expect(translations.orbFirstRunStep3).toBe(expected);
  });

  it.each([
    [en, "Save mood and start today's entry"],
    [uk, "Зберегти настрій і почати сьогоднішній запис"],
    [es, "Guardar el estado de ánimo y empezar la entrada de hoy"],
    [de, "Stimmung speichern und heutigen Eintrag starten"],
    [fr, "Enregistrer l’humeur et commencer l’entrée du jour"],
    [ja, "気分を保存して今日の記録を始める"],
    [ar, "حفظ المزاج وبدء مدخل اليوم"],
    [he, "לשמור את מצב הרוח ולהתחיל רשומה להיום"],
  ])("names both effects of the mood-to-journal action", (translations, expected) => {
    expect(translations.orbSaveMoodAndStartEntry).toBe(expected);
  });
});
