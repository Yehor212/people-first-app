/**
 * In-App Update Plugin
 * Checks for app updates on Google Play and prompts users to update.
 * Uses the Google Play Core In-App Updates API.
 */

import { registerPlugin } from '@capacitor/core';
import type { AppUpdatePlugin } from './appUpdateTypes';
export type { AppUpdateInfo, AppUpdatePlugin } from './appUpdateTypes';

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate', {
  web: () => import('./AppUpdateWeb').then(m => new m.AppUpdateWeb()),
});

export default AppUpdate;
