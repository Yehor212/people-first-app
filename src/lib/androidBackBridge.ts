import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface AndroidBackInvokedEvent {
  canGoBack: boolean;
  /** Snapshot captured by native code before WebView/React can remove a layer. */
  hadVisibleLayer?: boolean;
}

interface AndroidBackNativePlugin {
  setState(options: {
    canConsume: boolean;
    hasVisibleLayer: boolean;
  }): Promise<{ canConsume: boolean; hasVisibleLayer: boolean } | void>;
  addListener(
    eventName: "backInvoked",
    listener: (event: AndroidBackInvokedEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const AndroidBackBridge = registerPlugin<AndroidBackNativePlugin>("AndroidBack");
