import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettingsHandlers } from "@/hooks/useSettingsHandlers";
import { defaultReminderSettings } from "@/lib/reminders";
import { db } from "@/storage/db";
import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import { commitProfileNameUpdate } from "@/storage/settingsPreferencePersistence";
import { useHydrateUserData } from "@/stores/useHydrateUserData";
import {
  defaultPrivacySettings,
  useUserDataStore,
} from "@/stores/userDataStore";
import type { V2SettingsControls } from "../types";

const USER_NAME_KEY = "zenflow-username";
const USER_NAME_CUSTOM_KEY = "zenflow-username-custom";
const PROFILE_RECOVERY_KEY = "zenflow-profile-recovery";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      invalidNameCharacters: "Use ordinary text for your name.",
      invalidNameFormat: "Enter a name between 1 and 100 characters.",
      nameSaved: "Saved",
      nameSavedLocally: "Saved on this device",
      profile: "Profile",
      profileNamePlaceholder: "Enter your name",
      saveName: "Save name",
      saving: "Saving...",
      settingsPreferenceSaveError:
        "Couldn’t save this change. Your previous setting is still active.",
      yourName: "Your name",
    },
  }),
}));

vi.mock("@/lib/settingsOwnerBoundary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/settingsOwnerBoundary")>()),
  assertSettingsOwnerCurrent: vi.fn(() => Promise.resolve()),
  readVerifiedSettingsOwnerRealm: vi.fn(() =>
    Promise.resolve({
      kind: "local" as const,
      ownerUserId: null,
      generation: "settings-persistence-test",
    }),
  ),
}));

import { ProfilePanel } from "../V2SettingsProfilePanel";

function resetUserDataStore() {
  useUserDataStore.setState({
    userName: "Friend",
    userNameCustom: false,
    reminders: { ...defaultReminderSettings },
    privacy: { ...defaultPrivacySettings },
    isLoading: true,
    _setters: null,
  });
}

function PersistenceHarness() {
  useHydrateUserData();
  const userName = useUserDataStore((state) => state.userName);
  const userNameCustom = useUserDataStore((state) => state.userNameCustom);
  const reminders = useUserDataStore((state) => state.reminders);
  const privacy = useUserDataStore((state) => state.privacy);
  const { handleNameChange, handlePrivacyChange, handleRemindersChange, handleResetData } =
    useSettingsHandlers([]);

  const controls: V2SettingsControls = {
    userName,
    userNameCustom,
    onNameChange: handleNameChange,
    onResetData: handleResetData,
    reminders,
    onRemindersChange: handleRemindersChange,
    habits: [],
    moods: [],
    focusSessions: [],
    gratitudeEntries: [],
    privacy,
    onPrivacyChange: handlePrivacyChange,
  };

  return (
    <>
      <output data-testid="hydrated-profile-state">
        {userName}:{String(userNameCustom)}
      </output>
      <ProfilePanel controls={controls} />
    </>
  );
}

