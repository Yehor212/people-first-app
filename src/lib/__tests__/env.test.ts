/**
 * Unit tests for centralized environment configuration
 */
import { describe, it, expect } from "vitest";
import {
  IS_DEV,
  MODE,
  BASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SENTRY_DSN,
  SPOTIFY_CLIENT_ID,
  ADMOB_REWARDED_ID_ANDROID,
  ADMOB_BANNER_ID_ANDROID,
  ADMOB_REWARDED_ID_IOS,
  ADMOB_BANNER_ID_IOS,
} from "../env";

describe("env", () => {
  it("IS_DEV is a boolean", () => {
    expect(typeof IS_DEV).toBe("boolean");
  });

  it("MODE is a string", () => {
    expect(typeof MODE).toBe("string");
  });

  it('BASE_URL is a non-empty string with fallback to "/"', () => {
    expect(typeof BASE_URL).toBe("string");
    expect(BASE_URL.length).toBeGreaterThan(0);
  });

  it("SUPABASE_URL is string or undefined (no other type)", () => {
    expect(SUPABASE_URL === undefined || typeof SUPABASE_URL === "string").toBe(true);
  });

  it("SUPABASE_ANON_KEY is string or undefined", () => {
    expect(SUPABASE_ANON_KEY === undefined || typeof SUPABASE_ANON_KEY === "string").toBe(true);
  });

  it("SENTRY_DSN is string or undefined", () => {
    expect(SENTRY_DSN === undefined || typeof SENTRY_DSN === "string").toBe(true);
  });

  it("SPOTIFY_CLIENT_ID is a string (empty fallback)", () => {
    expect(typeof SPOTIFY_CLIENT_ID).toBe("string");
  });

  it("ADMOB_REWARDED_ID_ANDROID is a string (env-only, no hardcoded fallback)", () => {
    expect(typeof ADMOB_REWARDED_ID_ANDROID).toBe("string");
  });

  it("ADMOB_BANNER_ID_ANDROID is a string (env-only, no hardcoded fallback)", () => {
    expect(typeof ADMOB_BANNER_ID_ANDROID).toBe("string");
  });

  it("ADMOB_REWARDED_ID_IOS is a string (env-only, no hardcoded fallback)", () => {
    expect(typeof ADMOB_REWARDED_ID_IOS).toBe("string");
  });

  it("ADMOB_BANNER_ID_IOS is a string (env-only, no hardcoded fallback)", () => {
    expect(typeof ADMOB_BANNER_ID_IOS).toBe("string");
  });

  it('AdMob IDs follow "ca-app-pub-" format when configured via env', () => {
    const ids = [
      ADMOB_REWARDED_ID_ANDROID,
      ADMOB_BANNER_ID_ANDROID,
      ADMOB_REWARDED_ID_IOS,
      ADMOB_BANNER_ID_IOS,
    ];
    for (const id of ids) {
      if (id.length > 0) {
        expect(id).toMatch(/^ca-app-pub-/);
      }
    }
  });
});
