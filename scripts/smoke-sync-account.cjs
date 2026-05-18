#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");

const required = process.env.ZENFLOW_SYNC_ACCOUNT_REQUIRED === "true";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.ZENFLOW_SYNC_TEST_EMAIL;
const password = process.env.ZENFLOW_SYNC_TEST_PASSWORD;

function stopUnverified(reason) {
  console.log(`[sync-account] UNVERIFIED - ${reason}`);
  console.log(
    "[sync-account] Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ZENFLOW_SYNC_TEST_EMAIL, and ZENFLOW_SYNC_TEST_PASSWORD for same-account Supabase proof."
  );
  process.exit(required ? 2 : 0);
}

function fail(message, error) {
  console.error(`[sync-account] FAIL - ${message}`);
  if (error) {
    console.error(error.message || String(error));
  }
  process.exit(1);
}

async function insertEvent(client, row) {
  const { data, error } = await client
    .from("sync_events")
    .insert(row)
    .select("id, seq, entity_type, entity_id, op, payload, device_id, created_at")
    .single();

  if (error) throw error;
  if (!data || typeof data.seq !== "number") {
    throw new Error("sync_events insert returned no seq");
  }
  return data;
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    stopUnverified("Supabase public config is missing");
  }
  if (!email || !password) {
    stopUnverified("test account credentials are missing");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) fail("test account sign-in failed", signInError);
  const userId = signInData.user?.id;
  if (!userId) fail("test account sign-in returned no user");

  const stamp = Date.now();
  const entityId = `sync-smoke-${stamp}`;
  const deviceA = `sync-smoke-a-${stamp}`;
  const deviceB = `sync-smoke-b-${stamp}`;
  const upsertIdempotencyKey = crypto.randomUUID();
  const deleteIdempotencyKey = crypto.randomUUID();

  const upsert = await insertEvent(client, {
    user_id: userId,
    entity_type: "journal",
    entity_id: entityId,
    op: "upsert",
    payload: {
      id: entityId,
      title: "Sync smoke",
      content: "temporary account-level sync smoke",
      date: new Date(stamp).toISOString().slice(0, 10),
      createdAt: stamp,
      updatedAt: stamp,
    },
    device_id: deviceA,
    idempotency_key: upsertIdempotencyKey,
  });

  const deletion = await insertEvent(client, {
    user_id: userId,
    entity_type: "journal",
    entity_id: entityId,
    op: "delete",
    payload: null,
    device_id: deviceB,
    idempotency_key: deleteIdempotencyKey,
  });

  if (deletion.seq <= upsert.seq) {
    fail(`delete seq ${deletion.seq} did not advance after upsert seq ${upsert.seq}`);
  }

  const { data: deltas, error: deltaError } = await client
    .from("sync_events")
    .select("seq, entity_type, entity_id, op, device_id")
    .gt("seq", upsert.seq - 1)
    .eq("entity_id", entityId)
    .order("seq", { ascending: true });
  if (deltaError) fail("delta read failed", deltaError);

  const ops = (deltas || []).map((event) => event.op).join(",");
  if (ops !== "upsert,delete") {
    fail(`expected upsert,delete event order; got ${ops || "empty"}`);
  }

  const { data: tombstone, error: tombstoneError } = await client
    .from("sync_tombstones")
    .select("entity_type, entity_id, deleted_seq")
    .eq("entity_type", "journal")
    .eq("entity_id", entityId)
    .single();
  if (tombstoneError) fail("tombstone read failed", tombstoneError);
  if (!tombstone || tombstone.deleted_seq !== deletion.seq) {
    fail("delete tombstone does not match latest delete seq");
  }

  const { error: duplicateError } = await client.from("sync_events").insert({
    user_id: userId,
    entity_type: "journal",
    entity_id: entityId,
    op: "delete",
    payload: null,
    device_id: deviceB,
    idempotency_key: deleteIdempotencyKey,
  });
  if (!duplicateError) {
    fail("duplicate idempotency key was accepted");
  }

  console.log(
    `[sync-account] PASS - account=${userId.slice(0, 8)}..., upsertSeq=${upsert.seq}, deleteSeq=${deletion.seq}, tombstoneSeq=${tombstone.deleted_seq}`
  );
}

main().catch((error) => fail("unexpected smoke error", error));
