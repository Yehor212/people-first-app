import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260808000000_automation_transaction_ledger.sql",
);
const migrationExists = existsSync(migrationPath);
const migrationSql = migrationExists ? readFileSync(migrationPath, "utf8") : "";

const automationTables = [
  "automation_preferences",
  "automation_history_state",
  "automation_transactions",
  "automation_mutations",
  "automation_record_revisions",
  "automation_history_tombstones",
] as const;

const clientReadableTables = automationTables.filter(
  (table) => table !== "automation_record_revisions",
);

const publicRpcs = [
  "get_automation_preference",
  "set_automation_preference",
  "set_automation_preference_with_planning",
  "revoke_automation_preference",
  "commit_automation_transaction",
  "undo_automation_transaction",
  "get_automation_history_snapshot",
  "purge_automation_history",
] as const;

const internalFunctions = [
  "automation_now_ms",
  "automation_canonical_json",
  "automation_hash_json",
  "automation_source_key",
  "automation_preference_payload",
  "reject_reserved_automation_setting",
  "capture_automation_record_revision",
  "automation_current_projection",
  "automation_apply_mutation",
  "automation_commit_rejection",
  "automation_undo_rejection",
] as const;

const expectedPublicRpcSignatures: Record<(typeof publicRpcs)[number], string> = {
  get_automation_preference: "",
  set_automation_preference: "bigint, text[], text, integer, jsonb",
  set_automation_preference_with_planning:
    "bigint, text[], text, integer, jsonb, jsonb, text",
  revoke_automation_preference: "",
  commit_automation_transaction: "jsonb",
  undo_automation_transaction: "jsonb",
  get_automation_history_snapshot: "jsonb, jsonb",
  purge_automation_history: "uuid, uuid[], boolean, text",
};

const expectedPolicyNames: Record<(typeof automationTables)[number], readonly string[]> = {
  automation_preferences: ["automation_preferences_select_own"],
  automation_history_state: ["automation_history_state_select_own"],
  automation_transactions: ["automation_transactions_select_own"],
  automation_mutations: ["automation_mutations_select_own"],
  automation_record_revisions: [],
  automation_history_tombstones: ["automation_history_tombstones_select_own"],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function normalizeSql(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function matches(sql: string, expression: RegExp): boolean {
  expression.lastIndex = 0;
  return expression.test(sql);
}

function matchCount(sql: string, expression: RegExp): number {
  const flags = expression.flags.includes("g") ? expression.flags : `${expression.flags}g`;
  return [...sql.matchAll(new RegExp(expression.source, flags))].length;
}

function functionBlock(sql: string, name: string): string {
  const startExpression = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(name)}\\s*\\(`,
    "i",
  );
  const start = startExpression.exec(sql);
  if (!start) return "";

  const remainder = sql.slice(start.index + start[0].length);
  const next = /create\s+or\s+replace\s+function\s+public\.[a-z_][a-z0-9_]*\s*\(/i.exec(
    remainder,
  );
  return sql.slice(start.index, next ? start.index + start[0].length + next.index : sql.length);
}

function tableDefinition(sql: string, table: string): string {
  const expression = new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+public\\.${escapeRegExp(table)}\\s*\\([\\s\\S]*?\\n\\);`,
    "i",
  );
  return expression.exec(sql)?.[0] ?? "";
}

function policyBlocks(sql: string, table: string): string[] {
  return [...sql.matchAll(/create\s+policy\b[\s\S]*?;/gi)]
    .map((match) => match[0])
    .filter((policy) =>
      matches(policy, new RegExp(`\\bon\\s+public\\.${escapeRegExp(table)}\\b`, "i")),
    );
}

function policyName(policy: string): string | undefined {
  const match = /create\s+policy\s+("(?:""|[^"])+"|[a-z_][a-z0-9_$]*)/i.exec(policy);
  if (!match) return undefined;
  return match[1].startsWith('"')
    ? match[1].slice(1, -1).replace(/""/g, '"').toLowerCase()
    : match[1].toLowerCase();
}

