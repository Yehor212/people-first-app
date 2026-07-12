import { isNative } from '@/lib/platform';
import Widget from '@/plugins/WidgetPlugin';
import { cleanupAllAccountCacheFiles } from '@/lib/shareActions';

/**
 * Clear account-owned data exposed outside the main web view.
 *
 * Account-boundary callers treat rejection as a hard stop: completing an
 * account switch while a widget or native cache still contains the previous
 * account's data would be a cross-account privacy leak.
 */
export async function clearAccountDeviceSurfaces(): Promise<void> {
  if (!isNative) return;

  await Promise.all([
    Widget.clearAccountData(),
    cleanupAllAccountCacheFiles(),
  ]);
}
