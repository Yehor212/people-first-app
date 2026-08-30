import { registerPlugin } from "@capacitor/core";
import { isAndroid, isNative } from "@/lib/platform";

export const PUSH_REALM_LANGUAGES = [
  "en",
  "uk",
  "es",
  "de",
  "fr",
  "ja",
  "ar",
  "he",
] as const;

export type PushRealmLanguage = (typeof PUSH_REALM_LANGUAGES)[number];

export const PUSH_REALM_CHANNEL_IDS = [
  "zenflow_default_v4",
  "zenflow_furin_v5",
  "zenflow_gentle_v4",
  "zenflow_silent_v4",
] as const;

export type PushRealmChannelId = (typeof PUSH_REALM_CHANNEL_IDS)[number];

export interface PushRealmPresentation {
  language: PushRealmLanguage;
  channelId: PushRealmChannelId;
}

export interface PushRealmActivation extends PushRealmPresentation {
  installationId: string;
}

interface PushRealmPlugin {
  activate(options: PushRealmActivation): Promise<void>;
  suspend(): Promise<void>;
  updatePresentation(options: Partial<PushRealmPresentation>): Promise<void>;
}

const CANONICAL_RFC_4122_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PushRealm = registerPlugin<PushRealmPlugin>("PushRealm");

function isNativeAndroidPushRealmAvailable(): boolean {
  return isNative && isAndroid;
}

export function isCanonicalPushRealmId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_RFC_4122_UUID.test(value);
}

export function isPushRealmLanguage(value: unknown): value is PushRealmLanguage {
  return (
    typeof value === "string" &&
    (PUSH_REALM_LANGUAGES as readonly string[]).includes(value)
  );
}

export function isPushRealmChannelId(value: unknown): value is PushRealmChannelId {
  return (
    typeof value === "string" &&
    (PUSH_REALM_CHANNEL_IDS as readonly string[]).includes(value)
  );
}

export async function activateNativePushRealm(
  activation: PushRealmActivation,
): Promise<void> {
  if (!isNativeAndroidPushRealmAvailable()) return;
  if (
    !isCanonicalPushRealmId(activation.installationId) ||
    !isPushRealmLanguage(activation.language) ||
    !isPushRealmChannelId(activation.channelId)
  ) {
    throw new TypeError("Invalid native push realm activation");
  }
  await PushRealm.activate(activation);
}

export async function suspendNativePushRealm(): Promise<void> {
  if (!isNativeAndroidPushRealmAvailable()) return;
  await PushRealm.suspend();
}

export async function updateNativePushPresentation(
  presentation: Partial<PushRealmPresentation>,
): Promise<void> {
  if (!isNativeAndroidPushRealmAvailable()) return;
  if (
    (presentation.language !== undefined &&
      !isPushRealmLanguage(presentation.language)) ||
    (presentation.channelId !== undefined &&
      !isPushRealmChannelId(presentation.channelId)) ||
    (presentation.language === undefined && presentation.channelId === undefined)
  ) {
    throw new TypeError("Invalid native push presentation");
  }
  await PushRealm.updatePresentation(presentation);
}
