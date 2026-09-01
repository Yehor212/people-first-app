import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline page i18n shell", () => {
  it("keeps localized offline copy valid UTF-8 for every supported language", () => {
    const html = readFileSync("public/offline.html", "utf8");
    const docsHtml = readFileSync("docs/offline.html", "utf8");

    expect(docsHtml).toBe(html);

    for (const expected of [
      "Немає з’єднання",
      "Estás sin conexión",
      "Vous êtes hors ligne",
      "オフライン",
      "أنت غير متصل",
      "אין חיבור",
    ]) {
      expect(html).toContain(expected);
    }

    for (const mojibake of ["Р’", "Гі", "г‚", "ШЈ", "Чђ"]) {
      expect(html).not.toContain(mojibake);
    }

    expect(html).toContain("JSON.parse(stored)");
    expect(html).toContain("document.title = msgs.pageTitle");
    expect(html).toContain("lang === 'ar' || lang === 'he' ? 'rtl' : 'ltr'");
    expect(html).not.toContain("All your data is saved locally");
    expect(html).not.toContain("كل بياناتك");
  });
});
