import { render, screen, within } from "@testing-library/react";
import { Settings2 } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TEXT_SPACING_STRESS = {
  width: "320px",
  fontSize: "200%",
  lineHeight: "1.5",
  letterSpacing: "0.12em",
  wordSpacing: "0.16em",
} as const;

describe("shared text control reflow", () => {
  it("lets every textual button size grow and retain its label under narrow large-text spacing", () => {
    render(
      <div data-testid="button-stress-frame" style={TEXT_SPACING_STRESS}>
        <Button data-testid="button-default">
          <Settings2 data-testid="button-default-icon" aria-hidden="true" />
          <span>Керування нагадуваннями та звуками</span>
        </Button>
        <Button data-testid="button-sm" size="sm">
          <Settings2 aria-hidden="true" />
          <span>Datenschutz und Datensicherheit</span>
        </Button>
        <Button data-testid="button-lg" size="lg">
          <Settings2 aria-hidden="true" />
          <span>Gérer les rappels et les sons</span>
        </Button>
        <Button data-testid="button-xl" size="xl">
          <Settings2 aria-hidden="true" />
          <span>إدارة التذكيرات والأصوات</span>
        </Button>
      </div>
    );

    expect(screen.getByTestId("button-stress-frame")).toHaveStyle(TEXT_SPACING_STRESS);

    const expectedMinimumHeights = {
      "button-default": "min-h-11",
      "button-sm": "min-h-11",
      "button-lg": "min-h-12",
      "button-xl": "min-h-14",
    } as const;

    for (const [testId, minimumHeight] of Object.entries(expectedMinimumHeights)) {
      const button = screen.getByTestId(testId);

      expect(button).toHaveClass(
        "h-auto",
        minimumHeight,
        "max-w-full",
        "min-w-0",
        "whitespace-normal",
        "break-words",
        "text-center",
        "[hyphens:manual]",
        "[overflow-wrap:break-word]",
        "[&_svg]:shrink-0",
        "[&>span]:min-w-0"
      );
      expect(button).not.toHaveClass("whitespace-nowrap");
      expect(within(button).getByText(/\S/)).toBeVisible();
    }

    expect(screen.getByTestId("button-default-icon")).toBeVisible();
  });

  it("keeps icon-only button variants square at or above the shared 44px target floor", () => {
    render(
      <>
        <Button data-testid="button-icon" size="icon" aria-label="Open settings">
          <Settings2 aria-hidden="true" />
        </Button>
        <Button data-testid="button-icon-sm" size="icon-sm" aria-label="Open compact settings">
          <Settings2 aria-hidden="true" />
        </Button>
        <Button data-testid="button-icon-lg" size="icon-lg" aria-label="Open large settings">
          <Settings2 aria-hidden="true" />
        </Button>
      </>
    );

    expect(screen.getByTestId("button-icon")).toHaveClass("h-11", "w-11", "shrink-0");
    expect(screen.getByTestId("button-icon-sm")).toHaveClass("h-11", "w-11", "shrink-0");
    expect(screen.getByTestId("button-icon-lg")).toHaveClass("h-14", "w-14", "shrink-0");
  });

  it("lets shared tabs and their labels grow under narrow large-text spacing", () => {
    render(
      <div data-testid="tabs-stress-frame" style={TEXT_SPACING_STRESS}>
        <Tabs defaultValue="all">
          <TabsList data-testid="tabs-list">
            <TabsTrigger data-testid="tabs-trigger" value="all">
              <Settings2 data-testid="tabs-trigger-icon" aria-hidden="true" />
              <span>Усі досягнення та нагороди</span>
            </TabsTrigger>
            <TabsTrigger value="locked">
              <span>Datenschutz und Datensicherheit</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    );

    expect(screen.getByTestId("tabs-stress-frame")).toHaveStyle(TEXT_SPACING_STRESS);

    const list = screen.getByTestId("tabs-list");
    expect(list).toHaveClass("h-auto", "min-h-11", "max-w-full", "items-stretch");
    expect(list).not.toHaveClass("h-10");

    const trigger = screen.getByTestId("tabs-trigger");
    expect(trigger).toHaveClass(
      "h-auto",
      "min-h-11",
      "max-w-full",
      "min-w-0",
      "whitespace-normal",
      "break-words",
      "text-center",
      "[hyphens:manual]",
      "[overflow-wrap:break-word]",
      "[&_svg]:shrink-0",
      "[&>span]:min-w-0"
    );
    expect(trigger).not.toHaveClass("whitespace-nowrap");
    expect(within(trigger).getByText("Усі досягнення та нагороди")).toBeVisible();
    expect(screen.getByTestId("tabs-trigger-icon")).toBeVisible();
  });
});
