import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  ActionButton,
  PanelFrame,
  SettingsChoiceButton,
  SettingsInset,
  ToggleRow,
} from "../components/V2SettingsControlPrimitives";

const MATERIAL_TOKEN = /^(?:border(?:$|-)|bg-|rounded|shadow)/;

function baseMaterialTokens(element: HTMLElement) {
  return element.className
    .split(/\s+/)
    .filter((token) => token && !token.includes(":"))
    .filter((token) => MATERIAL_TOKEN.test(token));
}

describe("V2 Settings containment contract", () => {
  it("keeps material containment on the semantic group instead of the panel shell", () => {
    render(
      <PanelFrame
        icon={Settings}
        title="Appearance"
        description="Choose the display that works for you."
        testId="appearance-panel"
      >
        <SettingsInset testId="appearance-row">Theme</SettingsInset>
      </PanelFrame>
    );

    const panel = screen.getByTestId("appearance-panel");
    const group = panel.querySelector<HTMLElement>('[data-slot="settings-group"]');

    expect(baseMaterialTokens(panel)).toEqual([]);
    expect(panel).not.toHaveClass("overflow-hidden");
    expect(group).not.toBeNull();
    expect(group).toHaveAttribute("data-containment", "group");
    expect(baseMaterialTokens(group as HTMLElement)).toEqual(
      expect.arrayContaining(["border", "rounded-[8px]"])
    );
    expect(baseMaterialTokens(group as HTMLElement).some((token) => token.startsWith("bg-"))).toBe(
      true
    );
    expect(baseMaterialTokens(group as HTMLElement).some((token) => token.startsWith("shadow"))).toBe(
      false
    );
  });

  it("keeps the panel icon inline with copy at compact widths", () => {
    render(
      <PanelFrame
        icon={Settings}
        title="Appearance"
        description="Choose the display that works for you."
        testId="appearance-panel"
      >
        <SettingsInset>Theme</SettingsInset>
      </PanelFrame>
    );

    const header = screen
      .getByTestId("appearance-panel")
      .querySelector<HTMLElement>('[data-slot="settings-panel-header"]');

    expect(header).not.toBeNull();
    expect(header).toHaveClass("grid", "grid-cols-[2.25rem_minmax(0,1fr)]");
    expect(header).not.toHaveClass("flex-col");
  });

  it("renders an ordinary toggle as a flat row inside its owning group", () => {
    render(
      <ToggleRow
        icon={Settings}
        title="Notifications"
        description="Choose whether ZenFlow can remind you."
        checked={false}
        onCheckedChange={() => undefined}
        testId="notifications-row"
      />
    );

    const row = screen.getByTestId("notifications-row");

    expect(row).toHaveAttribute("data-containment", "row");
    expect(baseMaterialTokens(row)).toEqual([]);
    expect(row).toHaveClass("min-h-[58px]");
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeInTheDocument();
  });

  it("keeps an ordinary neutral inset flat", () => {
    render(<SettingsInset testId="ordinary-inset">Current theme</SettingsInset>);

    const inset = screen.getByTestId("ordinary-inset");

    expect(inset).toHaveAttribute("data-containment", "row");
    expect(baseMaterialTokens(inset)).toEqual([]);
  });

  it("retains explicit containment for destructive and neutral recovery callouts", () => {
    render(
      <>
        <SettingsInset tone="danger" testId="danger-callout">
          Delete account
        </SettingsInset>
        <SettingsInset emphasis="callout" testId="recovery-callout">
          Try loading the account again.
        </SettingsInset>
      </>
    );

    for (const testId of ["danger-callout", "recovery-callout"]) {
      const callout = screen.getByTestId(testId);
      const materialTokens = baseMaterialTokens(callout);

      expect(callout).toHaveAttribute("data-containment", "callout");
      expect(materialTokens).toEqual(expect.arrayContaining(["border", "rounded-[8px]"]));
      expect(materialTokens.some((token) => token.startsWith("bg-"))).toBe(true);
      expect(materialTokens.some((token) => token.startsWith("shadow"))).toBe(false);
    }
  });

  it("keeps action affordance without decorative elevation", () => {
    render(
      <>
        <ActionButton icon={Settings} onClick={() => undefined}>
          Save
        </ActionButton>
        <SettingsChoiceButton selected onClick={() => undefined}>
          Paper
        </SettingsChoiceButton>
      </>
    );

    for (const control of [
      screen.getByRole("button", { name: "Save" }),
      screen.getByRole("button", { name: "Paper" }),
    ]) {
      const materialTokens = baseMaterialTokens(control);

      expect(materialTokens.some((token) => token === "border")).toBe(true);
      expect(materialTokens.some((token) => token.startsWith("bg-"))).toBe(true);
      expect(materialTokens.some((token) => token.startsWith("shadow"))).toBe(false);
      expect(control).toHaveClass("focus-visible:outline-none", "focus-visible:ring-2");
    }
  });
});
