import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildRealmBoundAndroidMessage,
  isAndroidPushTarget,
  isPushNotificationType,
} from "../_shared/pushRealmMessage.ts";

const readFunction = (relativeUrl: string) =>
  readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), "utf8");

const SEND_FUNCTIONS = [
  ["send-push-now", "./index.ts"],
  ["send-push-test", "../send-push-test/index.ts"],
  ["send-scheduled-push", "../send-scheduled-push/index.ts"],
] as const;

describe.each(SEND_FUNCTIONS)("%s installation-realm delivery", (_name, relativeUrl) => {
  it("uses only the shared Android data-message builder", () => {
    const source = readFunction(relativeUrl);

    expect(source).toContain(
      'from "../_shared/pushRealmMessage.ts"',
    );
    expect(source).not.toContain('from "npm:web-push@');
    expect(source).not.toContain(".sendNotification(");
    expect(source).not.toMatch(/\bnotification:\s*\{/);
    expect(source).not.toMatch(/\bwebpush:\s*\{/);
    expect(source).not.toMatch(/\bapns:\s*\{/);
  });

  it("loads the rotating row UUID with each Android token inside the delivery permit", () => {
    const source = readFunction(relativeUrl);
    const permitStart = source.indexOf("const delivery = await withPushDeliveryPermit(");
    const targetRead = source.indexOf('.select("id, token, platform")');
    const providerCall = source.indexOf("await sendFcmNotifications(");
    const permitEnd = source.indexOf('if (delivery.state === "blocked")');

    expect(permitStart).toBeGreaterThanOrEqual(0);
    expect(targetRead).toBeGreaterThan(permitStart);
    expect(providerCall).toBeGreaterThan(targetRead);
    expect(providerCall).toBeLessThan(permitEnd);
    expect(source).toContain('.eq("platform", "android")');
    expect(source).toContain(".filter(isAndroidPushTarget)");
  });
});

describe("shared realm-bound FCM payload", () => {
  it("binds only bounded routing metadata to the exact token-row UUID", () => {
    const helperPath = resolve(
      process.cwd(),
      "supabase/functions/_shared/pushRealmMessage.ts",
    );
    expect(existsSync(helperPath)).toBe(true);
    const source = readFileSync(helperPath, "utf8");

    expect(source).toContain('zenflow_delivery_version: "1"');
    expect(source).toContain("zenflow_install_id: target.id");
    expect(source).toContain('priority: "high"');
    expect(source).toContain('ttl: "0s"');
    expect(source).not.toMatch(/\bnotification:\s*\{/);
    expect(source).not.toMatch(/\bwebpush:\s*\{/);
    expect(source).not.toMatch(/\bapns:\s*\{/);

    const target = {
      id: "9d17e4c8-1fac-4b9f-a2d1-2df6d25e784a",
      token: "provider-token-value",
      platform: "android" as const,
    };

    expect(buildRealmBoundAndroidMessage(target, "habit")).toEqual({
      message: {
        token: target.token,
        data: {
          zenflow_delivery_version: "1",
          zenflow_install_id: target.id,
          zenflow_notification_type: "habit",
        },
        android: {
          priority: "high",
          ttl: "0s",
        },
      },
    });
  });

  it("rejects malformed destinations and unbounded notification kinds", () => {
    expect(
      isAndroidPushTarget({
        id: "9d17e4c8-1fac-4b9f-a2d1-2df6d25e784a",
        token: "provider-token-value",
        platform: "android",
      }),
    ).toBe(true);
    expect(
      isAndroidPushTarget({
        id: "not-a-row-uuid",
        token: "provider-token-value",
        platform: "android",
      }),
    ).toBe(false);
    expect(
      isAndroidPushTarget({
        id: "9d17e4c8-1fac-4b9f-a2d1-2df6d25e784a",
        token: "provider-token-value",
        platform: "ios",
      }),
    ).toBe(false);
    expect(isPushNotificationType("test")).toBe(true);
    expect(isPushNotificationType("caller-supplied-kind")).toBe(false);
  });
});

describe("request notification-kind boundaries", () => {
  it("keeps send-push-now's existing invalid-type fallback bounded to mood", () => {
    const source = readFunction("./index.ts");

    expect(source).toContain(
      'const type = isPushNotificationType(payload.type) ? payload.type : "mood";',
    );
  });

  it("keeps arbitrary send-push-test title and body out of provider payloads", () => {
    const source = readFunction("../send-push-test/index.ts");

    expect(source).toContain('await sendFcmNotifications(targets, "test")');
    expect(source).not.toContain("rawTitle");
    expect(source).not.toContain("rawBody");
    expect(source).not.toContain("zenflow_title");
    expect(source).not.toContain("zenflow_body");
  });
});

describe("Android delivery realm", () => {
  it("replaces automatic FCM display with the realm-validating service", () => {
    const manifest = readFileSync(
      resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );
    const servicePath = resolve(
      process.cwd(),
      "android/app/src/main/java/com/zenflow/app/ZenFlowMessagingService.java",
    );
    const pluginPath = resolve(
      process.cwd(),
      "android/app/src/main/java/com/zenflow/app/PushRealmPlugin.java",
    );

    expect(manifest).toContain(
      'android:name="com.capacitorjs.plugins.pushnotifications.MessagingService"',
    );
    expect(manifest).toContain('tools:node="remove"');
    expect(manifest).toContain('android:name=".ZenFlowMessagingService"');
    expect(existsSync(servicePath)).toBe(true);
    expect(existsSync(pluginPath)).toBe(true);

    const service = readFileSync(servicePath, "utf8");
    expect(service).toContain("PushDeliveryPermit.executeAuthorized(");
    expect(service).toContain("displayRealmBoundNotification");
    expect(service).toContain("PushNotificationsPlugin.sendRemoteMessage(remoteMessage)");
    expect(service).toContain("PushNotificationsPlugin.onNewToken(token)");
    expect(service).toContain("NotificationManager.IMPORTANCE_MIN");
    expect(service).toContain("channelNameResource(channelId)");
    expect(service).toContain("R.mipmap.ic_launcher_foreground");
    expect(service).toContain("NotificationCompat.VISIBILITY_SECRET");
    expect(service).toContain("Notification.VISIBILITY_SECRET");
    expect(service).not.toContain("NotificationCompat.VISIBILITY_PRIVATE");
    expect(service).not.toContain("Notification.VISIBILITY_PRIVATE");
    expect(service).not.toContain("R.mipmap.ic_launcher)");

    const plugin = readFileSync(pluginPath, "utf8");
    expect(plugin).toContain('@CapacitorPlugin(name = "PushRealm")');
    expect(plugin).toContain("PushDeliveryPermit.withRealmLock(");
    expect(plugin).toContain(".commit()");
    expect(plugin).toContain("manager.cancelAll()");

    const activity = readFileSync(
      resolve(
        process.cwd(),
        "android/app/src/main/java/com/zenflow/app/MainActivity.java",
      ),
      "utf8",
    );
    expect(activity).toContain("registerPlugin(PushRealmPlugin.class);");
    expect(manifest.match(/com\.google\.firebase\.MESSAGING_EVENT/g)).toHaveLength(1);

    for (const resourcePath of [
      "android/app/src/main/res/values/strings.xml",
      "android/app/src/main/res/values-uk/strings.xml",
      "android/app/src/main/res/values-es/strings.xml",
      "android/app/src/main/res/values-de/strings.xml",
      "android/app/src/main/res/values-fr/strings.xml",
      "android/app/src/main/res/values-ja/strings.xml",
      "android/app/src/main/res/values-ar/strings.xml",
      "android/app/src/main/res/values-iw/strings.xml",
    ]) {
      const resources = readFileSync(resolve(process.cwd(), resourcePath), "utf8");
      expect(resources).toContain('name="push_realm_channel_default"');
      expect(resources).toContain('name="push_realm_channel_default_description"');
      expect(resources).toContain('name="push_realm_channel_gentle"');
      expect(resources).toContain('name="push_realm_channel_gentle_description"');
      expect(resources).toContain('name="push_realm_channel_silent"');
      expect(resources).toContain('name="push_realm_channel_silent_description"');
    }
  });

  it("suspends native display before remote revocation and activates only the returned row UUID", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/pushNotifications.ts"),
      "utf8",
    );
    const suspend = source.indexOf("await suspendNativePushRealm()");
    const remoteRevocation = source.indexOf("await revokeOwnedPushInstall", suspend);
    const claim = source.indexOf("await claimOwnedPushInstall");
    const activate = source.indexOf("await activateNativePushRealm", claim);
    const persist = source.indexOf("storageSetRaw(SK.PUSH_TOKEN", claim);

    expect(suspend).toBeGreaterThanOrEqual(0);
    expect(remoteRevocation).toBeGreaterThan(suspend);
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(activate).toBeGreaterThan(claim);
    expect(activate).toBeGreaterThan(persist);
  });
});

describe("push token mutation authority", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260722150000_harden_push_delivery_realm.sql",
  );

  it("removes the legacy claim and preserves only the owner-bound authenticated RPC", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.claim_push_install\(text, text, text\)/i,
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_push_install\(\s*p_token text,\s*p_device_id text,\s*p_expected_owner_user_id uuid,\s*p_platform text DEFAULT 'android'\s*\)/i,
    );
    expect(sql).toMatch(/caller_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/caller_id <> p_expected_owner_user_id/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) FROM PUBLIC/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) FROM anon/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) TO authenticated/i,
    );
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });

  it("rejects cross-owner collisions after device-then-token locks and rotates the row UUID", () => {
    const migrationPath = resolve(
      process.cwd(),
      "supabase/migrations/20260722150000_harden_push_delivery_realm.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /DELETE FROM public\.push_device_tokens[\s\S]*WHERE user_id = caller_id[\s\S]*AND \(token = p_token OR device_id = p_device_id\)/i,
    );
    expect(sql).toMatch(
      /IF EXISTS \([\s\S]*user_id <> caller_id[\s\S]*AND \(token = p_token OR device_id = p_device_id\)[\s\S]*\) THEN[\s\S]*RAISE EXCEPTION 'Push installation belongs to another owner' USING ERRCODE = '42501'/i,
    );
    expect(sql).toMatch(
      /INSERT INTO public\.push_device_tokens \(user_id, token, platform, device_id, updated_at\)[\s\S]*RETURNING id INTO claimed_id/i,
    );
    expect(sql).not.toMatch(/ON CONFLICT/i);

    const deviceLock = sql.indexOf("hashtextextended(p_device_id, 0)");
    const tokenLock = sql.indexOf("hashtextextended(p_token, 1)");
    const ownerGuard = sql.indexOf("user_id <> caller_id");
    const ownerDelete = sql.indexOf("WHERE user_id = caller_id");
    const insert = sql.indexOf("INSERT INTO public.push_device_tokens");
    expect(deviceLock).toBeGreaterThan(-1);
    expect(tokenLock).toBeGreaterThan(deviceLock);
    expect(ownerGuard).toBeGreaterThan(tokenLock);
    expect(ownerDelete).toBeGreaterThan(ownerGuard);
    expect(insert).toBeGreaterThan(ownerDelete);
  });

  it("removes direct client mutations and leaves only authenticated own-row reads", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.push_device_tokens FROM authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.push_device_tokens FROM anon/i,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "push_device_tokens_all" ON public\.push_device_tokens/i,
    );
    expect(sql).toMatch(
      /CREATE POLICY "push_device_tokens_select_own" ON public\.push_device_tokens\s+FOR SELECT\s+TO authenticated\s+USING \(user_id = \(select auth\.uid\(\)\)\)/i,
    );
    expect(sql).not.toMatch(/FOR ALL[\s\S]*push_device_tokens/i);
    expect(sql).not.toMatch(/FOR (?:INSERT|UPDATE|DELETE)/i);
  });
});
