import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowPath = path.resolve(".github/workflows/cc0-kimi-audio-review.yml");

test("CC0 review workflow is least-privileged and publishes the exact review pack", () => {
  assert.equal(fs.existsSync(workflowPath), true);
  const source = fs.readFileSync(workflowPath, "utf8");

  assert.match(source, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(source, /contents:\s*write/);
  assert.doesNotMatch(source, /pull-requests:\s*write/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /sudo apt-get install --no-install-recommends --yes ffmpeg zip/);
  assert.match(source, /generate-cc0-kimi-review-pack\.mjs/);
  assert.match(source, /verification\.assetCount !== 26/);
  assert.match(source, /verification\.sourceRightsDocumented !== true/);
  assert.match(source, /verification\.releaseAuthorization !== false/);
  assert.match(source, /maximumCorrelation >= 0\.995/);
  assert.match(source, /find "\$root\/audio" -type f -name '\*\.mp3'/);
  assert.match(source, /test "\$\(find "\$root\/spectrograms" -type f -name '\*\.png' \| wc -l\)" -eq 26/);
  assert.match(source, /actions\/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10/);
  assert.match(source, /actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/);
  assert.match(source, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.match(source, /cc0-kimi-audio-failure-\$\{\{ github\.sha \}\}/);
  assert.match(source, /output\/cc0-kimi-source-cache\/2679\.mp3/);
  assert.match(source, /retention-days: 1/);
  assert.match(source, /retention-days: 30/);
  assert.match(source, /git diff --exit-code -- public\/sounds docs\/sounds src\/sw\.ts android ios src-tauri/);
});
