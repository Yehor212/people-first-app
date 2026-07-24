export const ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT =
  "zenflow:account-boundary-writers-suspended";
export const ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT =
  "zenflow:account-boundary-writers-resumed";

let writersSuspended = false;
let accountBoundaryWritersEpoch = 0;

export function suspendAccountBoundaryWriters(): void {
  accountBoundaryWritersEpoch += 1;
  writersSuspended = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCOUNT_BOUNDARY_WRITERS_SUSPENDED_EVENT));
  }
}

export function resumeAccountBoundaryWriters(): void {
  accountBoundaryWritersEpoch += 1;
  writersSuspended = false;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCOUNT_BOUNDARY_WRITERS_RESUMED_EVENT));
  }
}

export function areAccountBoundaryWritersSuspended(): boolean {
  return writersSuspended;
}

/** Changes on every suspend/resume attempt so cleanup can release only its own turn. */
export function getAccountBoundaryWritersEpoch(): number {
  return accountBoundaryWritersEpoch;
}
