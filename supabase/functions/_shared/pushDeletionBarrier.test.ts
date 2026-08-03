import { describe, expect, it } from "vitest";

import * as pushBarrier from "./pushDeletionBarrier";

const { checkPushDeliveryEligibility } = pushBarrier;

const OWNER_ID = "a5b6f9e1-a7cc-487d-a64b-f730e4514c39";
const PERMIT_TOKEN = "89b7dd47-1c28-4d9e-b4f9-87929247a2bd";
const OTHER_OWNER_ID = "84ce1e4a-a3c3-4cd1-80ef-e4e192cc9e0c";

type RpcResult = { data: unknown; error: unknown | null };
type Rpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<RpcResult>;
type PermitExecutionResult<T> =
  | { state: "blocked" | "unavailable" }
  | {
      state: "completed";
      value: T;
      releaseConfirmed: boolean;
    };
type WithPushDeliveryPermit = <T>(
  ownerId: string,
  dependencies: { rpc: Rpc; randomUUID: () => string },
  delivery: () => Promise<T>,
) => Promise<PermitExecutionResult<T>>;

const getWithPushDeliveryPermit = (): WithPushDeliveryPermit | undefined =>
  (
    pushBarrier as unknown as {
      withPushDeliveryPermit?: WithPushDeliveryPermit;
    }
  ).withPushDeliveryPermit;

function admittedRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    state: "admitted",
    owner_id: OWNER_ID,
    permit_token: PERMIT_TOKEN,
    lease_epoch: 7,
    lease_expires_at: "2026-07-18T14:10:00.000Z",
    ...overrides,
  };
}

describe("checkPushDeliveryEligibility", () => {
  it("allows delivery only when the exact owner has no deletion block", async () => {
    const result = await checkPushDeliveryEligibility(OWNER_ID, async () => ({
      data: null,
      error: null,
    }));

    expect(result).toEqual({ state: "allowed" });
  });

  it("blocks delivery when the exact owner has a deletion block", async () => {
    const result = await checkPushDeliveryEligibility(OWNER_ID, async () => ({
      data: { user_id: OWNER_ID },
      error: null,
    }));

    expect(result).toEqual({ state: "blocked" });
  });

  it("fails closed when a lookup returns a different owner", async () => {
    const result = await checkPushDeliveryEligibility(OWNER_ID, async () => ({
      data: { user_id: "84ce1e4a-a3c3-4cd1-80ef-e4e192cc9e0c" },
      error: null,
    }));

    expect(result).toEqual({ state: "unavailable" });
  });

  it("fails closed without exposing lookup errors", async () => {
    const privateError = new Error("database details must not escape");

    const returnedError = await checkPushDeliveryEligibility(OWNER_ID, async () => ({
      data: null,
      error: privateError,
    }));
    const thrownError = await checkPushDeliveryEligibility(OWNER_ID, async () => {
      throw privateError;
    });

    expect(returnedError).toEqual({ state: "unavailable" });
    expect(thrownError).toEqual({ state: "unavailable" });
    expect(JSON.stringify([returnedError, thrownError])).not.toContain(privateError.message);
  });
});

