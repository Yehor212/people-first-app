import type { CommandIntent, CommandKind, RiskLevel } from "./types";

const COMMAND_MAP: Record<string, CommandKind> = {
  "/status": "status",
  "/health": "health",
  "/plan": "plan",
  "/fix": "fix",
  "/review": "review",
  "/test": "test",
  "/security": "security",
  "/deploy": "deploy",
  "/rollback": "rollback",
  "/jobs": "jobs",
  "/cancel": "cancel",
  "/approve": "approve",
  "/deny": "deny",
};

const DESTRUCTIVE_PATTERN =
  /\b(deploy|rollback|merge\s+to\s+main|main\s+merge|supabase|sql|rls|secret|protected|hook|branch\s+delete|delete\s+branch|docs\/law|\.codex|agents\.md)\b/i;

export function parseCommand(rawText: string, defaultTargetRef = "main"): CommandIntent {
  const raw = rawText.trim();
  if (!raw) {
    return buildIntent("ask", "", raw, defaultTargetRef, 0);
  }

  const [head = "", ...tail] = raw.split(/\s+/);
  const command = head.toLowerCase().split("@")[0] ?? "";
  const slashKind = COMMAND_MAP[command];

  if (slashKind) {
    return buildIntent(slashKind, tail.join(" ").trim(), raw, defaultTargetRef, 1);
  }

  if (head.startsWith("/")) {
    return buildIntent("ask", raw, raw, defaultTargetRef, 0.2);
  }

  const freeTextKind = classifyFreeText(raw);
  return buildIntent(freeTextKind.kind, raw, raw, defaultTargetRef, freeTextKind.confidence);
}

export function isDispatchableKind(kind: CommandKind): boolean {
  return ["plan", "fix", "review", "test", "security", "deploy", "rollback"].includes(kind);
}

export function requiresConfirmation(kind: CommandKind, prompt: string): boolean {
  return kind === "deploy" || kind === "rollback" || DESTRUCTIVE_PATTERN.test(prompt);
}

export function riskForIntent(kind: CommandKind, prompt: string): RiskLevel {
  if (requiresConfirmation(kind, prompt)) {
    return "high";
  }

  if (kind === "fix" || kind === "security" || kind === "cancel" || kind === "approve" || kind === "deny") {
    return "medium";
  }

  return "low";
}

export function requestedGatesForKind(kind: CommandKind): string[] {
  switch (kind) {
    case "fix":
      return ["npm run typecheck", "npm run lint", "npm run check:task-completion", "npm run check:sync-contract"];
    case "test":
      return ["npm run typecheck", "npm run lint", "npm run check:task-completion", "npm run check:sync-contract"];
    case "security":
      return [
        "npm run typecheck",
        "npm run lint",
        "npm run check:task-completion",
        "npm run check:sync-contract",
        "snyk code test",
      ];
    case "deploy":
    case "rollback":
      return ["npm run check:all", "npm run check:task-completion", "npm run check:sync-contract"];
    case "plan":
    case "review":
      return ["npm run check:task-completion", "npm run check:sync-contract"];
    default:
      return [];
  }
}

function buildIntent(
  kind: CommandKind,
  prompt: string,
  rawText: string,
  targetRef: string,
  confidence: number,
): CommandIntent {
  return {
    kind,
    prompt,
    rawText,
    targetRef,
    riskLevel: riskForIntent(kind, prompt),
    requiresConfirmation: requiresConfirmation(kind, prompt),
    requestedGates: requestedGatesForKind(kind),
    confidence,
  };
}

function classifyFreeText(text: string): { kind: CommandKind; confidence: number } {
  if (/\b(status|ci|build state|статус|состояние)\b/i.test(text)) {
    return { kind: "status", confidence: 0.74 };
  }

  if (/\b(fix|bug|broken|почини|исправ|ошибка|баг)\b/i.test(text)) {
    return { kind: "fix", confidence: 0.72 };
  }

  if (/\b(review|audit|inspect|проверь|ревью|аудит)\b/i.test(text)) {
    return { kind: "review", confidence: 0.72 };
  }

  if (/\b(test|tests|тест|тесты)\b/i.test(text)) {
    return { kind: "test", confidence: 0.72 };
  }

  if (/\b(security|snyk|vulnerability|безопасн)\b/i.test(text)) {
    return { kind: "security", confidence: 0.72 };
  }

  return { kind: "ask", confidence: 0.35 };
}
