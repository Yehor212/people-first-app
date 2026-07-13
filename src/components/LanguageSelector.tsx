import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { type MouseEvent, useEffect } from "react";

import { EntryGateBackdrop } from "@/components/EntryGateBackdrop";
import { EntryThemeSwitcher } from "@/components/EntryThemeSwitcher";
import { ZenFlowBrandMark } from "@/components/ZenFlowBrandMark";
import { resetEntryGateScroll } from "@/components/entryGateScroll";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Language, languageFlags, languageNames } from "@/i18n/translations";
import { shouldAnimate } from "@/lib/animationUtils";
import { isAndroid } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

import "./EntryGate.css";

interface LanguageSelectorProps {
  onComplete: () => void;
}

const languages: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const rtlLanguages = new Set<Language>(["ar", "he"]);

const shellVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const languageListVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.1,
    },
  },
};

const languageItemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export function LanguageSelector({ onComplete }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const animated = !isAndroid && shouldAnimate();

  useEffect(() => {
    resetEntryGateScroll("language-selector-screen");
  }, []);

  const handleSelect = (lang: Language, event?: MouseEvent<HTMLButtonElement>) => {
    setLanguage(lang);
    const screen = event?.currentTarget.closest<HTMLElement>(
      "[data-testid='language-selector-screen']"
    );
    if (screen) {
      screen.scrollTop = 0;
      screen.scrollLeft = 0;
    }
    resetEntryGateScroll("language-selector-screen");
  };

  const handleContinue = () => {
    resetEntryGateScroll("language-selector-screen");
    onComplete();
  };

  return (
    <main
      className="entry-gate-screen relative isolate flex items-start justify-center overflow-x-hidden overflow-y-auto text-foreground md:items-center"
      aria-labelledby="language-selector-title"
      data-testid="language-selector-screen"
      data-entry-theme={appliedTheme}
    >
      <EntryGateBackdrop animated={animated} />

      <motion.section
        className="entry-gate-content relative z-10 flex w-full max-w-lg flex-col gap-4 md:max-w-3xl md:gap-5 lg:max-w-4xl"
        initial={animated ? "hidden" : false}
        animate="visible"
        variants={shellVariants}
        transition={{ duration: 0.34, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <header className="text-center">
          <ZenFlowBrandMark
            className="mx-auto mb-3 h-[72px] w-[72px] rounded-[1.35rem]"
            testId="zenflow-language-logo"
          />
          <h1
            id="language-selector-title"
            className="entry-gate-title mx-auto max-w-xs text-4xl font-black leading-none text-foreground sm:text-5xl md:max-w-xl md:text-6xl"
          >
            {t.welcomeTitle}
          </h1>
        </header>

        <EntryThemeSwitcher />

        <section
          className="entry-glass-panel rounded-3xl border border-border/50 p-3 shadow-2xl sm:p-3.5"
          aria-label={t.selectLanguage}
        >
          <motion.div
            className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4"
            role="radiogroup"
            aria-label={t.selectLanguage}
            variants={languageListVariants}
            initial={animated ? "hidden" : false}
            animate="visible"
          >
            {languages.map((lang) => {
              const selected = language === lang;

              return (
                <motion.button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={languageNames[lang]}
                  lang={lang}
                  dir={rtlLanguages.has(lang) ? "rtl" : "ltr"}
                  onClick={(event) => handleSelect(lang, event)}
                  className={cn(
                    "entry-action-tile btn-press min-h-14 rounded-2xl border px-3 py-2.5 text-start outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "border-primary/70 bg-primary/20 text-foreground shadow-lg"
                      : "border-border/45 bg-card/55 text-muted-foreground hover:border-primary/40 hover:bg-card/75 hover:text-foreground"
                  )}
                  variants={languageItemVariants}
                  transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                  data-testid={`language-option-${lang}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="text-xl leading-none" aria-hidden="true">
                      {languageFlags[lang]}
                    </span>
                    <span
                      className="min-w-0 flex-1 text-sm font-semibold leading-tight"
                      dir={rtlLanguages.has(lang) ? "rtl" : "ltr"}
                    >
                      {languageNames[lang]}
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </section>

        <button
          type="button"
          onClick={handleContinue}
          className="btn-press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          data-testid="language-continue"
        >
          <span>{t.continue}</span>
          <ArrowRight className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
        </button>

      </motion.section>
    </main>
  );
}
