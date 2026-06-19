import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MutableRefObject, ReactNode } from "react";
import { useJournalEditorState } from "../useJournalEditorState";
import { JOURNAL_DRAFT_ENTRY_ID, type JournalEntry } from "../types";
import type { JournalDraftData } from "../journalDraftStorage";

const storageMocks = vi.hoisted(() => ({
  commitDraftMediaToEntry: vi.fn(() => Promise.resolve()),
  deleteDraftMedia: vi.fn(() => Promise.resolve()),
}));

const draftStorageMocks = vi.hoisted(() => ({
  clearJournalDraft: vi.fn(() => Promise.resolve()),
  loadJournalDraft: vi.fn<() => Promise<JournalDraftData | null>>(() => Promise.resolve(null)),
  saveJournalDraft: vi.fn(() => Promise.resolve()),
}));

type AndroidBackCallback = () => boolean;

const backHandlerMocks = vi.hoisted(() => ({
  registerModalCloseCallback: vi.fn((_callback: AndroidBackCallback) => vi.fn()),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      journalEntrySaved: "Entry saved",
      journalAudioError: "Failed to save audio",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/usePanicGesture", () => ({ usePanicGesture: vi.fn() }));
vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: backHandlerMocks.registerModalCloseCallback,
}));
vi.mock("@/lib/a11y", () => ({
  announceError: vi.fn(),
  announceSuccess: vi.fn(),
  createFocusTrap: vi.fn(() => vi.fn()),
}));
vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(() => Promise.resolve()),
  hapticTap: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/audioManager", () => ({ playSuccess: vi.fn() }));
vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (state: { appliedTheme: "paper" }) => unknown) =>
    selector({ appliedTheme: "paper" }),
}));
vi.mock("../useJournalVoice", () => ({
  useJournalVoice: () => ({
    error: null,
    isListening: false,
    isSupported: false,
    start: vi.fn(),
    stop: vi.fn(),
    transcript: "",
  }),
}));
vi.mock("../journalDraftStorage", () => ({
  clearJournalDraft: draftStorageMocks.clearJournalDraft,
  getJournalDraftKey: () => "journal_draft_new",
  loadJournalDraft: draftStorageMocks.loadJournalDraft,
  saveJournalDraft: draftStorageMocks.saveJournalDraft,
}));
vi.mock("../journalStorage", () => ({
  commitDraftMediaToEntry: storageMocks.commitDraftMediaToEntry,
  deleteDraftMedia: storageMocks.deleteDraftMedia,
}));

class AsyncFileReader {
  result = "data:audio/webm;base64,dm9pY2U=";
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL() {
    setTimeout(() => this.onloadend?.(), 10);
  }
}

