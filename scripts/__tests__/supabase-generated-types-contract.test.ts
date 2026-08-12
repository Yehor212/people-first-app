import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type PropertyShape = Record<string, string>;

type TableShape = {
  Row: PropertyShape;
  Insert: PropertyShape;
  Update: PropertyShape;
  Relationships: PropertyShape[];
};

type RpcShape = {
  Args: "never" | PropertyShape;
  Returns: string;
};

const generatedTypesPath = resolve(
  process.cwd(),
  process.env.ZENFLOW_T169_GENERATED_TYPES_PATH ?? "src/types/supabase.ts",
);
const generatedTypesSource = readFileSync(generatedTypesPath, "utf8");
const catalogOraclePath = process.env.ZENFLOW_T169_CATALOG_ORACLE_PATH;

type CatalogColumn = {
  table: string;
  column: string;
  ordinal: number;
  udt: string;
  nullable: boolean;
  has_default: boolean;
};

type CatalogRelationship = {
  table: string;
  name: string;
  columns: string[];
  referenced_table: string;
  referenced_columns: string[];
};

type CatalogRpc = {
  name: string;
  argument_names: string[];
  argument_types: string[];
  default_argument_count: number;
  result: string;
};

type CatalogOracle = {
  columns: CatalogColumn[];
  relationships: CatalogRelationship[];
  rpcs: CatalogRpc[];
};

const catalogOracle: CatalogOracle | undefined = catalogOraclePath
  ? JSON.parse(readFileSync(resolve(process.cwd(), catalogOraclePath), "utf8"))
  : undefined;

