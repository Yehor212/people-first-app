import { motion } from "framer-motion";
import { ArrowRight, Check, Globe2 } from "lucide-react";
import { type MouseEvent, useEffect } from "react";

import { ZenFlowBrandMark } from "@/components/ZenFlowBrandMark";
import { resetEntryGateScroll } from "@/components/entryGateScroll";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Language, languageFlags, languageNames } from "@/i18n/translations";
import { shouldAnimate } from "@/lib/animationUtils";
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
  const animated = shouldAnimate();

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

  const handleSkip = () => {
    resetEntryGateScroll("language-selector-screen");
    onComplete();
  };

  return (
    <main
      className="entry-gate-screen relative isolate flex items-start justify-center overflow-x-hidden overflow-y-auto text-foreground"
      aria-labelledby="language-selector-title"
      data-testid="language-selector-screen"
      data-entry-theme={appliedTheme}
    >
      <div aria-hidden="true" className="entry-gate-aurora" />

      <motion.section
        className="relative z-10 flex w-full max-w-lg flex-col gap-4"
        initial={animated ? "hidden" : false}
        animate="visible"
        variants={shellVariants}
        transition={{ duration: 0.34, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <header className="text-center">
          <ZenFlowBrandMark
            className="mx-auto mb-3 h-16 w-16 rounded-2xl"
            testId="zenflow-language-logo"
          />
          <h1
            id="language-selector-title"
            className="mx-auto max-w-xs text-3xl font-bold leading-none text-foreground"
          >
            {t.welcomeTitle}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {t.welcomeSubtitle}
          </p>
        </header>

        <section
          className="entry-glass-panel rounded-3xl border border-border/50 p-3.5 shadow-2xl"
          aria-labelledby="language-selector-choice-title"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2
                id="language-selector-choice-title"
                className="text-lg font-semibold text-foreground"
              >
                {t.selectLanguage}
              </h2>
            </div>
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Globe2 className="h-5 w-5" />
            </div>
          </div>

          <motion.div
            className="grid grid-cols-2 gap-2"
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

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleContinue}
            className="btn-press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="language-continue"
          >
            <span>{t.continue}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="btn-press min-h-12 w-full rounded-full border border-border/55 bg-card/45 px-6 py-3 text-base font-medium text-muted-foreground transition-all hover:border-primary/35 hover:bg-card/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="language-skip"
          >
            {t.skip || "Skip"}
          </button>
        </div>

      </motion.section>
    </main>
  );
}
