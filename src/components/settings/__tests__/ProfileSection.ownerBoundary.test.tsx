import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/ui/accordion";
import { ProfileSection } from "../ProfileSection";

const mocks = vi.hoisted(() => ({
  currentOwnerUserId: "account-a",
  getCurrentSessionUserId: vi.fn(),
  updateProfileName: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/accountService", () => ({
  updateProfileName: mocks.updateProfileName,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    setLanguage: vi.fn(),
    t: {
      invalidNameFormat: "Invalid name format",
      nameSaved: "Saved",
      nameSavedLocally: "Saved on this device",
      save: "Save",
      settingsGroupProfile: "Profile",
      yourName: "Your name",
    },
  }),
}));

vi.mock("@/components/ThemeToggle", () => ({
  useTheme: () => ({ theme: "light", changeTheme: vi.fn() }),
}));

function renderSubject(userName: string, onNameChange: (name: string) => void) {
  return render(
    <Accordion type="multiple" value={["profile"]}>
      <ProfileSection userName={userName} onNameChange={onNameChange} />
    </Accordion>,
  );
}

describe("ProfileSection owner boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentOwnerUserId = "account-a";
    mocks.getCurrentSessionUserId.mockImplementation(async () => mocks.currentOwnerUserId);
  });

  it("ignores account A's delayed cloud completion after account B becomes active", async () => {
    let finishUpdate!: (success: boolean) => void;
    mocks.updateProfileName.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpdate = resolve;
      }),
    );
    const onNameChange = vi.fn();
    const view = renderSubject("Avery A", onNameChange);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Avery Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onNameChange).toHaveBeenCalledWith("Avery Updated");
      expect(mocks.updateProfileName).toHaveBeenCalledWith("account-a", "Avery Updated");
    });

    mocks.currentOwnerUserId = "account-b";
    view.rerender(
      <Accordion type="multiple" value={["profile"]}>
        <ProfileSection userName="Bailey B" onNameChange={onNameChange} />
      </Accordion>,
    );

    await act(async () => {
      finishUpdate(false);
    });

    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bailey B")).toBeInTheDocument();
    expect(onNameChange).toHaveBeenCalledTimes(1);
  });
});
