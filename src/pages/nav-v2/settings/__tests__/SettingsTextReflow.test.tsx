import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  SettingsHeroCard,
  SettingsModuleList,
  SettingsPageShell,
} from "../components/SettingsPageComponents";
import { DEFAULT_THEME_CUSTOMIZATION } from "@/stores/themeCustomization";
import { AppearanceAccent } from "../V2SettingsAppearanceAccent";
import { SettingsModuleCard } from "../components/SettingsModuleCard";
import {
  PanelFrame,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  SettingsInsetButton,
  ToggleRow,
} from "../components/V2SettingsControlPrimitives";

vi.mock("@/components/navigation-v2/ThemeToggleV2", () => ({
  ThemeToggleV2: () => <button type="button">Theme toggle</button>,
}));

describe("Settings text reflow contracts", () => {
  it("reserves a safe logical phone rail for the persistent drawer trigger", () => {
    render(
      <SettingsPageShell labelledBy="settings-shell-heading" controlsWired mobileDetailOpen={false}>
        <h1 id="settings-shell-heading">Settings</h1>
      </SettingsPageShell>
    );

    const shell = screen.getByTestId("settings-page");
    expect(shell.className).toContain(
      "ps-[calc(var(--safe-inline-start)_+_var(--v2-phone-drawer-rail))]"
    );
    expect(shell.className).toContain(
      "pe-[max(var(--v2-phone-content-inline-end),var(--safe-inline-end))]"
    );
    expect(shell.className).toContain(
      "pt-[calc(var(--safe-top)+var(--v2-phone-drawer-top-rail))]"
    );
    expect(shell.className).toContain("md:ps-[max(1.5rem,var(--safe-inline-start))]");
    expect(shell.className).toContain("md:pe-[max(1.5rem,var(--safe-inline-end))]");
    expect(shell.className).not.toContain("4.25rem");
    expect(shell.className).not.toContain("pl-[max(1.25rem,var(--safe-left))]");
    expect(shell.className).not.toContain("pr-[max(1.25rem,var(--safe-right))]");
  });

  it("uses font-scale tokens and keeps the compact theme summary multiline", () => {
    render(
      <SettingsHeroCard
        title="Benachrichtigungen"
        lead="Benachrichtigungseinstellungen für ZenFlow."
        themeTitle="Benachrichtigungston"
        themeLabel="Benachrichtigungsberechtigung"
        controlsWired={false}
      />
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Benachrichtigungen" });
    const themeTitle = screen.getByText("Benachrichtigungston");
    const themeLabel = screen.getByText("Benachrichtigungsberechtigung");

    expect(heading).toHaveClass("text-2xl");
    expect(heading.className).not.toContain("text-[1.55rem]");
    expect(themeTitle).not.toHaveClass("truncate");
    expect(themeLabel).not.toHaveClass("truncate");
    expect(themeTitle.className).toContain("[overflow-wrap:break-word]");
    expect(themeLabel.className).toContain("[overflow-wrap:break-word]");
    expect(themeTitle.className).toContain("[hyphens:manual]");
    expect(themeLabel.className).toContain("[hyphens:manual]");
    expect(themeTitle.className).not.toContain("[overflow-wrap:anywhere]");
    expect(themeLabel.className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("keeps the wired Settings hero readable at the narrow phone breakpoint", () => {
    render(
      <SettingsHeroCard
        title="Benachrichtigungen"
        lead="Benachrichtigungseinstellungen für ZenFlow."
        themeTitle="Benachrichtigungston"
        themeLabel="Benachrichtigungsberechtigung"
        controlsWired
      />
    );

    const card = screen.getByTestId("settings-page-control-card");
    const heading = screen.getByRole("heading", { level: 1, name: "Benachrichtigungen" });
    const lead = screen.getByText("Benachrichtigungseinstellungen für ZenFlow.");
    const headingTokens = heading.className.split(/\s+/);

    expect(card).toHaveClass("w-full");
    expect(card.className).toContain("px-0");
    expect(card.className).toContain("min-[360px]:px-8");
    expect(headingTokens).toContain("text-lg");
    expect(headingTokens).toContain("min-[420px]:text-xl");
    expect(headingTokens).toContain("sm:text-3xl");
    expect(headingTokens).not.toContain("text-xl");
    expect(headingTokens).not.toContain("text-3xl");
    expect(headingTokens).not.toContain("min-[360px]:text-3xl");
    expect(heading.className).toContain("[overflow-wrap:break-word]");
    expect(heading.className).toContain("[hyphens:manual]");
    expect(heading.className).not.toContain("[overflow-wrap:anywhere]");
    expect(lead).toHaveClass("max-w-[15rem]", "min-[360px]:max-w-[24rem]");
  });

  it("lets shared choice and field labels wrap without expanding their grid tracks", () => {
    render(
      <>
        <SettingsChoiceButton selected={false} onClick={() => undefined} presentation="compact">
          Benachrichtigungston
        </SettingsChoiceButton>
        <SettingsChoiceButton
          selected
          onClick={() => undefined}
          presentation="compact"
          testId="selected-settings-choice"
        >
          System
        </SettingsChoiceButton>
        <SettingsFieldHeader
          icon={Settings}
          title="Benachrichtigungsberechtigung"
          description="Benachrichtigungsberechtigung erforderlich."
        />
      </>
    );

    const choice = screen.getByRole("button", { name: "Benachrichtigungston" });
    const choiceLabel = choice.querySelector<HTMLElement>(
      '[data-slot="settings-choice-label"]'
    );
    const selectedChoice = screen.getByTestId("selected-settings-choice");
    const selectionMarker = selectedChoice.querySelector<HTMLElement>(
      '[data-slot="settings-choice-selection"]'
    );
    const title = screen.getByText("Benachrichtigungsberechtigung");
    const description = screen.getByText("Benachrichtigungsberechtigung erforderlich.");

    expect(choice).toHaveClass("whitespace-normal");
    expect(choice).toHaveClass("min-h-[48px]", "min-w-[48px]");
    expect(choice).not.toHaveClass("min-h-[44px]", "min-w-11");
    expect(choice.className).toContain("[overflow-wrap:break-word]");
    expect(choice.className).toContain("[hyphens:manual]");
    expect(choice.className).not.toContain("[overflow-wrap:anywhere]");
    expect(choiceLabel).not.toBeNull();
    expect(choiceLabel).toHaveClass("min-w-0", "max-w-full", "break-words");
    expect(choiceLabel?.className).toContain("[overflow-wrap:break-word]");
    expect(choiceLabel?.className).toContain("[hyphens:manual]");
    expect(choiceLabel?.className).not.toContain("[overflow-wrap:anywhere]");
    expect(selectedChoice).toHaveAttribute("aria-pressed", "true");
    expect(selectionMarker).not.toBeNull();
    expect(selectionMarker).toHaveAttribute("aria-hidden", "true");
    expect(selectionMarker?.querySelector("svg")).not.toBeNull();
    expect(title).toHaveClass("min-w-0", "break-words");
    expect(title.className).toContain("[overflow-wrap:break-word]");
    expect(title.className).toContain("[hyphens:manual]");
    expect(description).toHaveClass("break-words");
    expect(description.className).toContain("[overflow-wrap:break-word]");
    expect(description.className).toContain("[hyphens:manual]");
  });

  it("keeps accent swatches as visible circular flex items beside their labels", () => {
    render(
      <AppearanceAccent
        tx={{}}
        appliedTheme="paper"
        customization={{ ...DEFAULT_THEME_CUSTOMIZATION }}
        onChange={() => undefined}
      />
    );

    const swatches = document.querySelectorAll<HTMLElement>('[data-swatch-kind="accent"]');

    expect(swatches).toHaveLength(4);
    for (const swatch of swatches) {
      expect(swatch).toHaveClass("h-5", "w-5", "shrink-0", "rounded-full");
      expect(swatch.parentElement).toHaveClass("flex", "items-center", "gap-2");
    }
  });

  it("gives long toggle descriptions the full narrow row without splitting words", () => {
    render(
      <ToggleRow
        icon={Settings}
        title="Benachrichtigungen"
        description="Benachrichtigungsberechtigung erforderlich."
        checked={false}
        onCheckedChange={() => undefined}
        testId="canonical-toggle-row"
      />
    );

    const row = screen.getByTestId("canonical-toggle-row");
    const title = screen.getByText("Benachrichtigungen");
    const description = screen.getByText("Benachrichtigungsberechtigung erforderlich.");
    const icon = row.querySelector<HTMLElement>("svg")?.parentElement;

    expect(title.className).toContain("[overflow-wrap:break-word]");
    expect(title.className).toContain("[hyphens:manual]");
    expect(title).toHaveClass("col-start-2", "col-end-3", "row-start-1");
    expect(description).toHaveClass("col-start-2", "col-end-4", "row-start-2");
    expect(description.className).toContain("[overflow-wrap:break-word]");
    expect(description.className).toContain("[hyphens:manual]");
    expect(row).toHaveClass("rounded-none", "border-x-0", "border-t-0", "bg-transparent");
    expect(row.className).not.toContain("shadow-");
    expect(icon).not.toBeNull();
    expect(icon?.className).not.toContain("rounded-[8px]");
    expect(icon?.className).not.toContain("bg-[hsl(var(--settings-v2-accent)/0.1)]");
  });

  it("allows nested Settings panels to shrink to the viewport instead of expanding it", () => {
    render(
      <PanelFrame
        icon={Settings}
        title="Konfidenzialität und Daten"
        description="Vollständige Beschreibung"
        testId="bounded-panel"
      >
        <SettingsInset testId="bounded-inset">Inhalt</SettingsInset>
      </PanelFrame>
    );

    expect(screen.getByTestId("bounded-panel")).toHaveClass("w-full", "min-w-0", "max-w-full");
    expect(screen.getByTestId("bounded-inset")).toHaveClass("w-full", "min-w-0", "max-w-full");
  });

  it("offers a flat divider row without creating another contained surface", () => {
    render(
      <SettingsInset presentation="flat-row" testId="flat-settings-row">
        Account status
      </SettingsInset>
    );

    const row = screen.getByTestId("flat-settings-row");
    expect(row).toHaveAttribute("data-inset-presentation", "flat-row");
    expect(row).toHaveClass("rounded-none", "border-b", "bg-transparent");
    expect(row).not.toHaveClass("rounded-[8px]", "border", "p-2");
    expect(row.className).not.toContain("bg-[hsl(var(--settings-v2-shell)");
  });

  it("keeps the full-width inset action at least 48px tall", () => {
    render(
      <SettingsInsetButton onClick={() => undefined}>
        Benachrichtigungseinstellungen
      </SettingsInsetButton>
    );

    expect(screen.getByRole("button", { name: "Benachrichtigungseinstellungen" })).toHaveClass(
      "min-h-[48px]"
    );
  });

  it("exposes stable panel-header slots for narrow text-only reflow", () => {
    render(
      <PanelFrame
        icon={Settings}
        title="מראה"
        description="אפשר לבחור מצב צבע, צבע הדגשה וגודל טקסט."
        testId="narrow-reflow-panel"
      >
        Inhalt
      </PanelFrame>
    );

    const panel = screen.getByTestId("narrow-reflow-panel");
    const header = panel.querySelector<HTMLElement>('[data-slot="settings-panel-header"]');
    const copy = panel.querySelector<HTMLElement>('[data-slot="settings-panel-copy"]');

    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("flex-col", "min-[360px]:flex-row");
    expect(copy).toHaveClass("w-full", "min-[360px]:w-auto");
    expect(panel.querySelector('[data-slot="settings-panel-icon"]')).toBeInTheDocument();
    expect(copy).toBeInTheDocument();
  });

  it("uses the visible module label as the accessible name", () => {
    render(
      <SettingsModuleCard
        item={{
          id: "account",
          icon: Settings,
          label: "Benachrichtigungen",
          value: "Benachrichtigungston",
          description: "Benachrichtigungsberechtigung erforderlich.",
          role: "settings",
        }}
        expanded={false}
        controlsWired
        buttonId="settings-account-button"
        panelId="settings-account-panel"
        panelMounted={false}
        onOpen={() => undefined}
      />
    );

    const moduleButton = screen.getByRole("button", { name: "Benachrichtigungen" });
    const description = screen.getByText("Benachrichtigungsberechtigung erforderlich.");

    expect(moduleButton).toBeInTheDocument();
    expect(moduleButton.className).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(moduleButton.className).not.toContain("min-[420px]:grid-cols");
    expect(description).toHaveClass("col-start-2", "col-end-3", "row-start-2");
    expect(moduleButton.parentElement?.className).toContain("before:start-16");
    expect(moduleButton.parentElement?.className).not.toContain("min-[420px]:before:start-16");
    expect(description.style.hyphens).toBe("manual");
    expect(description.style.overflowWrap).toBe("break-word");
  });

  it("uses one grouped surface with flat divider-separated module rows", () => {
    render(
      <SettingsModuleList
        items={[
          {
            id: "account",
            icon: Settings,
            label: "Account",
            description: "Profile and account access.",
            role: "settings",
          },
          {
            id: "appearance",
            icon: Settings,
            label: "Appearance",
            description: "Theme and text preferences.",
            role: "settings",
          },
        ]}
        expandedId="account"
        onOpen={() => undefined}
        controlsWired
        label="Settings sections"
        backLabel="Back"
        desktopLayout
        mobileDetailOpen={false}
        onBack={() => undefined}
        onMobileSurfaceReady={() => undefined}
        renderPanel={() => <div>Selected panel</div>}
      />
    );

    const group = screen.getByTestId("settings-module-list");
    const accountRow = screen.getByTestId("settings-module-account");
    const appearanceRow = screen.getByTestId("settings-module-appearance");
    const accountButton = screen.getByTestId("settings-module-card-account");
    const accountIcon = accountRow.querySelector<HTMLElement>(
      '[data-slot="settings-module-icon"]'
    );

    expect(group).toHaveAttribute("data-visual-role", "settings-group");
    expect(group).toHaveClass("overflow-hidden", "rounded-[8px]", "border");
    expect(group).not.toHaveClass("divide-y");
    expect(accountRow).not.toHaveClass("rounded-[8px]", "border");
    expect(appearanceRow).not.toHaveClass("rounded-[8px]", "border");
    expect(accountRow.className).not.toContain("shadow-");
    expect(appearanceRow.className).not.toContain("shadow-");
    expect(accountRow).toHaveClass(
      "before:start-16",
      "before:end-3",
      "first:before:hidden"
    );
    expect(accountRow.className).not.toContain("min-[420px]:before:start-16");
    expect(accountButton).not.toHaveClass("rounded-[8px]");
    expect(accountButton.className).not.toContain("hover:-translate-y");
    expect(accountButton.className).not.toContain("shadow-");
    expect(accountButton).toHaveClass("focus-visible:ring-inset");
    expect(accountIcon).not.toBeNull();
    expect(accountIcon).not.toHaveClass("border");
    expect(accountButton).toHaveClass("min-h-[72px]");
    expect(accountButton).toHaveAttribute("aria-current", "page");
  });
});