describe("withPushDeliveryPermit", () => {
  it("admits before provider work and releases with the exact owner, token and epoch", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    const events: string[] = [];
    const rpc: Rpc = async (functionName, args) => {
      if (functionName === "acquire_push_delivery_permit") {
        events.push("acquire");
        expect(args).toEqual({
          p_owner_id: OWNER_ID,
          p_permit_token: PERMIT_TOKEN,
        });
        return { data: [admittedRow()], error: null };
      }
      events.push("release");
      expect(functionName).toBe("release_push_delivery_permit");
      expect(args).toEqual({
        p_owner_id: OWNER_ID,
        p_permit_token: PERMIT_TOKEN,
        p_lease_epoch: 7,
      });
      return { data: true, error: null };
    };

    const result = await withPushDeliveryPermit(
      OWNER_ID,
      { rpc, randomUUID: () => PERMIT_TOKEN },
      async () => {
        events.push("provider");
        return 2;
      },
    );

    expect(result).toEqual({
      state: "completed",
      value: 2,
      releaseConfirmed: true,
    });
    expect(events).toEqual(["acquire", "provider", "release"]);
  });

  it("never starts provider work when deletion already owns admission", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    let providerStarted = false;
    const rpc: Rpc = async (functionName) => {
      expect(functionName).toBe("acquire_push_delivery_permit");
      return {
        data: [
          {
            state: "blocked",
            owner_id: null,
            permit_token: null,
            lease_epoch: null,
            lease_expires_at: null,
          },
        ],
        error: null,
      };
    };

    const result = await withPushDeliveryPermit(
      OWNER_ID,
      { rpc, randomUUID: () => PERMIT_TOKEN },
      async () => {
        providerStarted = true;
        return 1;
      },
    );

    expect(result).toEqual({ state: "blocked" });
    expect(providerStarted).toBe(false);
  });

  it("never starts provider work when the database fails closed at the active-permit cap", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    let providerStarted = false;
    const result = await withPushDeliveryPermit(
      OWNER_ID,
      {
        rpc: async () => ({
          data: [
            {
              state: "unavailable",
              owner_id: null,
              permit_token: null,
              lease_epoch: null,
              lease_expires_at: null,
            },
          ],
          error: null,
        }),
        randomUUID: () => PERMIT_TOKEN,
      },
      async () => {
        providerStarted = true;
        return 1;
      },
    );

    expect(result).toEqual({ state: "unavailable" });
    expect(providerStarted).toBe(false);
  });

  it("fails closed when the database response changes owner or token", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    let providerStarted = false;
    const mismatches = [
      admittedRow({ owner_id: OTHER_OWNER_ID }),
      admittedRow({ permit_token: PERMIT_TOKEN.replace(/.$/, "0") }),
      admittedRow({ lease_epoch: 0 }),
    ];

    for (const row of mismatches) {
      const result = await withPushDeliveryPermit(
        OWNER_ID,
        {
          rpc: async () => ({ data: [row], error: null }),
          randomUUID: () => PERMIT_TOKEN,
        },
        async () => {
          providerStarted = true;
          return 1;
        },
      );
      expect(result).toEqual({ state: "unavailable" });
    }

    expect(providerStarted).toBe(false);
  });

  it("does not turn an accepted provider result into a retry when release is unconfirmed", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    const rpc: Rpc = async (functionName) =>
      functionName === "acquire_push_delivery_permit"
        ? { data: [admittedRow()], error: null }
        : { data: false, error: null };

    const result = await withPushDeliveryPermit(
      OWNER_ID,
      { rpc, randomUUID: () => PERMIT_TOKEN },
      async () => 1,
    );

    expect(result).toEqual({
      state: "completed",
      value: 1,
      releaseConfirmed: false,
    });
  });

  it("cannot release a newer lease that reused the same owner and token", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    const storedPermit = { ownerId: OWNER_ID, token: PERMIT_TOKEN, epoch: 8 };
    const rpc: Rpc = async (functionName, args) => {
      if (functionName === "acquire_push_delivery_permit") {
        return { data: [admittedRow({ lease_epoch: 7 })], error: null };
      }
      const matchesCurrentLease =
        args.p_owner_id === storedPermit.ownerId &&
        args.p_permit_token === storedPermit.token &&
        args.p_lease_epoch === storedPermit.epoch;
      return { data: matchesCurrentLease, error: null };
    };

    const result = await withPushDeliveryPermit(
      OWNER_ID,
      { rpc, randomUUID: () => PERMIT_TOKEN },
      async () => 1,
    );

    expect(result).toEqual({
      state: "completed",
      value: 1,
      releaseConfirmed: false,
    });
    expect(storedPermit.epoch).toBe(8);
  });

  it("attempts fenced release without replacing a provider failure", async () => {
    const withPushDeliveryPermit = getWithPushDeliveryPermit();
    expect(withPushDeliveryPermit).toBeTypeOf("function");
    if (!withPushDeliveryPermit) return;

    const originalError = new Error("provider failed");
    const calls: string[] = [];
    const rpc: Rpc = async (functionName) => {
      calls.push(functionName);
      return functionName === "acquire_push_delivery_permit"
        ? { data: [admittedRow()], error: null }
        : { data: false, error: new Error("private release details") };
    };

    await expect(
      withPushDeliveryPermit(
        OWNER_ID,
        { rpc, randomUUID: () => PERMIT_TOKEN },
        async () => {
          throw originalError;
        },
      ),
    ).rejects.toBe(originalError);
    expect(calls).toEqual([
      "acquire_push_delivery_permit",
      "release_push_delivery_permit",
    ]);
  });
});
