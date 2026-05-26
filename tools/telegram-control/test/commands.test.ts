import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "../src/commands";

void test("parses status as a low-risk local command", () => {
  const intent = parseCommand("/status", "main");
  assert.equal(intent.kind, "status");
  assert.equal(intent.riskLevel, "low");
  assert.equal(intent.requiresConfirmation, false);
});

void test("deploy requires Telegram confirmation", () => {
  const intent = parseCommand("/deploy production", "main");
  assert.equal(intent.kind, "deploy");
  assert.equal(intent.riskLevel, "high");
  assert.equal(intent.requiresConfirmation, true);
});

void test("protected prompt requires confirmation even for fix mode", () => {
  const intent = parseCommand("/fix update Supabase RLS policy", "main");
  assert.equal(intent.kind, "fix");
  assert.equal(intent.requiresConfirmation, true);
});

void test("ambiguous free text becomes ASK", () => {
  const intent = parseCommand("please think about it", "main");
  assert.equal(intent.kind, "ask");
  assert.equal(intent.confidence < 0.5, true);
});
