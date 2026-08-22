/**
 * Descriptive metrics for the active Codex hook control plane.
 *
 * Counts are static registration observations only. They are never converted
 * into a quality score, security approval, or evidence that hooks loaded at
 * runtime. Routine hooks do not write diagnostic files; an operator can invoke
 * the separate local-observation command when a bounded local receipt is needed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

type HookConfig = {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
};

const ROOT = process.cwd();
const HOOKS_JSON = path.join(ROOT, ".codex", "hooks.json");

function registeredInventory(): { events: number; invocations: number; files: number } {
  const config = JSON.parse(readFileSync(HOOKS_JSON, "utf8")) as HookConfig;
  const files = new Set<string>();
  let invocations = 0;
  const events = Object.entries(config.hooks ?? {});
  for (const [, groups] of events) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        invocations += 1;
        const match = String(hook.command ?? "")
          .replace(/\\/g, "/")
          .match(/\.codex\/hooks\/([^/\s"']+\.cjs)/);
        if (match) files.add(match[1]);
      }
    }
  }
  return { events: events.length, invocations, files: files.size };
}

const inventory = registeredInventory();
console.log("CODEX ENFORCEMENT METRICS");
console.log(`registered_events=${inventory.events}`);
console.log(`registered_invocations=${inventory.invocations}`);
console.log(`registered_hook_files=${inventory.files}`);
console.log("routine_audit_writes=DISABLED");
console.log("explicit_local_observation_receipts=OPERATOR_INVOKED_ONLY");
console.log("runtime_loading=UNVERIFIED");
console.log("effective_permissions=UNVERIFIED");
console.log("reason=static registrations and local observations do not prove Codex host loading or effective permissions");
