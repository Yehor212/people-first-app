import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsEmeraldNightBackdrop } from "./SettingsEmeraldNightBackdrop";

describe("SettingsEmeraldNightBackdrop", () => {
  it("renders one deterministic, non-interactive 24-star scene with bounded motion sets", () => {
    render(<SettingsEmeraldNightBackdrop mobileDetailOpen={false} motionEnabled />);

    const backdrop = screen.getByTestId("settings-emerald-night-backdrop");
    const stars = screen.getAllByTestId("settings-emerald-night-star");
    const ids = stars.map((star) => star.getAttribute("data-star-id"));

    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveAttribute("data-animated", "true");
    expect(backdrop).toHaveAttribute("data-mobile-detail", "false");
    expect(stars).toHaveLength(24);
    expect(new Set(ids).size).toBe(24);
    expect(ids).toEqual([
      "emerald-01",
      "emerald-02",
      "emerald-03",
      "emerald-04",
      "emerald-05",
      "emerald-06",
      "emerald-07",
      "emerald-08",
      "emerald-09",
      "emerald-10",
      "emerald-11",
      "emerald-12",
      "emerald-13",
      "emerald-14",
      "emerald-15",
      "emerald-16",
      "emerald-17",
      "emerald-18",
      "emerald-19",
      "emerald-20",
      "emerald-21",
      "emerald-22",
      "emerald-23",
      "emerald-24",
    ]);
    expect(backdrop.querySelectorAll(".settings-emerald-night-backdrop__star-core")).toHaveLength(
      24
    );
    expect(
      stars
        .filter((star) => star.getAttribute("data-motion-compact") === "true")
        .map((star) => star.getAttribute("data-star-id"))
    ).toEqual([
      "emerald-01",
      "emerald-04",
      "emerald-10",
      "emerald-11",
      "emerald-13",
      "emerald-14",
      "emerald-17",
      "emerald-18",
    ]);
    expect(
      stars
        .filter((star) => star.getAttribute("data-motion-desktop") === "true")
        .map((star) => star.getAttribute("data-star-id"))
    ).toEqual(["emerald-01", "emerald-04", "emerald-15", "emerald-16"]);
    expect(
      stars
        .filter((star) => star.style.getPropertyValue("--settings-star-desktop-inline"))
        .map((star) => [
          star.getAttribute("data-star-id"),
          star.style.getPropertyValue("--settings-star-desktop-inline"),
        ])
    ).toEqual([
      ["emerald-03", "27%"],
      ["emerald-04", "75%"],
      ["emerald-15", "0.2%"],
    ]);
    expect(
      stars
        .filter((star) => star.style.getPropertyValue("--settings-star-desktop-block"))
        .map((star) => [
          star.getAttribute("data-star-id"),
          star.style.getPropertyValue("--settings-star-desktop-block"),
        ])
    ).toEqual([["emerald-09", "14%"]]);
    const starById = new Map(stars.map((star) => [star.getAttribute("data-star-id"), star]));
    const movingStars = stars.filter(
      (candidate) =>
        candidate.getAttribute("data-motion-compact") === "true" ||
        candidate.getAttribute("data-motion-desktop") === "true"
    );
    expect(
      Object.fromEntries(
        movingStars.map((star) => [
          star.getAttribute("data-star-id"),
          star.style.getPropertyValue("--settings-star-motion-duration"),
        ])
      )
    ).toEqual({
      "emerald-01": "12s",
      "emerald-04": "12s",
      "emerald-10": "12s",
      "emerald-11": "14s",
      "emerald-13": "12s",
      "emerald-14": "14s",
      "emerald-15": "10s",
      "emerald-16": "12s",
      "emerald-17": "14s",
      "emerald-18": "10s",
    });
    const nebula = backdrop.querySelector<HTMLElement>(
      '.settings-emerald-night-backdrop__nebula[data-motion-emphasis="primary"]'
    );
    expect(nebula).toHaveAttribute("data-motion-active", "true");
    expect(nebula).toHaveAttribute("data-motion-id", "ambient-nebula");
    expect(
      Object.fromEntries(
        [
          "emerald-01",
          "emerald-04",
          "emerald-10",
          "emerald-11",
          "emerald-13",
          "emerald-14",
          "emerald-17",
          "emerald-18",
        ].map((id) => [
          id,
          starById.get(id)?.style.getPropertyValue("--settings-star-motion-delay-compact"),
        ])
      )
    ).toEqual({
      "emerald-01": "0s",
      "emerald-04": "-1.75s",
      "emerald-10": "-3.5s",
      "emerald-11": "-5.25s",
      "emerald-13": "-7s",
      "emerald-14": "-8.75s",
      "emerald-17": "-10.5s",
      "emerald-18": "-12.25s",
    });
    expect(
      Object.fromEntries(
        ["emerald-01", "emerald-04", "emerald-15", "emerald-16"].map((id) => [
          id,
          starById.get(id)?.style.getPropertyValue("--settings-star-motion-delay-desktop"),
        ])
      )
    ).toEqual({
      "emerald-01": "0s",
      "emerald-04": "-3.5s",
      "emerald-15": "-7s",
      "emerald-16": "-10.5s",
    });
    expect(backdrop.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
    expect(backdrop.querySelectorAll("canvas, svg, img, video")).toHaveLength(0);
  });

  it("exposes detail state without changing star identity or its motion contract", () => {
    const { rerender } = render(
      <SettingsEmeraldNightBackdrop mobileDetailOpen={false} motionEnabled />
    );
    const before = screen
      .getAllByTestId("settings-emerald-night-star")
      .map((star) => star.getAttribute("data-star-id"));

    rerender(<SettingsEmeraldNightBackdrop mobileDetailOpen motionEnabled />);

    expect(screen.getByTestId("settings-emerald-night-backdrop")).toHaveAttribute(
      "data-mobile-detail",
      "true"
    );
    expect(screen.getByTestId("settings-emerald-night-backdrop")).toHaveAttribute(
      "data-animated",
      "true"
    );
    expect(
      screen
        .getAllByTestId("settings-emerald-night-star")
        .map((star) => star.getAttribute("data-star-id"))
    ).toEqual(before);
  });

  it("keeps the two translated-heading edge stars inside the detail safety gutter", () => {
    render(<SettingsEmeraldNightBackdrop mobileDetailOpen motionEnabled={false} />);

    for (const id of ["emerald-06", "emerald-21"]) {
      const star = document.querySelector<HTMLElement>(`[data-star-id="${id}"]`);
      expect(star?.style.getPropertyValue("--settings-star-detail-inline")).toBe("99.5%");
    }
  });

  it("keeps the narrow overview heading edge stars outside the text safety gutter", () => {
    render(<SettingsEmeraldNightBackdrop mobileDetailOpen={false} motionEnabled />);

    for (const id of ["emerald-09", "emerald-10"]) {
      const star = document.querySelector<HTMLElement>(`[data-star-id="${id}"]`);
      expect(star?.style.getPropertyValue("--settings-star-inline")).toBe("100.2%");
    }

    const translatedHeadingStar = document.querySelector<HTMLElement>(
      '[data-star-id="emerald-21"]'
    );
    expect(translatedHeadingStar?.style.getPropertyValue("--settings-star-inline")).toBe("99.5%");
  });

  it("keeps all star cores static when the effective motion gate is off", () => {
    render(<SettingsEmeraldNightBackdrop mobileDetailOpen={false} motionEnabled={false} />);

    const backdrop = screen.getByTestId("settings-emerald-night-backdrop");
    expect(backdrop).toHaveAttribute("data-animated", "false");
    expect(
      backdrop.querySelector('.settings-emerald-night-backdrop__nebula')
    ).not.toHaveAttribute("data-motion-active");
    expect(backdrop.querySelectorAll('[data-motion-compact="true"]')).toHaveLength(8);
    expect(backdrop.querySelectorAll('[data-motion-desktop="true"]')).toHaveLength(4);
  });

});
