import { memo, useEffect, useRef } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * DiaryPage — placeholder shell for Phase 3-A. Populated in Phase 3-D (JournalModule migration).
 */
export const DiaryPage = memo(function DiaryPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  return (
    <Bloom key="diary-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12 outline-none"
        aria-labelledby="diary-page-heading"
        data-testid="diary-page"
      >
        <h1
          ref={h1Ref}
          id="diary-page-heading"
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          {tx.navV2Diary || t.diary || "Diary"}
        </h1>
        <p className="mt-3 text-muted-foreground font-body">
          {tx.navV2DiaryPlaceholder ||
            "Diary page — Phase 3-D will wire the JournalModule experience here."}
        </p>
      </main>
    </Bloom>
  );
});
