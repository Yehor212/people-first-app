import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { uiPreviewFixtureBoundary } from "./fixtures";
import { uiPreviewRegistry, type UiPreviewTheme } from "./registry";
import { PreviewControl } from "./UiPreviewControl";
import { FoundationSample } from "./UiPreviewFoundations";

const rtlLocales = new Set(["ar", "he"]);

function previewWidthClass(width: number): string {
  if (width === 380) return "max-w-[380px]";
  if (width === 340) return "max-w-[340px]";
  return "max-w-[320px]";
}

interface UiSystemPreviewProps {
  activeTheme: UiPreviewTheme;
  reducedMotion: boolean;
}

export function UiSystemPreview({ activeTheme, reducedMotion }: UiSystemPreviewProps) {
  const [selectionByCase, setSelectionByCase] = useState<Record<string, boolean>>({});
  const [lastAction, setLastAction] = useState<string | null>(null);
  const visibleCases = uiPreviewRegistry.cases.filter((previewCase) => {
    if (previewCase.state === "high-contrast") return activeTheme === "high-contrast";
    if (previewCase.state === "reduced-motion") return reducedMotion;
    return true;
  });

  const handleSelectionChange = (id: string, checked: boolean) => {
    setSelectionByCase((current) => ({ ...current, [id]: checked }));
    setLastAction(id);
  };

  return (
    <main
      data-testid="ui-system-preview"
      data-fixture-boundary={uiPreviewRegistry.fixtureSentinel}
      className="min-h-dvh w-full max-w-full overflow-x-clip bg-background px-3 py-6 text-foreground sm:px-6"
      aria-labelledby="ui-system-preview-title"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header id="preview-boundary" className="grid min-w-0 gap-2">
          <Badge variant="outline" className="w-fit max-w-full">
            Development/test only
          </Badge>
          <h1
            id="ui-system-preview-title"
            className="text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl"
          >
            ZenFlow UI-system preview
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground [overflow-wrap:anywhere] sm:text-base">
            Isolated evidence for shared component semantics, theme tokens, compact reflow, RTL,
            contrast, and reduced motion. It does not load application state or user records.
          </p>
          {lastAction && (
            <p role="status" className="text-sm text-muted-foreground">
              Local preview interaction: {lastAction}
            </p>
          )}
        </header>

        <section aria-labelledby="ui-system-foundations-title" className="grid min-w-0 gap-3">
          <div className="grid gap-1">
            <h2 id="ui-system-foundations-title" className="text-xl font-semibold">
              Foundations
            </h2>
            <p className="text-sm text-muted-foreground">
              Runtime token evidence from the current ZenFlow stylesheets.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {uiPreviewRegistry.foundations.map((foundation) => (
              <Card
                key={foundation.id}
                data-preview-foundation={foundation.id}
                data-preview-token-references={foundation.tokenReferences.join(" ")}
                elevation="flat"
                className="grid min-w-0 content-start gap-3 border border-border bg-card p-4 text-card-foreground"
              >
                <h3 className="font-semibold">{foundation.label}</h3>
                <FoundationSample id={foundation.id} />
                <code className="break-words text-xs text-muted-foreground">
                  {foundation.tokenReferences.join(" · ")}
                </code>
              </Card>
            ))}
          </div>
        </section>

        <section
          aria-label="Registered UI-system cases"
          className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2"
        >
          {visibleCases.map((previewCase) => {
            const isRtl = rtlLocales.has(previewCase.locale);
            return (
              <Card
                key={previewCase.id}
                data-preview-case
                data-preview-id={previewCase.id}
                data-preview-component={previewCase.component}
                data-preview-state={previewCase.state}
                data-preview-theme={activeTheme}
                data-preview-locale={previewCase.locale}
                data-preview-width={previewCase.width}
                data-preview-input={previewCase.input}
                data-preview-reduced-motion={reducedMotion || previewCase.reducedMotion}
                data-preview-source={previewCase.source}
                data-preview-evidence-kind={previewCase.evidenceKind}
                data-preview-state-mechanism={previewCase.stateMechanism}
                dir={isRtl ? "rtl" : "ltr"}
                lang={previewCase.locale}
                elevation="flat"
                className={`grid w-full min-w-0 ${previewWidthClass(previewCase.width)} gap-4 overflow-visible border border-border bg-card p-4 text-card-foreground [overflow-wrap:anywhere]`}
              >
                <div
                  dir="ltr"
                  className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs"
                >
                  <span className="rounded-full border border-current/30 px-2 py-1">
                    {previewCase.component}
                  </span>
                  <span className="rounded-full border border-current/30 px-2 py-1">
                    {previewCase.state}
                  </span>
                  <span className="opacity-70">
                    {activeTheme} · {previewCase.locale} · {previewCase.input} ·{" "}
                    {previewCase.stateMechanism}
                  </span>
                </div>
                <PreviewControl
                  previewCase={previewCase}
                  onAction={setLastAction}
                  selectionValue={
                    selectionByCase[previewCase.id] ??
                    uiPreviewFixtureBoundary.switchInitiallyChecked
                  }
                  onSelectionChange={handleSelectionChange}
                />
              </Card>
            );
          })}
        </section>

        <div hidden aria-hidden="true">
          {uiPreviewRegistry.notApplicable.map((entry) => (
            <span
              key={`${entry.component}-${entry.state}`}
              data-preview-na
              data-preview-component={entry.component}
              data-preview-state={entry.state}
              data-preview-na-reason={entry.reason}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export default UiSystemPreview;
