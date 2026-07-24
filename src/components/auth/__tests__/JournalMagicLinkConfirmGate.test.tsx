import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearReset: vi.fn(),
  cancelPkceAttemptFromUrl: vi.fn(),
  notifyAuthComplete: vi.fn(),
  persistProof: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      cancel: "Cancel",
      journalMagicConfirmAction: "Confirm in ZenFlow",
      journalMagicConfirmDescription:
        "Continue only if you requested this email for your diary.",
      journalMagicConfirmError:
        "This email link could not be confirmed. Request a new link from your diary.",
      journalMagicConfirmPending: "Confirming...",
      journalMagicConfirmTitle: "Confirm email link",
    },
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      verifyOtp: authMocks.verifyOtp,
    },
  },
}));

vi.mock("@/lib/authRedirect", () => ({
  notifyAuthComplete: authMocks.notifyAuthComplete,
}));

vi.mock("@/lib/authTransitionCoordinator", () => ({
  cancelPkceAttemptFromUrl: authMocks.cancelPkceAttemptFromUrl,
}));

vi.mock("@/lib/journalPasswordResetHandoff", () => ({
  clearJournalPasswordResetParamFromCurrentUrl: authMocks.clearReset,
  persistJournalPasswordResetProofFromUrl: authMocks.persistProof,
}));

import { JournalMagicLinkConfirmGate } from "@/components/auth/JournalMagicLinkConfirmGate";

const TOKEN_HASH = "a".repeat(64);
const USER_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("JournalMagicLinkConfirmGate", () => {
  beforeEach(() => {
    authMocks.notifyAuthComplete.mockReset();
    authMocks.clearReset.mockReset();
    authMocks.cancelPkceAttemptFromUrl.mockReset();
    authMocks.cancelPkceAttemptFromUrl.mockResolvedValue(true);
    authMocks.persistProof.mockReset();
    authMocks.verifyOtp.mockReset();
    authMocks.verifyOtp.mockResolvedValue({
      data: {
        session: {
          user: {
            id: USER_ID,
            email: "owner@example.invalid",
          },
        },
      },
      error: null,
    });
    window.history.replaceState(
      {},
      "",
      `/diary?nav=v2&journalReset=nonce-1&zenflowAuthAttempt=123e4567-e89b-42d3-a456-426614174001#zenflowConfirm=1&token_hash=${TOKEN_HASH}&type=email`,
    );
  });

  it("waits for explicit confirmation, removes the token from the URL, then owner-binds proof", async () => {
    render(
      <JournalMagicLinkConfirmGate>
        <div>Diary shell</div>
      </JournalMagicLinkConfirmGate>,
    );

    expect(await screen.findByRole("dialog", { name: "Confirm email link" })).toBeInTheDocument();
    expect(screen.queryByText("Diary shell")).not.toBeInTheDocument();
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    await waitFor(() => expect(window.location.href).not.toContain("token_hash"));
    expect(window.location.search).toContain("journalReset=nonce-1");

    fireEvent.click(screen.getByRole("button", { name: "Confirm in ZenFlow" }));

    await waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: TOKEN_HASH,
        type: "email",
      });
    });
    expect(authMocks.persistProof).toHaveBeenCalledWith(
      expect.stringContaining("journalReset=nonce-1"),
      USER_ID,
    );
    expect(authMocks.notifyAuthComplete).toHaveBeenCalledTimes(1);
    expect(authMocks.cancelPkceAttemptFromUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("zenflowAuthAttempt="),
    );
    expect(await screen.findByText("Diary shell")).toBeInTheDocument();
  });

  it("keeps the confirmation gate open when verification fails", async () => {
    authMocks.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Token expired" },
    });

    render(
      <JournalMagicLinkConfirmGate>
        <div>Diary shell</div>
      </JournalMagicLinkConfirmGate>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Confirm in ZenFlow" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This email link could not be confirmed",
    );
    expect(authMocks.persistProof).not.toHaveBeenCalled();
    expect(authMocks.notifyAuthComplete).not.toHaveBeenCalled();
    expect(screen.queryByText("Diary shell")).not.toBeInTheDocument();
  });

  it("does not create reset proof when verification returns no authenticated owner", async () => {
    authMocks.verifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    render(
      <JournalMagicLinkConfirmGate>
        <div>Diary shell</div>
      </JournalMagicLinkConfirmGate>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Confirm in ZenFlow" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(authMocks.persistProof).not.toHaveBeenCalled();
    expect(authMocks.notifyAuthComplete).not.toHaveBeenCalled();
  });

  it("returns to the app without exchanging the token when the user cancels", async () => {
    render(
      <JournalMagicLinkConfirmGate>
        <div>Diary shell</div>
      </JournalMagicLinkConfirmGate>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(authMocks.clearReset).toHaveBeenCalledTimes(1);
    expect(authMocks.cancelPkceAttemptFromUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("zenflowAuthAttempt="),
    );
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(await screen.findByText("Diary shell")).toBeInTheDocument();
  });
});
