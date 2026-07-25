import { describe, expect, it } from "vitest";

import { plural } from "@/lib/plural";
import { ar } from "@/i18n/languages/ar";
import { en } from "@/i18n/languages/en";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("offline banner localized pending counts", () => {
  it("selects complete English and Ukrainian messages for 0, 1, 2, 5, and 21", () => {
    expect([0, 1, 2, 5, 21].map((count) => plural(en, "offlineBannerPending", count, "en"))).toEqual([
      "0 changes waiting to save online",
      "1 change waiting to save online",
      "2 changes waiting to save online",
      "5 changes waiting to save online",
      "21 changes waiting to save online",
    ]);

    expect([0, 1, 2, 5, 21].map((count) => plural(uk, "offlineBannerPending", count, "uk"))).toEqual([
      "0 змін очікують збереження онлайн",
      "1 зміна очікує збереження онлайн",
      "2 зміни очікують збереження онлайн",
      "5 змін очікують збереження онлайн",
      "21 зміна очікує збереження онлайн",
    ]);
  });

  it("uses Arabic and Hebrew grammar while isolating interpolated numbers", () => {
    expect([0, 1, 2, 3, 5, 11, 21, 100].map((count) => plural(ar, "offlineBannerPending", count, "ar"))).toEqual([
      "لا توجد تغييرات بانتظار الحفظ عبر الإنترنت",
      "تغيير واحد بانتظار الحفظ عبر الإنترنت",
      "تغييران بانتظار الحفظ عبر الإنترنت",
      "\u2068٣\u2069 تغييرات بانتظار الحفظ عبر الإنترنت",
      "\u2068٥\u2069 تغييرات بانتظار الحفظ عبر الإنترنت",
      "\u2068١١\u2069 تغييرًا بانتظار الحفظ عبر الإنترنت",
      "\u2068٢١\u2069 تغييرًا بانتظار الحفظ عبر الإنترنت",
      "\u2068١٠٠\u2069 تغيير بانتظار الحفظ عبر الإنترنت",
    ]);

    expect([0, 1, 2, 5, 21].map((count) => plural(he, "offlineBannerPending", count, "he"))).toEqual([
      "\u20680\u2069 שינויים ממתינים לשמירה אונליין",
      "שינוי אחד ממתין לשמירה אונליין",
      "שני שינויים ממתינים לשמירה אונליין",
      "\u20685\u2069 שינויים ממתינים לשמירה אונליין",
      "\u206821\u2069 שינויים ממתינים לשמירה אונליין",
    ]);
  });

  it("keeps the Japanese counter in the translator-defined position", () => {
    expect([0, 1, 2, 5, 21].map((count) => plural(ja, "offlineBannerPending", count, "ja"))).toEqual([
      "オンライン保存を待っている変更は0件です",
      "オンライン保存を待っている変更は1件です",
      "オンライン保存を待っている変更は2件です",
      "オンライン保存を待っている変更は5件です",
      "オンライン保存を待っている変更は21件です",
    ]);
  });
});
