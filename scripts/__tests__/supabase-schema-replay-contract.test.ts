import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const initialSchema = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/001_initial_schema.sql"),
  "utf8",
);
const userSettingsMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260125_user_settings.sql"),
  "utf8",
);
const reminderSettingsTimesMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260201_reminder_settings_times.sql"),
  "utf8",
);
const scheduledPushCronMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260202_fix_scheduled_push_cron.sql"),
  "utf8",
);
const scheduledPushCronSql = process.env.ZENFLOW_T169_CRON_SQL_PATH
  ? readFileSync(resolve(process.env.ZENFLOW_T169_CRON_SQL_PATH), "utf8")
  : scheduledPushCronMigration;
const optimizedRlsMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260204_optimize_rls_policies.sql"),
  "utf8",
);
const dataIntegrityMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260314_data_integrity.sql"),
  "utf8",
);
const pgvectorJournalMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260215_pgvector_journal.sql"),
  "utf8",
);
const analyticsRlsMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260331_analytics_events_rls.sql"),
  "utf8",
);
const authenticatedScopeRlsMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260420055001_authenticated_scope_rls.sql"),
  "utf8",
);
const pushTablesMigration = readFileSync(
  resolve(repositoryRoot, "supabase/migrations/20260307_push_tables.sql"),
  "utf8",
);
const privateSyncBroadcastMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260525000000_private_sync_broadcast.sql",
  ),
  "utf8",
);
const accountDeletionRecoveryMigration = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260718113000_account_deletion_recovery_barrier.sql",
  ),
  "utf8",
);

type SqlRange = {
  start: number;
  end: number;
  body: string;
};

function withoutSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function blankSqlLiteral(value: string): string {
  return value.replace(/[^\r\n]/g, " ");
}

function withoutNonExecutableDollarQuotes(sql: string): string {
  let cursor = 0;
  let result = "";
  const delimiterPattern = /\$(?:[a-z_][a-z0-9_]*)?\$/gi;

  while (cursor < sql.length) {
    delimiterPattern.lastIndex = cursor;
    const opening = delimiterPattern.exec(sql);
    if (!opening) {
      result += sql.slice(cursor);
      break;
    }

    const delimiter = opening[0];
    const closingIndex = sql.indexOf(delimiter, opening.index + delimiter.length);
    if (closingIndex < 0) {
      result += sql.slice(cursor);
      break;
    }

    result += sql.slice(cursor, opening.index);
    const isDoBody = /\bdo\s*$/i.test(sql.slice(Math.max(0, opening.index - 16), opening.index));
    if (isDoBody) {
      const bodyStart = opening.index + delimiter.length;
      result += delimiter;
      result += withoutNonExecutableDollarQuotes(sql.slice(bodyStart, closingIndex));
      result += delimiter;
    } else {
      result += blankSqlLiteral(
        sql.slice(opening.index, closingIndex + delimiter.length),
      );
    }
    cursor = closingIndex + delimiter.length;
  }

  return result;
}

function withoutSingleQuotedLiterals(sql: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < sql.length) {
    if (sql[cursor] !== "'") {
      result += sql[cursor];
      cursor += 1;
      continue;
    }

    const start = cursor;
    cursor += 1;
    while (cursor < sql.length) {
      if (sql[cursor] !== "'") {
        cursor += 1;
        continue;
      }
      if (sql[cursor + 1] === "'") {
        cursor += 2;
        continue;
      }
      cursor += 1;
      break;
    }
    result += blankSqlLiteral(sql.slice(start, cursor));
  }

  return result;
}

function withoutQuotedSqlMarkers(sql: string): string {
  let result = "";
  let cursor = 0;
  const structuralKeyword =
    /\b(?:alter|begin|create|delete|do|drop|end|execute|for|from|grant|if|insert|perform|raise|revoke|select|then|update|where|with)\b/i;

  while (cursor < sql.length) {
    const quote = sql[cursor];
    if (quote !== "'" && quote !== '"') {
      result += quote;
      cursor += 1;
      continue;
    }

    const start = cursor;
    cursor += 1;
    while (cursor < sql.length) {
      if (sql[cursor] !== quote) {
        cursor += 1;
        continue;
      }
      if (sql[cursor + 1] === quote) {
        cursor += 2;
        continue;
      }
      cursor += 1;
      break;
    }
    const literal = sql.slice(start, cursor);
    result += structuralKeyword.test(literal) ? blankSqlLiteral(literal) : literal;
  }

  return result;
}

function tableDefinition(sql: string, table: string): string {
  const executable = withoutSqlComments(sql);
  const match = new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\s*\\([\\s\\S]*?\\n\\);`,
    "i",
  ).exec(executable);
  return match?.[0] ?? "";
}

function tableColumns(definition: string): Set<string> {
  const columns = new Set<string>();
  for (const line of definition.split("\n").slice(1, -1)) {
    const normalized = line.trim().replace(/,$/, "");
    if (!normalized || /^(?:primary|foreign|unique|check|constraint)\b/i.test(normalized)) {
      continue;
    }
    const match = /^(?:"((?:""|[^"])+)"|([a-z_][a-z0-9_]*))\s+/i.exec(normalized);
    if (match) columns.add((match[1] ?? match[2]).replace(/""/g, '"').toLowerCase());
  }
  return columns;
}

function doBlocks(sql: string): SqlRange[] {
  const blocks: SqlRange[] = [];
  const opening = /do\s+(\$(?:[a-z_][a-z0-9_]*)?\$)/gi;
  for (const match of sql.matchAll(opening)) {
    const delimiter = match[1];
    const close = sql.indexOf(delimiter, match.index + match[0].length);
    if (close < 0) continue;
    const end = sql.indexOf(";", close + delimiter.length);
    if (end < 0) continue;
    blocks.push({
      start: match.index,
      end: end + 1,
      body: sql.slice(match.index, end + 1),
    });
  }
  return blocks;
}

function isColumnPresenceGuarded(
  sql: string,
  statementStart: number,
  column: string,
): boolean {
  const block = doBlocks(sql).find(
    (candidate) => statementStart >= candidate.start && statementStart < candidate.end,
  );
  if (!block) return false;

  const prefix = sql.slice(block.start, statementStart);
  return (
    /if\s+exists\s*\(\s*select\s+1\s+from\s+information_schema\.columns\b/i.test(prefix) &&
    /table_schema\s*=\s*'public'/i.test(prefix) &&
    /table_name\s*=\s*'user_settings'/i.test(prefix) &&
    new RegExp(`column_name\\s*=\\s*'${column}'`, "i").test(prefix) &&
    /\bthen\s*$/i.test(prefix.trimEnd())
  );
}

function validateUserSettingsReplay(
  baselineSql: string,
  laterMigrationSql: string,
): string[] {
  const findings: string[] = [];
  const executableBaseline = withoutSqlComments(baselineSql);
  const executableMigration = withoutSqlComments(laterMigrationSql);
  const baselineDefinition = tableDefinition(executableBaseline, "user_settings");
  if (!baselineDefinition) return ["MISSING_BASELINE_TABLE:user_settings"];

  const existingColumns = tableColumns(baselineDefinition);
  const indexPattern =
    /create\s+index\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)\s+on\s+public\.user_settings\s*\(\s*([a-z_][a-z0-9_]*)\s*\)[\s\S]*?;/gi;

  for (const match of executableMigration.matchAll(indexPattern)) {
    const indexName = match[1].toLowerCase();
    const column = match[2].toLowerCase();
    if (existingColumns.has(column)) continue;
    if (!isColumnPresenceGuarded(executableMigration, match.index, column)) {
      findings.push(`UNGUARDED_INDEX_COLUMN:${indexName}:${column}`);
    }
  }

  return findings;
}

function firstMatchIndex(sql: string, expressions: RegExp[]): number | undefined {
  const indexes = expressions
    .map((expression) => expression.exec(sql)?.index)
    .filter((index): index is number => index !== undefined);
  return indexes.length > 0 ? Math.min(...indexes) : undefined;
}

function validateTableEstablishedBeforeUse(
  sql: string,
  table: string,
  expectedColumns: readonly string[],
): string[] {
  const findings: string[] = [];
  const executable = withoutSqlComments(sql);
  const definition = tableDefinition(executable, table);
  const definitionIndex = definition ? executable.indexOf(definition) : -1;
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const firstUse = firstMatchIndex(executable, [
    new RegExp(`alter\\s+table\\s+(?:public\\.)?${escapedTable}\\b`, "i"),
    new RegExp(`update\\s+(?:public\\.)?${escapedTable}\\b`, "i"),
    new RegExp(`(?:create|drop)\\s+policy[\\s\\S]*?\\bon\\s+(?:public\\.)?${escapedTable}\\b`, "i"),
  ]);

  if (!definition || firstUse === undefined || definitionIndex > firstUse) {
    return [`MISSING_TABLE_BEFORE_USE:${table}`];
  }

  const actualColumns = tableColumns(definition);
  for (const column of expectedColumns) {
    if (!actualColumns.has(column)) findings.push(`MISSING_BASELINE_COLUMN:${table}:${column}`);
  }
  const enableRls = new RegExp(
    `alter\\s+table\\s+(?:public\\.)?${escapedTable}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
    "i",
  ).exec(executable);
  if (!enableRls || enableRls.index < definitionIndex) {
    findings.push(`MISSING_BASELINE_RLS:${table}`);
  }
  return findings;
}

