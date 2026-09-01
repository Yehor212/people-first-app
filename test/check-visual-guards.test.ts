// @vitest-environment node

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { checkMotionSafe, checkThemeBlind } from "../scripts/check-visual-guards";
import { validateVisualProofPacket } from "../scripts/visual-quality-proof-gate";
import {
  findUncoveredGovernedVisualPaths,
  validateApprovedVisualBaseline,
} from "../scripts/visual-quality-repository-gate";

const REQUIRED_PLATFORMS = [
  "Web/Vite",
  "PWA",
  "Android/Capacitor",
  "iOS/WKWebView",
  "Desktop/Tauri",
  "Telegram/export",
  "Accessibility/reduced motion",
  "Performance",
  "Security/Privacy",
  "Testing",
  "Operations",
];

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function createValidProof(rootDir: string) {
  const evidenceDir = join(rootDir, "proofs", "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const master = gzipSync(
    Buffer.from(
      JSON.stringify({ v: "5.7.4", w: 512, h: 512, fr: 60, ip: 0, op: 180, ddd: 0, layers: [] })
    )
  );
  const preview = Buffer.from("preview-video");
  const frameBoard = Buffer.from("frame-board");
  const criticReport = Buffer.from("# Visual critic evidence\n");
  writeFileSync(join(evidenceDir, "candidate.tgs"), master);
  writeFileSync(join(evidenceDir, "candidate.mp4"), preview);
  writeFileSync(join(evidenceDir, "candidate.png"), frameBoard);
  writeFileSync(join(rootDir, "proofs/contact-v8-comparison.md"), criticReport);

  return {
    schemaVersion: 1,
    packetType: "candidate-proof",
    id: "candidate-bedtime-model-v1",
    coveredPaths: ["public/animations/candidate.tgs"],
    contract: "docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md",
    baseline: {
      id: "contact-v8-layered",
      comparisonRequired: true,
    },
    brief: {
      goal: "A coherent bedtime model and event animation.",
      nonGoals: ["Do not claim compact Telegram parity without a separate review."],
    },
    provenance: {
      classification: "project-original",
      ownerAuthorization: true,
      evidence: ["Direct owner brief."],
      limitations: ["No independent legal opinion."],
    },
    target: {
      format: "TGS",
      deliveryProfile: "quality-master",
      width: 512,
      height: 512,
      fps: 60,
      frames: 180,
      durationMs: 3000,
      loop: true,
      codec: "gzip-compressed Lottie JSON",
      alpha: true,
    },
    artifacts: [
      {
        role: "master",
        path: "proofs/evidence/candidate.tgs",
        sha256: sha256(master),
        bytes: master.byteLength,
        portable: true,
      },
      {
        role: "preview",
        path: "proofs/evidence/candidate.mp4",
        sha256: sha256(preview),
        bytes: preview.byteLength,
        portable: true,
      },
      {
        role: "frame-board",
        path: "proofs/evidence/candidate.png",
        sha256: sha256(frameBoard),
        bytes: frameBoard.byteLength,
        portable: true,
      },
      {
        role: "critic-report",
        path: "proofs/contact-v8-comparison.md",
        sha256: sha256(criticReport),
        bytes: criticReport.byteLength,
        portable: true,
      },
    ],
    technicalReceipts: [
      "schema-parse",
      "dimensions",
      "fps",
      "duration",
      "frame-count",
      "loop",
      "target-size",
      "codec-alpha",
      "supported-features",
      "bounds",
      "render-decode",
    ].map((check) => ({ check, status: "PASS", evidence: `validator:${check}` })),
    visualIntegrityCritic: {
      status: "PASS",
      reviewer: "visual-integrity-critic",
      evidence: "proofs/contact-v8-comparison.md",
      artifactRole: "critic-report",
      dimensions: {
        briefFit: "PASS",
        visualClarity: "PASS",
        craftNeatness: "PASS",
        modelIntegrity: "PASS",
        motionIntegrity: "PASS",
        styleMatch: "PASS",
        evidenceQuality: "PASS",
        templateAudit: "PASS",
      },
    },
    statuses: {
      Technical: { status: "PASS", evidence: "technicalReceipts" },
      "Visual Runtime": { status: "UNVERIFIED", evidence: "No device matrix yet." },
      "Artistic-Craft": { status: "UNVERIFIED", evidence: "Awaiting direct human review." },
      Motion: { status: "UNVERIFIED", evidence: "Awaiting direct human review." },
      Model: { status: "UNVERIFIED", evidence: "Awaiting direct human review." },
      Plan: { status: "PASS", evidence: "Approved implementation plan." },
    },
    humanApproval: {
      status: "UNVERIFIED",
      source: null,
      approvedArtifactRole: null,
      artifactSha256: null,
      statement: null,
      scope: null,
      reviewedOn: null,
    },
    telegram: {
      masterQualityArtifactRole: "master",
      compactDelivery: {
        technicalStatus: "UNVERIFIED",
        artisticParityStatus: "UNVERIFIED",
        artifactRole: null,
        humanApprovalInherited: false,
        reason: "Compact delivery has not been viewed separately.",
      },
    },
    platformMatrix: REQUIRED_PLATFORMS.map((platform) => ({
      platform,
      status: "UNVERIFIED",
      evidence: "Governance packet only; runtime proof is pending.",
    })),
  };
}

