export type AutomationServiceFetchState = "success" | "offline" | "error";

export interface AutomationServiceControl {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly fetchedAt: number;
  readonly expiresAt: number;
}

export type AutomationServiceGateCode =
  | "SERVICE_ENABLED"
  | "SERVICE_KILL_SWITCH"
  | "SERVICE_REFRESH_UNAVAILABLE"
  | "SERVICE_CONTROL_MISSING"
  | "SERVICE_CONTROL_INVALID"
  | "SERVICE_CONTROL_STALE"
  | "SERVICE_DISABLED";

export type AutomationServiceGateResult = Readonly<{
  allowed: boolean;
  code: AutomationServiceGateCode;
}>;

export interface ResolveAutomationServiceGateInput {
  readonly now: number;
  readonly fetchState: AutomationServiceFetchState;
  readonly control: AutomationServiceControl | null;
  readonly emergencyDisabled: boolean;
}

const deny = (code: Exclude<AutomationServiceGateCode, "SERVICE_ENABLED">) =>
  ({ allowed: false, code }) as const;

function isSafeTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function resolveAutomationServiceGate(
  input: ResolveAutomationServiceGateInput
): AutomationServiceGateResult {
  if (input.emergencyDisabled) return deny("SERVICE_KILL_SWITCH");
  if (input.fetchState !== "success") return deny("SERVICE_REFRESH_UNAVAILABLE");
  if (input.control === null) return deny("SERVICE_CONTROL_MISSING");

  const { control, now } = input;
  if (
    control.schemaVersion !== 1 ||
    typeof control.enabled !== "boolean" ||
    !isSafeTimestamp(now) ||
    !isSafeTimestamp(control.fetchedAt) ||
    !isSafeTimestamp(control.expiresAt) ||
    control.fetchedAt > now ||
    control.expiresAt <= control.fetchedAt
  ) {
    return deny("SERVICE_CONTROL_INVALID");
  }

  if (now > control.expiresAt) return deny("SERVICE_CONTROL_STALE");
  if (!control.enabled) return deny("SERVICE_DISABLED");
  return { allowed: true, code: "SERVICE_ENABLED" };
}
