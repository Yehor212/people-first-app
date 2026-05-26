import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  buildActivationRunSteps,
  parseActivationRunOptions,
  summarizeActivationRun,
} from "../src/activation-runner";

const root = resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const options = parseActivationRunOptions(args, process.env);
const continueOnError = args.includes("--continue-on-error") || !options.apply;

for (const line of summarizeActivationRun(options)) {
  console.log(line);
}

let failed = false;
for (const step of buildActivationRunSteps(options)) {
  console.log("");
  if (!step.shouldRun) {
    console.log(`SKIP ${step.id} - ${step.skipReason ?? "not requested"}`);
    continue;
  }
  console.log(`${step.mutatesExternalState ? "APPLY" : "DRY_RUN"} ${step.id} - ${step.label}`);
  console.log(`COMMAND ${step.displayCommand}`);

  const invocation = commandInvocation(step.command, step.args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) {
    failed = true;
    console.error(`FAIL ${step.id} could not start: ${result.error.message}`);
    if (!continueOnError) {
      process.exit(1);
    }
    continue;
  }

  if (result.status !== 0) {
    failed = true;
    console.error(`FAIL ${step.id} exited with code ${result.status ?? 1}`);
    if (!continueOnError) {
      process.exit(result.status ?? 1);
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Telegram control activation runner completed. Review PASS/UNVERIFIED/FAIL lines above.");
}

function commandInvocation(command: string, args: string[]): { command: string; args: string[] } {
  if (command === "npm" && process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm", ...args] };
  }
  return { command, args };
}
