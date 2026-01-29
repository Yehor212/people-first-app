/**
 * In-App Review Plugin
 * Prompts users to rate the app on Google Play Store using the native In-App Review API.
 */

import { registerPlugin } from '@capacitor/core';

export interface ReviewPlugin {
  /**
   * Request an in-app review from the user.
   * Note: Google Play may not always show the review dialog (rate limiting, etc.)
   */
  requestReview(): Promise<void>;

  /**
   * Check if in-app review is supported on this platform.
   */
  isSupported(): Promise<{ supported: boolean }>;
}

const Review = registerPlugin<ReviewPlugin>('Review', {
  web: () => import('./ReviewWeb').then(m => new m.ReviewWeb()),
});

export default Review;
