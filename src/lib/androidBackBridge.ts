import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface AndroidBackInvokedEvent {
  canGoBack: boolean;
  /** Native snapshot taken before React or a WebView layer can unmount. */
  hadVisibleLayer: boolean;
  revision: number;
}

interface AndroidBackState {
  canConsume: boolean;
  hasVisibleLayer: boolean;
  revision: number;
}

interface AndroidBackNativePlugin {
  setState(options: {
    canConsume: boolean;
    hasVisibleLayer: boolean;
  }): Promise<AndroidBackState>;
  addListener(
    eventName: "backInvoked",
    listener: (event: AndroidBackInvokedEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const AndroidBackBridge = registerPlugin<AndroidBackNativePlugin>("AndroidBack");
