import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const modulePath = path.resolve(
  "scripts/audio-review/generate-first-party-review-pack.mjs"
);

test("generator module exists", async () => {
  assert.equal(fs.existsSync(modulePath), true);
  const generator = await import(pathToFileURL(modulePath).href);
  assert.equal(generator.EXPECTED_FILE_NAMES.length, 26);
});

test("representative PCM rendering is deterministic", async () => {
  const generator = await import(pathToFileURL(modulePath).href);
  const definitions = generator.createDefinitions({ durationScale: 0.02 });
  for (const id of ["forest:soft", "soft-air-veil", "feedback-success"]) {
    const definition = definitions.find((item) => item.id === id);
    assert.ok(definition);
    const first = generator.renderAsset(definition);
    const second = generator.renderAsset(definition);
    const firstHash = crypto
      .createHash("sha256")
      .update(Buffer.from(first.buffer))
      .digest("hex");
    const secondHash = crypto
      .createHash("sha256")
      .update(Buffer.from(second.buffer))
      .digest("hex");
    assert.equal(firstHash, secondHash, id);
  }
});

test(
  "reduced integration build writes exact review-only evidence",
  { timeout: 600_000 },
  async () => {
    const generator = await import(pathToFileURL(modulePath).href);
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "zenflow-audio-review-"));
    try {
      const verification = generator.buildReviewPack({
        outputDir: output,
        durationScale: 0.02,
      });
      assert.equal(verification.status, "PASS");
      assert.equal(verification.assetCount, 26);
      assert.equal(verification.runtimeModified, false);
      assert.equal(verification.humanListening, "UNVERIFIED");
      assert.deepEqual(Object.values(verification.platformPlayback), [
        "UNVERIFIED",
        "UNVERIFIED",
        "UNVERIFIED",
        "UNVERIFIED",
        "UNVERIFIED",
      ]);

      const provenance = JSON.parse(
        fs.readFileSync(
          path.join(output, "evidence", "provenance.json"),
          "utf8"
        )
      );
      assert.equal(provenance.assets.length, 26);
      assert.deepEqual(
        provenance.assets.map((item) => item.fileName),
        generator.EXPECTED_FILE_NAMES
      );

      for (const item of provenance.assets) {
        assert.equal(
          item.sourceType,
          "first-party-deterministic-procedural-synthesis"
        );
        assert.equal(item.thirdPartySamples, false);
        assert.equal(item.stockRecordings, false);
        assert.equal(item.voices, false);
        assert.equal(item.aiGeneratedAudioInputs, false);
        assert.equal(item.recoveredExternalBinaryInputs, false);
        const file = path.join(output, item.relativePath);
        assert.equal(fs.existsSync(file), true, item.fileName);
        const hash = crypto
          .createHash("sha256")
          .update(fs.readFileSync(file))
          .digest("hex");
        assert.equal(hash, item.sha256, item.fileName);
      }

      const rights = JSON.parse(
        fs.readFileSync(
          path.join(output, "evidence", "rights-ledger.json"),
          "utf8"
        )
      );
      assert.equal(rights.status, "REVIEW_ONLY");
      assert.equal(rights.releaseAuthorization, false);
      assert.equal(rights.ownerLicenseDecision, "UNVERIFIED");
      assert.equal(rights.formalLegalReview, "UNVERIFIED");

      for (const family of generator.FAMILIES) {
        const record = verification.intensityProgression[family];
        assert.equal(record.status, "PASS");
        assert.ok(record.gaps.every((gap) => gap >= 3), family);
      }
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  }
);