describe("visual guard heuristics", () => {
  it("treats useShouldAnimate as a valid motion guard", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "import { useShouldAnimate } from '@/hooks/useShouldAnimate';",
      "const animate = useShouldAnimate();",
      "<motion.div animate={animate ? { opacity: 1 } : undefined} />",
    ];

    expect(checkMotionSafe("src/components/ui/DialogMotion.tsx", lines)).toEqual([]);
  });

  it("accepts framer-motion components when the app has a global MotionConfig gate", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "export function Example() {",
      "  return <motion.div animate={{ opacity: 1 }} whileTap={{ scale: 0.95 }} />;",
      "}",
    ];

    expect(
      checkMotionSafe("src/components/ui/DialogMotion.tsx", lines, { hasGlobalMotionGate: true }),
    ).toEqual([]);
  });

  it("ignores motion findings in test files", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "export function Example() {",
      "  return <motion.div animate={{ opacity: 1 }} />;",
      "}",
    ];

    expect(checkMotionSafe("src/components/ui/__tests__/DialogMotion.test.tsx", lines)).toEqual(
      [],
    );
  });

  it("does not flag backdrop scrims as theme-blind surfaces", () => {
    const lines = [
      "{/* Desktop backdrop */}",
      '<div className="fixed inset-0 z-[79] bg-black/40 backdrop-blur-sm" aria-hidden="true" />',
    ];

    expect(checkThemeBlind("src/components/ChangelogPanel.tsx", lines)).toEqual([]);
  });

  it("accepts hover-only dark variants for interactive controls", () => {
    const lines = [
      '<button className="rounded-lg hover:bg-white/10 dark:hover:bg-white/10 text-white/70" />',
    ];

    expect(checkThemeBlind("src/components/canvas/EmotionPanel.tsx", lines)).toEqual([]);
  });

  it("accepts arbitrary selector dark variants", () => {
    const lines = [
      '<div className="[&_code]:bg-black/5 dark:[&_code]:bg-black/5 [&_code]:rounded" />',
    ];

    expect(checkThemeBlind("src/features/journal/JournalEntryEditor.tsx", lines)).toEqual([]);
  });

  it("still flags hardcoded surfaces that are not scrims", () => {
    const lines = ['<div className="rounded-xl bg-white/20 border border-white/20" />'];

    const violations = checkThemeBlind("src/components/SurfaceCard.tsx", lines);

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.rule)).toEqual([
      "theme-blind",
      "theme-blind",
    ]);
  });
});

