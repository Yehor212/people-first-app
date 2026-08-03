export type PushNotificationType = "mood" | "habit" | "focus" | "test";

export interface PushDeviceTarget {
  id: string;
  token: string;
  platform: "android";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUSH_TYPES = new Set<PushNotificationType>([
  "mood",
  "habit",
  "focus",
  "test",
]);

export function isPushNotificationType(value: unknown): value is PushNotificationType {
  return typeof value === "string" && PUSH_TYPES.has(value as PushNotificationType);
}

export function isAndroidPushTarget(value: unknown): value is PushDeviceTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    UUID_PATTERN.test(candidate.id) &&
    typeof candidate.token === "string" &&
    candidate.token.length >= 8 &&
    candidate.token.length <= 4096 &&
    candidate.platform === "android"
  );
}

export function buildRealmBoundAndroidMessage(
  target: PushDeviceTarget,
  type: PushNotificationType,
) {
  return {
    message: {
      token: target.token,
      data: {
        zenflow_delivery_version: "1",
        zenflow_install_id: target.id,
        zenflow_notification_type: type,
      },
      android: {
        priority: "high",
        ttl: "0s",
      },
    },
  } as const;
}
