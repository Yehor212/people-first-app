import { useEffect } from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { Bloom } from "../components/Bloom";

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: vi.fn(),
}));

describe("Bloom component", () => {
  beforeEach(() => {
    vi.mocked(useShouldAnimate).mockReturnValue(true);
  });

  it("preserves its child DOM and lifecycle identity when animation preference changes", () => {
    let mounts = 0;
    let unmounts = 0;

    function ChildProbe() {
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);
      return <canvas data-testid="persistent-bloom-child" />;
    }

    const view = render(
      <Bloom>
        <ChildProbe />
      </Bloom>,
    );
    const initialCanvas = view.getByTestId("persistent-bloom-child");

    vi.mocked(useShouldAnimate).mockReturnValue(false);
    view.rerender(
      <Bloom>
        <ChildProbe />
      </Bloom>,
    );

    expect(view.getByTestId("persistent-bloom-child")).toBe(initialCanvas);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);

    vi.mocked(useShouldAnimate).mockReturnValue(true);
    view.rerender(
      <Bloom>
        <ChildProbe />
      </Bloom>,
    );

    expect(view.getByTestId("persistent-bloom-child")).toBe(initialCanvas);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);

    view.unmount();
    expect(unmounts).toBe(1);
  });

  it.each([
    { label: "reduced motion", shouldAnimate: false, disabled: false },
    { label: "disabled motion", shouldAnimate: true, disabled: true },
  ])("preserves ordinary DOM props and handlers with $label", ({ shouldAnimate, disabled }) => {
    vi.mocked(useShouldAnimate).mockReturnValue(shouldAnimate);
    const onClick = vi.fn();

    const view = render(
      <Bloom
        aria-label="Mood summary"
        data-testid="static-bloom"
        data-state="ready"
        disabled={disabled}
        id="mood-summary"
        onClick={onClick}
        role="region"
        style={{ color: "rgb(1, 2, 3)" }}
      />,
    );

    const element = view.getByTestId("static-bloom");
    expect(element).toHaveAttribute("id", "mood-summary");
    expect(element).toHaveAttribute("role", "region");
    expect(element).toHaveAttribute("aria-label", "Mood summary");
    expect(element).toHaveAttribute("data-state", "ready");
    expect(element).toHaveStyle({ color: "rgb(1, 2, 3)" });

    fireEvent.click(element);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
