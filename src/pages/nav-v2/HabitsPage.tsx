import { memo, useEffect, useRef } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * HabitsPage — placeholder shell for Phase 3-A. Populated in Phase 3-C (GardenTab migration).
 */
export const HabitsPage = memo(function HabitsPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  return (
    <Bloom key="habits-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12 outline-none"
        aria-labelledby="habits-page-heading"
        data-testid="habits-page"
      >
        <h1
          ref={h1Ref}
          id="habits-page-heading"
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          {tx.navV2Habits || t.habits || "Habits"}
        </h1>
        <p className="mt-3 text-muted-foreground font-body">
          {tx.navV2HabitsPlaceholder ||
            "Habits page — Phase 3-C will wire GardenTab + HabitHubTab here."}
        </p>
      </main>
    </Bloom>
  );
});
