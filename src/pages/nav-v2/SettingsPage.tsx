import { memo, useEffect, useRef } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * SettingsPage — placeholder shell for Phase 3-A. Populated in Phase 3-E (SettingsTab migration).
 */
export const SettingsPage = memo(function SettingsPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  return (
    <Bloom key="settings-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12 outline-none"
        aria-labelledby="settings-page-heading"
        data-testid="settings-page"
      >
        <h1
          ref={h1Ref}
          id="settings-page-heading"
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight outline-none"
        >
          {tx.navV2Settings || t.settings || "Settings"}
        </h1>
        <p className="mt-3 text-muted-foreground font-body">
          {tx.navV2SettingsPlaceholder ||
            "Settings page — Phase 3-E will wire SettingsTab here."}
        </p>
      </main>
    </Bloom>
  );
});
