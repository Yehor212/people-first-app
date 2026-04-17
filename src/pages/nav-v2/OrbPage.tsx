import { memo, useEffect, useRef } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * OrbPage — placeholder shell for Phase 3-A.
 *
 * Content migration (HomeTab -> OrbPage) happens in Phase 3-B. This shell exists
 * so the V2 navigation can route to it while V1 HomeTab remains the default.
 */
export const OrbPage = memo(function OrbPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  // Move focus to heading on mount so screen readers announce route change.
  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  return (
    <Bloom key="orb-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12 outline-none"
        aria-labelledby="orb-page-heading"
        data-testid="orb-page"
      >
        <h1
          ref={h1Ref}
          id="orb-page-heading"
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          {tx.navV2Orb || "Orb"}
        </h1>
        <p className="mt-3 text-muted-foreground font-body">
          {tx.navV2OrbPlaceholder ||
            "Orb page — Phase 3-B will wire the HomeTab experience here."}
        </p>
      </main>
    </Bloom>
  );
});
