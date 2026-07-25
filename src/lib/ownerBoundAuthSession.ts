import { supabase } from "@/lib/supabaseClient";
import { removeExpectedOwnerAuthSession } from "@/lib/authTransitionCoordinator";

export type OwnerBoundLocalSignOutResult =
  | { status: "signed-out" }
  | { status: "no-session" }
  | { status: "owner-changed"; userId: string }
  | { status: "unsupported" };

/**
 * Remove only the expected owner's locally persisted Supabase session.
 *
 * The configured transition coordinator serializes SDK refreshes, the pinned
 * unlocked sign-in writers, and this owner predicate under one non-stealing
 * origin lock. It removes only the exact persisted owner and deliberately
 * leaves the shared PKCE verifier untouched.
 */
export async function signOutExpectedOwnerWithAuthClient(
  auth: unknown,
  expectedOwnerUserId: string,
): Promise<OwnerBoundLocalSignOutResult> {
  return removeExpectedOwnerAuthSession(auth, expectedOwnerUserId);
}

export async function signOutExpectedOwnerLocally(
  expectedOwnerUserId: string,
): Promise<OwnerBoundLocalSignOutResult> {
  if (!supabase) return { status: "unsupported" };
  return signOutExpectedOwnerWithAuthClient(
    supabase.auth,
    expectedOwnerUserId,
  );
}
