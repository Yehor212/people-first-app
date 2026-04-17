import { useEffect, useState } from "react";

/**
 * Minimal snapshot of the Navigator Battery API.
 * `level` is in [0..1]; `charging` is true when plugged in.
 */
export interface BatteryState {
  level: number;
  charging: boolean;
}

/**
 * Subset of the BatteryManager interface we rely on.
 * Declared locally because `navigator.getBattery()` is absent from lib.dom.d.ts.
 */
interface BatteryManagerLike {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

/**
 * Reactive hook around Navigator.getBattery().
 *
 * Returns:
 *   - `null` when the API is unavailable (Safari/iOS never shipped it, Firefox removed it).
 *     Consumers MUST treat `null` as "no signal" — do NOT assume low battery.
 *   - `{ level, charging }` on supported browsers (Chromium-based: Chrome, Edge,
 *     Android WebView — which covers our Capacitor Android build).
 *
 * Cleanup: detaches `levelchange` + `chargingchange` listeners on unmount,
 * and guards setState against the resolving-after-unmount race (Law 25).
 */
export function useBatteryState(): BatteryState | null {
  const [state, setState] = useState<BatteryState | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== "function") return;

    let mounted = true;
    let battery: BatteryManagerLike | null = null;

    const sync = () => {
      if (!mounted || !battery) return;
      setState({ level: battery.level, charging: battery.charging });
    };

    nav.getBattery()
      .then((b) => {
        if (!mounted) return;
        battery = b;
        sync();
        battery.addEventListener("levelchange", sync);
        battery.addEventListener("chargingchange", sync);
      })
      .catch(() => {
        // API rejection — treat as unsupported. Keep state=null so consumers
        // cannot misread "permission denied" as "low battery".
      });

    return () => {
      mounted = false;
      if (battery) {
        battery.removeEventListener("levelchange", sync);
        battery.removeEventListener("chargingchange", sync);
      }
    };
  }, []);

  return state;
}