const expectedTables: Record<string, TableShape> = {
  automation_history_state: {
    Row: {
      all_history_purged_at: "number|null",
      history_generation: "number",
      last_sequence: "number",
      record_revision_version: "number",
      updated_at: "number",
      user_id: "string",
    },
    Insert: {
      all_history_purged_at: "?number|null",
      history_generation: "?number",
      last_sequence: "?number",
      record_revision_version: "?number",
      updated_at: "number",
      user_id: "string",
    },
    Update: {
      all_history_purged_at: "?number|null",
      history_generation: "?number",
      last_sequence: "?number",
      record_revision_version: "?number",
      updated_at: "?number",
      user_id: "?string",
    },
    Relationships: [],
  },
  automation_history_tombstones: {
    Row: {
      history_generation: "number",
      purged_at: "number",
      purged_transaction_id: "string",
      server_sequence: "number",
      user_id: "string",
    },
    Insert: {
      history_generation: "number",
      purged_at: "number",
      purged_transaction_id: "string",
      server_sequence: "number",
      user_id: "string",
    },
    Update: {
      history_generation: "?number",
      purged_at: "?number",
      purged_transaction_id: "?string",
      server_sequence: "?number",
      user_id: "?string",
    },
    Relationships: [],
  },
  automation_mutations: {
    Row: {
      after_hash: "string",
      after_revision_token: "string|null",
      before_hash: "string",
      before_revision_token: "string|null",
      entity_id: "string",
      entity_type: "string",
      mutation_ordinal: "number",
      operation: "string",
      transaction_id: "string",
      user_id: "string",
    },
    Insert: {
      after_hash: "string",
      after_revision_token: "?string|null",
      before_hash: "string",
      before_revision_token: "?string|null",
      entity_id: "string",
      entity_type: "string",
      mutation_ordinal: "number",
      operation: "string",
      transaction_id: "string",
      user_id: "string",
    },
    Update: {
      after_hash: "?string",
      after_revision_token: "?string|null",
      before_hash: "?string",
      before_revision_token: "?string|null",
      entity_id: "?string",
      entity_type: "?string",
      mutation_ordinal: "?number",
      operation: "?string",
      transaction_id: "?string",
      user_id: "?string",
    },
    Relationships: [
      {
        columns: '["user_id","transaction_id"]',
        foreignKeyName: '"automation_mutations_user_id_transaction_id_fkey"',
        isOneToOne: "false",
        referencedColumns: '["user_id","id"]',
        referencedRelation: '"automation_transactions"',
      },
    ],
  },
  automation_preferences: {
    Row: {
      consent_epoch: "string|null",
      consented_at: "number|null",
      enabled: "boolean",
      enabled_rule_ids: "string[]",
      focus_habit_id: "string|null",
      focus_minimum_minutes: "number",
      planning_habit_mappings: "Json",
      revoked_at: "number|null",
      server_revision: "number",
      updated_at: "number",
      user_id: "string",
    },
    Insert: {
      consent_epoch: "?string|null",
      consented_at: "?number|null",
      enabled: "?boolean",
      enabled_rule_ids: "?string[]",
      focus_habit_id: "?string|null",
      focus_minimum_minutes: "?number",
      planning_habit_mappings: "?Json",
      revoked_at: "?number|null",
      server_revision: "?number",
      updated_at: "number",
      user_id: "string",
    },
    Update: {
      consent_epoch: "?string|null",
      consented_at: "?number|null",
      enabled: "?boolean",
      enabled_rule_ids: "?string[]",
      focus_habit_id: "?string|null",
      focus_minimum_minutes: "?number",
      planning_habit_mappings: "?Json",
      revoked_at: "?number|null",
      server_revision: "?number",
      updated_at: "?number",
      user_id: "?string",
    },
    Relationships: [],
  },
  automation_record_revisions: {
    Row: {
      entity_id: "string",
      entity_type: "string",
      mutation_generation: "number",
      record_exists: "boolean",
      revision_token: "string|null",
      state_hash: "string",
      transaction_id: "string|null",
      updated_at: "number",
      user_id: "string",
    },
    Insert: {
      entity_id: "string",
      entity_type: "string",
      mutation_generation: "number",
      record_exists: "boolean",
      revision_token: "?string|null",
      state_hash: "string",
      transaction_id: "?string|null",
      updated_at: "number",
      user_id: "string",
    },
    Update: {
      entity_id: "?string",
      entity_type: "?string",
      mutation_generation: "?number",
      record_exists: "?boolean",
      revision_token: "?string|null",
      state_hash: "?string",
      transaction_id: "?string|null",
      updated_at: "?number",
      user_id: "?string",
    },
    Relationships: [],
  },
  automation_transactions: {
    Row: {
      consent_epoch: "string",
      created_at: "number",
      device_id: "string",
      history_generation: "number",
      id: "string",
      revision_ciphertext: "string",
      rule_id: "string",
      rule_version: "number",
      server_sequence: "number",
      source_id: "string",
      source_key: "string",
      source_revision: "string",
      source_type: "string",
      status: "string",
      undo_transaction_id: "string|null",
      undone_at: "number|null",
      updated_at: "number",
      user_id: "string",
    },
    Insert: {
      consent_epoch: "string",
      created_at: "number",
      device_id: "string",
      history_generation: "number",
      id: "string",
      revision_ciphertext: "string",
      rule_id: "string",
      rule_version: "number",
      server_sequence: "number",
      source_id: "string",
      source_key: "string",
      source_revision: "string",
      source_type: "string",
      status: "string",
      undo_transaction_id: "?string|null",
      undone_at: "?number|null",
      updated_at: "number",
      user_id: "string",
    },
    Update: {
      consent_epoch: "?string",
      created_at: "?number",
      device_id: "?string",
      history_generation: "?number",
      id: "?string",
      revision_ciphertext: "?string",
      rule_id: "?string",
      rule_version: "?number",
      server_sequence: "?number",
      source_id: "?string",
      source_key: "?string",
      source_revision: "?string",
      source_type: "?string",
      status: "?string",
      undo_transaction_id: "?string|null",
      undone_at: "?number|null",
      updated_at: "?number",
      user_id: "?string",
    },
    Relationships: [],
  },
};

