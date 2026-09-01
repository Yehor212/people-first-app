import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { uiPreviewRegistry } from "./registry";

type FoundationId = (typeof uiPreviewRegistry.foundations)[number]["id"];

const colorSamples = [
  { label: "Background", className: "bg-background text-foreground" },
  { label: "Primary", className: "bg-primary text-primary-foreground" },
  { label: "Destructive", className: "bg-destructive text-destructive-foreground" },
] as const;

const spacingSamples = [
  {
    token: "--v2-phone-drawer-inset",
    className: "w-[var(--v2-phone-drawer-inset)]",
  },
  {
    token: "--v2-phone-content-inline-end",
    className: "w-[var(--v2-phone-content-inline-end)]",
  },
  {
    token: "--v2-phone-content-block-end",
    className: "w-[var(--v2-phone-content-block-end)]",
  },
  {
    token: "--v2-phone-drawer-size",
    className: "w-[var(--v2-phone-drawer-size)]",
  },
] as const;

const radiusSamples = [
  { token: "--radius-xs", className: "rounded-[var(--radius-xs)]" },
  { token: "--radius-sm", className: "rounded-[var(--radius-sm)]" },
  { token: "--radius-md", className: "rounded-[var(--radius-md)]" },
  { token: "--radius-lg", className: "rounded-[var(--radius-lg)]" },
] as const;

const elevationSamples = [
  { token: "--zen-shadow-xs", className: "zen-shadow-xs" },
  { token: "--zen-shadow-sm", className: "zen-shadow-sm" },
  { token: "--zen-shadow-md", className: "zen-shadow-md" },
] as const;

const motionSamples = [
  {
    label: "Fast",
    token: "--duration-fast",
    className: "[transition-duration:var(--duration-fast)]",
  },
  {
    label: "Normal",
    token: "--duration-normal",
    className: "[transition-duration:var(--duration-normal)]",
  },
  {
    label: "Slow",
    token: "--duration-slow",
    className: "[transition-duration:var(--duration-slow)]",
  },
] as const;

export function FoundationSample({ id }: { id: FoundationId }) {
  switch (id) {
    case "color-roles":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {colorSamples.map(({ label, className }) => (
            <span
              key={label}
              className={`flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-border px-2 text-center text-xs ${className}`}
            >
              {label}
            </span>
          ))}
        </div>
      );

    case "typography-roles":
      return (
        <div className="grid gap-2">
          <span className="[font-family:var(--typography-family-display)] text-[length:var(--typography-scale-xl)]">
            Display role
          </span>
          <span className="[font-family:var(--typography-family-body)] text-[length:var(--typography-scale-base)]">
            Body role
          </span>
          <span className="[font-family:var(--typography-family-body)] text-[length:var(--typography-scale-sm)]">
            Supporting role
          </span>
        </div>
      );

    case "spacing-scale":
      return (
        <div className="grid justify-items-start gap-2" aria-label="Runtime layout spacing anchors">
          {spacingSamples.map(({ token, className }) => (
            <span
              key={token}
              data-preview-space-step={token}
              className={`block h-3 rounded-full bg-primary ${className}`}
              title={token}
            />
          ))}
        </div>
      );

    case "radius-scale":
      return (
        <div className="flex flex-wrap gap-2">
          {radiusSamples.map(({ token, className }) => (
            <span
              key={token}
              data-preview-radius-sample={token}
              className={`size-11 border border-border bg-muted ${className}`}
              title={token}
            />
          ))}
        </div>
      );

    case "elevation-scale":
      return (
        <div className="flex flex-wrap gap-3 p-1">
          {elevationSamples.map(({ token, className }) => (
            <span
              key={token}
              data-preview-elevation-sample={token}
              className={`size-11 rounded-[var(--radius-sm)] border border-border bg-card ${className}`}
              title={token}
            />
          ))}
        </div>
      );

    case "focus-contract":
      return (
        <Button type="button" variant="outline" aria-label="Inspect focus token">
          Inspect focus token
        </Button>
      );

    case "target-contract":
      return (
        <Button type="button" size="icon" aria-label="Inspect minimum target">
          <Settings2 aria-hidden />
        </Button>
      );

    case "motion-contract":
      return (
        <div className="flex flex-wrap gap-2 text-xs">
          {motionSamples.map(({ label, token, className }) => (
            <span
              key={token}
              className={`flex min-h-11 items-center rounded-[var(--radius-sm)] border border-border px-3 motion-safe:transition-colors hover:bg-accent ${className}`}
            >
              {label}
            </span>
          ))}
        </div>
      );

    case "container-contract":
      return (
        <div className="w-full max-w-[var(--container-max-width)] border border-dashed border-border bg-muted/40 p-[var(--container-padding)]">
          Token-bounded content
        </div>
      );
  }
}
