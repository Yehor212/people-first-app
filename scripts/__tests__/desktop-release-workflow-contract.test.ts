import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Desktop release workflow contract", () => {
  it("protects desktop signing and release creation behind an environment with job-scoped write permission", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toMatch(/permissions:\n  contents: read/);
    expect(workflow).toContain("environment:\n      name: desktop-release-signing");
    expect(workflow).toContain("permissions:\n      contents: write");
    expect(workflow.indexOf("environment:\n      name: desktop-release-signing")).toBeLessThan(
      workflow.indexOf("name: Sign Windows artifacts"),
    );
  });

  it("uses reproducible npm ci installs before desktop release build/signing", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toContain("run: npm ci");
    expect(workflow).not.toContain("run: npm install");
    expect(workflow.indexOf("run: npm ci")).toBeLessThan(
      workflow.indexOf("run: npm run desktop:check"),
    );
  });

  it("guards desktop draft releases to main and rejects existing release tags", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toContain("name: Validate desktop release source and tag");
    expect(workflow).toContain("refs/heads/main");
    expect(workflow).toContain("desktop-v$version");
    expect(workflow).toContain("gh release view $tag");
    expect(workflow).toContain('git ls-remote --exit-code --tags origin "refs/tags/$tag"');
    expect(workflow.indexOf("name: Validate desktop release source and tag")).toBeLessThan(
      workflow.indexOf("name: Build desktop app"),
    );
  });
  it("keeps checkout credentials and GitHub contexts out of desktop pwsh scripts", () => {
    const workflow = readFileSync(".github/workflows/desktop-release.yml", "utf8");

    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("DESKTOP_RELEASE_REF: ${{ github.ref }}");
    expect(workflow).toContain("DESKTOP_RELEASE_REPOSITORY: ${{ github.repository }}");
    expect(workflow).toContain("DESKTOP_RELEASE_TAG: ${{ steps.meta.outputs.tag }}");
    expect(workflow).not.toContain('"${{ github.ref }}"');
    expect(workflow).not.toContain('"${{ github.repository }}"');
    expect(workflow).not.toContain('"${{ steps.meta.outputs.tag }}"');
    expect(workflow).not.toContain('"ZenFlow Desktop ${{ steps.meta.outputs.version }}"');
  });

});
