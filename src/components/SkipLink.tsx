/**
 * Skip Link Component
 *
 * Accessibility feature that allows keyboard users to skip
 * navigation and jump directly to main content.
 *
 * Hidden by default, visible only when focused via Tab key.
 */

import { useLanguage } from "@/contexts/LanguageContext";

export function SkipLink() {
  const { t } = useLanguage();

  return (
    <a
      href="#main-content"
      className="
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:start-4
        focus:z-[1000]
        focus:bg-primary
        focus:text-primary-foreground
        focus:px-4
        focus:py-2
        focus:rounded-lg
        focus:outline-none
        focus:ring-2
        focus:ring-ring
        focus:ring-offset-2
      "
    >
      {t.skipToContent || "Skip to main content"}
    </a>
  );
}
