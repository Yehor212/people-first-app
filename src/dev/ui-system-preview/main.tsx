import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../../index.css";
import UiSystemPreview from "./UiSystemPreview";

if (import.meta.env.DEV) {
  const requestedTheme = new URLSearchParams(window.location.search).get("theme");
  const activeTheme =
    requestedTheme === "ink" || requestedTheme === "oled" || requestedTheme === "high-contrast"
      ? requestedTheme
      : "paper";
  const rootTheme = activeTheme === "high-contrast" ? "paper" : activeTheme;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.dataset.theme = rootTheme;
  if (activeTheme === "high-contrast") {
    document.documentElement.dataset.themeContrast = "high";
  } else {
    delete document.documentElement.dataset.themeContrast;
  }
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";

  const rootElement = document.getElementById("ui-preview-root");
  if (!rootElement) {
    throw new Error("ZenFlow UI preview root is missing.");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <UiSystemPreview activeTheme={activeTheme} reducedMotion={reducedMotion} />
    </StrictMode>
  );
}
