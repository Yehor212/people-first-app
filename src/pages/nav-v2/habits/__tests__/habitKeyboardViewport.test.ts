import { describe, expect, it } from "vitest";
import { calculateScrollTopForVisibility } from "../habitKeyboardViewport";

describe("habit keyboard viewport visibility", () => {
  it("moves a focused field below the fixed sheet header using the measured Android geometry", () => {
    const nextScrollTop = calculateScrollTopForVisibility({
      currentScrollTop: 313.1428527832031,
      element: {
        top: 55.42857360839844,
        bottom: 104.95238494873047,
      },
      viewport: {
        top: 94.76190948486328,
        bottom: 189.33334350585938,
      },
      padding: 12,
    });

    expect(nextScrollTop).toBeCloseTo(261.8095, 3);
  });

  it("moves a focused field above the keyboard edge when it is below the scrollport", () => {
    const nextScrollTop = calculateScrollTopForVisibility({
      currentScrollTop: 50,
      element: { top: 210, bottom: 250 },
      viewport: { top: 80, bottom: 200 },
      padding: 16,
    });

    expect(nextScrollTop).toBe(116);
  });

  it("does not move a field that is already fully visible", () => {
    const nextScrollTop = calculateScrollTopForVisibility({
      currentScrollTop: 88,
      element: { top: 112, bottom: 156 },
      viewport: { top: 80, bottom: 200 },
      padding: 12,
    });

    expect(nextScrollTop).toBe(88);
  });

  it("never requests a negative scroll offset", () => {
    const nextScrollTop = calculateScrollTopForVisibility({
      currentScrollTop: 8,
      element: { top: 40, bottom: 80 },
      viewport: { top: 100, bottom: 200 },
      padding: 12,
    });

    expect(nextScrollTop).toBe(0);
  });
});
