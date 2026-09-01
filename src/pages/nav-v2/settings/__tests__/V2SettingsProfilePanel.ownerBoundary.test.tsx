import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultReminderSettings } from "@/lib/reminders";
import type { V2SettingsControls } from "../types";

const mocks = vi.hoisted(() => {
  class BoundaryError extends Error {
    constructor(operation = "Profile name save", cause?: unknown) {
      super(`${operation} stopped at an account boundary`);
      this.name = "SettingsOwnerBoundaryError";
      if (cause !== undefined) {
        (this as Error & { cause?: unknown }).cause = cause;
      }
    }
  }

  return {
    BoundaryError,
    assertSettingsOwnerCurrent: vi.fn(),
    getCurrentSessionUserId: vi.fn(async () => null),
    loggerError: vi.fn(),
    readVerifiedSettingsOwnerRealm: vi.fn(),
    subscribeOwnerGeneration: vi.fn(),
    updateProfileName: vi.fn(),
  };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      nameSaved: "Saved",
      nameSavedLocally: "Saved on this device",
      settingsPreferenceSaveError:
        "Couldn’t save this change. Your previous setting is still active.",
      profile: "Profile",
      saveName: "Save name",
      saving: "Saving...",
      yourName: "Your name",
    },
  }),
}));

vi.mock("@/lib/accountService", () => ({
  updateProfileName: mocks.updateProfileName,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/settingsOwnerBoundary", () => ({
  SettingsOwnerBoundaryError: mocks.BoundaryError,
  assertSettingsOwnerCurrent: mocks.assertSettingsOwnerCurrent,
  readVerifiedSettingsOwnerRealm: mocks.readVerifiedSettingsOwnerRealm,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  captureOriginAccountBoundaryGeneration: () => "settings-generation-a",
  subscribeOriginAccountBoundaryObservation: mocks.subscribeOwnerGeneration,
}));

import { ProfilePanel } from "../V2SettingsProfilePanel";

function createControls(): V2SettingsControls {
  return {
    userName: "Avery",
    userNameCustom: true,
    onNameChange: vi.fn(),
    onResetData: vi.fn(),
    reminders: defaultReminderSettings,
    onRemindersChange: vi.fn(),
    habits: [],
    moods: [],
    focusSessions: [],
    gratitudeEntries: [],
    privacy: {
      noTracking: false,
      analytics: false,
      consentShown: true,
      adConsent: false,
      pushNotifications: false,
    },
    onPrivacyChange: vi.fn(),
  };
}

describe("V2 Settings profile owner boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.readVerifiedSettingsOwnerRealm.mockResolvedValue({
      kind: "local",
      ownerUserId: null,
      generation: "settings-generation-a",
    });
    mocks.assertSettingsOwnerCurrent.mockResolvedValue(undefined);
    mocks.subscribeOwnerGeneration.mockReturnValue(() => undefined);
    mocks.updateProfileName.mockResolvedValue(true);
  });

  it("keeps the name field usable beside its content-width action on wide layouts", () => {
    render(<ProfilePanel controls={createControls()} />);

    const input = screen.getByLabelText("Your name");
    const save = screen.getByTestId("settings-v2-profile-save");

    expect(input.parentElement).toHaveClass("min-[520px]:flex-row");
    expect(input).toHaveClass("min-w-0", "flex-1");
    expect(save).toHaveClass("w-auto");
    expect(save).not.toHaveClass("w-full");
  });

  it.each(["session verification fails", "the confirmed session and durable owner do not match"])(
    "does not mutate the profile when %s",
    async () => {
      mocks.readVerifiedSettingsOwnerRealm.mockRejectedValueOnce(new mocks.BoundaryError());
      const controls = createControls();
      render(<ProfilePanel controls={controls} />);

      fireEvent.change(screen.getByLabelText("Your name"), {
        target: { value: "Avery Updated" },
      });
      fireEvent.click(screen.getByTestId("settings-v2-profile-save"));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mocks.readVerifiedSettingsOwnerRealm).toHaveBeenCalledTimes(1);
      expect(controls.onNameChange).not.toHaveBeenCalled();
      expect(mocks.updateProfileName).not.toHaveBeenCalled();
      expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
    }
  );

  it("does not claim the profile was saved when local persistence fails", async () => {
    const controls = createControls();
    controls.onNameChange = vi.fn(() => {
      throw new Error("IndexedDB unavailable");
    });
    render(<ProfilePanel controls={controls} />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Avery Updated" },
    });
    fireEvent.click(screen.getByTestId("settings-v2-profile-save"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t save this change. Your previous setting is still active."
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });

  it("binds a delayed local save to the captured owner generation and suppresses stale success", async () => {
    let resolveLocalSave!: () => void;
    const controls = createControls();
    controls.onNameChange = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLocalSave = resolve;
        })
    );
    mocks.assertSettingsOwnerCurrent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new mocks.BoundaryError());
    render(<ProfilePanel controls={controls} />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Avery Updated" },
    });
    fireEvent.click(screen.getByTestId("settings-v2-profile-save"));

    await act(async () => {
      await Promise.resolve();
    });
    expect(controls.onNameChange).toHaveBeenCalledWith(
      "Avery Updated",
      true,
      "settings-generation-a"
    );

    await act(async () => {
      resolveLocalSave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.assertSettingsOwnerCurrent).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });

  it("prevents a newer draft from being entered while the previous name save is pending", async () => {
    let resolveLocalSave!: () => void;
    const controls = createControls();
    controls.onNameChange = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLocalSave = resolve;
        })
    );
    render(<ProfilePanel controls={controls} />);

    const input = screen.getByLabelText("Your name");
    fireEvent.change(input, { target: { value: "Avery Updated" } });
    fireEvent.click(screen.getByTestId("settings-v2-profile-save"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(controls.onNameChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("Avery Updated");
    expect(input).toBeDisabled();

    await act(async () => {
      resolveLocalSave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(input).toBeEnabled();
    expect(input).toHaveValue("Avery Updated");
    expect(controls.onNameChange).toHaveBeenCalledTimes(1);
  });

  it("drops an unsaved draft when the owner generation changes even if the visible name is equal", () => {
    let notifyOwnerChange!: (generation: string) => void;
    mocks.subscribeOwnerGeneration.mockImplementation((listener) => {
      notifyOwnerChange = listener;
      return () => undefined;
    });
    const controls = createControls();
    render(<ProfilePanel controls={controls} />);

    const input = screen.getByLabelText("Your name");
    fireEvent.change(input, { target: { value: "Draft from owner A" } });
    expect(input).toHaveValue("Draft from owner A");

    act(() => notifyOwnerChange("settings-generation-b"));

    expect(input).toHaveValue("Avery");
    expect(screen.getByTestId("settings-v2-profile-save")).toBeDisabled();
  });
});
