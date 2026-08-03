import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recoveryMocks = vi.hoisted(() => ({
  checkDatabaseHealth: vi.fn<() => Promise<boolean>>(),
  triggerDataRefresh: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      databaseRecoveryTitle: "Vos données enregistrées sont temporairement indisponibles",
      databaseRecoveryDesc:
        "ZenFlow n’a rien supprimé. Gardez l’application ouverte et réessayez.",
      databaseRecoveryRestore: "Réessayer",
      databaseRecoveryStartFresh: "Pas maintenant",
      databaseRecoveryChecking: "Vérification…",
    },
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));
vi.mock("@/storage/db", () => ({ checkDatabaseHealth: recoveryMocks.checkDatabaseHealth }));
vi.mock("@/hooks/useIndexedDB", () => ({ triggerDataRefresh: recoveryMocks.triggerDataRefresh }));
vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { DatabaseRecoveryDialog } from "@/components/DatabaseRecoveryDialog";

describe("DatabaseRecoveryDialog reflow and lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recoveryMocks.checkDatabaseHealth.mockResolvedValue(true);
    recoveryMocks.triggerDataRefresh.mockResolvedValue(undefined);
  });

  it("keeps long localized recovery actions stacked through the 640px transition", async () => {
    render(<DatabaseRecoveryDialog />);
    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:database-recovery-needed"));
    });

    const title = await screen.findByRole("heading", {
      name: "Vos données enregistrées sont temporairement indisponibles",
    });
    const restore = screen.getByRole("button", {
      name: "Réessayer",
    });
    const startFresh = screen.getByRole("button", { name: "Pas maintenant" });
    const footer = restore.parentElement;

    expect(title.parentElement).toHaveClass(
      "grid",
      "grid-cols-1",
      "min-[420px]:grid-cols-[auto_minmax(0,1fr)]",
    );
    expect(footer).toHaveClass("flex-col-reverse", "md:flex-row");
    expect(footer).not.toHaveClass("sm:flex-row");
    expect(restore).toHaveClass("w-full", "md:w-auto");
    expect(startFresh).toHaveClass("w-full", "md:w-auto");
  });

  it("does not dismiss while a health retry that cannot be cancelled is pending", async () => {
    let finishRetry!: (healthy: boolean) => void;
    recoveryMocks.checkDatabaseHealth.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { finishRetry = resolve; }),
    );
    render(<DatabaseRecoveryDialog />);
    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:database-recovery-needed"));
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Réessayer" }),
    );
    await waitFor(() => expect(recoveryMocks.checkDatabaseHealth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Vérification…" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    finishRetry(true);
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(recoveryMocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open when the database is still unavailable", async () => {
    recoveryMocks.checkDatabaseHealth.mockResolvedValueOnce(false);
    render(<DatabaseRecoveryDialog />);
    act(() => {
      window.dispatchEvent(new CustomEvent("zenflow:database-recovery-needed"));
    });

    fireEvent.click(await screen.findByRole("button", { name: "Réessayer" }));

    await waitFor(() => expect(recoveryMocks.checkDatabaseHealth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(recoveryMocks.triggerDataRefresh).not.toHaveBeenCalled();
  });
});
