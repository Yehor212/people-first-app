import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowPath = path.resolve(
  ".github/workflows/first-party-audio-review.yml"
);

test("review workflow is least-privileged and publishes the exact 26-file pack", () => {
  assert.equal(fs.existsSync(workflowPath), true, "workflow file must exist");
  const source = fs.readFileSync(workflowPath, "utf8");

  assert.match(source, /name:\s*First-Party Audio Review Artifact/);
  assert.match(source, /codex\/first-party-audio-reconstruction-v5/);
  assert.match(source, /workflow_dispatch:/);
  assert.match(source, /permissions:\s*\n\s+contents:\s*read/);
  assert.doesNotMatch(source, /contents:\s*write|pull-requests:\s*write|id-token:\s*write/);
  assert.doesNotMatch(source, /\bsecrets\./);
  assert.doesNotMatch(source, /npm\s+(?:ci|install)/);
  assert.match(source, /sudo apt-get update/);
  assert.match(source, /sudo apt-get install --no-install-recommends --yes ffmpeg/);
  assert.doesNotMatch(source, /ffmpeg -version \| head|ffprobe -version \| head/);

  assert.match(
    source,
    /node --expose-gc --test[\s\S]*scripts\/audio-review\/__tests__\/generate-first-party-review-pack\.test\.mjs[\s\S]*scripts\/audio-review\/__tests__\/first-party-audio-review-workflow\.test\.mjs/
  );
  assert.match(
    source,
    /node --expose-gc scripts\/audio-review\/generate-first-party-review-pack\.mjs[\s\S]*--output output\/first-party-audio-review/
  );
  assert.match(source, /first-party-audio-review\.zip/);
  assert.match(source, /SHA256SUMS/);
  assert.match(source, /actions\/upload-artifact@[0-9a-f]{40}/);
  assert.match(source, /if-no-files-found:\s*error/);
  assert.match(source, /retention-days:\s*30/);
});
