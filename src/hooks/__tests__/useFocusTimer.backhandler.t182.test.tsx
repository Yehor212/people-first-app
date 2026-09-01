import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FocusSession } from "@/types";

const backOwners = vi.hoisted(() => new Set<() => boolean>());
const persisted = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: vi.fn((callback: () => boolean) => {
    backOwners.add(callback);
    return () => backOwners.delete(callback);
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      ariaFocusReflection: "Focus reflection",
      close: "Close",
      focusCompletedShort: "Focus session complete",
      focusExpandToJournal: "Write about it in your journal",
      focusPreset25: "25 minutes",
      focusPreset50: "50 minutes",
      focusPresetCustom: "Custom",
      focusReflectionQuestion: "How did this focus session feel?",
      focusReflectionSave: "Save",
      focusReflectionSkip: "Skip",
      focusReflectionTitle: "Session reflection",
    },
  }),
}));

vi.mock("@/lib/safeJson", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/safeJson")>()),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    persisted.set(key, JSON.stringify(value));
    return true;
  }),
  storageReadRaw: vi.fn((key: string) => ({ ok: true, value: persisted.get(key) ?? null })),
  storageRemove: vi.fn((key: string) => persisted.delete(key) || true),
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: vi.fn(async () => null),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { focusPaused: vi.fn(), focusStarted: vi.fn() },
}));

vi.mock("@/lib/a11y", () => ({ announceSuccess: vi.fn() }));
vi.mock("@/lib/focusCompletionNotification", () => ({
  scheduleFocusCompletionNotification: vi.fn(async () => undefined),
}));

vi.mock("@/stores", () => ({
  setFocusControls: vi.fn(),
  useUIStore: {
    getState: () => ({
      clearFocusTimerBridge: vi.fn(),
      setFocusTimerBridge: vi.fn(),
    }),
  },
}));

vi.mock("@/components/cosmic/CosmicStarField", () => ({
  CosmicStar: ({ id }: { id: string }) => <span data-testid={`star-${id}`} />,
  cosmicStars: [{ id: "s1" }],
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const stripMotionProps = <T extends Record<string, unknown>>(props: T) => {
    const {
      animate: _animate,
      initial: _initial,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...rest
    } = props;
    return rest;
  };

  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MotionDiv(
        { children, ...props },
        ref
      ) {
        return (
          <div ref={ref} {...stripMotionProps(props)}>
            {children}
          </div>
        );
      }),
      button: React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
        function MotionButton({ children, ...props }, ref) {
          return (
            <button ref={ref} {...stripMotionProps(props)}>
              {children}
            </button>
          );
        }
      ),
    },
  };
});

import { FocusReflectionModal } from "@/components/FocusReflectionModal";
import { useBackHandler } from "../useBackHandler";
import { useFocusTimer } from "../useFocusTimer";

function ReflectionHarness({
  onCompleteSession,
}: {
  onCompleteSession: (session: FocusSession) => void;
}) {
  const timer = useFocusTimer({ sessions: [], onCompleteSession });

  return (
    <>
      <button onClick={timer.handleHyperfocusComplete}>Finish hyperfocus</button>
      {timer.showReflection && (
        <FocusReflectionModal
          reflectionValue={timer.reflectionValue}
          onSelectValue={timer.setReflectionValue}
          onSave={timer.handleSaveReflection}
          onDismiss={() => timer.handleSaveReflection(null)}
          onCancel={timer.handleCancelReflection}
        />
      )}
    </>
  );
}

function MountedHyperfocusOwner({ onExit }: { onExit: () => void }) {
  useBackHandler(true, onExit);
  return <div role="dialog" aria-label="Hyperfocus session" />;
}

function HyperfocusHarness({
  onCompleteSession,
}: {
  onCompleteSession: (session: FocusSession) => void;
}) {
  const timer = useFocusTimer({ sessions: [], onCompleteSession });
  return (
    <>
      <button onClick={() => timer.setShowHyperfocus(true)}>Open hyperfocus</button>
      {timer.showHyperfocus && (
        <MountedHyperfocusOwner onExit={() => timer.setShowHyperfocus(false)} />
      )}
    </>
  );
}

describe("T182 focus-reflection Back ownership", () => {
  beforeEach(() => {
    persisted.clear();
  });

  it("has one Back owner that safely acknowledges the already-finished session", async () => {
    const onCompleteSession = vi.fn();
    backOwners.clear();
    render(<ReflectionHarness onCompleteSession={onCompleteSession} />);

    const trigger = screen.getByRole("button", { name: "Finish hyperfocus" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Focus reflection" })).toBeInTheDocument();

    await waitFor(() => expect(backOwners.size).toBe(1));
    const owner = [...backOwners][0];
    act(() => {
      owner();
    });

    await waitFor(() => expect(onCompleteSession).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Focus reflection" })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("uses the same durable acknowledgement semantics for keyboard Escape", async () => {
    const onCompleteSession = vi.fn();
    backOwners.clear();
    render(<ReflectionHarness onCompleteSession={onCompleteSession} />);

    fireEvent.click(screen.getByRole("button", { name: "Finish hyperfocus" }));
    const dialog = await screen.findByRole("dialog", { name: "Focus reflection" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(onCompleteSession).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Focus reflection" })).not.toBeInTheDocument(),
    );
  });

  it("leaves Hyperfocus Back ownership to the mounted fullscreen layer", async () => {
    const onCompleteSession = vi.fn();
    backOwners.clear();
    render(<HyperfocusHarness onCompleteSession={onCompleteSession} />);

    fireEvent.click(screen.getByRole("button", { name: "Open hyperfocus" }));
    expect(await screen.findByRole("dialog", { name: "Hyperfocus session" })).toBeInTheDocument();

    await waitFor(() => expect(backOwners.size).toBe(1));
    const owner = [...backOwners][0];
    act(() => {
      owner();
    });

    expect(onCompleteSession).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Hyperfocus session" })).not.toBeInTheDocument();
  });
});
