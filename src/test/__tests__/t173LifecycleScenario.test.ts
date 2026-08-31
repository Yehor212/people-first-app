import { afterEach, describe, expect, it } from "vitest";

import {
  advanceT173LifecycleScenario,
  cleanupT173LifecycleScenario,
  initializeT173LifecycleScenario,
  readT173LifecycleStatus,
  reopenT173Database,
} from "../t173LifecycleScenario";

describe("T173 owner-bound lifecycle scenario", () => {
  afterEach(async () => {
    await cleanupT173LifecycleScenario();
  });

  it("recovers each interruption with exactly-once ack, owner isolation, and no resurrection", async () => {
    expect(await initializeT173LifecycleScenario()).toMatchObject({
      stage: "BEFORE_PRIMARY_COMMIT",
      primaryCount: 0,
      ownerOutboxCount: 0,
      unrelatedOwnerOutboxCount: 1,
    });

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "PRIMARY_COMMITTED",
      primaryCount: 1,
      ownerOutboxCount: 1,
    });
    await reopenT173Database();
    expect(await readT173LifecycleStatus()).toMatchObject({
      stage: "PRIMARY_COMMITTED",
      primaryCount: 1,
      ownerOutboxCount: 1,
    });

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "DISPATCH_SUBMITTED",
      remoteSubmissionCount: 1,
      acknowledgementCount: 0,
    });
    await reopenT173Database();

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "ACK_PERSISTED",
      remoteSubmissionCount: 1,
      acknowledgementCount: 1,
      staleCallbacksRejected: 1,
      duplicateCallbacksIgnored: 1,
    });
    await reopenT173Database();

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "LOCAL_CLEANUP_COMPLETE",
      primaryCount: 1,
      ownerOutboxCount: 0,
      acknowledgementCount: 1,
      unrelatedOwnerOutboxCount: 1,
    });

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "DELETE_FENCED",
      primaryCount: 0,
      tombstoneCount: 1,
      staleResponsesRejected: 1,
      deletionFence: "GREEN",
    });
    await reopenT173Database();

    expect(await advanceT173LifecycleScenario()).toMatchObject({
      stage: "VERIFIED",
      primaryCount: 0,
      ownerOutboxCount: 0,
      unrelatedOwnerOutboxCount: 1,
      remoteSubmissionCount: 1,
      acknowledgementCount: 1,
      tombstoneCount: 1,
      exactlyOnce: "GREEN",
      ownerBoundary: "GREEN",
      deletionFence: "GREEN",
    });
  });
});
