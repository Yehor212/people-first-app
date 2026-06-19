import { useEffect } from "react";

const V2_EDGE_TO_EDGE_CLASS = "zenflow-v2-edge-to-edge";
const V2_FULLSCREEN_SURFACE = "v2";

export function useV2FullscreenSurface() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const root = document.documentElement;
    const body = document.body;

    root.classList.add(V2_EDGE_TO_EDGE_CLASS);
    body.classList.add(V2_EDGE_TO_EDGE_CLASS);
    root.dataset.fullscreenSurface = V2_FULLSCREEN_SURFACE;
    body.dataset.fullscreenSurface = V2_FULLSCREEN_SURFACE;

    return () => {
      root.classList.remove(V2_EDGE_TO_EDGE_CLASS);
      body.classList.remove(V2_EDGE_TO_EDGE_CLASS);

      if (root.dataset.fullscreenSurface === V2_FULLSCREEN_SURFACE) {
        delete root.dataset.fullscreenSurface;
      }
      if (body.dataset.fullscreenSurface === V2_FULLSCREEN_SURFACE) {
        delete body.dataset.fullscreenSurface;
      }
    };
  }, []);
}
