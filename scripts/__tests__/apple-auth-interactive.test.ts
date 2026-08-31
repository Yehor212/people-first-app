import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function redactionFixtureValue(...parts: string[]) {
  return parts.join("_");
}

const supabaseAccessTokenEnvKey = ["SUPABASE", "ACCESS", "TOKEN"].join("_");
const appleClientCredentialEnvKey = ["SUPABASE", "APPLE", "CLIENT", "SECRET"].join("_");

describe("activate-apple-auth-live", () => {
  it("never emits arbitrary downstream auth diagnostics", async () => {
    const { activateAppleAuthLiveInteractive } = require("../activate-apple-auth-live.cjs") as {
      activateAppleAuthLiveInteractive: (input: Record<string, unknown>) => Promise<{ message: string }>;
    };
    const canary = "ZF_T172_AUTH_APPLE_91bf4e";
    const output: string[] = [];

    const result = await activateAppleAuthLiveInteractive({
      env: {
        SUPABASE_ACCESS_TOKEN: "fixed-test-token",
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_APPLE_CLIENT_SECRET: "fixed-test-secret",
      },
      prompt: async () => "",
      applyAppleAuthLive: async () => ({ status: "UNVERIFIED", message: canary, exitCode: 2 }),
      write: (line: string) => output.push(line),
    });

    expect(output.join("\n")).not.toContain(canary);
    expect(result.message).not.toContain(canary);
  });

  it("collects missing secrets locally and does not print them", async () => {
    const { activateAppleAuthLiveInteractive } = require("../activate-apple-auth-live.cjs") as {
      activateAppleAuthLiveInteractive: (input: {
        env: NodeJS.ProcessEnv;
        rootDir?: string;
        prompt: (question: { name: string; secret?: boolean; defaultValue?: string }) => Promise<string>;
        applyAppleAuthLive: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthPublic?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthLive?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        write: (line: string) => void;
      }) => Promise<{ status: string; message: string; exitCode: number }>;
    };

    const sensitiveToken = redactionFixtureValue("sbp", "redaction", "token", "must", "not", "print");
    const sensitiveAppleValue = redactionFixtureValue("apple", "redaction", "jwt", "must", "not", "print");
    const prompts: Array<{ name: string; secret?: boolean; defaultValue?: string }> = [];
    const output: string[] = [];
    let appliedEnv: NodeJS.ProcessEnv | undefined;

    const result = await activateAppleAuthLiveInteractive({
      env: {
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
        SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS: "com.zenflow.app",
      },
      prompt: async (question) => {
        prompts.push(question);
        if (question.name === "SUPABASE_ACCESS_TOKEN") return sensitiveToken;
        if (question.name === "SUPABASE_APPLE_CLIENT_ID") return "com.zenflow.app.web";
        if (question.name === "SUPABASE_APPLE_SECRET_SOURCE") return "client-secret";
        if (question.name === "SUPABASE_APPLE_CLIENT_SECRET") return sensitiveAppleValue;
        throw new Error("Unexpected prompt " + question.name);
      },
      applyAppleAuthLive: async ({ env }) => {
        appliedEnv = env;
        return { status: "PASS", message: "Hosted Supabase Apple Auth applied.", exitCode: 0 };
      },
      checkAppleAuthPublic: async () => ({ status: "PASS", message: "Public Supabase Auth settings expose Apple provider.", exitCode: 0 }),
      checkAppleAuthLive: async () => ({ status: "PASS", message: "Hosted Supabase Apple Auth is enabled with required redirects.", exitCode: 0 }),
      write: (line) => output.push(line),
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(prompts.map((prompt) => prompt.name)).toEqual([
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_APPLE_CLIENT_ID",
      "SUPABASE_APPLE_SECRET_SOURCE",
      "SUPABASE_APPLE_CLIENT_SECRET",
    ]);
    expect(prompts.filter((prompt) => prompt.name !== "SUPABASE_APPLE_SECRET_SOURCE").every((prompt) => prompt.secret)).toBe(true);
    expect(prompts.find((prompt) => prompt.name === "SUPABASE_APPLE_SECRET_SOURCE")?.defaultValue).toBe("client-secret");
    expect(appliedEnv).toMatchObject({
      [supabaseAccessTokenEnvKey]: sensitiveToken,
      SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
      [appleClientCredentialEnvKey]: sensitiveAppleValue,
      SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
      SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS: "com.zenflow.app",
      ZENFLOW_APPLE_AUTH_APPLY_CONFIRM: "true",
    });

    const printed = output.join("\n");
    expect(printed).toContain("Using local-only prompts for missing hosted Apple Auth inputs");
    expect(printed).not.toContain(sensitiveToken);
    expect(printed).not.toContain(sensitiveAppleValue);
  });

  it("redacts existing env secrets from downstream messages", async () => {
    const { activateAppleAuthLiveInteractive } = require("../activate-apple-auth-live.cjs") as {
      activateAppleAuthLiveInteractive: (input: {
        env: NodeJS.ProcessEnv;
        prompt: (question: { name: string; secret?: boolean; defaultValue?: string }) => Promise<string>;
        applyAppleAuthLive: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthPublic?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthLive?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        write: (line: string) => void;
      }) => Promise<{ status: string; message: string; exitCode: number }>;
    };

    const existingToken = redactionFixtureValue("sbp", "existing", "redaction", "must", "not", "print");
    const existingAppleValue = redactionFixtureValue("existing", "apple", "redaction", "must", "not", "print");
    const output: string[] = [];

    await activateAppleAuthLiveInteractive({
      env: {
        [supabaseAccessTokenEnvKey]: existingToken,
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        [appleClientCredentialEnvKey]: existingAppleValue,
      },
      prompt: async (question) => {
        throw new Error("Unexpected prompt " + question.name);
      },
      applyAppleAuthLive: async () => ({
        status: "UNVERIFIED",
        message: "diagnostic " + existingToken + " " + existingAppleValue,
        exitCode: 2,
      }),
      write: (line) => output.push(line),
    });

    const printed = output.join("\n");
    expect(printed).not.toContain(existingToken);
    expect(printed).not.toContain(existingAppleValue);
    expect(printed).toContain("Hosted Supabase Apple Auth apply was not verified");
  });


  it("can collect Apple signing inputs instead of a pasted client secret", async () => {
    const { activateAppleAuthLiveInteractive } = require("../activate-apple-auth-live.cjs") as {
      activateAppleAuthLiveInteractive: (input: {
        env: NodeJS.ProcessEnv;
        rootDir?: string;
        prompt: (question: { name: string; secret?: boolean; defaultValue?: string }) => Promise<string>;
        applyAppleAuthLive: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthPublic?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthLive?: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        write: (line: string) => void;
      }) => Promise<{ status: string; message: string; exitCode: number }>;
    };

    const prompts: Array<{ name: string; secret?: boolean; defaultValue?: string }> = [];
    const output: string[] = [];
    let appliedEnv: NodeJS.ProcessEnv | undefined;

    const result = await activateAppleAuthLiveInteractive({
      env: {
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
      },
      prompt: async (question) => {
        prompts.push(question);
        if (question.name === "SUPABASE_ACCESS_TOKEN") return "sbp_local_management_token";
        if (question.name === "SUPABASE_APPLE_CLIENT_ID") return "com.zenflow.app.web";
        if (question.name === "SUPABASE_APPLE_SECRET_SOURCE") return "signing-key";
        if (question.name === "SUPABASE_APPLE_TEAM_ID") return "TEAMID1234";
        if (question.name === "SUPABASE_APPLE_KEY_ID") return "KEYID12345";
        if (question.name === "SUPABASE_APPLE_PRIVATE_KEY_PATH") return "/Users/example/secure/AuthKey_KEYID12345.p8";
        throw new Error("Unexpected prompt " + question.name);
      },
      applyAppleAuthLive: async ({ env }) => {
        appliedEnv = env;
        return { status: "PASS", message: "Hosted Supabase Apple Auth applied.", exitCode: 0 };
      },
      checkAppleAuthPublic: async () => ({ status: "PASS", message: "Public Supabase Auth settings expose Apple provider.", exitCode: 0 }),
      checkAppleAuthLive: async () => ({ status: "PASS", message: "Hosted Supabase Apple Auth is enabled with required redirects.", exitCode: 0 }),
      write: (line) => output.push(line),
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(prompts.map((prompt) => prompt.name)).toEqual([
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_APPLE_CLIENT_ID",
      "SUPABASE_APPLE_SECRET_SOURCE",
      "SUPABASE_APPLE_TEAM_ID",
      "SUPABASE_APPLE_KEY_ID",
      "SUPABASE_APPLE_PRIVATE_KEY_PATH",
    ]);
    expect(prompts.find((prompt) => prompt.name === "SUPABASE_APPLE_SECRET_SOURCE")?.defaultValue).toBe("client-secret");
    expect(appliedEnv).toMatchObject({
      SUPABASE_ACCESS_TOKEN: "sbp_local_management_token",
      SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
      SUPABASE_APPLE_TEAM_ID: "TEAMID1234",
      SUPABASE_APPLE_KEY_ID: "KEYID12345",
      SUPABASE_APPLE_PRIVATE_KEY_PATH: "/Users/example/secure/AuthKey_KEYID12345.p8",
      ZENFLOW_APPLE_AUTH_APPLY_CONFIRM: "true",
    });
    expect(appliedEnv?.SUPABASE_APPLE_CLIENT_SECRET).toBeUndefined();
    expect(output.join("\n")).toContain("Apple client secret will be generated locally from signing-key inputs");
  });


  it("verifies public and hosted Apple auth after a successful apply", async () => {
    const { activateAppleAuthLiveInteractive } = require("../activate-apple-auth-live.cjs") as {
      activateAppleAuthLiveInteractive: (input: {
        env: NodeJS.ProcessEnv;
        prompt: (question: { name: string; secret?: boolean; defaultValue?: string }) => Promise<string>;
        applyAppleAuthLive: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthPublic: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        checkAppleAuthLive: (input: { env: NodeJS.ProcessEnv; rootDir?: string }) => Promise<{ status: string; message: string; exitCode: number }>;
        write: (line: string) => void;
      }) => Promise<{ status: string; message: string; exitCode: number }>;
    };

    const sensitiveToken = redactionFixtureValue("sbp", "apply", "token", "must", "not", "print");
    const sensitiveAppleValue = redactionFixtureValue("apple", "apply", "credential", "must", "not", "print");
    const output: string[] = [];
    const calls: string[] = [];

    const result = await activateAppleAuthLiveInteractive({
      env: { SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf" },
      prompt: async (question) => {
        if (question.name === "SUPABASE_ACCESS_TOKEN") return sensitiveToken;
        if (question.name === "SUPABASE_APPLE_CLIENT_ID") return "com.zenflow.app.web";
        if (question.name === "SUPABASE_APPLE_SECRET_SOURCE") return "client-secret";
        if (question.name === "SUPABASE_APPLE_CLIENT_SECRET") return sensitiveAppleValue;
        throw new Error("Unexpected prompt " + question.name);
      },
      applyAppleAuthLive: async () => {
        calls.push("apply");
        return { status: "PASS", message: "Hosted Supabase Apple Auth applied.", exitCode: 0 };
      },
      checkAppleAuthPublic: async ({ env }) => {
        calls.push("public:" + env.SUPABASE_ACCESS_TOKEN);
        return { status: "PASS", message: "Public Supabase Auth settings expose Apple provider.", exitCode: 0 };
      },
      checkAppleAuthLive: async ({ env }) => {
        calls.push("live:" + env.SUPABASE_ACCESS_TOKEN);
        return { status: "PASS", message: "Hosted Supabase Apple Auth is enabled with required redirects.", exitCode: 0 };
      },
      write: (line) => output.push(line),
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(calls).toEqual(["apply", "public:" + sensitiveToken, "live:" + sensitiveToken]);
    const printed = output.join("\n");
    expect(printed).toContain("Verifying hosted Apple Auth after apply");
    expect(printed).toContain("Public Supabase Auth settings expose Apple provider");
    expect(printed).toContain("Hosted Supabase Apple Auth is enabled with required redirects");
    expect(printed).not.toContain(sensitiveToken);
    expect(printed).not.toContain(sensitiveAppleValue);
  });
});