describe("visual model and animation proof gate", () => {
  it("fails closed on malformed visual proof JSON", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    const packetPath = join(rootDir, "malformed.json");
    try {
      writeFileSync(packetPath, "{not-json");
      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual([
        expect.objectContaining({ rule: "visual-proof-malformed", severity: "CRITICAL" }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when required portable evidence is missing", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    try {
      const packet = createValidProof(rootDir);
      rmSync(join(rootDir, "proofs/evidence/candidate.mp4"));
      const packetPath = join(rootDir, "proofs/candidate.json");
      writeFileSync(packetPath, JSON.stringify(packet));

      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: "visual-proof-missing-file" })])
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects a missing visual-integrity-critic report file", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    try {
      const packet = createValidProof(rootDir);
      rmSync(join(rootDir, "proofs/contact-v8-comparison.md"));
      const packetPath = join(rootDir, "proofs/candidate.json");
      writeFileSync(packetPath, JSON.stringify(packet));

      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: "visual-proof-missing-file" })])
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects artistic PASS without direct artifact-bound human approval", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    try {
      const packet = createValidProof(rootDir);
      packet.statuses["Artistic-Craft"] = {
        status: "PASS",
        evidence: "Technical render passed.",
      };
      const packetPath = join(rootDir, "proofs/candidate.json");
      writeFileSync(packetPath, JSON.stringify(packet));

      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: "visual-proof-human-approval" })])
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects approval inheritance from a quality master to a compact Telegram delivery", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    try {
      const packet = createValidProof(rootDir);
      packet.telegram.compactDelivery = {
        technicalStatus: "PASS",
        artisticParityStatus: "PASS",
        artifactRole: null,
        humanApprovalInherited: true,
        reason: "Inherited from the quality master.",
      };
      const packetPath = join(rootDir, "proofs/candidate.json");
      writeFileSync(packetPath, JSON.stringify(packet));

      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: "visual-proof-scope" })])
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects Telegram-unsupported TGS features even when hashes match", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-visual-proof-"));
    try {
      const packet = createValidProof(rootDir);
      packet.target.deliveryProfile = "telegram-compact";
      const unsupportedMaster = gzipSync(
        Buffer.from(
          JSON.stringify({
            v: "5.7.4",
            w: 512,
            h: 512,
            fr: 60,
            ip: 0,
            op: 180,
            ddd: 0,
            assets: [{ id: "raster", p: "frame.png" }],
            layers: [{ ty: 2, ddd: 0, refId: "raster" }],
          })
        )
      );
      writeFileSync(join(rootDir, "proofs/evidence/candidate.tgs"), unsupportedMaster);
      const masterRecord = packet.artifacts.find((artifact) => artifact.role === "master");
      if (!masterRecord) throw new Error("test master record is missing");
      masterRecord.sha256 = sha256(unsupportedMaster);
      masterRecord.bytes = unsupportedMaster.byteLength;
      const packetPath = join(rootDir, "proofs/candidate.json");
      writeFileSync(packetPath, JSON.stringify(packet));

      expect(validateVisualProofPacket(rootDir, packetPath)).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: "visual-proof-tgs-feature" })])
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("requires a proof packet to cover a newly changed governed visual asset", () => {
    const changed = ["public/animations/new-bedtime-bear.tgs"];
    expect(findUncoveredGovernedVisualPaths(changed, new Set<string>())).toEqual(changed);
    expect(findUncoveredGovernedVisualPaths(changed, new Set(changed))).toEqual([]);
  });

  it("accepts the immutable contact-v8-layered repository baseline packet", () => {
    const rootDir = resolve(import.meta.dirname, "..");
    const packetPath = resolve(
      rootDir,
      "docs/ai/visual-quality/approved-baselines/contact-v8-layered.json"
    );

    expect(validateVisualProofPacket(rootDir, packetPath)).toEqual([]);
    expect(validateApprovedVisualBaseline(rootDir)).toEqual([]);
  });
});
