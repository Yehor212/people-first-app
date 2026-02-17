/**
 * Centralized platform detection (TD-21)
 * Single source of truth — replaces scattered Capacitor.isNativePlatform() / getPlatform() calls
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
export const isAndroid = platform === 'android';
export const isIos = platform === 'ios';
export const isWeb = platform === 'web';
