import { describe, expect, it } from "vitest";

import { createJsonResponse, parseJsonBody } from "./http";

describe("Edge HTTP body limits", () => {
  it("rejects an oversized streamed body even without Content-Length", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(2048) }),
    });
    request.headers.delete("content-length");

    const [body, error] = await parseJsonBody(request, null, 128);

    expect(body).toBeNull();
    expect(error?.status).toBe(413);
  });

  it("parses a bounded JSON body", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ status: "ok" }),
    });

    const [body, error] = await parseJsonBody<{ status: string }>(
      request,
      null,
      128,
    );

    expect(error).toBeNull();
    expect(body).toEqual({ status: "ok" });
  });

  it("marks sensitive JSON responses as non-cacheable", () => {
    const response = createJsonResponse(null, 200, { status: "ok" });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