function normalizedRoleSet(roles: string): string[] {
  return [...new Set(roles.split(",").map((role) => normalizeSql(role)).filter(Boolean))].sort();
}

function hasExactRoles(roles: string | undefined, expected: readonly string[]): boolean {
  if (roles === undefined) return false;
  return JSON.stringify(normalizedRoleSet(roles)) === JSON.stringify([...expected].sort());
}

function privilegeStatement(
  sql: string,
  action: "grant" | "revoke",
  functionName: string,
): { signature: string; roles: string } | undefined {
  const direction = action === "grant" ? "to" : "from";
  const expression = new RegExp(
    `${action}\\s+(?:all(?:\\s+privileges)?|execute)\\s+on\\s+function\\s+public\\.${escapeRegExp(functionName)}\\s*\\(([^;]*)\\)\\s+${direction}\\s+([^;]+);`,
    "i",
  );
  const match = expression.exec(sql);
  return match
    ? {
        signature: splitTopLevelArguments(match[1]).map(parameterType).join(", "),
        roles: normalizeSql(match[2]),
      }
    : undefined;
}

function definitionSignature(sql: string, functionName: string): string | undefined {
  const argumentsText = definitionArguments(sql, functionName);
  if (argumentsText === undefined) return undefined;
  const parameters = splitTopLevelArguments(argumentsText);
  return parameters.map(parameterType).join(", ");
}