function makeProps(overrides: Partial<Parameters<typeof useJournalEditorState>[0]> = {}) {
  return {
    desktop: true,
    entry: null,
    entryPrefill: null,
    onAddAudio: vi.fn(() =>
      Promise.resolve({
        id: "audio-recorded",
        entryId: "draft",
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      }),
    ),
    onAddPhoto: vi.fn(),
    onBack: vi.fn(),
    onRemoveAudio: vi.fn(),
    onRemovePhoto: vi.fn(),
    onSave: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function makeExistingEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-existing",
    date: "2026-06-17",
    title: "Existing",
    content: "<p>Existing private thought</p>",
    stickers: [],
    photoIds: ["photo-old"],
    audioIds: ["audio-old"],
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("useJournalEditorState recording save", () => {
  beforeEach(() => {
    storageMocks.commitDraftMediaToEntry.mockClear();
    storageMocks.deleteDraftMedia.mockClear();
    draftStorageMocks.clearJournalDraft.mockClear();
    draftStorageMocks.loadJournalDraft.mockReset();
    draftStorageMocks.loadJournalDraft.mockResolvedValue(null);
    draftStorageMocks.saveJournalDraft.mockClear();
    backHandlerMocks.registerModalCloseCallback.mockClear();
    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() =>
          Promise.resolve({
            getTracks: () => [{ stop: vi.fn() }],
          }),
        ),
      },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("waits for an active recording to be linked before saving the entry", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const props = makeProps({ onSave });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    act(() => {
      result.current.setTitle("Recorded thought");
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        audioIds: ["audio-recorded"],
        title: "Recorded thought",
      }),
    );
  });

  it("writes iOS pagehide-stopped audio into the draft without waiting for debounce", async () => {
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-pagehide",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      }),
    );
    const props = makeProps({ onAddAudio });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });

    await waitFor(() => expect(result.current.audioIds).toEqual(["audio-pagehide"]));
    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_new",
      expect.objectContaining({ audioIds: ["audio-pagehide"] }),
    );
  });


  it("persists dirty draft content immediately when the app backgrounds", async () => {
    const props = makeProps();

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.innerHTML = "<p>Background private text</p>";

    act(() => {
      (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;
      result.current.handleEditorInput();
    });

    expect(draftStorageMocks.saveJournalDraft).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
        "journal_draft_new",
        expect.objectContaining({ content: "<p>Background private text</p>" }),
      ),
    );
  });

  it("writes restored draft content into the visible editor", async () => {
    draftStorageMocks.loadJournalDraft.mockResolvedValue({
      title: "Restored on iOS",
      date: "2026-06-17",
      content: "<p>Restored private iOS draft</p>",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      habitSnapshot: [],
      savedAt: Date.now(),
    });
    const props = makeProps();

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    const editor = document.createElement("div");
    editor.contentEditable = "true";

    act(() => {
      (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;
    });

    await waitFor(() => expect(result.current.draftAvailable).not.toBeNull());
    act(() => {
      result.current.handleRestoreDraft();
    });

    expect(result.current.content).toBe("<p>Restored private iOS draft</p>");
    expect(editor.textContent).toContain("Restored private iOS draft");
  });

  it("flushes an active recording when Android back closes the recording overlay", async () => {
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-from-back",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      }),
    );
    const props = makeProps({ onAddAudio });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    await waitFor(() => expect(backHandlerMocks.registerModalCloseCallback).toHaveBeenCalled());

    const callbacks = backHandlerMocks.registerModalCloseCallback.mock.calls.map(
      ([callback]) => callback,
    );
    const latestBackCallback = callbacks.at(-1);
    expect(latestBackCallback).toBeTypeOf("function");

    act(() => {
      expect(latestBackCallback?.()).toBe(true);
    });

    await waitFor(() => expect(onAddAudio).toHaveBeenCalled());
    expect(onAddAudio).toHaveBeenCalledWith(
      "data:audio/webm;base64,dm9pY2U=",
      0,
      "audio/webm",
      JOURNAL_DRAFT_ENTRY_ID,
    );
  });

  it("discards existing-entry staged media without deleting original media", async () => {
    const onAddPhoto = vi.fn(() =>
      Promise.resolve({
        id: "photo-new",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:image/jpeg;base64,new",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 100,
        createdAt: Date.now(),
      }),
    );
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const onBack = vi.fn();
    const props = makeProps({
      entry: makeExistingEntry(),
      onAddPhoto,
      onBack,
      onRemovePhoto,
    });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      await result.current.handleRemovePhoto("photo-old");
    });
    await act(async () => {
      await result.current.handleDiscard();
    });

    expect(onAddPhoto).toHaveBeenCalledWith(expect.any(File), JOURNAL_DRAFT_ENTRY_ID);
    expect(onRemovePhoto).toHaveBeenCalledWith("photo-new", JOURNAL_DRAFT_ENTRY_ID);
    expect(onRemovePhoto).not.toHaveBeenCalledWith("photo-old", "entry-existing");
    expect(storageMocks.deleteDraftMedia).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it("commits existing-entry staged media only after save succeeds", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const onAddPhoto = vi.fn(() =>
      Promise.resolve({
        id: "photo-new",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:image/jpeg;base64,new",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 100,
        createdAt: Date.now(),
      }),
    );
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-recorded",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      }),
    );
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const onRemoveAudio = vi.fn(() => Promise.resolve());
    const props = makeProps({
      entry: makeExistingEntry(),
      onAddAudio,
      onAddPhoto,
      onRemoveAudio,
      onRemovePhoto,
      onSave,
    });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      await result.current.handleRemovePhoto("photo-old");
      await result.current.handleRemoveAudio("audio-old");
    });
    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(onAddAudio).toHaveBeenCalledWith(
      "data:audio/webm;base64,dm9pY2U=",
      expect.any(Number),
      "audio/webm",
      JOURNAL_DRAFT_ENTRY_ID,
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        audioIds: ["audio-recorded"],
        photoIds: ["photo-new"],
      }),
    );
    expect(storageMocks.commitDraftMediaToEntry).toHaveBeenCalledWith("entry-existing", {
      audioIds: ["audio-recorded"],
      photoIds: ["photo-new"],
    });
    const commitOrder = storageMocks.commitDraftMediaToEntry.mock.invocationCallOrder[0];
    const saveOrder = onSave.mock.invocationCallOrder[0];
    expect(commitOrder).toBeLessThan(saveOrder);
    expect(onRemovePhoto).toHaveBeenCalledWith("photo-old", "entry-existing");
    expect(onRemoveAudio).toHaveBeenCalledWith("audio-old", "entry-existing");
  });
});
