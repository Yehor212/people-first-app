/**
 * CinematicHeading — tests for WOW-5 char-stagger + SOFT axis.
 */
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CinematicHeading } from "../CinematicHeading";

let mockAnimate = true;
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => mockAnimate,
}));

describe("CinematicHeading", () => {
  afterEach(() => {
    cleanup();
    mockAnimate = true;
  });

  it("exposes full aria-label for screen readers", () => {
    const { getByTestId } = render(
      <CinematicHeading leadText="Good morning, " emphasis="Friend" />,
    );
    const h1 = getByTestId("cinematic-heading");
    expect(h1.getAttribute("aria-label")).toBe("Good morning, Friend");
  });

  it("marks data-animated='true' when motion is allowed", () => {
    mockAnimate = true;
    const { getByTestId } = render(
      <CinematicHeading leadText="Hi, " emphasis="Friend" />,
    );
    expect(getByTestId("cinematic-heading").getAttribute("data-animated")).toBe(
      "true",
    );
  });

  it("renders static fallback when animations disabled", () => {
    mockAnimate = false;
    const { getByTestId } = render(
      <CinematicHeading leadText="Hi, " emphasis="Friend" />,
    );
    const h1 = getByTestId("cinematic-heading");
    expect(h1.getAttribute("data-animated")).toBe("false");
    expect(h1.textContent).toBe("Hi, Friend");
  });

  it("renders the emphasis with italic class", () => {
    mockAnimate = false;
    const { getByTestId } = render(
      <CinematicHeading leadText="Hi, " emphasis="Friend" />,
    );
    const italicSpan = getByTestId("cinematic-heading").querySelector(".italic");
    expect(italicSpan).not.toBeNull();
    expect(italicSpan?.textContent).toBe("Friend");
  });
});
