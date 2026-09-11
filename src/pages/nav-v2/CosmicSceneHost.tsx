import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./CosmicSceneHost.css";

export interface CosmicSceneActivity {
  active: boolean;
  activationKey: number;
}

type AcquireScene = (slot: HTMLElement) => () => void;
const CosmicSceneHostContext = createContext<AcquireScene | null>(null);
const CosmicScenePlacementContext = createContext(false);
const CosmicSceneDecorationTargetContext = createContext<HTMLElement | null>(null);

interface OwnedScene extends CosmicSceneActivity {
  host: HTMLDivElement;
}

/** Owns decoration only; page content and private state never enter this host. */
export function CosmicSceneHostProvider({
  children,
  enabled = true,
  placement = "page",
  sceneClassName = "",
  renderScene,
}: {
  children: ReactNode;
  enabled?: boolean;
  placement?: "page" | "anchored";
  sceneClassName?: string;
  renderScene: (activity: CosmicSceneActivity) => ReactNode;
}) {
  const anchored = placement === "anchored";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const anchorSlotRef = useRef<HTMLElement | null>(null);
  const leaseRef = useRef<symbol | null>(null);
  const [scene, setScene] = useState<OwnedScene | null>(null);

  const attachFrame = useCallback((frame: HTMLDivElement | null) => {
    frameRef.current = frame;
    const host = hostRef.current;
    if (frame && host && host.parentNode !== frame) frame.appendChild(host);
  }, []);

  const acquireScene = useCallback<AcquireScene>((slot) => {
    let host = hostRef.current;
    if (!host) {
      host = slot.ownerDocument.createElement("div");
      host.className = "contents";
      host.dataset.cosmicSceneHost = "true";
      hostRef.current = host;
    }
    const lease = Symbol("cosmic-scene-lease");
    leaseRef.current = lease;
    // React owns the scene children, not the empty host. Supported Android
    // engines keep its parent fixed; only the current empty slot owns an anchor.
    // The legacy path preserves the original page's containing block unchanged.
    if (anchored) {
      anchorSlotRef.current?.removeAttribute("data-cosmic-scene-anchor");
      slot.setAttribute("data-cosmic-scene-anchor", "true");
      anchorSlotRef.current = slot;
      const frame = frameRef.current;
      if (frame && host.parentNode !== frame) frame.appendChild(host);
    } else {
      slot.appendChild(host);
    }
    const ownedHost = host;
    setScene((previous) => ({
      host: ownedHost,
      active: true,
      activationKey: (previous?.activationKey ?? 0) + 1,
    }));

    return () => {
      if (leaseRef.current !== lease) return;
      // Read the resolved anchor size before removing its slot. Keeping the
      // paint dimensions avoids throwing away the static raster on every exit.
      const frame = anchored ? frameRef.current : null;
      if (frame) {
        // CSS serialization rounds fractional layout dimensions; preserving the
        // exact rect avoids a resize (and full reraster) when the slot returns.
        const { width, height } = frame.getBoundingClientRect();
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
          frame.style.setProperty("--cosmic-scene-retained-width", `${width}px`);
          frame.style.setProperty("--cosmic-scene-retained-height", `${height}px`);
          frame.dataset.retainedPaint = "true";
        }
      }
      leaseRef.current = null;
      anchorSlotRef.current?.removeAttribute("data-cosmic-scene-anchor");
      anchorSlotRef.current = null;
      if (!anchored) ownedHost.remove();
      setScene((previous) => (previous ? { ...previous, active: false } : previous));
    };
  }, [anchored]);

  useLayoutEffect(() => {
    if (!enabled) {
      leaseRef.current = null;
      anchorSlotRef.current?.removeAttribute("data-cosmic-scene-anchor");
      anchorSlotRef.current = null;
      hostRef.current?.remove();
      setScene(null);
    }
  }, [enabled]);

  useLayoutEffect(
    () => () => {
      leaseRef.current = null;
      anchorSlotRef.current?.removeAttribute("data-cosmic-scene-anchor");
      hostRef.current?.remove();
    },
    []
  );

  return (
    <CosmicSceneHostContext.Provider value={enabled ? acquireScene : null}>
      <CosmicScenePlacementContext.Provider value={enabled && anchored}>
        <CosmicSceneDecorationTargetContext.Provider
          value={enabled && anchored ? scene?.host ?? null : null}
        >
          {children}
          {enabled && anchored && (
            <div
              ref={attachFrame}
              aria-hidden="true"
              className={`cosmic-scene-frame ${sceneClassName}`}
              data-cosmic-scene-frame="true"
              data-active={scene?.active ? "true" : "false"}
            />
          )}
          {enabled && scene && createPortal(renderScene(scene), scene.host)}
        </CosmicSceneDecorationTargetContext.Provider>
      </CosmicScenePlacementContext.Provider>
    </CosmicSceneHostContext.Provider>
  );
}

export function useCosmicSceneHost(): AcquireScene | null {
  return useContext(CosmicSceneHostContext);
}

/** Relocates decoration only; its page still owns mounting and cleanup. */
export function CosmicSceneDecoration({ children }: { children: ReactNode }) {
  const anchored = useContext(CosmicScenePlacementContext);
  const target = useContext(CosmicSceneDecorationTargetContext);
  return anchored ? (target ? createPortal(children, target) : null) : children;
}

export function CosmicSceneSlot({ acquireScene }: { acquireScene: AcquireScene }) {
  const anchored = useContext(CosmicScenePlacementContext);
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (slot) return acquireScene(slot);
  }, [acquireScene]);

  return (
    <div
      ref={slotRef}
      className={anchored ? "cosmic-scene-slot" : "contents"}
      data-cosmic-scene-slot="true"
    />
  );
}