const expectedRpcs: Record<string, RpcShape> = {
  commit_automation_transaction: {
    Args: { p_request: "Json" },
    Returns: "Json",
  },
  get_automation_history_snapshot: {
    Args: { p_cursor: "?Json", p_snapshot_token: "?Json" },
    Returns: "Json",
  },
  get_automation_preference: { Args: "never", Returns: "Json" },
  purge_automation_history: {
    Args: {
      p_all: "boolean",
      p_device_id: "string",
      p_operation_id: "string",
      p_transaction_ids: "string[]",
    },
    Returns: "Json",
  },
  revoke_automation_preference: { Args: "never", Returns: "Json" },
  set_automation_preference: {
    Args: {
      p_enabled_rule_ids: "string[]",
      p_expected_server_revision: "number",
      p_focus_habit_id: "string",
      p_focus_minimum_minutes: "number",
      p_planning_habit_mappings: "Json",
    },
    Returns: "Json",
  },
  set_automation_preference_with_planning: {
    Args: {
      p_device_id: "string",
      p_enabled_rule_ids: "string[]",
      p_expected_server_revision: "number",
      p_focus_habit_id: "string",
      p_focus_minimum_minutes: "number",
      p_planning_blocks: "Json",
      p_planning_habit_mappings: "Json",
    },
    Returns: "Json",
  },
  undo_automation_transaction: {
    Args: { p_request: "Json" },
    Returns: "Json",
  },
};

const catalogTypeToGeneratedType: Record<string, string> = {
  _text: "string[]",
  bool: "boolean",
  int4: "number",
  int8: "number",
  jsonb: "Json",
  text: "string",
  uuid: "string",
};

const catalogArgumentToGeneratedType: Record<string, string> = {
  bigint: "number",
  boolean: "boolean",
  integer: "number",
  jsonb: "Json",
  text: "string",
  "text[]": "string[]",
  uuid: "string",
  "uuid[]": "string[]",
};

