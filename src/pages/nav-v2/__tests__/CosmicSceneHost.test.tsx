import { StrictMode, Suspense, use, useLayoutEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CosmicSceneHostProvider,
  CosmicSceneSlot,
  useCosmicSceneHost,
  type CosmicSceneActivity,
} from "../CosmicSceneHost";
import { CosmicBgAdapter, RetainedCosmicSceneProvider } from "../CosmicBgAdapter";
import { useThemeStore } from "@/stores/themeStore";

vi.mock("@/lib/platform", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/platform")>(),
  isAndroid: true,
}));
vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => false }));
vi.mock("@/components/cosmic/CosmicStarField", () => ({
  CosmicStar: () => null,
  cosmicStars: [],
}));

function Slot({ name }: { name: string }) {
  const acquireScene = useCosmicSceneHost();
  return (
    <section data-testid={`slot-${name}`}>
      {acquireScene && <CosmicSceneSlot acquireScene={acquireScene} />}
    </section>
  );
}

describe("navigation-owned decorative scene", () => {
  beforeEach(() => useThemeStore.setState({ appliedTheme: "paper" }));
  afterEach(cleanup);
  afterEach(() => vi.unstubAllGlobals());

  it("retains measured paint dimensions on release and replaces them after a resized visit", () => {
    const tree = (active: boolean) => (
      <CosmicSceneHostProvider placement="anchored" renderScene={() => <div data-testid="scene" />}>
        {active && <Slot name="page" />}
      </CosmicSceneHostProvider>
    );
    const { rerender } = render(tree(true));
    const frame = document.querySelector<HTMLElement>("[data-cosmic-scene-frame]")!;
    // Computed CSS serializes fewer decimals than the browser's layout rect.
    // Rounding even a fraction of a pixel invalidates the retained paint.
    frame.style.width = "412.19px";
    frame.style.height = "974.196px";
    const bounds = vi.spyOn(frame, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 412.19049072265625, 974.1964721679688),
    );
    rerender(tree(false));
    expect(frame).toHaveAttribute("data-retained-paint", "true");
    expect(frame.style.getPropertyValue("--cosmic-scene-retained-width")).toBe("412.19049072265625px");
    expect(frame.style.getPropertyValue("--cosmic-scene-retained-height")).toBe("974.1964721679688px");
    rerender(tree(true));
    frame.style.width = "700px";
    frame.style.height = "839px";
    bounds.mockReturnValue(new DOMRect(0, 0, 700, 839));
    rerender(tree(false));
    expect(frame.style.getPropertyValue("--cosmic-scene-retained-width")).toBe("700px");
    expect(frame.style.getPropertyValue("--cosmic-scene-retained-height")).toBe("839px");
    expect(screen.getAllByTestId("scene")).toHaveLength(1);
  });

  it("keeps an anchored portal under one connected parent while pages and leases change", () => {
    const disposed = vi.fn();
    function Scene({ active, activationKey }: CosmicSceneActivity) {
      useLayoutEffect(() => disposed, []);
      return <div data-testid="scene" data-active={active} data-visit={activationKey} />;
    }
    const renderScene = (activity: CosmicSceneActivity) => <Scene {...activity} />;
    const tree = (first: boolean, second: boolean) => (
      <CosmicSceneHostProvider placement="anchored" renderScene={renderScene}>
        {first && <Slot key="first" name="first" />}
        {second && <Slot key="second" name="second" />}
      </CosmicSceneHostProvider>
    );
    const { rerender, unmount } = render(tree(true, false));
    const scene = screen.getByTestId("scene");
    const host = scene.parentElement;
    const frame = host?.parentElement;
    expect(frame).toHaveAttribute("data-cosmic-scene-frame", "true");
    expect(screen.getByTestId("slot-first")).not.toContainElement(scene);
    const append = vi.spyOn(frame as HTMLElement, "appendChild");

    rerender(tree(true, true));
    expect(scene.parentElement).toBe(host);
    expect(host?.parentElement).toBe(frame);
    expect(document.querySelectorAll('[data-cosmic-scene-anchor="true"]')).toHaveLength(1);
    expect(screen.getByTestId("slot-second").querySelector("[data-cosmic-scene-slot]"))
      .toHaveAttribute("data-cosmic-scene-anchor", "true");
    rerender(tree(false, true));
    expect(scene).toHaveAttribute("data-active", "true");
    expect(screen.queryByTestId("slot-first")).not.toBeInTheDocument();

    rerender(tree(false, false));
    expect(scene.isConnected).toBe(true);
    expect(scene).toHaveAttribute("data-active", "false");
    expect(frame).toHaveAttribute("data-active", "false");
    expect(document.querySelector("[data-cosmic-scene-anchor]" )).toBeNull();
    expect(disposed).not.toHaveBeenCalled();
    rerender(tree(true, false));
    expect(screen.getByTestId("scene")).toBe(scene);
    expect(host?.parentElement).toBe(frame);
    expect(scene).toHaveAttribute("data-visit", "3");
    expect(append).not.toHaveBeenCalled();
    unmount();
    expect(scene.isConnected).toBe(false);
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("selects stationary placement on a capable engine and mirrors only the scene theme scope", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const tree = (page: string | null, enabled = true) => (
      <StrictMode>
        <RetainedCosmicSceneProvider enabled={enabled}>
          {page && <section key={page} data-testid={`private-${page}`}><CosmicBgAdapter /></section>}
        </RetainedCosmicSceneProvider>
      </StrictMode>
    );
    const { rerender, unmount } = render(tree("orb"));
    const day = screen.getByTestId("day-cosmic-background");
    const frame = day.closest("[data-cosmic-scene-frame]");
    expect(frame).not.toBeNull();
    expect(frame).toHaveClass("orb-day-scope");
    rerender(tree("diary"));
    expect(screen.queryByTestId("private-orb")).not.toBeInTheDocument();
    expect(day.closest("[data-cosmic-scene-frame]")).toBe(frame);
    act(() => useThemeStore.setState({ appliedTheme: "ink" }));
    expect(frame).toHaveClass("dark", "orb-cosmic-scope");
    expect(frame).not.toHaveClass("orb-day-scope");
    expect(day).toHaveAttribute("data-android-day-active", "false");
    act(() => useThemeStore.setState({ appliedTheme: "paper" }));
    rerender(tree(null));
    expect(screen.queryByTestId("private-diary")).not.toBeInTheDocument();
    expect(day.isConnected).toBe(true);
    expect(day).toHaveAttribute("data-android-day-active", "false");
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
    rerender(tree("orb"));
    expect(screen.getByTestId("day-cosmic-background")).toBe(day);
    rerender(tree("orb", false));
    expect(day.isConnected).toBe(false);
    expect(screen.getAllByTestId("day-cosmic-background")).toHaveLength(1);
    expect(document.querySelector("[data-cosmic-scene-frame]")).toBeNull();
    unmount();
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
  });

  it.each(["anchor-name", "position-anchor", "top", "width"])(
    "keeps original placement when the engine lacks %s",
    (unsupported) => {
      vi.stubGlobal("CSS", { supports: (property: string) => property !== unsupported });
      const { rerender } = render(
        <RetainedCosmicSceneProvider enabled><section data-testid="page"><CosmicBgAdapter /></section></RetainedCosmicSceneProvider>,
      );
      const day = screen.getByTestId("day-cosmic-background");
      expect(screen.getByTestId("page")).toContainElement(day);
      expect(document.querySelector("[data-cosmic-scene-frame]")).toBeNull();
      rerender(<RetainedCosmicSceneProvider enabled>{null}</RetainedCosmicSceneProvider>);
      expect(day.isConnected).toBe(false);
    },
  );

  it("pauses the connected stationary scene during Suspense and reveals the same parent", async () => {
    vi.stubGlobal("CSS", { supports: () => true });
    let suspended = false;
    let resolvePending: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { resolvePending = resolve; });
    function Page() {
      if (suspended) use(pending);
      return <section><CosmicBgAdapter /></section>;
    }
    const tree = () => (
      <RetainedCosmicSceneProvider enabled>
        <Suspense fallback={<div data-testid="loading" />}><Page /></Suspense>
      </RetainedCosmicSceneProvider>
    );
    const { rerender } = render(tree());
    const day = screen.getByTestId("day-cosmic-background");
    const frame = day.closest("[data-cosmic-scene-frame]");
    await act(async () => { suspended = true; rerender(tree()); });
    expect(screen.getByTestId("loading")).toBeInTheDocument();
    expect(day.isConnected).toBe(true);
    expect(day).toHaveAttribute("data-android-day-active", "false");
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
    await act(async () => { suspended = false; resolvePending(); await pending; });
    await waitFor(() => expect(screen.queryByTestId("loading")).not.toBeInTheDocument());
    expect(screen.getByTestId("day-cosmic-background")).toBe(day);
    expect(day.closest("[data-cosmic-scene-frame]")).toBe(frame);
    expect(day).toHaveAttribute("data-android-day-active", "true");
  });

  it("allocates nothing before a slot, retains one scene, and fences obsolete cleanup", () => {
    const mounted = vi.fn();
    const disposed = vi.fn();
    function Scene({ active, activationKey }: CosmicSceneActivity) {
      useLayoutEffect(() => {
        mounted();
        return disposed;
      }, []);
      return <div data-testid="scene" data-active={active} data-visit={activationKey} />;
    }
    const renderScene = (activity: CosmicSceneActivity) => <Scene {...activity} />;
    const tree = (first: boolean, second: boolean) => (
      <CosmicSceneHostProvider renderScene={renderScene}>
        {first && <Slot key="first" name="first" />}
        {second && <Slot key="second" name="second" />}
      </CosmicSceneHostProvider>
    );
    const { rerender, unmount } = render(tree(false, false));
    expect(mounted).not.toHaveBeenCalled();

    rerender(tree(true, false));
    const scene = screen.getByTestId("scene");
    expect(mounted).toHaveBeenCalledTimes(1);
    rerender(tree(true, true));
    expect(screen.getByTestId("slot-second")).toContainElement(scene);
    rerender(tree(false, true));
    expect(screen.getByTestId("slot-second")).toContainElement(scene);
    expect(scene).toHaveAttribute("data-active", "true");

    rerender(tree(false, false));
    expect(scene.isConnected).toBe(false);
    expect(scene).toHaveAttribute("data-active", "false");
    expect(disposed).not.toHaveBeenCalled();
    rerender(tree(true, false));
    expect(screen.getByTestId("scene") === scene).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(1);
    unmount();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(scene.isConnected).toBe(false);
  });

  it("retains daylight through StrictMode page remounts and releases the body lease on exit", () => {
    const tree = (page: string | null) => (
      <StrictMode>
        <RetainedCosmicSceneProvider enabled>
          {page && <section key={page}><CosmicBgAdapter /></section>}
        </RetainedCosmicSceneProvider>
      </StrictMode>
    );
    const { rerender, unmount } = render(tree("orb"));
    const day = screen.getByTestId("day-cosmic-background");
    rerender(tree("diary"));
    expect(screen.getByTestId("day-cosmic-background") === day).toBe(true);
    expect(screen.getAllByTestId("day-cosmic-background")).toHaveLength(1);
    rerender(tree(null));
    expect(day.isConnected).toBe(false);
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
    rerender(tree("orb"));
    expect(screen.getByTestId("day-cosmic-background") === day).toBe(true);
    expect(document.body).toHaveClass("android-day-orb-opaque-surface");
    unmount();
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
  });

  it("restarts night decoration per visit while retaining the inactive daylight scene", () => {
    const tree = (page: string) => (
      <RetainedCosmicSceneProvider enabled>
        <section key={page}><CosmicBgAdapter /></section>
      </RetainedCosmicSceneProvider>
    );
    const { rerender } = render(tree("orb"));
    const day = screen.getByTestId("day-cosmic-background");
    act(() => useThemeStore.setState({ appliedTheme: "ink" }));
    const night = screen.getByTestId("cosmic-orb-background");
    expect(day).toHaveAttribute("data-android-day-active", "false");
    rerender(tree("diary"));
    expect(screen.getByTestId("cosmic-orb-background") === night).toBe(false);
    expect(screen.getByTestId("day-cosmic-background") === day).toBe(true);
    act(() => useThemeStore.setState({ appliedTheme: "paper" }));
    expect(screen.queryByTestId("cosmic-orb-background")).not.toBeInTheDocument();
    expect(day).toHaveAttribute("data-android-day-active", "true");
  });

  it("keeps original page-owned scenery when retention is disabled", () => {
    const tree = (page: string) => (
      <RetainedCosmicSceneProvider enabled={false}>
        <section key={page}><CosmicBgAdapter /></section>
      </RetainedCosmicSceneProvider>
    );
    const { rerender, container } = render(tree("orb"));
    const day = screen.getByTestId("day-cosmic-background");
    rerender(tree("diary"));
    expect(screen.getByTestId("day-cosmic-background") === day).toBe(false);
    expect(container.querySelector("[data-cosmic-scene-host]")).toBeNull();
    expect(container.querySelector("[data-cosmic-scene-slot]")).toBeNull();
  });

  it("preserves page state when scene retention is toggled without navigating", () => {
    const mounted = vi.fn();
    function CurrentPage() {
      const [section, setSection] = useState("list");
      useLayoutEffect(() => { mounted(); }, []);
      return (
        <section>
          <CosmicBgAdapter />
          <button onClick={() => setSection("settings")}>{section}</button>
        </section>
      );
    }
    const tree = (enabled: boolean) => (
      <RetainedCosmicSceneProvider enabled={enabled}>
        <CurrentPage />
      </RetainedCosmicSceneProvider>
    );
    const { rerender } = render(tree(true));
    fireEvent.click(screen.getByRole("button", { name: "list" }));
    rerender(tree(false));
    expect(screen.getByRole("button", { name: "settings" })).toBeInTheDocument();
    rerender(tree(true));
    expect(screen.getByRole("button", { name: "settings" })).toBeInTheDocument();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId("day-cosmic-background")).toHaveLength(1);
  });

  it("detaches during Suspense layout cleanup and reacquires the same scene on reveal", async () => {
    let suspended = false;
    let resolvePending: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { resolvePending = resolve; });
    function CurrentPage() {
      if (suspended) use(pending);
      return <CosmicBgAdapter />;
    }
    const tree = () => (
      <RetainedCosmicSceneProvider enabled>
        <Suspense fallback={<div data-testid="route-loading" />}>
          <CurrentPage />
        </Suspense>
      </RetainedCosmicSceneProvider>
    );
    const { rerender } = render(tree());
    const day = screen.getByTestId("day-cosmic-background");
    await act(async () => {
      suspended = true;
      rerender(tree());
    });
    expect(screen.getByTestId("route-loading")).toBeInTheDocument();
    expect(day.isConnected).toBe(false);
    expect(day).toHaveAttribute("data-android-day-active", "false");
    expect(document.body).not.toHaveClass("android-day-orb-opaque-surface");
    await act(async () => {
      suspended = false;
      resolvePending();
      await pending;
    });
    await waitFor(() => {
      expect(screen.queryByTestId("route-loading")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("day-cosmic-background") === day).toBe(true);
    expect(day).toHaveAttribute("data-android-day-active", "true");
  });
});
