import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { deleteAuthUserIdempotently } from "./edgeOperation";

const USER_ID = "a5b6f9e1-a7cc-487d-a64b-f730e4514c39";

describe("deleteAuthUserIdempotently", () => {
  it("accepts user_not_found only inside an already capability-claimed operation", async () => {
    const deleteUser = vi.fn();

    await deleteAuthUserIdempotently(
      {
        getUserById: vi.fn(async () => ({
          data: { user: null },
          error: { code: "user_not_found", status: 404 },
        })),
        deleteUser,
      },
      USER_ID,
    );

    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("fails closed on a generic 404 instead of inferring deletion", async () => {
    await expect(
      deleteAuthUserIdempotently(
        {
          getUserById: vi.fn(async () => ({
            data: { user: null },
            error: { message: "gateway not found", status: 404 },
          })),
          deleteUser: vi.fn(),
        },
        USER_ID,
      ),
    ).rejects.toThrow("Unable to verify account deletion state");
  });

  it("treats a race to user_not_found during delete as idempotent completion", async () => {
    await expect(
      deleteAuthUserIdempotently(
        {
          getUserById: vi.fn(async () => ({
            data: { user: { id: USER_ID } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({
            data: { user: null },
            error: { code: "user_not_found", status: 404 },
          })),
        },
        USER_ID,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("account deletion push drain edge binding", () => {
  it("calls the service-role drain RPC with the exact current operation fence", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "supabase/functions/delete-account/edgeOperation.ts",
      ),
      "utf8",
    );

    expect(source).toContain("drainPushDeliveries: (context) =>");
    expect(source).toMatch(
      /readRpcBoolean\(\s*client,\s*"drain_account_push_delivery_permits",\s*leaseArgs\(context\),?\s*\)/,
    );
  });
});
