import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "../hyperfocusGeneratedAudioManifest";
import { getHyperfocusAudioVariant } from "../hyperfocusAudioCatalog";

// Exact files selected by the owner from the 2026-09-10 PagDev audition packet.
// These independent digests must not be regenerated from the runtime manifest.
const SELECTED_FIREPLACE_HASHES = {
  soft: "af3033bf4e49c4623dfea15124d2fcab8d8213de35591785cdaef7985791032e",
  deep: "ea59625628045952a2ccd8fac21278662c735e34e0e1cc01d97e3cccb5f234f1",
  intense: "bc7816cc301b44e70090583fe4236e7cdd1ca18e657d6f7447b2c98d0892fabd",
} as const;

const RETAINED_NATURE_HASHES = {
  "forest:soft": "9928c308356d4d690b8de98f578e5214c2fa99a8348bcf9ad76d12bf5f292267",
  "forest:deep": "a535bcc14dc05065d83b50aeb52ca79b23ebc7801deabe4550e23edd2a256f02",
  "forest:intense": "1e234bf2778071ee0646bc7cce2a14aab8d72593d71cb2d2f6d436566d9ceae8",
  "rain:soft": "b57d902d75cbc2b9eaeb17d043dab47f62acfd60296ec728a016306a9d14225d",
  "rain:deep": "67e5e179599f94fbde8b5ff25f5d65480643e3996cfeeea0dfa2ef8fa3577f73",
  "rain:intense": "2651e39c6360c441c99e2c5d256c266ebaceb58f8f51993cda7c132a45d82a7f",
  "ocean:soft": "080bc2e63ecefa47a155b0d73f372d6b6bc6ee4fca562a4b57a559bf178eb0f3",
  "ocean:deep": "add49a641e416bbe84fcc510a5d004cfee4162ab7a97dc9a49b932d93555e4dd",
  "ocean:intense": "8c15c68486b5dea54a10b21ca262ad96d039bc09757686e9a61cc965557cf590",
  "river:soft": "7175a1f4946fbf0fb637f13a796a6e2218b9ecdef2ce1668b14c29a5e9826fcb",
  "river:deep": "f0a5d3af1de17b1859427b58db2fee06e43e8675b8899748c30b3fc37de4be55",
  "river:intense": "670638b8bd14dc8f74a0dbd53e2e263dc537b0020cbd8ddd70063b640520eec5",
  "wind:soft": "b4bdc3d2ae40c07c5d3ec5b027604c86878d83f0bdb330e250b0f0ab87b760dc",
  "wind:deep": "657b40edcde2f036db0d9a2e118f28a2551dcbf23dc8e816c8bae9dd4e8060d2",
  "wind:intense": "ffd5562248c1deff83ea31e2845f305dc1381db7c81872ff2564c78ccb3f8c66",
} as const;

describe("owner-selected fireplace replacement", () => {
  it.each(Object.entries(SELECTED_FIREPLACE_HASHES))(
    "ships the exact selected %s file through the unchanged variant id",
    (level, sha256) => {
      const id = `fireplace:${level}`;
      const publicPath = `sounds/hyperfocus/hyperfocus-fireplace-${level}.mp3`;
      const bytes = readFileSync(`public/${publicPath}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
      expect(bytes.length).toBe(721196);
      expect(HYPERFOCUS_GENERATED_AUDIO_MANIFEST[id]).toMatchObject({
        publicPath,
        sha256,
        bytes: 721196,
        provider: "OpenGameArt / PagDev",
      });
      expect(getHyperfocusAudioVariant(id)).toMatchObject({
        id,
        familyId: "fireplace",
        levelId: level,
        runtimePublicPath: publicPath,
      });
    }
  );

  it.each(Object.entries(RETAINED_NATURE_HASHES))(
    "preserves every byte of the accepted %s variant",
    (id, sha256) => {
      const entry = HYPERFOCUS_GENERATED_AUDIO_MANIFEST[id];
      expect(entry.sha256).toBe(sha256);
      const bytes = readFileSync(`public/${entry.publicPath}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
    }
  );
});
