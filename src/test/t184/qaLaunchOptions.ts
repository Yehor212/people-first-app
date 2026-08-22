const LANGUAGES = new Set(["en", "uk", "es", "de", "fr", "ja", "ar", "he"]);
const ROUTES = new Set(["orb", "habits", "diary", "planning", "settings"]);

export function parseT184QaLaunchOptions(search: string) {
  const params = new URLSearchParams(search);
  const language = params.get("qaLang") ?? "en";
  const route = params.get("qaRoute") ?? "orb";
  return {
    language: LANGUAGES.has(language) ? language : "en",
    route: ROUTES.has(route) ? route : "orb",
    auth: params.get("qaAuth") === "1",
  };
}
