/**
 * In-App Review Plugin
 * Prompts users to rate the app on Google Play Store using the native In-App Review API.
 */

import { registerPlugin } from '@capacitor/core';
import type { ReviewPlugin } from './reviewTypes';
export type { ReviewPlugin } from './reviewTypes';

const Review = registerPlugin<ReviewPlugin>('Review', {
  web: () => import('./ReviewWeb').then(m => new m.ReviewWeb()),
});

export default Review;
