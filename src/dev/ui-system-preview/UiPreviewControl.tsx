import { CircleOff, LoaderCircle, RefreshCw, Save, Settings2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  ActionButton,
  PanelFrame,
  SettingsChoiceButton,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "@/pages/nav-v2/settings/components/V2SettingsControlPrimitives";

import { uiPreviewFixtureBoundary, uiPreviewFixtureCopy } from "./fixtures";
import type { RegisteredUiPreviewCase } from "./registry";
import { statusContent } from "./UiPreviewStatus";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

interface PreviewControlProps {
  previewCase: RegisteredUiPreviewCase;
  onAction: (id: string) => void;
  selectionValue: boolean;
  onSelectionChange: (id: string, checked: boolean) => void;
}

export function PreviewControl({
  previewCase,
  onAction,
  selectionValue,
  onSelectionChange,
}: PreviewControlProps) {
  const copy = uiPreviewFixtureCopy[previewCase.locale];
  const isDisabled = previewCase.state === "disabled";
  const isLoading = previewCase.state === "loading";
  const isCanonicalDefault = previewCase.state === "default" && previewCase.locale === "en";

  switch (previewCase.component) {
    case "BUTTON":
      return (
        <Button
          type="button"
          variant={previewCase.state === "destructive" ? "destructive" : "default"}
          disabled={isDisabled || isLoading}
          aria-busy={isLoading || undefined}
          onClick={() => onAction(previewCase.id)}
        >
          {isLoading ? (
            <LoaderCircle
              aria-hidden
              className={classes(
                "size-4",
                previewCase.reducedMotion ? "" : "motion-safe:animate-spin"
              )}
            />
          ) : previewCase.state === "destructive" ? (
            <CircleOff aria-hidden className="size-4" />
          ) : (
            <Save aria-hidden className="size-4" />
          )}
          <span>
            {previewCase.state === "destructive"
              ? copy.clearPreviewState
              : isCanonicalDefault || previewCase.locale !== "en"
                ? copy.saveAppearance
                : `Preview action state: ${previewCase.state}`}
          </span>
        </Button>
      );

    case "ICON_BUTTON":
      return (
        <Button
          type="button"
          size="icon"
          variant={previewCase.state === "destructive" ? "destructive" : "outline"}
          disabled={isDisabled || isLoading}
          aria-busy={isLoading || undefined}
          aria-label={
            isCanonicalDefault || previewCase.locale !== "en"
              ? copy.openDisplayOptions
              : `Inspect icon-button state: ${previewCase.state}`
          }
          onClick={() => onAction(previewCase.id)}
        >
          {isLoading ? (
            <LoaderCircle
              aria-hidden
              className={classes(
                "size-4",
                previewCase.reducedMotion ? "" : "motion-safe:animate-spin"
              )}
            />
          ) : (
            <Settings2 aria-hidden className="size-4" />
          )}
        </Button>
      );

    case "LINK":
      return (
        <a
          href="#preview-boundary"
          className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 rounded-xl px-3 py-2 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [overflow-wrap:anywhere]"
        >
          <ShieldCheck aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {previewCase.state === "long-content"
              ? `${copy.reviewPrivacySettings} — ${copy.accountPreferencesDetail}`
              : isCanonicalDefault || previewCase.locale !== "en"
                ? copy.reviewPrivacySettings
                : `Inspect privacy-link state: ${previewCase.state}`}
          </span>
        </a>
      );

    case "FIELD": {
      const helpId = `${previewCase.id}-help`;
      const isError = previewCase.state === "error";
      const isSuccess = previewCase.state === "success";
      const isWarning = previewCase.state === "warning";
      return (
        <label className="grid min-w-0 gap-2 font-medium">
          <span className="text-sm">{copy.displayName}</span>
          <Input
            type="text"
            defaultValue={uiPreviewFixtureBoundary.displayNameValue}
            aria-label={
              isCanonicalDefault || previewCase.locale !== "en"
                ? copy.displayName
                : `Inspect display-name field state: ${previewCase.state}`
            }
            aria-describedby={helpId}
            aria-invalid={isError || undefined}
            aria-busy={isLoading || undefined}
            disabled={isDisabled || isLoading}
            variant={isError ? "error" : isSuccess ? "success" : "default"}
            placeholder={
              previewCase.state === "long-content"
                ? copy.accountPreferencesDetail
                : copy.displayNameHint
            }
            className={classes(
              isWarning && "border-[hsl(var(--zf-warning))]",
              previewCase.state === "rtl" && "text-right"
            )}
          />
          <span
            id={helpId}
            className={classes(
              "text-sm [overflow-wrap:anywhere]",
              isError ? "text-destructive" : "opacity-80"
            )}
          >
            {isError ? copy.recoveryNotice : copy.displayNameHint}
          </span>
        </label>
      );
    }

    case "SELECTION_CONTROL": {
      const checked =
        previewCase.state === "checked" || previewCase.state === "selected" || selectionValue;
      return (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{copy.reduceMotion}</span>
          <Switch
            aria-label={
              isCanonicalDefault || previewCase.locale !== "en"
                ? copy.reduceMotion
                : `Inspect motion selection state: ${previewCase.state}`
            }
            checked={checked}
            disabled={isDisabled}
            onCheckedChange={(nextChecked) => onSelectionChange(previewCase.id, nextChecked)}
          />
        </div>
      );
    }

    case "STATUS": {
      const status = statusContent(previewCase);
      return (
        <SettingsStatus
          tone={previewCase.state === "error" ? "danger" : "muted"}
          ariaLabel={status.message}
        >
          <span className="flex min-w-0 items-start gap-3 [overflow-wrap:anywhere]">
            <span className="mt-0.5 shrink-0">{status.icon}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{status.message}</span>
          </span>
        </SettingsStatus>
      );
    }

    case "SETTINGS_ROW": {
      const status = statusContent(previewCase);
      const showInteractiveRow = [
        "default",
        "hover",
        "focus-visible",
        "pressed",
        "selected",
        "disabled",
        "loading",
        "destructive",
      ].includes(previewCase.state);
      const showCallout = [
        "loading",
        "warning",
        "error",
        "destructive",
        "offline",
        "permission-blocked",
        "pending-sync",
        "recovery",
      ].includes(previewCase.state);

      return (
        <div
          role="group"
          aria-label={
            isCanonicalDefault || previewCase.locale !== "en"
              ? copy.accountPreferences
              : `Inspect settings-row state: ${previewCase.state}`
          }
          className="min-w-0"
        >
          <PanelFrame
            icon={Settings2}
            title={copy.accountPreferences}
            description={
              previewCase.state === "long-content"
                ? copy.accountPreferencesDetail
                : copy.displayNameHint
            }
            testId={`preview-panel-${previewCase.id}`}
          >
            <ToggleRow
              icon={Settings2}
              title={copy.accountPreferences}
              description={
                previewCase.state === "long-content"
                  ? copy.accountPreferencesDetail
                  : copy.displayNameHint
              }
              checked={previewCase.state === "selected"}
              onCheckedChange={(nextChecked) => onSelectionChange(previewCase.id, nextChecked)}
              disabled={isDisabled}
              testId={`preview-${previewCase.id}`}
              surfaceWeight="quiet"
            />
            {showInteractiveRow ? (
              <div
                className="grid min-w-0 gap-2 p-2 min-[360px]:p-3 min-[520px]:grid-cols-2"
                data-containment="row"
                data-slot="settings-row-actions"
              >
                <SettingsChoiceButton
                  selected={previewCase.state === "selected"}
                  selectedTone={previewCase.state === "destructive" ? "danger" : "subtle"}
                  disabled={isDisabled || isLoading}
                  onClick={() => onSelectionChange(previewCase.id, true)}
                  testId={`preview-choice-${previewCase.id}`}
                >
                  {copy.reduceMotion}
                </SettingsChoiceButton>
                <ActionButton
                  icon={previewCase.state === "destructive" ? CircleOff : Save}
                  variant={previewCase.state === "destructive" ? "danger" : "secondary"}
                  disabled={isDisabled}
                  isLoading={isLoading}
                  onClick={() => onAction(previewCase.id)}
                  testId={`preview-action-${previewCase.id}`}
                >
                  {previewCase.state === "destructive"
                    ? copy.clearPreviewState
                    : copy.saveAppearance}
                </ActionButton>
              </div>
            ) : null}
            {showCallout ? (
              <SettingsInset
                emphasis="callout"
                tone={
                  previewCase.state === "error" || previewCase.state === "destructive"
                    ? "danger"
                    : "neutral"
                }
                testId={`preview-callout-${previewCase.id}`}
              >
                <SettingsStatus
                  tone={
                    previewCase.state === "error" || previewCase.state === "destructive"
                      ? "danger"
                      : "muted"
                  }
                  ariaLabel={status.message}
                >
                  <span className="flex min-w-0 items-start gap-3 [overflow-wrap:anywhere]">
                    <span className="mt-0.5 shrink-0">{status.icon}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{status.message}</span>
                  </span>
                </SettingsStatus>
              </SettingsInset>
            ) : null}
          </PanelFrame>
        </div>
      );
    }

    case "EMPTY_ERROR_OFFLINE": {
      const status = statusContent(previewCase);
      const showRecovery =
        previewCase.state === "error" ||
        previewCase.state === "offline" ||
        previewCase.state === "permission-blocked" ||
        previewCase.state === "recovery";
      return (
        <section
          aria-labelledby={`${previewCase.id}-title`}
          className="grid min-w-0 justify-items-start gap-3 rounded-xl border border-dashed border-current/40 p-4 [overflow-wrap:anywhere]"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
            {status.icon}
          </span>
          <h3 id={`${previewCase.id}-title`} className="font-semibold [overflow-wrap:anywhere]">
            {copy.accountPreferences}
          </h3>
          <p className="max-w-full text-sm opacity-80 [overflow-wrap:anywhere]">{status.message}</p>
          {isLoading && (
            <Progress aria-label={copy.boundaryNotice} value={64} className="max-w-full" />
          )}
          {showRecovery && (
            <Button type="button" variant="outline" onClick={() => onAction(previewCase.id)}>
              <RefreshCw aria-hidden className="size-4" />
              <span>{copy.retryPreviewState}</span>
            </Button>
          )}
        </section>
      );
    }
  }
}
