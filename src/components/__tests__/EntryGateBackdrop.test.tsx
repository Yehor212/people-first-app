import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntryGateBackdrop } from "@/components/EntryGateBackdrop";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  return {
    motion: {
      span: React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
        function MotionSpan({ children, ...props }, ref) {
          return (
            <span ref={ref} data-motion-span="true" {...props}>
              {children}
            </span>
          );
        }
      ),
    },
  };
});

describe("EntryGateBackdrop", () => {
  it("renders a rich non-star animated atmosphere for entry screens", () => {
    render(<EntryGateBackdrop animated={true} />);

    expect(screen.getByTestId("entry-gate-aurora")).toBeInTheDocument();
    expect(screen.getAllByTestId("entry-gate-backdrop-orb")).toHaveLength(7);
    expect(screen.getAllByTestId("entry-gate-backdrop-ripple")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-ribbon")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-caustic")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-current")).toHaveLength(4);
    expect(screen.getByTestId("entry-gate-backdrop-horizon")).toBeInTheDocument();
    expect(screen.queryByTestId("entry-gate-backdrop-star")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-flow-mark")).toBeNull();
  });

  it("renders static spans when animation is disabled to avoid Android WebView compositor ghosts", () => {
    const { container } = render(<EntryGateBackdrop animated={false} />);

    expect(container.querySelector("[data-motion-span='true']")).toBeNull();
    expect(screen.getAllByTestId("entry-gate-backdrop-orb")).toHaveLength(7);
    expect(screen.getAllByTestId("entry-gate-backdrop-ripple")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-ribbon")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-caustic")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-current")).toHaveLength(4);
  });
});
