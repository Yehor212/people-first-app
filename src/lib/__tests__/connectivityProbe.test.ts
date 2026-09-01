import { describe, expect, it } from "vitest";

import {
  buildConnectivityProbeUrl,
  isNetworkOnlyConnectivityProbeUrl,
} from "@/lib/connectivityProbe";

describe("connectivityProbe", () => {
  it("marks the scoped version endpoint as a network-only connectivity request", () => {
    expect(buildConnectivityProbeUrl("https://example.test/people-first-app/")).toBe(
      "https://example.test/people-first-app/version.json?zenflow-connectivity-probe=network-only",
    );
  });

  it("matches only the exact same-origin endpoint inside the service-worker scope", () => {
    const scope = "https://example.test/people-first-app/";
    const valid = new URL(buildConnectivityProbeUrl(scope));

    expect(isNetworkOnlyConnectivityProbeUrl(valid, scope)).toBe(true);
    expect(
      isNetworkOnlyConnectivityProbeUrl(
        new URL("https://example.test/people-first-app/version.json"),
        scope,
      ),
    ).toBe(false);
    expect(
      isNetworkOnlyConnectivityProbeUrl(
        new URL(
          "https://example.test/people-first-app/version.json?zenflow-connectivity-probe=cached",
        ),
        scope,
      ),
    ).toBe(false);
    expect(
      isNetworkOnlyConnectivityProbeUrl(
        new URL(
          "https://other.test/people-first-app/version.json?zenflow-connectivity-probe=network-only",
        ),
        scope,
      ),
    ).toBe(false);
    expect(
      isNetworkOnlyConnectivityProbeUrl(
        new URL(
          "https://example.test/other/version.json?zenflow-connectivity-probe=network-only",
        ),
        scope,
      ),
    ).toBe(false);
  });
});