function validateOptionalTablePolicyBlocks(sql: string, tables: readonly string[]): string[] {
  const executable = withoutSqlComments(sql);
  const findings: string[] = [];

  for (const table of tables) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const policyStatements = [...executable.matchAll(/(?:drop|create)\s+policy\b[\s\S]*?;/gi)].filter(
      (statement) =>
        new RegExp(`\\bon\\s+public\\.${escaped}\\b`, "i").test(statement[0]),
    );
    for (const directPolicy of policyStatements) {
      const containingBlock = doBlocks(executable).find(
        (candidate) =>
          directPolicy.index >= candidate.start && directPolicy.index < candidate.end,
      );
      const prefix = containingBlock
        ? executable.slice(containingBlock.start, directPolicy.index)
        : "";
      if (
        !containingBlock ||
        !new RegExp(
          `if\\s+(?:to_regclass\\s*\\(\\s*'public\\.${escaped}'\\s*\\)\\s+is\\s+not\\s+null|exists\\s*\\([\\s\\S]*?table_name\\s*=\\s*'${escaped}')`,
          "i",
        ).test(prefix)
      ) {
        findings.push(`UNGUARDED_OPTIONAL_POLICY_TABLE:${table}`);
        break;
      }
      if (
        /^create\s+policy/i.test(directPolicy[0].trim()) &&
        !new RegExp(
          `if\\s+to_regclass\\s*\\(\\s*'public\\.${escaped}'\\s*\\)\\s+is\\s+not\\s+null\\s+then[\\s\\S]*?alter\\s+table\\s+public\\.${escaped}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
          "i",
        ).test(prefix)
      ) {
        findings.push(`MISSING_OPTIONAL_TABLE_RLS:${table}`);
        break;
      }
    }
  }

  return findings;
}

function validateOptionalTableComment(sql: string, table: string): string[] {
  const executable = withoutSqlComments(sql);
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const comments = [
    ...executable.matchAll(
      new RegExp(`comment\\s+on\\s+table\\s+public\\.${escaped}\\b[\\s\\S]*?;`, "gi"),
    ),
  ];
  for (const comment of comments) {
    const containingBlock = doBlocks(executable).find(
      (candidate) => comment.index >= candidate.start && comment.index < candidate.end,
    );
    const prefix = containingBlock ? executable.slice(containingBlock.start, comment.index) : "";
    if (
      !containingBlock ||
      !new RegExp(
        `if\\s+to_regclass\\s*\\(\\s*'public\\.${escaped}'\\s*\\)\\s+is\\s+not\\s+null`,
        "i",
      ).test(prefix)
    ) {
      return [`UNGUARDED_OPTIONAL_TABLE_COMMENT:${table}`];
    }
  }
  return [];
}

function policyNamesForTable(sql: string, table: string): string[] {
  const executable = withoutSqlComments(sql);
  return [...executable.matchAll(/create\s+policy\s+("(?:""|[^"])+"|[a-z_][a-z0-9_]*)[\s\S]*?;/gi)]
    .filter((match) =>
      new RegExp(`\\bon\\s+public\\.${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
        match[0],
      ),
    )
    .map((match) => match[1]);
}

function validateRecreatedPolicies(sql: string, table: string, policyNames: readonly string[]): string[] {
  const executable = withoutSqlComments(sql);
  const findings: string[] = [];
  for (const quotedName of policyNames) {
    const escapedName = quotedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const creates = [
      ...executable.matchAll(
        new RegExp(
          `create\\s+policy\\s+${escapedName}[\\s\\S]*?\\bon\\s+public\\.${table}\\b[\\s\\S]*?;`,
          "gi",
        ),
      ),
    ];
    for (const create of creates) {
      const prefix = executable.slice(Math.max(0, create.index - 240), create.index);
      if (
        !new RegExp(
          `drop\\s+policy\\s+if\\s+exists\\s+${escapedName}\\s+on\\s+public\\.${table}\\s*;\\s*$`,
          "i",
        ).test(prefix)
      ) {
        findings.push(`NONIDEMPOTENT_POLICY_RECREATE:${table}:${quotedName}`);
      }
    }
  }
  return findings;
}

function validateScheduledPushCronMigration(sql: string): string[] {
  const findings: string[] = [];
  const rawExecutable = withoutSqlComments(sql);
  const executable = withoutQuotedSqlMarkers(
    withoutNonExecutableDollarQuotes(rawExecutable),
  );
  if (/\bcreate\s+extension\b/i.test(executable)) {
    findings.push("FORBIDDEN_PRIVILEGED_EXTENSION_INSTALL");
  }
  if (/\b(?:grant|revoke)\b[^;]*\b(?:net|cron)\b/i.test(executable)) {
    findings.push("FORBIDDEN_EXTENSION_ACL_MUTATION");
  }

  if (/https?:\/\/[^\s'"$]*\.supabase\.co\b/i.test(rawExecutable)) {
    findings.push("HARDCODED_HOSTED_SUPABASE_ENDPOINT");
  }
  if (/https?:\/\/(?!\[)[a-z0-9]/i.test(rawExecutable)) {
    findings.push("HARDCODED_HTTP_ENDPOINT");
  }
  if (/bearer\s+[a-z0-9._~-]{12,}/i.test(rawExecutable)) {
    findings.push("HARDCODED_BEARER_CREDENTIAL");
  }
  if (/\bwhere\b[\s\S]{0,160}\b(?:jobname|command)\s+like\b/i.test(executable)) {
    findings.push("BROAD_CRON_JOB_MATCH");
  }

  const schedules = [...executable.matchAll(/(?<!to_regprocedure\s*\(\s*')\bcron\.schedule\s*\(/gi)];
  const schedule = schedules[0];
  if (!schedule) {
    findings.push("MISSING_SCHEDULE_CALL");
    return findings;
  }
  if (schedules.length !== 1) {
    findings.push("NONEXACT_SCHEDULE_COUNT");
  }

  const guardedBlock = doBlocks(executable).find(
    (candidate) =>
      schedule.index >= candidate.start && schedule.index < candidate.end,
  );
  if (!guardedBlock) {
    findings.push("UNGUARDED_SCHEDULE_CALL");
    return findings;
  }

  const beforeSchedule = executable.slice(guardedBlock.start, schedule.index);
  const capabilityGuard = /if\s+to_regclass\s*\(\s*'cron\.job'\s*\)\s+is\s+null\s+or\s+to_regprocedure\s*\(\s*'cron\.unschedule\(bigint\)'\s*\)\s+is\s+null\s+or\s+to_regprocedure\s*\(\s*'cron\.schedule\(text,text,text\)'\s*\)\s+is\s+null\s+or\s+to_regprocedure\s*\(\s*'net\.http_post\(text,jsonb,jsonb,jsonb,integer\)'\s*\)\s+is\s+null\s+then[\s\S]*?return\s*;[\s\S]*?end\s+if\s*;/i.exec(
    beforeSchedule,
  );
  if (!capabilityGuard) findings.push("MISSING_OPERATOR_CAPABILITY_GUARD");

  const firstUnschedule = /\bfor\s+existing_job\s+in\s+select\s+jobid\s+from\s+cron\.job/i.exec(
    beforeSchedule,
  );
  const firstFailClosedReturn = /\breturn\s*;/i.exec(beforeSchedule);
  if (!firstUnschedule || !firstFailClosedReturn || firstFailClosedReturn.index > firstUnschedule.index) {
    findings.push("CAPABILITY_GUARD_NOT_BEFORE_UNSCHEDULE");
  }
  const exactUnscheduleLoop = /for\s+existing_job\s+in\s+select\s+jobid\s+from\s+cron\.job\s+where\s+jobname\s*=\s*'send-scheduled-push-v2'\s+loop\s+perform\s+cron\.unschedule\s*\(\s*existing_job\.jobid\s*\)\s*;\s*end\s+loop\s*;/i.exec(
    beforeSchedule,
  );
  if (!exactUnscheduleLoop) {
    findings.push("MISSING_EXACT_JOB_MATCH");
  }
  const aclGuardPattern = /unnest\s*\(\s*array\s*\[\s*'anon'\s*,\s*'authenticated'\s*\]\s*\)[\s\S]*?has_schema_privilege[\s\S]*?'net'[\s\S]*?has_schema_privilege[\s\S]*?'cron'[\s\S]*?has_function_privilege[\s\S]*?has_table_privilege[\s\S]*?has_sequence_privilege/i;
  const preflightAclQuery = /select\s+exists\s*\([\s\S]*?\)\s+into\s+app_role_has_cron_or_net_access\s*;/i.exec(
    beforeSchedule,
  )?.[0] ?? "";
  if (
    !aclGuardPattern.test(preflightAclQuery) ||
    !/app_role_has_cron_or_net_access\s+is\s+true\s+then[\s\S]*?return\s*;/i.test(
      beforeSchedule,
    )
  ) {
    findings.push("MISSING_EFFECTIVE_APP_ROLE_ACL_GUARD");
  }
  if (!/to_regclass\s*\(\s*'vault\.decrypted_secrets'\s*\)/i.test(beforeSchedule)) {
    findings.push("MISSING_VAULT_RELATION_GUARD");
  }
  for (const secretName of ["project_url", "service_role_key"]) {
    if (
      !new RegExp(`name\\s*=\\s*'${secretName}'`, "i").test(beforeSchedule) ||
      !new RegExp(`${secretName}[\\s\\S]{0,200}(?:is\\s+null|nullif)`, "i").test(
        beforeSchedule,
      )
    ) {
      findings.push(`MISSING_SECRET_GUARD:${secretName}`);
    }
  }
  const prerequisiteBranches = [
    /if\s+to_regclass\s*\(\s*'vault\.decrypted_secrets'\s*\)\s+is\s+null\s+then[\s\S]*?end\s+if\s*;/i,
    /if\s+project_url_count\s*<>\s*1\s+or\s+project_url_value\s+is\s+null\s+then[\s\S]*?end\s+if\s*;/i,
    /if\s+project_url_value\s*!~[\s\S]*?then[\s\S]*?end\s+if\s*;/i,
    /if\s+service_role_key_count\s*<>\s*1\s+or\s+service_role_key_nonempty\s+is\s+not\s+true\s+then[\s\S]*?end\s+if\s*;/i,
  ];
  if (
    prerequisiteBranches.some((branch) => {
      const match = branch.exec(beforeSchedule);
      return !match || !/\breturn\s*;/i.test(match[0]);
    })
  ) {
    findings.push("MISSING_FAIL_CLOSED_RETURN");
  }

  const scheduledCall = rawExecutable.slice(schedule.index, guardedBlock.end);
  const scheduledCommand = /\$cron_command\$([\s\S]*?)\$cron_command\$/i.exec(
    scheduledCall,
  )?.[1] ?? "";
  if (
    !/^\s*cron\.schedule\s*\(\s*'send-scheduled-push-v2'\s*,/i.test(
      executable.slice(schedule.index),
    )
  ) {
    findings.push("MISSING_EXACT_SCHEDULE_IDENTITY");
  }
  if (
    !/^\s*cron\.schedule\s*\(\s*'send-scheduled-push-v2'\s*,\s*'\*\/15 \* \* \* \*'\s*,/i.test(
      executable.slice(schedule.index),
    )
  ) {
    findings.push("MISSING_EXACT_SCHEDULE_CADENCE");
  }
  for (const secretName of ["project_url", "service_role_key"]) {
    if (!new RegExp(`name\\s*=\\s*'${secretName}'`, "i").test(scheduledCommand)) {
      findings.push(`SCHEDULE_DOES_NOT_READ_VAULT:${secretName}`);
    }
  }
  const endpointCte = /\bendpoint\s+as\s*\(([\s\S]*?)\)\s*,\s*credential\s+as\s*\(/i.exec(
    scheduledCommand,
  )?.[1] ?? "";
  const credentialCte = /\bcredential\s+as\s*\(([\s\S]*?)\)\s*select\s+net\.http_post\s*\(/i.exec(
    scheduledCommand,
  )?.[1] ?? "";
  const exactCardinality = /having\s+(?:pg_catalog\.)?count\s*\(\s*\*\s*\)\s*=\s*1/i;
  const endpointCardinality =
    /where\s+name\s*=\s*'project_url'/i.test(endpointCte) &&
    exactCardinality.test(endpointCte);
  const credentialCardinality =
    /where\s+name\s*=\s*'service_role_key'/i.test(credentialCte) &&
    exactCardinality.test(credentialCte);
  if (!endpointCardinality || !credentialCardinality) {
    findings.push("MISSING_RUNTIME_CARDINALITY_GUARD");
  }
  if (
    !/select\s+(?:pg_catalog\.)?min\s*\(\s*nullif\s*\(\s*(?:pg_catalog\.)?rtrim\s*\(\s*decrypted_secret\s*,\s*'\/'\s*\)\s*,\s*''\s*\)\s*\)\s+as\s+project_url/i.test(
      endpointCte,
    )
  ) {
    findings.push("MISSING_RUNTIME_ENDPOINT_NORMALIZATION");
  }
  if (
    !/select\s+(?:pg_catalog\.)?min\s*\(\s*nullif\s*\(\s*(?:pg_catalog\.)?btrim\s*\(\s*decrypted_secret\s*\)\s*,\s*''\s*\)\s*\)\s+as\s+service_role_key/i.test(
      credentialCte,
    )
  ) {
    findings.push("MISSING_RUNTIME_CREDENTIAL_NORMALIZATION");
  }
  const normalizedScheduledCommand = scheduledCommand.replace(/\s+/g, " ").toLowerCase();
  if (
    !normalizedScheduledCommand.includes(
      "where endpoint.project_url ~ '^https://[a-z0-9-]+[.]supabase[.]co$'",
    )
  ) {
    findings.push("MISSING_RUNTIME_ORIGIN_GUARD");
  }
  if (!/credential\.service_role_key\s+is\s+not\s+null/i.test(scheduledCommand)) {
    findings.push("MISSING_RUNTIME_NONEMPTY_CREDENTIAL_GUARD");
  }
  if (
    !/url\s*:=\s*endpoint\.project_url\s*\|\|\s*'\/functions\/v1\/send-scheduled-push'/i.test(
      scheduledCommand,
    )
  ) {
    findings.push("MISSING_EXACT_RUNTIME_ENDPOINT_PATH");
  }
  if (
    !/headers\s*:=\s*(?:pg_catalog\.)?jsonb_build_object\s*\(\s*'Content-Type'\s*,\s*'application\/json'\s*,\s*'Authorization'\s*,\s*'Bearer '\s*\|\|\s*credential\.service_role_key\s*\)/i.test(
      scheduledCommand,
    )
  ) {
    findings.push("MISSING_RUNTIME_AUTHORIZATION_HEADER");
  }
  if ([...scheduledCommand.matchAll(/\bnet\s*\.\s*http_post\s*\(/gi)].length !== 1) {
    findings.push("NONEXACT_RUNTIME_HTTP_CALL_COUNT");
  }
  if (!/acl_guard\s+as\s*\([\s\S]*?where\s+not\s+exists\s*\(/i.test(scheduledCommand) || !aclGuardPattern.test(scheduledCommand)) {
    findings.push("MISSING_RUNTIME_APP_ROLE_ACL_GUARD");
  }
  if (
    !/from\s+acl_guard\s+cross\s+join\s+endpoint\s+cross\s+join\s+credential\b/i.test(
      scheduledCommand,
    )
  ) {
    findings.push("UNCONSUMED_RUNTIME_APP_ROLE_ACL_GUARD");
  }
  const executableCode = withoutSingleQuotedLiterals(executable);
  if (/\bexecute\b/i.test(executableCode)) {
    findings.push("FORBIDDEN_CRON_DYNAMIC_SQL");
  }
  if (
    /\b(?:perform|select)\s+(?:"net"|net)\s*\.\s*(?:"http_post"|http_post)\s*\(/i.test(
      executableCode,
    )
  ) {
    findings.push("DIRECT_MIGRATION_HTTP_CALL");
  }

  return findings;
}

function validateRealtimeMessagesPolicyMigration(
  sql: string,
  requireBootstrapAssertion = false,
  requireDeletionFence = false,
): string[] {
  const executable = withoutQuotedSqlMarkers(
    withoutNonExecutableDollarQuotes(withoutSqlComments(sql)),
  );
  const findings: string[] = [];

  if (/alter\s+table\s+(?:only\s+)?realtime\.messages\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_MESSAGES_OWNER_ALTER");
  }
  if (/alter\s+table\s+(?:only\s+)?realtime\.messages[\s\S]*?\bowner\s+to\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_MESSAGES_OWNER_CHANGE");
  }
  if (/\bset\s+(?:local\s+|session\s+)?role\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_ROLE_SWITCH");
  }
  if (/\bset\s+(?:local\s+|session\s+)?session\s+authorization\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_SESSION_AUTHORIZATION");
  }
  if (/\bgrant\s+(?:supabase_realtime_admin|supabase_admin)\s+to\s+postgres\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_ROLE_MEMBERSHIP_GRANT");
  }
  if (/\balter\s+role\s+postgres\b[^;]*\bsuperuser\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_POSTGRES_SUPERUSER");
  }
  if (
    requireBootstrapAssertion &&
    /security\s+definer/i.test(executable)
  ) {
    findings.push("FORBIDDEN_REALTIME_SECURITY_DEFINER_PROXY");
  }
  if (/\bgrant\b[^;]*\bon\s+(?:table\s+)?realtime\.messages\b/i.test(executable)) {
    findings.push("FORBIDDEN_REALTIME_MESSAGES_GRANT");
  }
  if (
    requireBootstrapAssertion &&
    !/if\s+not\s+exists\s*\([\s\S]*?from\s+pg_catalog\.pg_class[\s\S]*?join\s+pg_catalog\.pg_namespace[\s\S]*?namespace\.nspname\s*=\s*'realtime'[\s\S]*?relation\.relname\s*=\s*'messages'[\s\S]*?relation\.relrowsecurity\s+is\s+true[\s\S]*?raise\s+exception[\s\S]*?end\s+if\s*;/i.test(
      executable,
    )
  ) {
    findings.push("MISSING_REALTIME_RLS_BOOTSTRAP_ASSERTION");
  }

  const expectedPolicies = [
    {
      name: "sync broadcast receive own topic",
      action: "select",
    },
    {
      name: "sync broadcast send own topic",
      action: "insert",
    },
  ] as const;

  const realtimePolicyStatements = [
    ...executable.matchAll(
      /create\s+policy\s+(?:"(?:""|[^"])+"|[a-z_][a-z0-9_]*)\s+on\s+realtime\.messages\b[\s\S]*?;/gi,
    ),
  ];
  if (realtimePolicyStatements.length !== expectedPolicies.length) {
    findings.push("SURPLUS_OR_MISSING_REALTIME_POLICY");
  }

  const expectedBasePredicate =
    "realtime.messages.extension='broadcast'and(selectrealtime.topic())='sync-signal:'||(selectauth.uid())::text";
  const expectedDeletionPredicate =
    `${expectedBasePredicate}andnotexists(select1frompublic.account_deletion_blocksasdeletion_blockwheredeletion_block.user_id=(selectauth.uid()))`;

  for (const { name, action } of expectedPolicies) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const statement = new RegExp(
      `create\\s+policy\\s+"${escapedName}"\\s+on\\s+realtime\\.messages\\s+for\\s+${action}\\s+to\\s+authenticated\\b[\\s\\S]*?;`,
      "i",
    ).exec(executable)?.[0] ?? "";
    if (!statement) {
      findings.push(`MISSING_REALTIME_POLICY:${name}:${action}`);
      continue;
    }
    const expressionKeyword = action === "select" ? "using" : "with\\s+check";
    const expression = new RegExp(
      `${expressionKeyword}\\s*(\\([\\s\\S]*\\))\\s*;`,
      "i",
    ).exec(statement)?.[1] ?? "";
    const normalizedExpression = expression
      .replace(/^\(|\)$/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    const expectedExpression = requireDeletionFence
      ? expectedDeletionPredicate
      : expectedBasePredicate;
    if (normalizedExpression !== expectedExpression) {
      findings.push(`NONEXACT_REALTIME_POLICY_PREDICATE:${name}`);
    }
    if (!/realtime\.messages\.extension\s*=\s*'broadcast'/i.test(expression)) {
      findings.push(`MISSING_REALTIME_EXTENSION_PREDICATE:${name}`);
    }
    if (
      !/\(\s*select\s+realtime\.topic\s*\(\s*\)\s*\)\s*=\s*'sync-signal:'\s*\|\|\s*\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)\s*::\s*text/i.test(
        expression,
      )
    ) {
      findings.push(`MISSING_REALTIME_TOPIC_PREDICATE:${name}`);
    }
    if (
      requireDeletionFence &&
      !/not\s+exists\s*\(\s*select\s+1\s+from\s+public\.account_deletion_blocks\s+as\s+deletion_block\s+where\s+deletion_block\.user_id\s*=\s*\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)\s*\)/i.test(
        expression,
      )
    ) {
      findings.push(`MISSING_REALTIME_DELETION_FENCE:${name}`);
    }
  }

  return findings;
}

describe("Supabase legacy schema replay contract", () => {
  it("keeps the 20260125 user-settings migration replayable after the KV table already exists", () => {
    expect(validateUserSettingsReplay(initialSchema, userSettingsMigration)).toEqual([]);
  });

  it("rejects an in-memory migration that restores the unconditional missing-column index", () => {
    const unconditionalIndex = [
      "CREATE INDEX IF NOT EXISTS idx_user_settings_weekly_digest",
      "  ON public.user_settings(weekly_digest_enabled)",
      "  WHERE weekly_digest_enabled = true;",
    ].join("\n");
    const guardedBlock = /do\s+\$\$[\s\S]*?idx_user_settings_weekly_digest[\s\S]*?\$\$\s*;/i;
    const mutated = guardedBlock.test(userSettingsMigration)
      ? userSettingsMigration.replace(guardedBlock, unconditionalIndex)
      : userSettingsMigration;

    expect(validateUserSettingsReplay(initialSchema, mutated)).toContain(
      "UNGUARDED_INDEX_COLUMN:idx_user_settings_weekly_digest:weekly_digest_enabled",
    );
  });

  it("creates reminder settings before the first historical ALTER TABLE", () => {
    expect(
      validateTableEstablishedBeforeUse(
        reminderSettingsTimesMigration,
        "user_reminder_settings",
        [
          "user_id",
          "enabled",
          "mood_time",
          "mood_time_morning",
          "mood_time_afternoon",
          "mood_time_evening",
          "habit_time",
          "focus_time",
          "days",
          "quiet_start",
          "quiet_end",
          "habit_ids",
          "timezone",
          "language",
          "updated_at",
        ],
      ),
    ).toEqual([]);
  });

  it("creates inner-world storage before the RLS optimizer references it", () => {
    expect(
      validateTableEstablishedBeforeUse(optimizedRlsMigration, "user_inner_world", [
        "user_id",
        "world_data",
        "updated_at",
      ]),
    ).toEqual([]);
  });

  it("guards policies for relations absent at that point in migration history", () => {
    expect(
      validateOptionalTablePolicyBlocks(optimizedRlsMigration, [
        "push_logs",
        "push_device_tokens",
        "user_stats",
        "analytics_events",
      ]),
    ).toEqual([]);
  });

  it("rejects an in-memory optimizer with an unguarded optional-table policy", () => {
    const mutated = `${optimizedRlsMigration}\nCREATE POLICY "unsafe" ON public.analytics_events FOR SELECT USING (true);\n`;
    expect(validateOptionalTablePolicyBlocks(mutated, ["analytics_events"])).toContain(
      "UNGUARDED_OPTIONAL_POLICY_TABLE:analytics_events",
    );
  });

  it("rejects an in-memory optional-table policy without fail-closed RLS", () => {
    const mutated = optimizedRlsMigration.replace(
      "ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;",
      "",
    );
    expect(validateOptionalTablePolicyBlocks(mutated, ["analytics_events"])).toContain(
      "MISSING_OPTIONAL_TABLE_RLS:analytics_events",
    );
  });

  it("rejects in-memory RLS moved outside the matching optional-table guard", () => {
    const rls = "ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;";
    const mutated = optimizedRlsMigration
      .replace(rls, "")
      .replace(/DO \$\$/i, `${rls}\nDO $$`);
    expect(validateOptionalTablePolicyBlocks(mutated, ["analytics_events"])).toContain(
      "MISSING_OPTIONAL_TABLE_RLS:analytics_events",
    );
  });

  it("keeps all later optional-table operations replayable when hosted-only relations are absent", () => {
    expect(validateOptionalTableComment(dataIntegrityMigration, "user_stats")).toEqual([]);
    expect(validateOptionalTablePolicyBlocks(analyticsRlsMigration, ["analytics_events"])).toEqual(
      [],
    );
    expect(
      validateOptionalTablePolicyBlocks(authenticatedScopeRlsMigration, [
        "user_stats",
        "analytics_events",
      ]),
    ).toEqual([]);
  });

  it("retains the admitted later creators for both push tables", () => {
    for (const table of ["push_logs", "push_device_tokens"]) {
      const definition = tableDefinition(pushTablesMigration, table);
      expect(definition).not.toBe("");
      expect(tableColumns(definition)).toContain("user_id");
      expect(
        new RegExp(
          `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
          "i",
        ).test(withoutSqlComments(pushTablesMigration)),
      ).toBe(true);
    }
  });

  it("does not invent DDL for hosted-only user_stats or analytics_events", () => {
    const repairedSql = [
      optimizedRlsMigration,
      dataIntegrityMigration,
      analyticsRlsMigration,
      authenticatedScopeRlsMigration,
    ].join("\n");
    for (const table of ["user_stats", "analytics_events"]) {
      expect(tableDefinition(repairedSql, table)).toBe("");
    }
  });

  it("manages Realtime authorization through policies without owner-only table DDL", () => {
    expect(validateRealtimeMessagesPolicyMigration(privateSyncBroadcastMigration, true)).toEqual(
      [],
    );
    expect(
      validateRealtimeMessagesPolicyMigration(
        accountDeletionRecoveryMigration,
        false,
        true,
      ),
    ).toEqual([]);
  });

  it("rejects weakened Realtime broadcast, owner-topic, and deletion-fence predicates", () => {
    const withoutBroadcast = privateSyncBroadcastMigration.replace(
      /realtime\.messages\.extension\s*=\s*'broadcast'\s+and\s+/i,
      "",
    );
    expect(validateRealtimeMessagesPolicyMigration(withoutBroadcast, true)).toContain(
      "MISSING_REALTIME_EXTENSION_PREDICATE:sync broadcast receive own topic",
    );

    const broadenedTopic = privateSyncBroadcastMigration.replace(
      /\(SELECT realtime\.topic\(\)\)\s*=\s*'sync-signal:'\s*\|\|\s*\(SELECT auth\.uid\(\)\)::text/i,
      "(SELECT realtime.topic()) LIKE 'sync-signal:%'",
    );
    expect(validateRealtimeMessagesPolicyMigration(broadenedTopic, true)).toContain(
      "MISSING_REALTIME_TOPIC_PREDICATE:sync broadcast receive own topic",
    );

    const withoutDeletionFence = accountDeletionRecoveryMigration.replace(
      /\s+and\s+not\s+exists\s*\(\s*select\s+1\s+from\s+public\.account_deletion_blocks\s+as\s+deletion_block\s+where\s+deletion_block\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)\s*\)/i,
      "",
    );
    expect(
      validateRealtimeMessagesPolicyMigration(withoutDeletionFence, false, true),
    ).toContain("MISSING_REALTIME_DELETION_FENCE:sync broadcast receive own topic");

    const permissiveReceive = privateSyncBroadcastMigration.replace(
      "realtime.messages.extension = 'broadcast'",
      "(realtime.messages.extension = 'broadcast' OR TRUE)",
    );
    expect(validateRealtimeMessagesPolicyMigration(permissiveReceive, true)).toContain(
      "NONEXACT_REALTIME_POLICY_PREDICATE:sync broadcast receive own topic",
    );

    const inertBroadcastMarker = privateSyncBroadcastMigration.replace(
      "realtime.messages.extension = 'broadcast'",
      "$predicate$realtime.messages.extension = 'broadcast'$predicate$ IS NOT NULL",
    );
    expect(validateRealtimeMessagesPolicyMigration(inertBroadcastMarker, true)).toContain(
      "NONEXACT_REALTIME_POLICY_PREDICATE:sync broadcast receive own topic",
    );

    const weakenedDeletionFence = accountDeletionRecoveryMigration.replace(
      /not\s+exists\s*\(\s*select\s+1\s+from\s+public\.account_deletion_blocks\s+as\s+deletion_block\s+where\s+deletion_block\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)\s*\)/i,
      (match) => `(${match} OR TRUE)`,
    );
    expect(
      validateRealtimeMessagesPolicyMigration(weakenedDeletionFence, false, true),
    ).toContain("NONEXACT_REALTIME_POLICY_PREDICATE:sync broadcast receive own topic");

    const surplusPolicy = `${privateSyncBroadcastMigration}\nCREATE POLICY "surplus permissive receive" ON realtime.messages FOR SELECT TO authenticated USING (true);\n`;
    expect(validateRealtimeMessagesPolicyMigration(surplusPolicy, true)).toContain(
      "SURPLUS_OR_MISSING_REALTIME_POLICY",
    );

    const policyStatements = [
      ...withoutSqlComments(privateSyncBroadcastMigration).matchAll(
        /create\s+policy\s+"sync broadcast (?:receive|send) own topic"[\s\S]*?;/gi,
      ),
    ].map((match) => match[0]);
    const inertOnlyPolicies = policyStatements.reduce(
      (migration, statement, index) =>
        migration.replace(statement, "") +
        `\nSELECT $inert_policy_${index}$${statement}$inert_policy_${index}$;\n`,
      privateSyncBroadcastMigration,
    );
    expect(validateRealtimeMessagesPolicyMigration(inertOnlyPolicies, true)).toContain(
      "SURPLUS_OR_MISSING_REALTIME_POLICY",
    );

    const quotedOnlyPolicies = policyStatements.reduce(
      (migration, statement) =>
        migration.replace(statement, "") +
        `\nSELECT '${statement.replaceAll("'", "''")}';\n`,
      privateSyncBroadcastMigration,
    );
    expect(validateRealtimeMessagesPolicyMigration(quotedOnlyPolicies, true)).toContain(
      "SURPLUS_OR_MISSING_REALTIME_POLICY",
    );
  });

  it("rejects owner changes, role switches, grants, table DDL, and missing bootstrap RLS assertions", () => {
    const forbiddenStatements = [
      "ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;",
      "ALTER TABLE realtime.messages OWNER TO postgres;",
      "SET LOCAL ROLE supabase_realtime_admin;",
      "SET SESSION AUTHORIZATION supabase_realtime_admin;",
      "GRANT supabase_realtime_admin TO postgres;",
      "GRANT supabase_admin TO postgres;",
      "ALTER ROLE postgres SUPERUSER;",
      "GRANT ALL ON TABLE realtime.messages TO postgres;",
    ];
    for (const statement of forbiddenStatements) {
      expect(
        validateRealtimeMessagesPolicyMigration(
          `${accountDeletionRecoveryMigration}\n${statement}\n`,
        ),
      ).not.toEqual([]);
    }
    const assertion = /do\s+\$\$[\s\S]*?relrowsecurity[\s\S]*?\$\$\s*;/i.exec(
      privateSyncBroadcastMigration,
    )?.[0];
    expect(
      validateRealtimeMessagesPolicyMigration(
        assertion
          ? privateSyncBroadcastMigration.replace(assertion, "")
          : privateSyncBroadcastMigration,
        true,
      ),
    ).toContain("MISSING_REALTIME_RLS_BOOTSTRAP_ASSERTION");

    const definerProxy = `${privateSyncBroadcastMigration}\nCREATE FUNCTION public.unsafe_realtime_ddl() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE 'DROP POLICY unsafe ON realtime.messages'; END; $$;\n`;
    expect(validateRealtimeMessagesPolicyMigration(definerProxy, true)).toContain(
      "FORBIDDEN_REALTIME_SECURITY_DEFINER_PROXY",
    );
  });

  it("replaces the four journal-embedding policies owned by the earlier migration", () => {
    const ownerPolicies = policyNamesForTable(pgvectorJournalMigration, "journal_embeddings");
    expect(ownerPolicies).toHaveLength(4);
    expect(validateRecreatedPolicies(dataIntegrityMigration, "journal_embeddings", ownerPolicies)).toEqual(
      [],
    );
  });

  it("rejects an in-memory duplicate journal-embedding policy without an exact drop", () => {
    const ownerPolicies = policyNamesForTable(pgvectorJournalMigration, "journal_embeddings");
    const mutated = dataIntegrityMigration.replace(
      /drop\s+policy\s+if\s+exists\s+"Users can read own embeddings"[\s\S]*?;/i,
      "",
    );
    expect(validateRecreatedPolicies(mutated, "journal_embeddings", ownerPolicies)).toContain(
      'NONIDEMPOTENT_POLICY_RECREATE:journal_embeddings:"Users can read own embeddings"',
    );
  });

  it("rejects in-memory later migrations with unguarded optional operations", () => {
    const unguardedComment = `${dataIntegrityMigration}\nCOMMENT ON TABLE public.user_stats IS 'legacy';\n`;
    const unguardedPolicy = `${authenticatedScopeRlsMigration}\nCREATE POLICY "unsafe" ON public.analytics_events FOR SELECT USING (true);\n`;
    expect(validateOptionalTableComment(unguardedComment, "user_stats")).toContain(
      "UNGUARDED_OPTIONAL_TABLE_COMMENT:user_stats",
    );
    expect(validateOptionalTablePolicyBlocks(unguardedPolicy, ["analytics_events"])).toContain(
      "UNGUARDED_OPTIONAL_POLICY_TABLE:analytics_events",
    );
  });

  it.each([
    {
      table: "user_reminder_settings",
      sql: reminderSettingsTimesMigration,
      columns: ["user_id"],
    },
    {
      table: "user_inner_world",
      sql: optimizedRlsMigration,
      columns: ["user_id"],
    },
  ])("rejects an in-memory replay with the $table baseline removed", ({ table, sql, columns }) => {
    const definition = tableDefinition(sql, table);
    const mutated = definition ? sql.replace(definition, "") : sql;
    expect(validateTableEstablishedBeforeUse(mutated, table, columns)).toContain(
      `MISSING_TABLE_BEFORE_USE:${table}`,
    );
  });

  it("rejects an in-memory reminder baseline hidden inside a block comment", () => {
    const definition = tableDefinition(reminderSettingsTimesMigration, "user_reminder_settings");
    const executable = withoutSqlComments(reminderSettingsTimesMigration);
    const rls = /alter\s+table\s+(?:public\.)?user_reminder_settings\s+enable\s+row\s+level\s+security\s*;/i.exec(
      executable,
    )?.[0];
    const mutated = reminderSettingsTimesMigration
      .replace(definition, `/* ${definition} */`)
      .replace(rls ?? "", rls ? `/* ${rls} */` : "");

    expect(
      validateTableEstablishedBeforeUse(mutated, "user_reminder_settings", ["user_id"]),
    ).toContain("MISSING_TABLE_BEFORE_USE:user_reminder_settings");
  });

  it("keeps scheduled-push cron portable and fail-closed during a fresh local replay", () => {
    expect(validateScheduledPushCronMigration(scheduledPushCronSql)).toEqual([]);
  });

  it("rejects in-memory cron migrations that install privileged extensions", () => {
    const mutated = `CREATE EXTENSION IF NOT EXISTS pg_cron;\n${scheduledPushCronMigration}`;
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "FORBIDDEN_PRIVILEGED_EXTENSION_INSTALL",
    );
  });

  it("rejects in-memory cron setup without operator and effective ACL guards", () => {
    const mutated = scheduledPushCronMigration.replace(
      /if\s+to_regclass\s*\(\s*'cron\.job'\s*\)[\s\S]*?end\s+if\s*;/i,
      "",
    );
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "MISSING_OPERATOR_CAPABILITY_GUARD",
    );

    const withoutRuntimeAcl = scheduledPushCronMigration.replace(
      /with\s+acl_guard\s+as\s*\([\s\S]*?\),\s*endpoint\s+as\s*\(/i,
      "WITH endpoint AS (",
    );
    expect(validateScheduledPushCronMigration(withoutRuntimeAcl)).toContain(
      "MISSING_RUNTIME_APP_ROLE_ACL_GUARD",
    );

    const invertedRuntimeAcl = scheduledPushCronMigration.replace(
      "WHERE NOT EXISTS (\n          SELECT 1",
      "WHERE EXISTS (\n          SELECT 1",
    );
    expect(validateScheduledPushCronMigration(invertedRuntimeAcl)).toContain(
      "MISSING_RUNTIME_APP_ROLE_ACL_GUARD",
    );

    const privilegeMutation = `${scheduledPushCronMigration}\nGRANT EXECUTE ON ALL ROUTINES IN SCHEMA net TO authenticated;\n`;
    expect(validateScheduledPushCronMigration(privilegeMutation)).toContain(
      "FORBIDDEN_EXTENSION_ACL_MUTATION",
    );

    const wrongAclDestination = scheduledPushCronMigration.replace(
      "INTO app_role_has_cron_or_net_access;",
      "INTO service_role_key_nonempty;",
    );
    expect(validateScheduledPushCronMigration(wrongAclDestination)).toContain(
      "MISSING_EFFECTIVE_APP_ROLE_ACL_GUARD",
    );

    const unconsumedRuntimeAcl = scheduledPushCronMigration.replace(
      "FROM acl_guard\n      CROSS JOIN endpoint",
      "FROM endpoint",
    );
    expect(validateScheduledPushCronMigration(unconsumedRuntimeAcl)).toContain(
      "UNCONSUMED_RUNTIME_APP_ROLE_ACL_GUARD",
    );
  });

  it("rejects a weakened capability guard or a direct migration-time HTTP call", () => {
    const conjunctiveCapability = scheduledPushCronMigration.replace(
      "OR to_regprocedure('cron.unschedule(bigint)') IS NULL",
      "AND to_regprocedure('cron.unschedule(bigint)') IS NULL",
    );
    expect(validateScheduledPushCronMigration(conjunctiveCapability)).toContain(
      "MISSING_OPERATOR_CAPABILITY_GUARD",
    );

    const capabilityBranch = /if\s+to_regclass\s*\(\s*'cron\.job'\s*\)[\s\S]*?end\s+if\s*;/i.exec(
      scheduledPushCronMigration,
    )?.[0];
    const inertOnlyCapability = capabilityBranch
      ? scheduledPushCronMigration
          .replace(capabilityBranch, "")
          .replace(
            /for\s+existing_job\s+in/i,
            `PERFORM $inert_capability$${capabilityBranch}$inert_capability$;\n\n  FOR existing_job IN`,
          )
      : scheduledPushCronMigration;
    expect(validateScheduledPushCronMigration(inertOnlyCapability)).toContain(
      "MISSING_OPERATOR_CAPABILITY_GUARD",
    );
    const quotedOnlyCapability = capabilityBranch
      ? scheduledPushCronMigration
          .replace(capabilityBranch, "")
          .replace(
            /for\s+existing_job\s+in/i,
            `PERFORM '${capabilityBranch.replaceAll("'", "''")}';\n\n  FOR existing_job IN`,
          )
      : scheduledPushCronMigration;
    expect(validateScheduledPushCronMigration(quotedOnlyCapability)).toContain(
      "MISSING_OPERATOR_CAPABILITY_GUARD",
    );

    const directHttp = scheduledPushCronMigration.replace(
      "  PERFORM cron.schedule(",
      "  PERFORM net.http_post(url := project_url_value || '/functions/v1/send-scheduled-push');\n\n  PERFORM cron.schedule(",
    );
    expect(validateScheduledPushCronMigration(directHttp)).toContain(
      "DIRECT_MIGRATION_HTTP_CALL",
    );

    const dynamicHttp = scheduledPushCronMigration.replace(
      "  PERFORM cron.schedule(",
      "  EXECUTE $cron_command$SELECT net.http_post(url := project_url_value)$cron_command$;\n\n  PERFORM cron.schedule(",
    );
    expect(validateScheduledPushCronMigration(dynamicHttp)).toContain(
      "FORBIDDEN_CRON_DYNAMIC_SQL",
    );

    for (const qualifiedCall of [
      'PERFORM "net"."http_post"(url := project_url_value);',
      "PERFORM net . http_post(url := project_url_value);",
    ]) {
      const mutated = scheduledPushCronMigration.replace(
        "  PERFORM cron.schedule(",
        `  ${qualifiedCall}\n\n  PERFORM cron.schedule(`,
      );
      expect(validateScheduledPushCronMigration(mutated)).toContain(
        "DIRECT_MIGRATION_HTTP_CALL",
      );
    }
  });

  it("rejects an in-memory cron migration with a hosted Supabase endpoint", () => {
    const hostedEndpoint = ["https://", "example", ".supabase.co", "/functions/v1/send-scheduled-push"].join("");
    const mutated = `${scheduledPushCronMigration}\nSELECT '${hostedEndpoint}';\n`;
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "HARDCODED_HOSTED_SUPABASE_ENDPOINT",
    );
  });

  it("rejects an in-memory cron migration that removes the Vault relation guard", () => {
    const mutated = scheduledPushCronMigration.replace(
      /if\s+to_regclass\s*\(\s*'vault\.decrypted_secrets'\s*\)[\s\S]*?end\s+if\s*;/i,
      "",
    );
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "MISSING_VAULT_RELATION_GUARD",
    );
  });

  it("rejects an in-memory cron migration with a broad job-name matcher", () => {
    const mutated = `${scheduledPushCronMigration}\nSELECT jobid FROM cron.job WHERE jobname LIKE '%push%';\n`;
    expect(validateScheduledPushCronMigration(mutated)).toContain("BROAD_CRON_JOB_MATCH");
  });

  it("rejects an in-memory cron migration that touches the legacy job before the capability guard", () => {
    const unscheduleBlock = /for\s+existing_job\s+in[\s\S]*?end\s+loop\s*;/i.exec(
      scheduledPushCronMigration,
    )?.[0];
    const moved = unscheduleBlock
      ? scheduledPushCronMigration
          .replace(unscheduleBlock, "")
          .replace(/begin/i, (begin) => `${begin}\n${unscheduleBlock}`)
      : scheduledPushCronMigration;
    expect(validateScheduledPushCronMigration(moved)).toContain(
      "CAPABILITY_GUARD_NOT_BEFORE_UNSCHEDULE",
    );
  });

  it("rejects an in-memory cron migration that changes the exact job identity", () => {
    const mutated = scheduledPushCronMigration.replace(
      "WHERE jobname = 'send-scheduled-push-v2'",
      "WHERE jobname = 'send-scheduled-push'",
    );
    expect(validateScheduledPushCronMigration(mutated)).toContain("MISSING_EXACT_JOB_MATCH");
  });

  it("rejects an in-memory cron command without runtime cardinality guards", () => {
    const cardinality = /\s+having\s+(?:pg_catalog\.)?count\s*\(\s*\*\s*\)\s*=\s*1/i;
    const withoutEndpoint = scheduledPushCronMigration.replace(cardinality, "");
    expect(validateScheduledPushCronMigration(withoutEndpoint)).toContain(
      "MISSING_RUNTIME_CARDINALITY_GUARD",
    );
    const firstCardinality = cardinality.exec(scheduledPushCronMigration);
    const withoutCredential = firstCardinality
      ? scheduledPushCronMigration.slice(0, firstCardinality.index + firstCardinality[0].length) +
        scheduledPushCronMigration
          .slice(firstCardinality.index + firstCardinality[0].length)
          .replace(cardinality, "")
      : scheduledPushCronMigration;
    expect(validateScheduledPushCronMigration(withoutCredential)).toContain(
      "MISSING_RUNTIME_CARDINALITY_GUARD",
    );
  });

  it("rejects runtime Vault values that are not normalized or consumed by the exact request", () => {
    const untrimmedCredential = scheduledPushCronMigration.replace(
      /pg_catalog\.min\s*\(\s*NULLIF\(pg_catalog\.btrim\(decrypted_secret\), ''\)\s*\) AS service_role_key/i,
      "pg_catalog.min(decrypted_secret) AS service_role_key",
    );
    expect(validateScheduledPushCronMigration(untrimmedCredential)).toContain(
      "MISSING_RUNTIME_CREDENTIAL_NORMALIZATION",
    );

    const untrimmedEndpoint = scheduledPushCronMigration.replace(
      /pg_catalog\.min\s*\(\s*NULLIF\(pg_catalog\.rtrim\(decrypted_secret, '\/'\), ''\)\s*\) AS project_url/i,
      "pg_catalog.min(decrypted_secret) AS project_url",
    );
    expect(validateScheduledPushCronMigration(untrimmedEndpoint)).toContain(
      "MISSING_RUNTIME_ENDPOINT_NORMALIZATION",
    );

    const missingAuthorization = scheduledPushCronMigration.replace(
      /headers\s*:=\s*pg_catalog\.jsonb_build_object\s*\([\s\S]*?\),\s*body\s*:=/i,
      "headers := '{}'::jsonb,\n        body :=",
    );
    expect(validateScheduledPushCronMigration(missingAuthorization)).toContain(
      "MISSING_RUNTIME_AUTHORIZATION_HEADER",
    );

    const wrongPath = scheduledPushCronMigration.replace(
      "'/functions/v1/send-scheduled-push'",
      "'/functions/v1/send-scheduled-push-shadow'",
    );
    expect(validateScheduledPushCronMigration(wrongPath)).toContain(
      "MISSING_EXACT_RUNTIME_ENDPOINT_PATH",
    );
  });

  it("rejects an in-memory cron command without runtime origin validation", () => {
    const mutated = scheduledPushCronMigration.replace(
      /\s+where\s+endpoint\.project_url\s*~\s*'\^https:\/\/[^']+'/i,
      "",
    );
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "MISSING_RUNTIME_ORIGIN_GUARD",
    );
    const broadened = scheduledPushCronMigration.replace(
      "WHERE endpoint.project_url ~ '^https://[a-z0-9-]+[.]supabase[.]co$'",
      "WHERE endpoint.project_url ~ '^https://'",
    );
    expect(validateScheduledPushCronMigration(broadened)).toContain(
      "MISSING_RUNTIME_ORIGIN_GUARD",
    );
  });

  it("rejects in-memory HTTP or Bearer literals", () => {
    const httpEndpoint = ["https://", "example.invalid"].join("");
    const bearerCredential = ["Be", "arer synthetic-credential-value"].join("");
    const mutated = `${scheduledPushCronMigration}\nSELECT '${httpEndpoint}', '${bearerCredential}';\n`;
    expect(validateScheduledPushCronMigration(mutated)).toEqual(
      expect.arrayContaining(["HARDCODED_HTTP_ENDPOINT", "HARDCODED_BEARER_CREDENTIAL"]),
    );
  });

  it("rejects an in-memory cron migration with a changed schedule identity", () => {
    const mutated = scheduledPushCronMigration.replace(
      "PERFORM cron.schedule(\n    'send-scheduled-push-v2'",
      "PERFORM cron.schedule(\n    'send-scheduled-push-shadow'",
    );
    expect(validateScheduledPushCronMigration(mutated)).toContain(
      "MISSING_EXACT_SCHEDULE_IDENTITY",
    );
  });

  it("rejects an in-memory cron migration with more than one schedule call", () => {
    const mutated = `${scheduledPushCronMigration}\nSELECT cron.schedule('shadow', '* * * * *', 'SELECT 1');\n`;
    expect(validateScheduledPushCronMigration(mutated)).toContain("NONEXACT_SCHEDULE_COUNT");
  });

  it("rejects each in-memory cron prerequisite branch without its RETURN", () => {
    const branches = [
      /if\s+to_regclass\s*\(\s*'vault\.decrypted_secrets'\s*\)\s+is\s+null\s+then[\s\S]*?end\s+if\s*;/i,
      /if\s+project_url_count\s*<>\s*1\s+or\s+project_url_value\s+is\s+null\s+then[\s\S]*?end\s+if\s*;/i,
      /if\s+project_url_value\s*!~[\s\S]*?then[\s\S]*?end\s+if\s*;/i,
      /if\s+service_role_key_count\s*<>\s*1\s+or\s+service_role_key_nonempty\s+is\s+not\s+true\s+then[\s\S]*?end\s+if\s*;/i,
    ];
    for (const branch of branches) {
      const mutated = scheduledPushCronMigration.replace(branch, (match) =>
        match.replace(/\breturn\s*;/i, ""),
      );
      expect(validateScheduledPushCronMigration(mutated)).toContain(
        "MISSING_FAIL_CLOSED_RETURN",
      );
    }
  });

  it("rejects an in-memory broad unschedule even when an inert exact marker remains", () => {
    const mutated = scheduledPushCronMigration
      .replace(
        "WHERE jobname = 'send-scheduled-push-v2'",
        "WHERE jobname ILIKE '%push%'",
      )
      .replace(
        "-- A fresh local database",
        "PERFORM 'where jobname = ''send-scheduled-push-v2''';\n\n  -- A fresh local database",
      );
    expect(validateScheduledPushCronMigration(mutated)).toContain("MISSING_EXACT_JOB_MATCH");
  });
});
