import { Browser } from "@capacitor/browser";
import { isNative } from "@/lib/platform";
import { logger } from "@/lib/logger";

export async function openOAuthUrl(url: string): Promise<void> {
  if (!isNative) {
    window.location.assign(url);
    return;
  }

  await Browser.open({ url });
}

export async function closeOAuthBrowser(): Promise<void> {
  if (!isNative) return;

  try {
    await Browser.close();
  } catch (error) {
    logger.warn("[Auth]", "OAuth browser close failed:", error);
  }
}
