import { describe, expect, it } from "vitest";

import {
  isServiceWorkerMessageData,
  isTrustedServiceWorkerMessage,
} from "../serviceWorkerMessages";

function messageEvent(data: unknown, origin: string, scriptURL: string): MessageEvent {
  return {
    data,
    origin,
    source: { scriptURL } as ServiceWorker,
  } as MessageEvent;
}

describe("serviceWorkerMessages", () => {
  it("accepts only known message types", () => {
    expect(isServiceWorkerMessageData({ type: "SW_UPDATED" })).toBe(true);
    expect(isServiceWorkerMessageData({ type: "SYNC_REQUESTED" })).toBe(true);
    expect(isServiceWorkerMessageData({ type: "CLEAR_CACHES" })).toBe(false);
  });

  it("requires matching event origin and service worker script origin", () => {
    expect(
      isTrustedServiceWorkerMessage(
        messageEvent(
          { type: "SW_UPDATED" },
          "https://yehor212.github.io",
          "https://yehor212.github.io/people-first-app/sw.js"
        ),
        "https://yehor212.github.io"
      )
    ).toBe(true);

    expect(
      isTrustedServiceWorkerMessage(
        messageEvent(
          { type: "SW_UPDATED" },
          "https://evil.example",
          "https://yehor212.github.io/people-first-app/sw.js"
        ),
        "https://yehor212.github.io"
      )
    ).toBe(false);

    expect(
      isTrustedServiceWorkerMessage(
        messageEvent(
          { type: "SW_UPDATED" },
          "https://yehor212.github.io",
          "https://evil.example/sw.js"
        ),
        "https://yehor212.github.io"
      )
    ).toBe(false);
  });
});