function definitionArguments(sql: string, functionName: string): string | undefined {
  const expression = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(functionName)}\\s*\\(([\\s\\S]*?)\\)\\s*returns\\b`,
    "i",
  );
  const match = expression.exec(sql);
  return match?.[1];
}

function hasCallerOwnerArgument(sql: string, functionName: string): boolean {
  const argumentsText = definitionArguments(sql, functionName);
  if (argumentsText === undefined) return false;
  return splitTopLevelArguments(argumentsText).some((parameter) => {
    const withoutMode = parameter
      .replace(/^(?:inout|in|out|variadic)\s+/i, "")
      .trim();
    const name = /^([a-z_][a-z0-9_]*)\s+/i.exec(withoutMode)?.[1];
    return Boolean(name && /^(?:p_|in_|arg_)?(?:owner|user)_id$/i.test(name));
  });
}

function splitTopLevelArguments(value: string): string[] {
  const argumentsList: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];
    if (quote) {
      current += character;
      if (character === quote && previous !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      if (current.trim()) argumentsList.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) argumentsList.push(current.trim());
  return argumentsList;
}

function parameterType(parameter: string): string {
  const withoutDefault = parameter
    .replace(/\s+default\s+[\s\S]*$/i, "")
    .replace(/\s*=\s*[\s\S]*$/i, "")
    .trim();
  const withoutMode = withoutDefault.replace(/^(?:inout|in|out|variadic)\s+/i, "");
  const namedParameter = /^([a-z_][a-z0-9_]*)\s+([\s\S]+)$/i.exec(withoutMode);
  const type = namedParameter && /^(?:p_|in_|arg_)/i.test(namedParameter[1])
    ? namedParameter[2]
    : withoutMode;
  return normalizeSql(type.replace(/\b(?:public|pg_catalog)\./gi, ""));
}

function addFinding(findings: string[], condition: boolean, code: string): void {
  if (!condition) findings.push(code);
}

function validateAutomationMigration(sql: string): string[] {
  const findings: string[] = [];
  const uncommented = stripSqlComments(sql);
  const normalized = normalizeSql(uncommented);

  for (const table of automationTables) {
    const tableName = escapeRegExp(table);
    const definition = tableDefinition(uncommented, table);
    addFinding(findings, Boolean(definition), `TABLE_CREATE:${table}`);
    addFinding(
      findings,
      matches(normalized, new RegExp(`alter\\s+table\\s+public\\.${tableName}\\s+enable\\s+row\\s+level\\s+security\\s*;`, "i")),
      `ENABLE_RLS:${table}`,
    );
    addFinding(
      findings,
      matches(normalized, new RegExp(`alter\\s+table\\s+public\\.${tableName}\\s+force\\s+row\\s+level\\s+security\\s*;`, "i")),
      `FORCE_RLS:${table}`,
    );

    const tableRevoke = new RegExp(
      `revoke\\s+all(?:\\s+privileges)?\\s+on\\s+table\\s+public\\.${tableName}\\s+from\\s+([^;]+);`,
      "i",
    ).exec(normalized)?.[1] ?? "";
    addFinding(
      findings,
      hasExactRoles(tableRevoke, ["public", "anon", "authenticated"]),
      `TABLE_REVOKE:${table}`,
    );
    addFinding(
      findings,
      !matches(
        normalized,
        new RegExp(
          `grant\\s+(?:all(?:\\s+privileges)?|insert|update|delete)(?:\\s*,\\s*(?:insert|update|delete))*\\s+on\\s+table\\s+public\\.${tableName}\\s+to\\s+(?:public|anon|authenticated)\\b`,
          "i",
        ),
      ),
      `NO_DIRECT_WRITE_GRANT:${table}`,
    );
    addFinding(
      findings,
      !matches(definition, /^\s*(?:journal|diary|entry_text|raw_text|prose|content|body|title|notes?)\s+/im),
      `NO_PRIVATE_PROSE_COLUMN:${table}`,
    );

    const actualPolicies = policyBlocks(uncommented, table)
      .map(policyName)
      .filter((name): name is string => name !== undefined)
      .sort();
    addFinding(
      findings,
      JSON.stringify(actualPolicies) === JSON.stringify([...expectedPolicyNames[table]].sort()),
      `POLICY_INVENTORY:${table}`,
    );
  }

  for (const table of clientReadableTables) {
    const policies = policyBlocks(uncommented, table);
    const ownerScopedSelect = policies.some((policy) => {
      const normalizedPolicy = normalizeSql(policy);
      return normalizedPolicy.includes("for select") &&
        normalizedPolicy.includes("to authenticated") &&
        /(?:\b(?:owner_id|user_id)\s*=\s*\(\s*select\s+auth\.uid\(\)\s*\)|\(\s*select\s+auth\.uid\(\)\s*\)\s*=\s*(?:owner_id|user_id)\b)/i.test(normalizedPolicy);
    });
    addFinding(findings, ownerScopedSelect, `OWNER_SELECT_POLICY:${table}`);
    addFinding(
      findings,
      matches(
        normalized,
        new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${escapeRegExp(table)}\\s+to\\s+authenticated\\s*;`, "i"),
      ),
      `AUTHENTICATED_SELECT_GRANT:${table}`,
    );
  }

  addFinding(
    findings,
    policyBlocks(uncommented, "automation_record_revisions").length === 0,
    "INTERNAL_REVISIONS_NO_CLIENT_POLICY",
  );
  addFinding(
    findings,
    !matches(
      normalized,
      /grant\s+select\s+on\s+table\s+public\.automation_record_revisions\s+to\s+(?:public|anon|authenticated)\b/i,
    ),
    "INTERNAL_REVISIONS_NO_CLIENT_GRANT",
  );

  for (const rpc of publicRpcs) {
    const block = functionBlock(uncommented, rpc);
    const definitionCount = matchCount(
      uncommented,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(rpc)}\\s*\\(`, "i"),
    );
    addFinding(findings, definitionCount === 1, `RPC_DEFINITION:${rpc}`);
    addFinding(findings, /\bsecurity\s+definer\b/i.test(block), `SECURITY_DEFINER:${rpc}`);
    addFinding(
      findings,
      /\bset\s+search_path\s*=\s*''/i.test(block),
      `SAFE_SEARCH_PATH:${rpc}`,
    );
    addFinding(findings, /\bauth\.uid\(\)/i.test(block), `AUTH_UID_OWNER:${rpc}`);
    addFinding(
      findings,
      /\bis\s+null\b/i.test(block) &&
        (/\braise\s+exception\b/i.test(block) || /['"]UNAUTHORIZED['"]/i.test(block)),
      `UNAUTHENTICATED_REJECTION:${rpc}`,
    );
    const signature = definitionSignature(uncommented, rpc);
    addFinding(
      findings,
      signature === expectedPublicRpcSignatures[rpc],
      `RPC_EXPECTED_SIGNATURE:${rpc}`,
    );
    addFinding(
      findings,
      signature !== undefined && !hasCallerOwnerArgument(uncommented, rpc),
      `NO_CALLER_OWNER_ARGUMENT:${rpc}`,
    );
    addFinding(
      findings,
      !/\b(?:from|join|insert\s+into|update|delete\s+from)\s+automation_/i.test(block),
      `SCHEMA_QUALIFIED_RELATIONS:${rpc}`,
    );

    const revoke = privilegeStatement(normalized, "revoke", rpc);
    const grant = privilegeStatement(normalized, "grant", rpc);
    addFinding(
      findings,
      hasExactRoles(revoke?.roles, ["public", "anon", "authenticated"]),
      `RPC_REVOKE:${rpc}`,
    );
    addFinding(
      findings,
      hasExactRoles(grant?.roles, ["authenticated"]),
      `RPC_MINIMAL_GRANT:${rpc}`,
    );
    addFinding(
      findings,
      signature !== undefined && Boolean(revoke && grant) &&
        signature === revoke?.signature && signature === grant?.signature,
      `RPC_SIGNATURE_PRIVILEGES:${rpc}`,
    );
  }

  for (const helper of internalFunctions) {
    const signature = definitionSignature(uncommented, helper);
    const revoke = privilegeStatement(normalized, "revoke", helper);
    addFinding(
      findings,
      matchCount(
        uncommented,
        new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(helper)}\\s*\\(`, "i"),
      ) === 1,
      `INTERNAL_DEFINITION:${helper}`,
    );
    addFinding(
      findings,
      !matches(
        normalized,
        new RegExp(
          `grant\\s+(?:all(?:\\s+privileges)?|execute)\\s+on\\s+function\\s+public\\.${escapeRegExp(helper)}\\s*\\([^;]*\\)\\s+to\\s+(?:public|anon|authenticated)\\b`,
          "i",
        ),
      ),
      `INTERNAL_NO_CLIENT_GRANT:${helper}`,
    );
    addFinding(
      findings,
      signature !== undefined &&
        revoke?.signature === signature &&
        hasExactRoles(revoke.roles, ["public", "anon", "authenticated"]),
      `INTERNAL_REVOKE:${helper}`,
    );
  }

  const commitBlock = functionBlock(uncommented, "commit_automation_transaction");
  const undoBlock = functionBlock(uncommented, "undo_automation_transaction");
  addFinding(
    findings,
    /from\s+public\.automation_record_revisions\b[\s\S]{0,500}?\bfor\s+update\b/i.test(commitBlock),
    "CAS_LOCK:commit_automation_transaction",
  );
  addFinding(
    findings,
    /from\s+public\.automation_record_revisions\b[\s\S]{0,500}?\bfor\s+update\b/i.test(undoBlock),
    "CAS_LOCK:undo_automation_transaction",
  );
  addFinding(
    findings,
    !/insert\s+into\s+public\.automation_(?:preferences|history_state)\b/i.test(commitBlock),
    "NO_REJECTION_INITIALIZATION_WRITE:commit_automation_transaction",
  );
  addFinding(
    findings,
    !/insert\s+into\s+public\.automation_history_state\b/i.test(undoBlock),
    "NO_REJECTION_INITIALIZATION_WRITE:undo_automation_transaction",
  );
  addFinding(
    findings,
    !/jsonb_array_length\(p_request->['"]mutations['"]\)\s*<>\s*1/i.test(commitBlock) &&
      /jsonb_array_length\(p_request->['"]mutations['"]\)\s*>\s*32/i.test(commitBlock),
    "MULTI_MUTATION_BATCH",
  );

  for (const rpc of ["commit_automation_transaction", "undo_automation_transaction", "purge_automation_history"] as const) {
    const block = functionBlock(uncommented, rpc);
    addFinding(findings, /\bfor\s+update\b/i.test(block), `ATOMIC_LOCK:${rpc}`);
    addFinding(
      findings,
      /public\.automation_history_tombstones\b/i.test(block),
      `TOMBSTONE_GUARD:${rpc}`,
    );
  }

  addFinding(
    findings,
    /\bon\s+conflict\b/i.test(normalized) && /\b(?:request_id|idempot)/i.test(normalized),
    "IDEMPOTENT_RETRY",
  );
  addFinding(
    findings,
    /\bunique\s*\(\s*user_id\s*,\s*id\s*\)/i.test(
      tableDefinition(uncommented, "automation_transactions"),
    ) &&
      /\bforeign\s+key\s*\(\s*user_id\s*,\s*transaction_id\s*\)\s*references\s+public\.automation_transactions\s*\(\s*user_id\s*,\s*id\s*\)\s*on\s+delete\s+cascade/i.test(
        tableDefinition(uncommented, "automation_mutations"),
      ),
    "OWNER_COMPOSITE_CONSTRAINTS",
  );
  addFinding(
    findings,
    matchCount(normalized, /create\s+(?:unique\s+)?index\b/gi) >= 4,
    "AUTOMATION_INDEX_INVENTORY",
  );
  addFinding(
    findings,
    !/\bexception\s+when\s+others\b/i.test(normalized) &&
      !/\b(?:commit|rollback)\s*;/i.test(normalized),
    "NO_PARTIAL_FAILURE_SWALLOWING",
  );
  addFinding(
    findings,
    !/\braise\s+(?:debug|log|info|notice|warning)\b/i.test(normalized),
    "NO_PRIVATE_VALUE_LOGGING",
  );
  addFinding(
    findings,
    !/['"](?:journalText|diaryText|entryText|rawText|prose|content|body|title|notes?)['"]\s*,\s*(?:p_request|v_mutation|v_compensation)/i.test(
      [
        tableDefinition(uncommented, "automation_transactions"),
        tableDefinition(uncommented, "automation_mutations"),
        commitBlock,
        undoBlock,
        functionBlock(uncommented, "get_automation_history_snapshot"),
        functionBlock(uncommented, "purge_automation_history"),
      ].join("\n"),
    ),
    "FIXED_PROSE_FREE_RESULT_KEYS",
  );
  addFinding(
    findings,
    /forward[- ]only/i.test(sql) && /\b(?:rollback|repair)\b/i.test(sql) && /\bkill\b/i.test(sql),
    "FORWARD_ONLY_ROLLBACK_COMMENT",
  );
  addFinding(
    findings,
    !/\b(?:drop\s+table|truncate|disable\s+row\s+level\s+security)\b/i.test(normalized),
    "NO_DESTRUCTIVE_ROLLBACK",
  );

  return findings;
}

function removeFirst(sql: string, expression: RegExp, label: string): string {
  if (!matches(sql, expression)) throw new Error(`Negative control could not find ${label}`);
  return sql.replace(expression, "");
}

function mutateFunctionBlock(
  sql: string,
  functionName: string,
  expression: RegExp,
  label: string,
): string {
  const block = functionBlock(sql, functionName);
  if (!block) throw new Error(`Negative control could not find function ${functionName}`);
  const mutatedBlock = removeFirst(block, expression, label);
  return sql.replace(block, mutatedBlock);
}

function replaceInFunctionBlock(
  sql: string,
  functionName: string,
  expression: RegExp,
  replacement: string,
  label: string,
): string {
  const block = functionBlock(sql, functionName);
  if (!block) throw new Error(`Negative control could not find function ${functionName}`);
  if (!matches(block, expression)) throw new Error(`Negative control could not find ${label}`);
  return sql.replace(block, block.replace(expression, replacement));
}

describe("T168 automation migration static contract", () => {
  it("requires the exact clean-lane migration and accepts only the complete contract", () => {
    expect(
      migrationExists,
      "Expected RED: the T168 migration has not yet been copied into the execution lane",
    ).toBe(true);
    expect(validateAutomationMigration(migrationSql)).toEqual([]);
  });

  it("rejects an in-memory migration missing FORCE RLS", () => {
    if (!migrationExists) return;
    const mutated = removeFirst(
      migrationSql,
      /alter\s+table\s+public\.automation_preferences\s+force\s+row\s+level\s+security\s*;/i,
      "automation_preferences FORCE RLS",
    );
    expect(validateAutomationMigration(mutated)).toContain("FORCE_RLS:automation_preferences");
  });

  it("rejects an in-memory migration missing the authenticated owner guard", () => {
    if (!migrationExists) return;
    const mutated = mutateFunctionBlock(
      migrationSql,
      "commit_automation_transaction",
      /auth\.uid\(\)/i,
      "commit owner derivation",
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "AUTH_UID_OWNER:commit_automation_transaction",
    );
  });

  it("rejects an in-memory migration missing the public RPC revoke", () => {
    if (!migrationExists) return;
    const mutated = removeFirst(
      migrationSql,
      /revoke\s+(?:all(?:\s+privileges)?|execute)\s+on\s+function\s+public\.commit_automation_transaction\s*\([^;]*\)\s+from\s+[^;]+;/i,
      "commit RPC revoke",
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "RPC_REVOKE:commit_automation_transaction",
    );
  });

  it("rejects an in-memory migration missing the CAS row lock", () => {
    if (!migrationExists) return;
    const mutated = replaceInFunctionBlock(
      migrationSql,
      "commit_automation_transaction",
      /(and\s+entity_id\s*=\s*v_mutation->>'entityId'\s*)for\s+update;/i,
      "$1;",
      "commit mutation CAS lock",
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "CAS_LOCK:commit_automation_transaction",
    );
  });

  it("rejects an in-memory migration missing the composite owner foreign key", () => {
    if (!migrationExists) return;
    const mutated = removeFirst(
      migrationSql,
      /foreign\s+key\s*\(\s*user_id\s*,\s*transaction_id\s*\)\s*references\s+public\.automation_transactions\s*\(\s*user_id\s*,\s*id\s*\)\s*on\s+delete\s+cascade\s*,?/i,
      "automation mutation owner foreign key",
    );
    expect(validateAutomationMigration(mutated)).toContain("OWNER_COMPOSITE_CONSTRAINTS");
  });

  it("rejects consistently wrong public RPC definition and privilege signatures", () => {
    if (!migrationExists) return;
    let mutated = replaceInFunctionBlock(
      migrationSql,
      "commit_automation_transaction",
      /p_request\s+jsonb/i,
      "p_request text",
      "commit RPC definition signature",
    );
    mutated = mutated.replace(
      /(on\s+function\s+public\.commit_automation_transaction\s*)\(\s*jsonb\s*\)/gi,
      "$1(text)",
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "RPC_EXPECTED_SIGNATURE:commit_automation_transaction",
    );
  });

  it("rejects an in-memory migration missing an internal helper revoke", () => {
    if (!migrationExists) return;
    const mutated = removeFirst(
      migrationSql,
      /revoke\s+all\s+on\s+function\s+public\.automation_now_ms\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i,
      "automation_now_ms internal helper revoke",
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "INTERNAL_REVOKE:automation_now_ms",
    );
  });

  it("rejects an internal helper revoke with a reduced role set", () => {
    if (!migrationExists) return;
    const mutated = migrationSql.replace(
      /revoke\s+all\s+on\s+function\s+public\.automation_now_ms\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i,
      "REVOKE ALL ON FUNCTION public.automation_now_ms() FROM public, authenticated;",
    );
    expect(mutated, "Negative control could not reduce the helper revoke role set").not.toBe(
      migrationSql,
    );
    expect(validateAutomationMigration(mutated)).toContain(
      "INTERNAL_REVOKE:automation_now_ms",
    );
  });

  it("rejects an unexpected write policy on an automation table", () => {
    if (!migrationExists) return;
    const mutated = `${migrationSql}\n
CREATE POLICY automation_preferences_update_unexpected
  ON public.automation_preferences FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
`;
    expect(validateAutomationMigration(mutated)).toContain(
      "POLICY_INVENTORY:automation_preferences",
    );
  });
});
