import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function LanguageSelectorReflowFixture() {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  return <LanguageSelector onComplete={() => undefined} />;
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <LanguageSelectorReflowFixture />
  </LanguageProvider>,
);
