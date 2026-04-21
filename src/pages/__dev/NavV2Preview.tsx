/**
 * NavV2Preview — Phase 3-A dev-only preview page.
 *
 * Renders the V2 navigation shell (Sidebar / MobileNav / Drawer) against the
 * four placeholder page shells inside a resizable viewport harness. Lets us
 * validate layout, paper texture, haptic/keyboard affordances, and viewport
 * transitions without flipping the cloud flag.
 *
 * Dead-code-eliminated in production via `import.meta.env.DEV` guard in the
 * route registration (not this file), so the preview never ships to users.
 */

import { useState } from "react";
import { NavV2Orchestrator } from "@/components/navigation-v2/NavV2Orchestrator";

const VIEWPORTS = [
  { label: "Mobile 375", width: 375, height: 812 },
  { label: "Mobile 414", width: 414, height: 896 },
  { label: "Tablet 768", width: 768, height: 1024 },
  { label: "Desktop 1280", width: 1280, height: 800 },
  { label: "Desktop 1920", width: 1920, height: 1080 },
] as const;

export default function NavV2Preview() {
  const [vpIndex, setVpIndex] = useState(3);
  const vp = VIEWPORTS[vpIndex];

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Nav V2 Preview</h1>
          <p className="text-sm text-muted-foreground">
            Phase 3-A infrastructure — no content migration yet
          </p>
        </div>
        <nav className="flex gap-2" aria-label="viewport presets">
          {VIEWPORTS.map((v, i) => (
            <button
              key={v.label}
              type="button"
              onClick={() => setVpIndex(i)}
              className={`rounded px-3 py-1 text-sm ${
                i === vpIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <div
        className="mx-auto overflow-hidden rounded-xl border-2 border-border shadow-2xl bg-background"
        data-testid="nav-v2-preview-frame"
        data-viewport={vp.label}
        style={
          {
            width: `${vp.width}px`,
            height: `${vp.height}px`,
            maxWidth: "100%",
          }
        }
      >
        <div className="h-full overflow-auto">
          <NavV2Orchestrator />
        </div>
      </div>

      <footer className="mt-4 text-xs text-muted-foreground font-mono">
        Viewport: {vp.width} x {vp.height} — add ?nav=v2 to the root URL to preview in real app.
      </footer>
    </div>
  );
}