function sortedShape(shape: PropertyShape): PropertyShape {
  return Object.fromEntries(
    Object.entries(shape).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function tableShapesFromCatalog(oracle: CatalogOracle): Record<string, TableShape> {
  const admittedTables = new Set(Object.keys(expectedTables));
  return Object.fromEntries(
    [...admittedTables].sort().map((table) => {
      const columns = oracle.columns
        .filter((column) => column.table === table)
        .sort((left, right) => left.ordinal - right.ordinal);
      const row: PropertyShape = {};
      const insert: PropertyShape = {};
      const update: PropertyShape = {};
      for (const column of columns) {
        const baseType = catalogTypeToGeneratedType[column.udt];
        if (!baseType) throw new Error(`Unsupported catalog UDT: ${column.udt}`);
        const nullableType = `${baseType}${column.nullable ? "|null" : ""}`;
        row[column.column] = nullableType;
        insert[column.column] = `${column.nullable || column.has_default ? "?" : ""}${nullableType}`;
        update[column.column] = `?${nullableType}`;
      }
      const relationships = oracle.relationships
        .filter(
          (relationship) =>
            relationship.table === table &&
            admittedTables.has(relationship.referenced_table),
        )
        .map((relationship) => ({
          columns: JSON.stringify(relationship.columns),
          foreignKeyName: JSON.stringify(relationship.name),
          isOneToOne: "false",
          referencedColumns: JSON.stringify(relationship.referenced_columns),
          referencedRelation: JSON.stringify(relationship.referenced_table),
        }));
      return [
        table,
        {
          Row: sortedShape(row),
          Insert: sortedShape(insert),
          Update: sortedShape(update),
          Relationships: relationships,
        },
      ];
    }),
  );
}

function rpcShapesFromCatalog(oracle: CatalogOracle): Record<string, RpcShape> {
  const admittedRpcs = new Set(Object.keys(expectedRpcs));
  return Object.fromEntries(
    oracle.rpcs
      .filter((rpc) => admittedRpcs.has(rpc.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((rpc) => {
        if (rpc.argument_names.length !== rpc.argument_types.length) {
          throw new Error(`Catalog argument shape mismatch: ${rpc.name}`);
        }
        const firstDefault = rpc.argument_names.length - rpc.default_argument_count;
        const args = rpc.argument_names.length === 0
          ? "never"
          : sortedShape(
              Object.fromEntries(
                rpc.argument_names.map((name, index) => {
                  const type = catalogArgumentToGeneratedType[rpc.argument_types[index]];
                  if (!type) {
                    throw new Error(
                      `Unsupported catalog RPC type: ${rpc.argument_types[index]}`,
                    );
                  }
                  return [name, `${index >= firstDefault ? "?" : ""}${type}`];
                }),
              ),
            );
        const returns = catalogArgumentToGeneratedType[rpc.result];
        if (!returns) throw new Error(`Unsupported catalog result: ${rpc.result}`);
        return [rpc.name, { Args: args, Returns: returns }];
      }),
  );
}

function validateCatalogOracle(oracle: CatalogOracle): string[] {
  const findings: string[] = [];
  if (JSON.stringify(tableShapesFromCatalog(oracle)) !== JSON.stringify(expectedTables)) {
    findings.push("CATALOG_TABLE_ORACLE_MISMATCH");
  }
  if (JSON.stringify(rpcShapesFromCatalog(oracle)) !== JSON.stringify(expectedRpcs)) {
    findings.push("CATALOG_RPC_ORACLE_MISMATCH");
  }
  return findings;
}

function memberName(member: ts.TypeElement): string | undefined {
  if (!ts.isPropertySignature(member) || !member.name) return undefined;
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
    return member.name.text;
  }
  return undefined;
}

function property(
  literal: ts.TypeLiteralNode,
  name: string,
): ts.PropertySignature | undefined {
  return literal.members.find(
    (member): member is ts.PropertySignature =>
      ts.isPropertySignature(member) && memberName(member) === name,
  );
}

function typeLiteral(node: ts.TypeNode | undefined): ts.TypeLiteralNode | undefined {
  return node && ts.isTypeLiteralNode(node) ? node : undefined;
}

function normalizedType(node: ts.TypeNode, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile).replace(/\s+/g, "");
}

function properties(
  literal: ts.TypeLiteralNode,
  sourceFile: ts.SourceFile,
): PropertyShape {
  return Object.fromEntries(
    literal.members
      .filter(ts.isPropertySignature)
      .map((member) => {
        const name = memberName(member);
        if (!name || !member.type) return undefined;
        return [
          name,
          `${member.questionToken ? "?" : ""}${normalizedType(member.type, sourceFile)}`,
        ] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function relationshipShapes(
  node: ts.TypeNode | undefined,
  sourceFile: ts.SourceFile,
): PropertyShape[] | undefined {
  if (!node || !ts.isTupleTypeNode(node)) return undefined;
  const relationships: PropertyShape[] = [];
  for (const element of node.elements) {
    if (!ts.isTypeLiteralNode(element)) return undefined;
    relationships.push(properties(element, sourceFile));
  }
  return relationships;
}

function databaseContainers(source: string): {
  sourceFile: ts.SourceFile;
  tables?: ts.TypeLiteralNode;
  functions?: ts.TypeLiteralNode;
} {
  const sourceFile = ts.createSourceFile(
    "supabase.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const database = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database",
  );
  const databaseType = database && typeLiteral(database.type);
  const publicType = databaseType && typeLiteral(property(databaseType, "public")?.type);
  return {
    sourceFile,
    tables: publicType && typeLiteral(property(publicType, "Tables")?.type),
    functions: publicType && typeLiteral(property(publicType, "Functions")?.type),
  };
}

function validateGeneratedAutomationTypes(source: string): string[] {
  const findings: string[] = [];
  const { sourceFile, tables, functions } = databaseContainers(source);
  if (!tables) findings.push("MISSING_PUBLIC_TABLES_CONTAINER");
  if (!functions) findings.push("MISSING_PUBLIC_FUNCTIONS_CONTAINER");
  if (!tables || !functions) return findings;

  for (const [tableName, expected] of Object.entries(expectedTables)) {
    const table = typeLiteral(property(tables, tableName)?.type);
    if (!table) {
      findings.push(`MISSING_AUTOMATION_TABLE:${tableName}`);
      continue;
    }
    const actual: Partial<TableShape> = {};
    for (const variant of ["Row", "Insert", "Update"] as const) {
      const variantType = typeLiteral(property(table, variant)?.type);
      if (variantType) actual[variant] = properties(variantType, sourceFile);
    }
    actual.Relationships = relationshipShapes(
      property(table, "Relationships")?.type,
      sourceFile,
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      findings.push(`NONEXACT_AUTOMATION_TABLE_SHAPE:${tableName}`);
    }
  }

  for (const [rpcName, expected] of Object.entries(expectedRpcs)) {
    const rpc = typeLiteral(property(functions, rpcName)?.type);
    if (!rpc) {
      findings.push(`MISSING_AUTOMATION_RPC:${rpcName}`);
      continue;
    }
    const argsNode = property(rpc, "Args")?.type;
    const returnsNode = property(rpc, "Returns")?.type;
    const args = argsNode && argsNode.kind === ts.SyntaxKind.NeverKeyword
      ? "never"
      : properties(
          typeLiteral(argsNode) ?? ts.factory.createTypeLiteralNode([]),
          sourceFile,
        );
    const actual: RpcShape | undefined = returnsNode
      ? { Args: args, Returns: normalizedType(returnsNode, sourceFile) }
      : undefined;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      findings.push(`NONEXACT_AUTOMATION_RPC_SHAPE:${rpcName}`);
    }
  }

  return findings;
}

function removeOrRenameMember(
  source: string,
  containerName: "Tables" | "Functions",
  memberNameToChange: string,
  replacement?: string,
): string {
  const { sourceFile, tables, functions } = databaseContainers(source);
  const container = containerName === "Tables" ? tables : functions;
  const member = container && property(container, memberNameToChange);
  if (!member) return source;
  if (replacement) {
    const start = member.name.getStart(sourceFile);
    return `${source.slice(0, start)}${replacement}${source.slice(member.name.end)}`;
  }
  return `${source.slice(0, member.getFullStart())}${source.slice(member.end)}`;
}

describe("generated Supabase automation type contract", () => {
  it("matches the generator-derived shapes for six automation tables and eight RPCs", () => {
    expect(validateGeneratedAutomationTypes(generatedTypesSource)).toEqual([]);
  });

  it("rejects an in-memory generated declaration with an expected table removed", () => {
    const mutated = removeOrRenameMember(
      generatedTypesSource,
      "Tables",
      "automation_preferences",
    );
    expect(validateGeneratedAutomationTypes(mutated)).toContain(
      "MISSING_AUTOMATION_TABLE:automation_preferences",
    );
  });

  it("rejects an in-memory generated declaration with an expected RPC renamed", () => {
    const mutated = removeOrRenameMember(
      generatedTypesSource,
      "Functions",
      "commit_automation_transaction",
      "commit_automation_transaction_shadow",
    );
    expect(validateGeneratedAutomationTypes(mutated)).toContain(
      "MISSING_AUTOMATION_RPC:commit_automation_transaction",
    );
  });

  if (catalogOracle) {
    it("matches an independently captured replay catalog oracle", () => {
      expect(validateCatalogOracle(catalogOracle)).toEqual([]);
    });

    it("rejects an in-memory catalog oracle with drifted nullability and RPC type", () => {
      const mutated = structuredClone(catalogOracle);
      const preferenceUserId = mutated.columns.find(
        (column) =>
          column.table === "automation_preferences" && column.column === "user_id",
      );
      const commitRpc = mutated.rpcs.find(
        (rpc) => rpc.name === "commit_automation_transaction",
      );
      if (preferenceUserId) preferenceUserId.nullable = true;
      if (commitRpc) commitRpc.argument_types[0] = "text";
      expect(validateCatalogOracle(mutated)).toEqual(
        expect.arrayContaining([
          "CATALOG_TABLE_ORACLE_MISMATCH",
          "CATALOG_RPC_ORACLE_MISMATCH",
        ]),
      );
    });
  }
});
