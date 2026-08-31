import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNative } from "@/lib/platform";
import type { Language } from "@/i18n/translations";

interface NativeLocalePlugin {
  setLocale(options: { language: Language }): Promise<{ language: Language }>;
}

const ZenFlowLocale = registerPlugin<NativeLocalePlugin>("ZenFlowLocale");

export async function syncNativeLocale(language: Language): Promise<void> {
  if (!isNative || !isAndroid) return;
  await ZenFlowLocale.setLocale({ language });
}
