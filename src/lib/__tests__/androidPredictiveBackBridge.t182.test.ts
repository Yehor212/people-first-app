import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("T182 Android 16 predictive Back bridge contract", () => {
  it("has one lifecycle-bound AndroidX callback and no legacy KEYCODE/onBackPressed owner", () => {
    const plugin = read("android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java");
    const activity = read("android/app/src/main/java/com/zenflow/app/MainActivity.java");

    expect(plugin).toContain('@CapacitorPlugin(name = "AndroidBack")');
    expect(plugin).toContain("new OnBackPressedCallback(navigationState.canConsume())");
    expect(plugin).toContain(
      "getOnBackPressedDispatcher().addCallback(getActivity(), backCallback)"
    );
    expect(plugin).toContain('notifyListeners("backInvoked"');
    expect(plugin).toContain("backCallback.setEnabled(canConsume)");
    expect(plugin).toContain("backCallback.remove()");
    expect(plugin).not.toMatch(/\bonBackPressed\s*\(/);
    expect(plugin).not.toContain("KEYCODE_BACK");
    expect(activity).toContain("registerPlugin(AndroidBackPlugin.class);");
  });

  it("disables the competing Capacitor callback and commits no save/delete/complete action", () => {
    const config = read("capacitor.config.ts");
    const handler = read("src/lib/androidBackHandler.ts");

    expect(config).toMatch(/App:\s*\{[\s\S]*?disableBackButtonHandler:\s*true/);
    expect(handler).toContain('AndroidBackBridge.addListener("backInvoked"');
    expect(handler).not.toContain('App.addListener("backButton"');
    expect(handler).not.toContain("App.exitApp");
    expect(handler).not.toMatch(/querySelectorAll\([^)]*button|\.click\(\)/);
    expect(handler).not.toMatch(/\b(save|delete|complete)\s*\(/i);
  });

  it("keeps predictive cancel side-effect-free by notifying JavaScript only on commit", () => {
    const plugin = read("android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java");
    const committedBlock = /handleOnBackPressed\(\)\s*\{([\s\S]*?)\n\s*\}/.exec(plugin)?.[1] ?? "";

    expect(committedBlock).toContain('notifyListeners("backInvoked"');
    expect(plugin).not.toContain("handleOnBackStarted");
    expect(plugin).not.toContain("handleOnBackProgressed");
    expect(plugin).not.toContain("handleOnBackCancelled");
  });

  it("does not retain a committed Back for replay to a listener that attaches later", () => {
    const plugin = read("android/app/src/main/java/com/zenflow/app/AndroidBackPlugin.java");

    expect(plugin).toContain('notifyListeners("backInvoked", event);');
    expect(plugin).not.toContain('notifyListeners("backInvoked", event, true);');
  });

  it("registers the non-dialog appearance disclosure above navigation", () => {
    const appearance = read("src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx");

    expect(appearance).toContain("useBackHandler(appearanceMenuOpen, closeAppearanceMenu);");
  });

  it("registers the visible Diary formatting toolbar above its editor", () => {
    const toolbar = read("src/features/journal/DiaryFormatToolbar.tsx");

    expect(toolbar).toContain("useBackHandler(visible, closeToolbar);");
  });

  it("registers transient listbox states without treating persistent listboxes as Back layers", () => {
    const handler = read("src/lib/androidBackHandler.ts");
    const slashMenu = read("src/features/journal/SlashCommandMenu.tsx");
    const calendar = read("src/components/stats/CalendarTab.tsx");
    const habitHub = read("src/components/habit-hub/HabitHubList.tsx");

    expect(handler).not.toContain(`'[role="listbox"]'`);
    expect(slashMenu).toContain("useBackHandler(open, close);");
    expect(calendar).toContain("useBackHandler(showMonthSelector, closeMonthSelector);");
    expect(habitHub).toContain("useBackHandler(showSortMenu, closeSortMenu);");
  });

  it("owns Back while the journal import confirmation is still loading", () => {
    const journal = read("src/features/journal/JournalModule.tsx");
    const androidOwnerBlock =
      /\/\/ Android back button handling([\s\S]*?)\/\/ Security touch on interaction/.exec(
        journal
      )?.[1] ?? "";

    expect(androidOwnerBlock).toMatch(
      /if \(pendingJournalImport\)[\s\S]*?registerModalCloseCallback\([\s\S]*?setPendingJournalImport\(null\)/
    );
  });

  it("does not double-register components already covered by useModalA11y", () => {
    const files = [
      "src/components/NotificationPermission.tsx",
      "src/components/schedule/AddEventModal.tsx",
      "src/components/schedule/EventDetailsModal.tsx",
      "src/components/challenges-panel/ChallengesPanel.tsx",
      "src/components/leaderboard/Leaderboard.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toContain('from "@/hooks/useBackHandler"');
      expect(source, file).not.toMatch(/\buseBackHandler\s*\(/);
    }
  });

  it("keeps JournalModule keyboard focus handling separate from its single state owner", () => {
    const journal = read("src/features/journal/JournalModule.tsx");

    expect(journal).toContain('import { useModalKeyboard } from "@/hooks/useModalKeyboard";');
    expect(journal).not.toContain('import { useModalA11y } from "@/hooks/useModalA11y";');
    expect(journal).not.toContain('import { useBackHandler } from "@/hooks/useBackHandler";');
    expect(journal).not.toMatch(/\buseBackHandler\s*\(/);
    expect(journal).toMatch(
      /useModalKeyboard\(\{[\s\S]*?isOpen:\s*moduleState === "open"[\s\S]*?onClose:\s*handleClose/
    );
  });

  it("keeps parent and mounted child layers from registering the same Back state twice", () => {
    const schedule = read("src/components/schedule/ScheduleTimeline.tsx");
    expect(schedule).not.toContain('from "@/hooks/useBackHandler"');
    expect(schedule).not.toMatch(/\buseBackHandler\s*\(/);

    for (const file of [
      "src/features/journal/ExportPickerDialog.tsx",
      "src/features/journal/JournalImportConfirmDialog.tsx",
      "src/features/journal/RemovePasswordConfirmDialog.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain(
        'import { useModalKeyboard } from "@/hooks/useModalKeyboard";'
      );
      expect(source, file).not.toContain('from "@/hooks/useBackHandler"');
      expect(source, file).not.toContain('from "@/hooks/useModalA11y"');
      expect(source, file).not.toMatch(/\buseBackHandler\s*\(|\buseModalA11y\s*\(/);
    }
  });
});
