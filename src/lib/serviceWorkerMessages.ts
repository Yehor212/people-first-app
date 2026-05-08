const SERVICE_WORKER_MESSAGE_TYPES = ["SW_UPDATED", "SYNC_REQUESTED"] as const;

export type ServiceWorkerMessageType = (typeof SERVICE_WORKER_MESSAGE_TYPES)[number];

export interface ServiceWorkerMessage {
  type: ServiceWorkerMessageType;
}

function hasTrustedOrigin(url: string, expectedOrigin: string): boolean {
  try {
    return new URL(url).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function hasServiceWorkerScriptURL(source: MessageEventSource | null): source is ServiceWorker {
  return Boolean(
    source &&
      typeof source === "object" &&
      "scriptURL" in source &&
      typeof (source as { scriptURL?: unknown }).scriptURL === "string"
  );
}

export function isServiceWorkerMessageData(data: unknown): data is ServiceWorkerMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    SERVICE_WORKER_MESSAGE_TYPES.includes(type as ServiceWorkerMessageType)
  );
}

export function isTrustedServiceWorkerMessage(
  event: MessageEvent,
  expectedOrigin: string
): event is MessageEvent<ServiceWorkerMessage> {
  if (event.origin !== expectedOrigin) return false;
  if (!hasServiceWorkerScriptURL(event.source)) return false;
  if (!hasTrustedOrigin(event.source.scriptURL, expectedOrigin)) return false;
  return isServiceWorkerMessageData(event.data);
}
