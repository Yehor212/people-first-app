import { motion } from "framer-motion";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

import { EntryGateBackdrop } from "@/components/EntryGateBackdrop";
import { EntryThemeSwitcher } from "@/components/EntryThemeSwitcher";
import { ZenFlowBrandMark } from "@/components/ZenFlowBrandMark";
import { resetEntryGateScroll } from "@/components/entryGateScroll";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Language, languageFlags, languageNames } from "@/i18n/translations";
import { shouldAnimate } from "@/lib/animationUtils";
import { isAndroid } from "@/lib/platform";
import { handleRadioGroupKeyDown } from "@/lib/radioGroupKeyboard";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

import "./EntryGate.css";

interface LanguageSelectorProps {
  onComplete: () => void;
}

const languages: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const rtlLanguages = new Set<Language>(["ar", "he"]);
const ENTRY_LANGUAGE_TWO_COLUMN_MAX_FONT_SIZE_PX = 20;

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
  const {
    language,
    setLanguage,
    t,
    pendingLanguage,
    languageLoadError,
    languageSaveError,
    retryLanguage,
  } = useLanguage();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const animated = !isAndroid && shouldAnimate();
  const languageGridRef = useRef<HTMLDivElement>(null);
  const [languageGridLayout, setLanguageGridLayout] = useState<"auto" | "single-column">(
    "auto"
  );

  useEffect(() => {
    resetEntryGateScroll("language-selector-screen");
  }, []);

  useLayoutEffect(() => {
    const grid = languageGridRef.current;
    const label = grid?.querySelector<HTMLElement>("[data-entry-language-label]");
    if (!grid || !label) return;

    const updateLayout = () => {
      const fontSize = Number.parseFloat(window.getComputedStyle(label).fontSize);
      setLanguageGridLayout(
        Number.isFinite(fontSize) && fontSize > ENTRY_LANGUAGE_TWO_COLUMN_MAX_FONT_SIZE_PX
          ? "single-column"
          : "auto"
      );
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("resize", updateLayout);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateLayout);
    resizeObserver?.observe(label);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("resize", updateLayout);
      resizeObserver?.disconnect();
    };
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
            className="entry-gate-title mx-auto min-w-0 max-w-xs whitespace-normal text-2xl font-black leading-tight text-foreground [hyphens:manual] [overflow-wrap:normal] min-[390px]:text-3xl sm:text-display-5xl md:max-w-xl md:text-display-6xl"
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
            ref={languageGridRef}
            className={cn(
              "grid gap-2 sm:gap-3",
              languageGridLayout === "single-column"
                ? "grid-cols-1"
                : "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))]"
            )}
            role="radiogroup"
            aria-label={t.selectLanguage}
            aria-busy={Boolean(pendingLanguage)}
            data-language-grid-layout={languageGridLayout}
            variants={languageListVariants}
            initial={animated ? "hidden" : false}
            animate="visible"
          >
            {languages.map((lang, index) => {
              const selected = (pendingLanguage ?? language) === lang;

              return (
                <motion.button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={languageNames[lang]}
                  lang={lang}
                  dir={rtlLanguages.has(lang) ? "rtl" : "ltr"}
                  tabIndex={selected ? 0 : -1}
                  onClick={(event) => handleSelect(lang, event)}
                  onKeyDown={(event) =>
                    handleRadioGroupKeyDown(event, index, languages.length, (nextIndex) => {
                      const nextLanguage = languages[nextIndex];
                      if (nextLanguage) setLanguage(nextLanguage);
                    })
                  }
                  className={cn(
                    "entry-action-tile btn-press h-auto min-h-14 min-w-0 whitespace-normal break-normal rounded-2xl border px-3 py-2.5 text-start [hyphens:none] outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "border-primary/70 bg-primary/20 text-foreground shadow-lg"
                      : "border-border/45 bg-card/55 text-muted-foreground hover:border-primary/40 hover:bg-card/75 hover:text-foreground"
                  )}
                  variants={languageItemVariants}
                  transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                  data-testid={`language-option-${lang}`}
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span className="shrink-0 text-xl leading-none" aria-hidden="true">
                      {languageFlags[lang]}
                    </span>
                    <span
                      className="min-w-0 flex-1 break-normal text-sm font-semibold leading-tight [hyphens:none]"
                      dir={rtlLanguages.has(lang) ? "rtl" : "ltr"}
                      data-entry-language-label
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

        {pendingLanguage ? (
          <p role="status" aria-live="polite" className="break-words text-center text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
            {t.languageApplying}
          </p>
        ) : null}

        {languageLoadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          >
            <p className="break-words [hyphens:manual] [overflow-wrap:break-word]">{t.languageLoadFailed}</p>
            <button
              type="button"
              onClick={retryLanguage}
              className="mx-auto mt-2 inline-flex h-auto min-h-[44px] min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-full border border-destructive/30 px-4 py-2 font-semibold [hyphens:manual] [overflow-wrap:break-word] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{t.tryAgain}</span>
            </button>
          </div>
        ) : null}

        {languageSaveError ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          >
            <p className="break-words [hyphens:manual] [overflow-wrap:break-word]">{t.languageSaveFailed}</p>
            <button
              type="button"
              onClick={retryLanguage}
              className="mx-auto mt-2 inline-flex h-auto min-h-[44px] min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-full border border-destructive/30 px-4 py-2 font-semibold [hyphens:manual] [overflow-wrap:break-word] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{t.tryAgain}</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={Boolean(pendingLanguage || languageLoadError)}
          className="btn-press flex h-auto min-h-12 w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg [hyphens:manual] [overflow-wrap:break-word] transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55"
          data-testid="language-continue"
        >
          <span>{t.continue}</span>
          <ArrowRight className="h-4 w-4 shrink-0 rtl:scale-x-[-1]" aria-hidden="true" />
        </button>

      </motion.section>
    </main>
  );
}
