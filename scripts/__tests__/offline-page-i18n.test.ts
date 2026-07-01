import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline page i18n shell", () => {
  it("keeps localized offline copy valid UTF-8 for every supported language", () => {
    const html = readFileSync("public/offline.html", "utf8");

    for (const expected of [
      "Ви офлайн",
      "Estás sin conexión",
      "Vous êtes hors ligne",
      "オフライン",
      "أنت غير متصل",
      "את/ה אופליין",
    ]) {
      expect(html).toContain(expected);
    }

    for (const mojibake of ["Р’", "Гі", "г‚", "ШЈ", "Чђ"]) {
      expect(html).not.toContain(mojibake);
    }
  });
});
