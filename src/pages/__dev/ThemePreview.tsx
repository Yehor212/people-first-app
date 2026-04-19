/**
 * ThemePreview — Phase 0-C dev-only preview page
 *
 * Renders all three new themes (paper / ink / oled) side-by-side with sample
 * typography, surfaces, buttons. Gated by `import.meta.env.DEV` so it
 * dead-code-eliminates in production.
 *
 * All per-theme styling goes through Tailwind arbitrary values referencing
 * --color-theme-{paper,ink,oled}-* CSS vars — zero inline `style={}` to keep
 * the inlineStyles ratchet floor intact.
 *
 * Phase 2 will wire theme selection into the Settings Panel with full i18n.
 */

import { useThemeStore, type AppliedTheme } from '@/stores/themeStore';
import './ThemePreview.css';

const THEMES: readonly AppliedTheme[] = ['paper', 'ink', 'oled'];

interface ThemedSampleProps {
  theme: AppliedTheme;
}

/** Sample block — uses a CSS class tagged with data-preview={theme} so the
 *  sibling CSS file can target each variant without inline styles. */
function ThemedSample({ theme }: ThemedSampleProps) {
  return (
    <div
      data-preview={theme}
      className="theme-preview-sample flex-1 min-w-[320px] rounded-2xl p-6 border shadow-sm"
    >
      <header className="mb-4">
        <h2 className="theme-preview-display text-3xl leading-tight mb-1 font-display">
          The {theme} theme
        </h2>
        <p className="theme-preview-muted text-sm">Phase 0-C preview surface</p>
      </header>

      <article className="theme-preview-body mb-6">
        <p className="mb-3">
          Body paragraph in Inter Variable. The editorial-natural palette favors
          legible, unhurried reading — the primary user journey is not fast
          scanning but slow unfolding. Adequate line-height and warm neutrals
          keep fatigue down across long sessions.
        </p>
        <p className="theme-preview-hand font-hand text-xl">
          And a handwritten note for sacred moments.
        </p>
      </article>

      <div className="theme-preview-card rounded-xl p-4 mb-4 border">
        <p className="text-sm mb-2">Elevated card surface</p>
        <button type="button" className="theme-preview-btn px-4 py-2 rounded-lg font-medium">
          Primary action
        </button>
      </div>

      <dl className="theme-preview-muted grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
        <dt>theme</dt>
        <dd>{theme}</dd>
        <dt>surface</dt>
        <dd>oklch L=base</dd>
        <dt>contrast AAA</dt>
        <dd>ok</dd>
      </dl>
    </div>
  );
}

export default function ThemePreview() {
  const theme = useThemeStore((s) => s.theme);
  const applied = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="min-h-screen p-8 bg-background">
      <header className="mb-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-display mb-2">ZenFlow Theme Preview</h1>
        <p className="text-muted-foreground mb-4">
          Phase 0-C — Paper Theme Core. Preview-only; not shipped to users.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">
            Live theme (writes data-theme to &lt;html&gt;):
          </span>
          {(['paper', 'ink', 'oled', 'auto'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-3 py-1.5 text-sm rounded-lg border motion-safe:transition-colors ${
                theme === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="text-xs font-mono text-muted-foreground ml-2">
            applied: <strong>{applied}</strong>
          </span>
        </div>
      </header>

      <section className="flex gap-4 flex-wrap max-w-[1200px] mx-auto">
        {THEMES.map((t) => (
          <ThemedSample key={t} theme={t} />
        ))}
      </section>

      <footer className="max-w-4xl mx-auto mt-8 text-sm text-muted-foreground">
        <p className="mb-2">
          Each sample uses <code>data-preview</code> attribute + sibling CSS
          file to avoid inline styles (ratchet discipline).
        </p>
        <p>
          Use the buttons above to actually set <code>data-theme</code> on{' '}
          <code>&lt;html&gt;</code> and see the paper noise + vignette effects.
        </p>
      </footer>
    </div>
  );
}
