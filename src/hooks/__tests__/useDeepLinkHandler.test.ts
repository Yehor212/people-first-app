/**
 * useDeepLinkHandler Hook Tests
 * Tests deep link processing for auth and challenge URLs
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appUrlOpenListeners,
  appStateChangeListeners,
  authStateListeners,
  mockAddListener,
  mockGetLaunchUrl,
  mockGetSession,
  mockOnAuthStateChange,
  mockHandleAuthCallback,
  mockCloseOAuthBrowser,
  mockIsFeatureVisible,
  mockIsNative,
  mockLocalOwner,
  mockClaimStatus,
} = vi.hoisted(() => {
  const appUrlOpenListeners: Array<(event: { url?: string }) => void> = [];
  const appStateChangeListeners: Array<(event: { isActive: boolean }) => void> = [];
  const authStateListeners: Array<(event: string, session: unknown) => void> = [];
  const mockAddListener = vi.fn(
    async (eventName: string, callback: (event: { url?: string; isActive?: boolean }) => void) => {
      if (eventName === "appUrlOpen") {
        appUrlOpenListeners.push(callback);
      } else if (eventName === "appStateChange") {
        appStateChangeListeners.push(callback);
      }
      return { remove: vi.fn() };
    }
  );
  const mockLocalOwner: { value: string | null } = { value: "telegram-user-1" };
  const mockClaimStatus: {
    value: "none" | "pending" | "invalid" | "unavailable";
  } = { value: "none" };

  return {
    appUrlOpenListeners,
    appStateChangeListeners,
    authStateListeners,
    mockAddListener,
    mockGetLaunchUrl: vi.fn(async (): Promise<{ url: string } | null> => null),
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      authStateListeners.push(callback);
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    }),
    mockHandleAuthCallback: vi.fn(async () => undefined),
    mockCloseOAuthBrowser: vi.fn(async () => undefined),
    mockIsFeatureVisible: vi.fn<(feature: string) => boolean>(() => true),
    mockIsNative: { value: true },
    mockLocalOwner,
    mockClaimStatus,
  };
});

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mockIsNative.value;
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mockAddListener,
    getLaunchUrl: mockGetLaunchUrl,
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    getFeatureAvailability: (feature: string) => {
      const visible = mockIsFeatureVisible(feature);
      return {
        manifestVersion: 1,
        key: feature,
        visible,
        state: visible ? "available" : "temporarily-unavailable",
        reason: visible ? "available" : "disabled-by-user",
        source: "user-setting",
        disclosure: visible ? "silent" : "user-safe-reason",
      };
    },
  }),
}));

vi.mock("@/lib/authRedirect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authRedirect")>("@/lib/authRedirect");
  return {
    ...actual,
    handleAuthCallback: mockHandleAuthCallback,
    notifyAuthComplete: vi.fn(),
    setPendingAuthUrl: vi.fn(),
  };
});

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  closeOAuthBrowser: mockCloseOAuthBrowser,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: vi.fn(async () => mockLocalOwner.value),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>()),
  readPendingLocalBackupAccountClaim: vi.fn(() => ({ status: mockClaimStatus.value })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  getAuthDedupeKey,
  parseChallengeInviteUrl,
  useDeepLinkHandler,
} from "@/hooks/useDeepLinkHandler";
import {
  encodeInviteData,
  generateShareLink,
  type Challenge,
  type ChallengeInvite,
} from "@/lib/friendChallenge";
import { consumeStagedJournalMagicLinkConfirmation } from "@/lib/journalMagicLinkConfirmation";
import { useAppStore, useUIStore, useUserDataStore } from "@/stores";

const CHALLENGE_FIXTURE: Challenge = {
  id: "challenge-deep-link-test",
  code: "ZEN-TEST24",
  habitName: "Evening walk",
  habitIcon: "🚶",
  duration: 21,
  startDate: "2026-07-28",
  endDate: "2026-08-18",
  creatorName: "Test Friend",
  myProgress: 0,
  isCreator: true,
  status: "active",
};

const EXPECTED_CHALLENGE_INVITE: ChallengeInvite = {
  code: CHALLENGE_FIXTURE.code,
};

function createTrustedWebChallengeUrl(): string {
  const url = new URL("https://yehor212.github.io/people-first-app/");
  url.hash = new URLSearchParams({ challenge: encodeInviteData(CHALLENGE_FIXTURE) }).toString();
  return url.toString();
}

function createSession(displayName = "Telegram Friend") {
  return {
    user: {
      id: "telegram-user-1",
      user_metadata: {
        full_name: displayName,
        name: displayName,
      },
      app_metadata: {
        provider: "custom:telegram",
      },
    },
  };
}

function resetStores() {
  useAppStore.setState({
    authBypassFlag: false,
    hasValidSession: false,
    webOAuthError: null,
  });
  useUserDataStore.setState({
    authGateChecked: false,
    googleAuthChecked: false,
    userName: "Friend",
    userNameCustom: false,
  });
  useUIStore.setState({
    challengeInvite: undefined,
    showChallengeModal: false,
  });
}

async function flushDeepLinkWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useDeepLinkHandler", () => {
  it("fingerprints every retained auth callback field without retaining private material", () => {
    const code = "ZF_T172_AUTH_CODE_6d17c4a9";
    const state = "ZF_T172_AUTH_STATE_2c71b9e4";
    const error = "ZF_T172_AUTH_ERROR_9a48d2f1";
    const token = "ZF_T172_AUTH_TOKEN_4f28e6b3";
    const key = getAuthDedupeKey(
      `com.zenflow.app://login-callback?code=${code}&state=${state}&error=${error}#access_token=${token}`
    );

    expect(key).toMatch(/^com\.zenflow\.app:\/\/login-callback\|auth=\d+:[a-f0-9]+$/);
    for (const canary of [code, state, error, token]) expect(key).not.toContain(canary);
    expect(getAuthDedupeKey("not a URL")).toBe("invalid-auth-url");
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    appUrlOpenListeners.length = 0;
    appStateChangeListeners.length = 0;
    authStateListeners.length = 0;
    mockGetLaunchUrl.mockResolvedValue(null);
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockHandleAuthCallback.mockResolvedValue(undefined);
    mockIsFeatureVisible.mockReturnValue(true);
    mockIsNative.value = true;
    mockLocalOwner.value = "telegram-user-1";
    mockClaimStatus.value = "none";
    consumeStagedJournalMagicLinkConfirmation();
    resetStores();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
  });

  describe("auth deep links", () => {
    it.each(["pending", "invalid", "unavailable"] as const)(
      "keeps native OAuth gated and profile untouched when backup claim is %s",
      async (status) => {
        mockClaimStatus.value = status;
        mockGetSession.mockResolvedValue({
          data: { session: createSession("Unowned Metadata") },
          error: null,
        });

        renderHook(() => useDeepLinkHandler());
        await act(async () => {
          await flushDeepLinkWork();
        });

        act(() => {
          appUrlOpenListeners[0]({
            url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
          });
        });
        await act(async () => {
          await flushDeepLinkWork();
        });

        expect(useAppStore.getState().hasValidSession).toBe(false);
        expect(useAppStore.getState().authBypassFlag).toBe(false);
        expect(useUserDataStore.getState().userName).toBe("Friend");
        expect(useUserDataStore.getState().authGateChecked).toBe(false);
      }
    );

    it.each([null, "other-user"])(
      "keeps native OAuth gated when local owner is %s",
      async (owner) => {
        mockLocalOwner.value = owner;
        mockGetSession.mockResolvedValue({ data: { session: createSession() }, error: null });

        renderHook(() => useDeepLinkHandler());
        await act(async () => {
          await flushDeepLinkWork();
        });
        act(() => {
          appUrlOpenListeners[0]({
            url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
          });
        });
        await act(async () => {
          await flushDeepLinkWork();
        });

        expect(useAppStore.getState().hasValidSession).toBe(false);
        expect(useAppStore.getState().authBypassFlag).toBe(false);
        expect(useUserDataStore.getState().userName).toBe("Friend");
        expect(useUserDataStore.getState().authGateChecked).toBe(false);
      }
    );

    it("uses provider-neutral copy when an OAuth callback returns without a session", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
        await Promise.resolve();
      });

      expect(useAppStore.getState().webOAuthError).toBe(
        "Sign-in did not complete. Please try again."
      );
      expect(useAppStore.getState().webOAuthError).not.toContain("Google");
      expect(mockCloseOAuthBrowser).toHaveBeenCalled();
    });

    it("ignores untrusted HTTPS OAuth callback URLs", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      await act(async () => {
        appUrlOpenListeners[0]({
          url: "https://evil.example/login-callback?code=stolen-code&state=bad-state",
        });
        await Promise.resolve();
      });

      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).not.toHaveBeenCalled();
      expect(useAppStore.getState().webOAuthError).toBeNull();
    });

    it("ignores malformed appUrlOpen URLs without throwing", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      expect(() => {
        appUrlOpenListeners[0]({ url: "not a valid callback url" });
      }).not.toThrow();

      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).not.toHaveBeenCalled();
      expect(useAppStore.getState().webOAuthError).toBeNull();
    });

    it("does not overwrite a custom user name when auth callback session arrives", async () => {
      useUserDataStore.setState({
        userName: "My Native Name",
        userNameCustom: true,
      });
      mockGetSession.mockResolvedValue({
        data: { session: createSession() },
        error: null,
      });

      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("My Native Name");
      expect(useUserDataStore.getState().userNameCustom).toBe(true);
    });

    it("deduplicates identical auth URLs", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: createSession() },
        error: null,
      });

      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      const url = "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state";
      act(() => {
        appUrlOpenListeners[0]({ url });
        appUrlOpenListeners[0]({ url });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockHandleAuthCallback).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(true);
    });

    it("stages each distinct scanner-safe diary link without exchanging it in the background", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await flushDeepLinkWork();
      });

      const firstTokenHash = "a".repeat(64);
      const freshTokenHash = "b".repeat(64);
      const buildLink = (tokenHash: string) =>
        `com.zenflow.app://login-callback?journalReset=nonce-1#zenflowConfirm=1&token_hash=${tokenHash}&type=email`;

      await act(async () => {
        appUrlOpenListeners[0]({ url: buildLink(firstTokenHash) });
        await flushDeepLinkWork();
      });
      expect(consumeStagedJournalMagicLinkConfirmation()?.tokenHash).toBe(firstTokenHash);

      await act(async () => {
        appUrlOpenListeners[0]({ url: buildLink(freshTokenHash) });
        await flushDeepLinkWork();
      });

      expect(consumeStagedJournalMagicLinkConfirmation()?.tokenHash).toBe(freshTokenHash);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).toHaveBeenCalledTimes(2);
    });

    it("waits for session after auth callback", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(authStateListeners).toHaveLength(1);

      mockGetSession.mockResolvedValue({ data: { session: createSession() }, error: null });
      act(() => {
        authStateListeners[0]("SIGNED_IN", createSession());
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useAppStore.getState().webOAuthError).toBeNull();
      expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
      expect(mockCloseOAuthBrowser).toHaveBeenCalled();
    });

    it("accepts INITIAL_SESSION after native OAuth callback", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(authStateListeners).toHaveLength(1);

      mockGetSession.mockResolvedValue({ data: { session: createSession() }, error: null });
      act(() => {
        authStateListeners[0]("INITIAL_SESSION", createSession());
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useAppStore.getState().webOAuthError).toBeNull();
      expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
      expect(mockCloseOAuthBrowser).toHaveBeenCalled();
    });

    it("sets user name from session metadata on success", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: createSession("Facebook Friend") },
        error: null,
      });

      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=facebook-code&state=facebook-state",
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Facebook Friend");
      expect(useUserDataStore.getState().userNameCustom).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(true);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
    });

    it.todo("clears dedupe cache after 50 entries");
    it.todo("stores pending URL when supabase is not ready");
  });

  describe("challenge deep links", () => {
    it("uses the canonical fragment-only web fallback and rejects lookalike origins", () => {
      const generated = generateShareLink(CHALLENGE_FIXTURE);
      expect(generated).toMatch(/^https:\/\/yehor212\.github\.io\/people-first-app\/#challenge=/);
      expect(parseChallengeInviteUrl(generated)).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(
        parseChallengeInviteUrl(
          generated.replace("https://yehor212.github.io", "https://evil.example")
        )
      ).toBeNull();
      expect(generated).not.toContain("?");
    });

    it("consumes the canonical challenge fragment on web and removes it from history", async () => {
      mockIsNative.value = false;
      const encoded = encodeInviteData(CHALLENGE_FIXTURE);
      window.history.replaceState({}, "", `/people-first-app/#challenge=${encoded}`);

      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(window.location.hash).toBe("");
      expect(appUrlOpenListeners).toHaveLength(0);
    });

    it("handles the generated HTTPS challenge capability", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      await act(async () => {
        appUrlOpenListeners[0]({ url: generateShareLink(CHALLENGE_FIXTURE) });
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
    });

    it("keeps legacy custom-scheme challenge links inbound-only", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });
      const generated = generateShareLink(CHALLENGE_FIXTURE);
      const legacy = generated.replace(
        "https://yehor212.github.io/people-first-app/#challenge=",
        "zenflow://challenge?data="
      );

      await act(async () => {
        appUrlOpenListeners[0]({ url: legacy });
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(generateShareLink(CHALLENGE_FIXTURE)).not.toMatch(/^zenflow:/);
    });

    it("handles the canonical public web fallback URL", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      await act(async () => {
        appUrlOpenListeners[0]({ url: createTrustedWebChallengeUrl() });
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
    });

    it("rejects lookalike HTTPS paths, insecure schemes, ports, and userinfo", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });
      const payload = encodeInviteData(CHALLENGE_FIXTURE);
      const untrusted = [
        `http://zenflow.app/challenge#data=${payload}`,
        `ftp://zenflow.app/challenge#data=${payload}`,
        `https://zenflow.app:444/challenge#data=${payload}`,
        `https://user@zenflow.app/challenge#data=${payload}`,
        `https://zenflow.app/challenge-evil#data=${payload}`,
        `https://zenflow.app/challenge/private#data=${payload}`,
        `https://zenflow.app/challenge?data=${payload}`,
        `https://evil.example/people-first-app/#challenge=${payload}`,
        `https://yehor212.github.io/people-first-app/private#challenge=${payload}`,
      ];

      for (const url of untrusted) {
        await act(async () => {
          appUrlOpenListeners[0]({ url });
          await flushDeepLinkWork();
        });
      }

      expect(useUIStore.getState().challengeInvite).toBeUndefined();
      expect(useUIStore.getState().showChallengeModal).toBe(false);
    });

    it("decodes only the opaque lookup code into the UI store", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      await act(async () => {
        appUrlOpenListeners[0]({ url: generateShareLink(CHALLENGE_FIXTURE) });
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual({ code: "ZEN-TEST24" });
      expect(JSON.stringify(useUIStore.getState().challengeInvite)).not.toContain("Evening walk");
      expect(JSON.stringify(useUIStore.getState().challengeInvite)).not.toContain("Test Friend");
    });

    it("opens the challenge modal when the challenges feature is enabled", async () => {
      mockIsFeatureVisible.mockReturnValue(true);
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      await act(async () => {
        appUrlOpenListeners[0]({ url: generateShareLink(CHALLENGE_FIXTURE) });
        await flushDeepLinkWork();
      });

      expect(mockIsFeatureVisible).toHaveBeenCalledWith("challenges");
      expect(useUIStore.getState().showChallengeModal).toBe(true);
    });

    it("keeps a valid invite and opens the truthful unavailable state when challenges are disabled", async () => {
      mockIsFeatureVisible.mockReturnValue(false);
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      await act(async () => {
        appUrlOpenListeners[0]({ url: generateShareLink(CHALLENGE_FIXTURE) });
        await flushDeepLinkWork();
      });

      expect(mockIsFeatureVisible).toHaveBeenCalledWith("challenges");
      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(useUIStore.getState().showChallengeModal).toBe(true);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
    });

    it("ignores malformed challenge data without throwing or mutating UI state", async () => {
      renderHook(() => useDeepLinkHandler());
      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(() => {
        appUrlOpenListeners[0]({
          url: "zenflow://challenge?data=not-valid-base64-or-json",
        });
      }).not.toThrow();
      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toBeUndefined();
      expect(useUIStore.getState().showChallengeModal).toBe(false);
    });
  });

  describe("launch URL (cold start)", () => {
    it("processes launch auth URL on mount", async () => {
      const launchUrl = "com.zenflow.app://login-callback?code=launch-code&state=launch-state";
      mockGetLaunchUrl.mockResolvedValue({ url: launchUrl });
      mockGetSession.mockResolvedValue({
        data: { session: createSession("Launch Friend") },
        error: null,
      });

      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(mockHandleAuthCallback).toHaveBeenCalledWith(expect.anything(), launchUrl);
      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Launch Friend");
      expect(appUrlOpenListeners).toHaveLength(1);
    });

    it("processes a challenge launch URL before the auth fallback", async () => {
      const launchUrl = generateShareLink(CHALLENGE_FIXTURE);
      mockGetLaunchUrl.mockResolvedValue({ url: launchUrl });

      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(useUIStore.getState().challengeInvite).toEqual(EXPECTED_CHALLENGE_INVITE);
      expect(useUIStore.getState().showChallengeModal).toBe(true);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(appUrlOpenListeners).toHaveLength(1);
    });
  });

  describe("appUrlOpen listener", () => {
    it.todo("registers listener on mount");
    it.todo("processes challenge URLs from listener");
    it.todo("processes auth URLs from listener");
    it.todo("removes listener on unmount");
  });

  describe("appStateChange", () => {
    it("checks launch auth URL when app becomes active", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await flushDeepLinkWork();
      });
      expect(appStateChangeListeners).toHaveLength(1);

      const resumeUrl = "com.zenflow.app://login-callback?code=resume-code&state=resume-state";
      mockGetLaunchUrl.mockClear();
      mockGetLaunchUrl.mockResolvedValueOnce({ url: resumeUrl });
      mockGetSession.mockResolvedValue({
        data: { session: createSession("Resume Friend") },
        error: null,
      });

      act(() => {
        appStateChangeListeners[0]({ isActive: true });
      });

      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(mockGetLaunchUrl).toHaveBeenCalledTimes(1);
      expect(mockHandleAuthCallback).toHaveBeenCalledWith(expect.anything(), resumeUrl);
      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Resume Friend");
    });

    it("only processes login-callback URLs on resume", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await flushDeepLinkWork();
      });
      expect(appStateChangeListeners).toHaveLength(1);

      mockGetLaunchUrl.mockClear();
      mockGetLaunchUrl.mockResolvedValueOnce({ url: "https://zenflow.app/challenge?data=invite" });

      act(() => {
        appStateChangeListeners[0]({ isActive: true });
      });

      await act(async () => {
        await flushDeepLinkWork();
      });

      expect(mockGetLaunchUrl).toHaveBeenCalledTimes(1);
      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });
  });

  describe("native-only guard", () => {
    it.todo("does nothing on non-native platform");
  });
});
