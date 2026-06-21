import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parsePublicAuthUrls, resolvePublicAuthUrls } = require(
  "../smoke-public-auth-providers.cjs",
);

describe("public auth smoke URL parsing", () => {
  it("defaults to the canonical public root URL", () => {
    expect(parsePublicAuthUrls(undefined).map((url: URL) => url.toString())).toEqual([
      "https://yehor212.github.io/people-first-app/",
    ]);
  });

  it("keeps multiple canonical URLs in order and drops URL hashes", () => {
    expect(
      parsePublicAuthUrls(
        [
          "https://yehor212.github.io/people-first-app/#ignored",
          "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone#ignored",
        ].join(","),
      ).map((url: URL) => url.toString()),
    ).toEqual([
      "https://yehor212.github.io/people-first-app/",
      "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
    ]);
  });

  it("builds additional route URLs from the deployed page URL", () => {
    expect(
      resolvePublicAuthUrls({
        baseUrl: "https://yehor212.github.io/people-first-app/",
        additionalPaths: "orb/?nav=v2&navLayout=phone",
      }).map((url: URL) => url.toString()),
    ).toEqual([
      "https://yehor212.github.io/people-first-app/",
      "https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone",
    ]);
  });
});
