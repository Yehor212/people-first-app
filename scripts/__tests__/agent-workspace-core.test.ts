import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  CANONICAL_REMOTE_ID,
  isCanonicalRemoteUrl,
  normalizeRemoteUrl,
  validateCreateRequest,
} = require("../agent-workspace-core.cjs");

describe("agent workspace pure safety decisions", () => {
  it.each([
    "https://github.com/Yehor212/people-first-app.git",
    "git@github.com:Yehor212/people-first-app.git",
    "ssh://git@github.com/Yehor212/people-first-app.git",
  ])("normalizes canonical Git transports: %s", (remote) => {
    expect(normalizeRemoteUrl(remote)).toBe(CANONICAL_REMOTE_ID);
    expect(isCanonicalRemoteUrl(remote)).toBe(true);
  });

  it.each([
    "https://fake-user:fake-secret@github.com/Yehor212/people-first-app.git",
    "https://@github.com/Yehor212/people-first-app.git",
    "ssh://git:@github.com/Yehor212/people-first-app.git",
    "https://github.com/foo/../Yehor212/people-first-app.git",
    "https://github.com:443/Yehor212/people-first-app.git",
    "https://github.com/Yehor212/people-first-app.git?transport=unsafe",
    "https://github.com/Yehor212/people-first-app.git#fragment",
    "http://github.com/Yehor212/people-first-app.git",
    "git@example.com:Yehor212/people-first-app.git",
  ])("rejects a credential-bearing or non-canonical remote URL: %s", (remote) => {
    expect(isCanonicalRemoteUrl(remote)).toBe(false);
  });

  it("rejects nested, existing, or non-agent worktree creation requests", () => {
    expect(
      validateCreateRequest({
        agent: "other",
        slug: "../main",
        targetPath: "/repo/control/nested",
        repoRoot: "/repo/control",
        branchExists: true,
        targetExists: true,
        worktreePaths: ["/repo/control"],
      })
    ).toMatchObject({ ok: false });
  });
});
