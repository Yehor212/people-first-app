/**
 * Web fallback for Review Plugin
 * On web, we redirect to the Play Store page instead.
 */

import type { ReviewPlugin } from './ReviewPlugin';
import { logger } from '@/lib/logger';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zenflow.app';

export class ReviewWeb implements ReviewPlugin {
  async requestReview(): Promise<void> {
    logger.log('[Review] Web fallback - opening Play Store');
    // On web, open the Play Store page in a new tab
    window.open(PLAY_STORE_URL, '_blank');
  }

  async isSupported(): Promise<{ supported: boolean }> {
    // Web can always redirect to Play Store
    return { supported: true };
  }
}