describe("Settings persist-first runtime wiring", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
    localStorage.clear();
    resetUserDataStore();
    await db.settings.bulkPut([
      { key: USER_NAME_KEY, value: "Avery" },
      { key: USER_NAME_CUSTOM_KEY, value: true },
    ]);
    localStorage.setItem(USER_NAME_KEY, JSON.stringify("Avery"));
    localStorage.setItem(USER_NAME_CUSTOM_KEY, JSON.stringify(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetUserDataStore();
  });

  it("keeps UI, Zustand, IndexedDB, and cold hydration on the previous profile when the commit rejects", async () => {
    const firstMount = render(<PersistenceHarness />);
    const nameInput = await screen.findByLabelText("Your name");
    await waitFor(() => expect(nameInput).toHaveValue("Avery"));
    await waitFor(() => expect(useUserDataStore.getState().isLoading).toBe(false));

    const bulkPut = vi
      .spyOn(db.settings, "bulkPut")
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"));

    fireEvent.change(nameInput, { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await expect(
      screen.findByRole("alert", {
        name: "",
      }),
    ).resolves.toHaveTextContent(
      "Couldn’t save this change. Your previous setting is still active.",
    );
    expect(useUserDataStore.getState().userName).toBe("Avery");
    expect(useUserDataStore.getState().userNameCustom).toBe(true);
    await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
      { key: USER_NAME_KEY, value: "Avery" },
      { key: USER_NAME_CUSTOM_KEY, value: true },
    ]);
    expect(localStorage.getItem(USER_NAME_KEY)).toBe(JSON.stringify("Avery"));
    expect(localStorage.getItem(USER_NAME_CUSTOM_KEY)).toBe(JSON.stringify(true));
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();

    bulkPut.mockRestore();
    firstMount.unmount();
    resetUserDataStore();

    render(<PersistenceHarness />);
    await waitFor(() =>
      expect(screen.getByTestId("hydrated-profile-state")).toHaveTextContent("Avery:true"),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Your name")).toHaveValue("Avery"),
    );
  });

  it("restores both profile fields from one recovery envelope when the authoritative pair cannot be read", async () => {
    await db.settings.bulkDelete([USER_NAME_KEY, USER_NAME_CUSTOM_KEY]);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_NAME_CUSTOM_KEY);
    localStorage.setItem(
      PROFILE_RECOVERY_KEY,
      JSON.stringify({ version: 1, name: "Recovered", userChosen: true }),
    );
    const bulkGet = vi
      .spyOn(db.settings, "bulkGet")
      .mockRejectedValueOnce(new Error("profile read unavailable"));

    render(<PersistenceHarness />);

    await waitFor(() =>
      expect(screen.getByTestId("hydrated-profile-state")).toHaveTextContent(
        "Recovered:true",
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Your name")).toHaveValue("Recovered"),
    );
    bulkGet.mockRestore();
  });

  it("fails closed to one default pair when IndexedDB contains an incomplete authoritative profile", async () => {
    await db.settings.bulkDelete([USER_NAME_KEY, USER_NAME_CUSTOM_KEY]);
    await db.settings.put({ key: USER_NAME_KEY, value: "Stored name only" });
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_NAME_CUSTOM_KEY);
    localStorage.setItem(
      PROFILE_RECOVERY_KEY,
      JSON.stringify({ version: 1, name: "Fallback", userChosen: true }),
    );

    render(<PersistenceHarness />);

    await waitFor(() =>
      expect(screen.getByTestId("hydrated-profile-state")).toHaveTextContent("Friend:false"),
    );
    expect(screen.getByLabelText("Your name")).toHaveValue("");
    await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
      { key: USER_NAME_KEY, value: "Stored name only" },
      undefined,
    ]);
  });

  it("coalesces sequential runtime profile setters into one semantic pair", async () => {
    render(<PersistenceHarness />);
    await waitFor(() => expect(useUserDataStore.getState().isLoading).toBe(false));
    const bulkPut = vi.spyOn(db.settings, "bulkPut");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      useUserDataStore.getState().setUserName("Account profile");
      useUserDataStore.getState().setUserNameCustom(false);
    });

    await waitFor(async () => {
      await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
        { key: USER_NAME_KEY, value: "Account profile" },
        { key: USER_NAME_CUSTOM_KEY, value: false },
      ]);
    });
    expect(bulkPut).toHaveBeenCalledTimes(1);
    expect(bulkPut).toHaveBeenCalledWith([
      { key: USER_NAME_KEY, value: "Account profile" },
      { key: USER_NAME_CUSTOM_KEY, value: false },
    ]);
    expect(
      setItem.mock.calls.filter(([key]) => key === PROFILE_RECOVERY_KEY),
    ).toEqual([
      [
        PROFILE_RECOVERY_KEY,
        JSON.stringify({ version: 1, name: "Account profile", userChosen: false }),
      ],
    ]);
  });

  it("preserves the latest durable companion field during a solo runtime name update", async () => {
    render(<PersistenceHarness />);
    await waitFor(() => expect(useUserDataStore.getState().isLoading).toBe(false));

    await commitProfileNameUpdate("Direct save", false);
    act(() => {
      useUserDataStore.getState().setUserName("Fresh account name");
    });

    await waitFor(async () => {
      await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
        { key: USER_NAME_KEY, value: "Fresh account name" },
        { key: USER_NAME_CUSTOM_KEY, value: false },
      ]);
    });
    expect(localStorage.getItem(PROFILE_RECOVERY_KEY)).toBe(
      JSON.stringify({ version: 1, name: "Fresh account name", userChosen: false }),
    );
  });

  it("serializes a runtime profile patch behind an ordinary authoritative barrier", async () => {
    render(<PersistenceHarness />);
    await waitFor(() => expect(useUserDataStore.getState().isLoading).toBe(false));

    let releaseMutation!: () => void;
    let markMutationStarted!: () => void;
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const mutationStarted = new Promise<void>((resolve) => {
      markMutationStarted = resolve;
    });
    const mutation = runWithDataWriteBarrier(async () => {
      markMutationStarted();
      await mutationGate;
    });
    await mutationStarted;

    act(() => {
      useUserDataStore.getState().setUserName("Queued profile action");
    });
    releaseMutation();
    await mutation;

    await waitFor(async () => {
      await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
        { key: USER_NAME_KEY, value: "Queued profile action" },
        { key: USER_NAME_CUSTOM_KEY, value: true },
      ]);
    });
    expect(localStorage.getItem(PROFILE_RECOVERY_KEY)).toBe(
      JSON.stringify({ version: 1, name: "Queued profile action", userChosen: true }),
    );
  });

  it("does not resurrect a profile patch attempted during an account-boundary discard", async () => {
    render(<PersistenceHarness />);
    await waitFor(() => expect(useUserDataStore.getState().isLoading).toBe(false));

    let releasePurge!: () => void;
    let markPurgeStarted!: () => void;
    const purgeGate = new Promise<void>((resolve) => {
      releasePurge = resolve;
    });
    const purgeStarted = new Promise<void>((resolve) => {
      markPurgeStarted = resolve;
    });
    const purge = runWithDataWriteBarrier(
      async () => {
        await db.settings.bulkDelete([USER_NAME_KEY, USER_NAME_CUSTOM_KEY]);
        localStorage.removeItem(PROFILE_RECOVERY_KEY);
        localStorage.removeItem(USER_NAME_KEY);
        localStorage.removeItem(USER_NAME_CUSTOM_KEY);
        markPurgeStarted();
        await purgeGate;
      },
      { deferredWrites: "discard" },
    );
    await purgeStarted;

    act(() => {
      useUserDataStore.getState().setUserName("Expired profile action");
    });
    releasePurge();
    await purge;

    await waitFor(async () => {
      await expect(db.settings.bulkGet([USER_NAME_KEY, USER_NAME_CUSTOM_KEY])).resolves.toEqual([
        undefined,
        undefined,
      ]);
    });
    expect(localStorage.getItem(PROFILE_RECOVERY_KEY)).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("hydrated-profile-state")).toHaveTextContent("Friend:false"),
    );
  });
});
