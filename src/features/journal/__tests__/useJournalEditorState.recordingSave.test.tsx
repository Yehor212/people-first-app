import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MutableRefObject, ReactNode } from "react";
import { useJournalEditorState } from "../useJournalEditorState";
import {
  JOURNAL_DRAFT_ENTRY_ID,
  getJournalDraftMediaOwnerId,
  type JournalAudio,
  type JournalEntry,
} from "../types";
import type { JournalDraftData } from "../journalDraftStorage";
import { prepareAppForReload } from "@/lib/versionCheck";

const storageMocks = vi.hoisted(() => ({
  acceptDraftPhoto: vi.fn(() => Promise.resolve()),
  clearDraftPhotoCancellation: vi.fn(() => Promise.resolve()),
  commitDraftMediaToEntry: vi.fn(() => Promise.resolve()),
  deleteDraftMedia: vi.fn(() => Promise.resolve()),
  discardJournalDraft: vi.fn(() => Promise.resolve()),
  getDraftMediaIds: vi.fn<
    () => Promise<{ photoIds: string[]; audioIds: string[] }>
  >(() => Promise.resolve({ photoIds: [], audioIds: [] })),
  getAudioForEntry: vi.fn<() => Promise<JournalAudio[]>>(() => Promise.resolve([])),
  markDraftPhotoCancellation: vi.fn(() => Promise.resolve()),
}));

const draftStorageMocks = vi.hoisted(() => ({
  acquireJournalDraftWriter: vi.fn(() => Promise.resolve()),
  clearJournalDraft: vi.fn(() => Promise.resolve()),
  loadJournalDraft: vi.fn<() => Promise<JournalDraftData | null>>(() => Promise.resolve(null)),
  releaseJournalDraftWriter: vi.fn(() => Promise.resolve()),
  saveJournalDraft: vi.fn(() => Promise.resolve()),
  touchJournalDraftWriter: vi.fn(() => Promise.resolve(true)),
}));

type AndroidBackCallback = () => boolean;

const backHandlerMocks = vi.hoisted(() => ({
  registerModalCloseCallback: vi.fn((_callback: AndroidBackCallback) => vi.fn()),
}));

const panicGestureMocks = vi.hoisted(() => ({
  onPanic: null as (() => void) | null,
}));

const audioLifecycleMocks = vi.hoisted(() => ({
  pauseAllAudio: vi.fn(),
}));

const voiceMocks = vi.hoisted(() => ({
  error: null as string | null,
  isListening: false,
  isSupported: false,
  start: vi.fn(),
  stop: vi.fn(() => Promise.resolve("")),
  transcript: "",
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      journalEntrySaved: "Entry saved",
      journalAudioError: "Failed to save audio",
      journalAudioInputMissing:
        "No microphone was found. You can keep writing without audio.",
      journalAudioInputUnavailable:
        "The microphone is busy or unavailable. You can keep writing and try again later.",
      journalAudioStartError:
        "The microphone could not start. You can keep writing without audio.",
      journalAudioLoadError: "This entry's audio could not be loaded.",
      journalAudioLoadRetry: "Try loading audio again",
      journalAudioRemoveError: "This recording could not be removed.",
      journalSaveConflictHint: "This entry changed elsewhere. Your edits are still here.",
    },
  }),
}));

vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/hooks/usePanicGesture", () => ({
  usePanicGesture: (_enabled: boolean, onPanic: () => void) => {
    panicGestureMocks.onPanic = onPanic;
  },
}));
vi.mock("@/lib/audioLifecycle", () => ({
  pauseAllAudio: audioLifecycleMocks.pauseAllAudio,
}));
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
  useJournalVoice: () => ({ ...voiceMocks }),
}));
vi.mock("../journalDraftStorage", () => ({
  JournalDraftInUseError: class JournalDraftInUseError extends Error {
    readonly code = "JOURNAL_DRAFT_IN_USE";

    constructor(readonly draftKey: string) {
      super("This diary draft is open in another window");
      this.name = "JournalDraftInUseError";
    }
  },
  acquireJournalDraftWriter: draftStorageMocks.acquireJournalDraftWriter,
  clearJournalDraft: draftStorageMocks.clearJournalDraft,
  getJournalDraftKey: (entryId: string | null) => `journal_draft_${entryId || "new"}`,
  loadJournalDraft: draftStorageMocks.loadJournalDraft,
  releaseJournalDraftWriter: draftStorageMocks.releaseJournalDraftWriter,
  saveJournalDraft: draftStorageMocks.saveJournalDraft,
  touchJournalDraftWriter: draftStorageMocks.touchJournalDraftWriter,
}));
vi.mock("../journalStorage", () => ({
  acceptDraftPhoto: storageMocks.acceptDraftPhoto,
  clearDraftPhotoCancellation: storageMocks.clearDraftPhotoCancellation,
  commitDraftMediaToEntry: storageMocks.commitDraftMediaToEntry,
  deleteDraftMedia: storageMocks.deleteDraftMedia,
  discardJournalDraft: storageMocks.discardJournalDraft,
  getDraftMediaIds: storageMocks.getDraftMediaIds,
  getAudioForEntry: storageMocks.getAudioForEntry,
  markDraftPhotoCancellation: storageMocks.markDraftPhotoCancellation,
  isJournalEntryConflictError: (error: unknown) =>
    error instanceof Error &&
    (error as Error & { code?: unknown }).code === "JOURNAL_ENTRY_CONFLICT",
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

function makePhotoResult(id: string) {
  return {
    id,
    entryId: getJournalDraftMediaOwnerId(null),
    data: "data:image/jpeg;base64,photo",
    thumbnail: "data:image/jpeg;base64,thumb",
    width: 100,
    height: 100,
    createdAt: Date.now(),
  };
}

async function finishDraftPreflight(result: { current: { draftReady: boolean } }) {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(result.current.draftReady).toBe(true);
}

describe("useJournalEditorState recording save", () => {
  beforeEach(() => {
    storageMocks.acceptDraftPhoto.mockReset();
    storageMocks.acceptDraftPhoto.mockResolvedValue(undefined);
    storageMocks.clearDraftPhotoCancellation.mockReset();
    storageMocks.clearDraftPhotoCancellation.mockResolvedValue(undefined);
    storageMocks.commitDraftMediaToEntry.mockClear();
    storageMocks.deleteDraftMedia.mockClear();
    storageMocks.discardJournalDraft.mockReset();
    storageMocks.discardJournalDraft.mockResolvedValue(undefined);
    storageMocks.getDraftMediaIds.mockReset();
    storageMocks.getDraftMediaIds.mockResolvedValue({ photoIds: [], audioIds: [] });
    storageMocks.getAudioForEntry.mockReset();
    storageMocks.getAudioForEntry.mockResolvedValue([]);
    storageMocks.markDraftPhotoCancellation.mockReset();
    storageMocks.markDraftPhotoCancellation.mockResolvedValue(undefined);
    draftStorageMocks.clearJournalDraft.mockClear();
    draftStorageMocks.acquireJournalDraftWriter.mockReset();
    draftStorageMocks.acquireJournalDraftWriter.mockResolvedValue(undefined);
    draftStorageMocks.loadJournalDraft.mockReset();
    draftStorageMocks.loadJournalDraft.mockResolvedValue(null);
    draftStorageMocks.saveJournalDraft.mockClear();
    draftStorageMocks.releaseJournalDraftWriter.mockClear();
    draftStorageMocks.touchJournalDraftWriter.mockReset();
    draftStorageMocks.touchJournalDraftWriter.mockResolvedValue(true);
    backHandlerMocks.registerModalCloseCallback.mockClear();
    panicGestureMocks.onPanic = null;
    audioLifecycleMocks.pauseAllAudio.mockClear();
    voiceMocks.error = null;
    voiceMocks.isListening = false;
    voiceMocks.isSupported = false;
    voiceMocks.transcript = "";
    voiceMocks.start.mockReset();
    voiceMocks.stop.mockReset();
    voiceMocks.stop.mockResolvedValue("");
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

  it("recovers scoped media written just before a process crash", async () => {
    const draftOwnerId = getJournalDraftMediaOwnerId(null);
    storageMocks.getDraftMediaIds.mockResolvedValue({
      photoIds: ["photo-after-crash"],
      audioIds: ["audio-after-crash"],
    });

    const { result } = renderHook(() => useJournalEditorState(makeProps()), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });

    await waitFor(() => expect(result.current.draftReady).toBe(true));
    expect(storageMocks.getDraftMediaIds).toHaveBeenCalledWith(draftOwnerId);
    expect(result.current.draftAvailable).toEqual(
      expect.objectContaining({
        photoIds: ["photo-after-crash"],
        audioIds: ["audio-after-crash"],
      }),
    );
  });

  it("checkpoints a completed photo layout interaction without waiting for draft debounce", async () => {
    const entry = makeExistingEntry({
      photoLayout: { "photo-old": { x: 25, y: 35, width: 160 } },
    });
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ entry })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => {
      result.current.setPhotoLayout({
        "photo-old": { x: 60, y: 45, width: 320 },
      });
    });
    await act(async () => {
      await result.current.checkpointPhotoLayout();
    });

    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledTimes(1);
    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_entry-existing",
      expect.objectContaining({
        photoLayout: {
          "photo-old": { x: 60, y: 45, width: 320 },
        },
      }),
      expect.any(String),
    );
  });

  it("checkpoints the first gallery-to-page placement without waiting for draft debounce", async () => {
    const entry = makeExistingEntry({ photoLayout: {} });
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ entry })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => {
      result.current.handleFloatPhoto("photo-old");
    });

    await waitFor(() => expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledTimes(1));
    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_entry-existing",
      expect.objectContaining({
        photoLayout: {
          "photo-old": { x: 50, y: 50, width: 200 },
        },
      }),
      expect.any(String),
    );
  });

  it("removes a late photo write when processing is cancelled before editor adoption", async () => {
    let resolvePhoto: ((photo: {
      id: string;
      entryId: string;
      data: string;
      thumbnail: string;
      width: number;
      height: number;
      createdAt: number;
    }) => void) | undefined;
    const onAddPhoto = vi.fn(
      () =>
        new Promise<{
          id: string;
          entryId: string;
          data: string;
          thumbnail: string;
          width: number;
          height: number;
          createdAt: number;
        }>((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto, onRemovePhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    const controller = new AbortController();
    let addPromise: Promise<unknown> | undefined;
    act(() => {
      addPromise = result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        controller.signal,
      );
    });
    await waitFor(() => expect(onAddPhoto).toHaveBeenCalledTimes(1));
    controller.abort();
    resolvePhoto?.({
      id: "photo-cancelled-late",
      entryId: getJournalDraftMediaOwnerId(null),
      data: "data:image/jpeg;base64,cancelled",
      thumbnail: "data:image/jpeg;base64,thumb",
      width: 100,
      height: 100,
      createdAt: Date.now(),
    });

    await expect(addPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(storageMocks.markDraftPhotoCancellation).toHaveBeenCalledWith(
      "photo-cancelled-late",
      getJournalDraftMediaOwnerId(null),
    );
    expect(onRemovePhoto).toHaveBeenCalledWith(
      "photo-cancelled-late",
      getJournalDraftMediaOwnerId(null),
    );
    expect(storageMocks.clearDraftPhotoCancellation).toHaveBeenCalledWith(
      "photo-cancelled-late",
      getJournalDraftMediaOwnerId(null),
    );
    expect(result.current.photoIds).not.toContain("photo-cancelled-late");
  });

  it("does not expose a processed photo until its draft admission is durable", async () => {
    let releaseAdmission: (() => void) | undefined;
    storageMocks.acceptDraftPhoto.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseAdmission = resolve;
        }),
    );
    const onAddPhoto = vi.fn(() => Promise.resolve(makePhotoResult("photo-awaiting-admission")));
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    let addPromise: Promise<unknown> | undefined;
    act(() => {
      addPromise = result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      );
    });

    await waitFor(() =>
      expect(storageMocks.acceptDraftPhoto).toHaveBeenCalledWith(
        "photo-awaiting-admission",
        getJournalDraftMediaOwnerId(null),
      ),
    );
    expect(result.current.photoIds).not.toContain("photo-awaiting-admission");

    await act(async () => {
      releaseAdmission?.();
      await addPromise;
    });
    expect(result.current.photoIds).toContain("photo-awaiting-admission");
  });

  it("discards a photo when cancellation arrives during durable draft admission", async () => {
    let releaseAdmission: (() => void) | undefined;
    storageMocks.acceptDraftPhoto.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseAdmission = resolve;
        }),
    );
    const onAddPhoto = vi.fn(() => Promise.resolve(makePhotoResult("photo-aborted-in-admission")));
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto, onRemovePhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    const controller = new AbortController();
    let addPromise: Promise<unknown> | undefined;
    act(() => {
      addPromise = result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        controller.signal,
      );
    });
    await waitFor(() => expect(storageMocks.acceptDraftPhoto).toHaveBeenCalledTimes(1));

    const rejectedAdd = expect(addPromise).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await act(async () => {
      releaseAdmission?.();
    });

    await rejectedAdd;
    expect(storageMocks.markDraftPhotoCancellation).toHaveBeenCalledWith(
      "photo-aborted-in-admission",
      getJournalDraftMediaOwnerId(null),
    );
    expect(onRemovePhoto).toHaveBeenCalledWith(
      "photo-aborted-in-admission",
      getJournalDraftMediaOwnerId(null),
    );
    expect(result.current.photoIds).not.toContain("photo-aborted-in-admission");
  });

  it("fails closed when durable draft-photo admission cannot be committed", async () => {
    storageMocks.acceptDraftPhoto.mockRejectedValueOnce(new Error("settings write unavailable"));
    const onAddPhoto = vi.fn(() => Promise.resolve(makePhotoResult("photo-admission-failed")));
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await expect(
      result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      ),
    ).rejects.toThrow("settings write unavailable");

    expect(result.current.photoIds).not.toContain("photo-admission-failed");
  });

  it("keeps a durable cancellation marker when late photo cleanup fails", async () => {
    let resolvePhoto: ((photo: ReturnType<typeof makePhotoResult>) => void) | undefined;
    const onAddPhoto = vi.fn(
      () =>
        new Promise<ReturnType<typeof makePhotoResult>>((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const onRemovePhoto = vi.fn(() => Promise.reject(new Error("delete unavailable")));
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto, onRemovePhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    const controller = new AbortController();
    let addPromise: Promise<unknown> | undefined;
    act(() => {
      addPromise = result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        controller.signal,
      );
    });
    await waitFor(() => expect(onAddPhoto).toHaveBeenCalledTimes(1));
    controller.abort();
    resolvePhoto?.(makePhotoResult("photo-cancelled-orphan"));

    await expect(addPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(storageMocks.markDraftPhotoCancellation).toHaveBeenCalledWith(
      "photo-cancelled-orphan",
      getJournalDraftMediaOwnerId(null),
    );
    expect(onRemovePhoto).toHaveBeenCalledWith(
      "photo-cancelled-orphan",
      getJournalDraftMediaOwnerId(null),
    );
    expect(storageMocks.clearDraftPhotoCancellation).not.toHaveBeenCalled();
    expect(result.current.photoIds).not.toContain("photo-cancelled-orphan");
  });

  it("discards a processed photo when the editor loses its draft writer lease", async () => {
    let resolvePhoto: ((photo: ReturnType<typeof makePhotoResult>) => void) | undefined;
    const onAddPhoto = vi.fn(
      () =>
        new Promise<ReturnType<typeof makePhotoResult>>((resolve) => {
          resolvePhoto = resolve;
        }),
    );
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddPhoto, onRemovePhoto })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    draftStorageMocks.touchJournalDraftWriter.mockResolvedValueOnce(false);

    let addPromise: Promise<unknown> | undefined;
    act(() => {
      addPromise = result.current.handleAddPhoto(
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      );
    });
    resolvePhoto?.(makePhotoResult("photo-after-lease-loss"));

    await expect(addPromise).rejects.toMatchObject({ code: "JOURNAL_DRAFT_IN_USE" });
    expect(onRemovePhoto).toHaveBeenCalledWith(
      "photo-after-lease-loss",
      getJournalDraftMediaOwnerId(null),
    );
    expect(result.current.photoIds).not.toContain("photo-after-lease-loss");
    await waitFor(() => expect(result.current.draftLoadError).toBe(true));
    expect(result.current.draftLoadInUse).toBe(true);
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
      {
        draftKey: "journal_draft_new",
        mediaOwnerId: getJournalDraftMediaOwnerId(null),
        writerId: expect.any(String),
      },
    );
  });

  it("stops active capture and playback when panic lock conceals the diary", async () => {
    voiceMocks.isSupported = true;
    const { result, rerender } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    await act(async () => result.current.handleStartRecording());
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    audioLifecycleMocks.pauseAllAudio.mockClear();
    voiceMocks.isListening = true;
    rerender();

    act(() => panicGestureMocks.onPanic?.());

    expect(result.current.panicLocked).toBe(true);
    expect(audioLifecycleMocks.pauseAllAudio).toHaveBeenCalledTimes(1);
    expect(voiceMocks.stop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(false));
  });

  it("cancels a pending microphone request before panic concealment can be bypassed", async () => {
    const stopTrack = vi.fn();
    let grantMicrophone!: (stream: { getTracks: () => Array<{ stop: () => void }> }) => void;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise<{ getTracks: () => Array<{ stop: () => void }> }>((resolve) => {
              grantMicrophone = resolve;
            }),
        ),
      },
    });
    const constructRecorder = vi.fn();
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        constructor() {
          constructRecorder();
        }
      },
    );

    const { result } = renderHook(() => useJournalEditorState(makeProps()), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    let startRequest!: Promise<void>;
    act(() => {
      startRequest = result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRequestingPermission).toBe(true));
    act(() => panicGestureMocks.onPanic?.());
    expect(result.current.panicLocked).toBe(true);

    await act(async () => {
      grantMicrophone({ getTracks: () => [{ stop: stopTrack }] });
      await startRequest;
    });

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(constructRecorder).not.toHaveBeenCalled();
    expect(result.current.recorder.isRecording).toBe(false);
    expect(result.current.showRecordingOverlay).toBe(false);
  });

  it("offers the same privacy lock from a desktop keyboard", async () => {
    const { result } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    await act(async () => result.current.handleStartRecording());
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    audioLifecycleMocks.pauseAllAudio.mockClear();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "L",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );
    });

    expect(result.current.panicLocked).toBe(true);
    expect(audioLifecycleMocks.pauseAllAudio).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(false));
  });

  it("keeps Escape inside the panic lock instead of navigating beneath it", async () => {
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => panicGestureMocks.onPanic?.());
    expect(result.current.panicLocked).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });

    expect(result.current.panicLocked).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("stops dictation and playback before opening the microphone recorder", async () => {
    voiceMocks.isListening = true;
    voiceMocks.isSupported = true;
    voiceMocks.transcript = "words already recognized";
    voiceMocks.stop.mockResolvedValue("words already recognized");
    const { result } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => result.current.handleStartRecording());

    expect(audioLifecycleMocks.pauseAllAudio).toHaveBeenCalledTimes(1);
    expect(voiceMocks.stop).toHaveBeenCalledTimes(1);
    expect(result.current.recorder.isRecording).toBe(true);
  });

  it("stops the microphone recorder before starting dictation", async () => {
    voiceMocks.isSupported = true;
    const { result } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    await act(async () => result.current.handleStartRecording());
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    audioLifecycleMocks.pauseAllAudio.mockClear();

    await act(async () => result.current.handleConfirmDictation());

    expect(audioLifecycleMocks.pauseAllAudio).toHaveBeenCalledTimes(1);
    expect(result.current.recorder.isRecording).toBe(false);
    expect(voiceMocks.start).toHaveBeenCalledTimes(1);
  });

  it("commits final dictation into the visible editor before saving", async () => {
    voiceMocks.isListening = true;
    voiceMocks.isSupported = true;
    voiceMocks.transcript = "A private thought spoken aloud";
    voiceMocks.stop.mockResolvedValue("A private thought spoken aloud");
    const onSave = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onSave })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;

    await act(async () => {
      await result.current.handleSave();
    });

    expect(editor.textContent).toContain("A private thought spoken aloud");
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("A private thought spoken aloud"),
      }),
      expect.any(Object),
    );
  });

  it("commits a naturally completed dictation into the visible editor", async () => {
    voiceMocks.isListening = true;
    voiceMocks.isSupported = true;
    voiceMocks.transcript = "Words that must remain visible";
    const { result, rerender } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;

    voiceMocks.isListening = false;
    rerender();

    await waitFor(() =>
      expect(editor.textContent).toContain("Words that must remain visible"),
    );
  });

  it("retains a completed recording for retry when durable storage fails", async () => {
    const onAddAudio = vi
      .fn()
      .mockRejectedValueOnce(new Error("IndexedDB write failed"))
      .mockResolvedValueOnce({
        id: "audio-after-retry",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      });
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    act(() => result.current.handleStopRecording());

    await waitFor(() => expect(result.current.audioSaveRetryAvailable).toBe(true));
    expect(result.current.recorder.audioData).toBe("data:audio/webm;base64,dm9pY2U=");
    expect(result.current.showRecordingOverlay).toBe(true);

    act(() => result.current.retryAudioSave());
    await waitFor(() => expect(result.current.audioIds).toEqual(["audio-after-retry"]));
    expect(onAddAudio).toHaveBeenCalledTimes(2);
  });

  it("keeps failed-save recovery visible when Android Back is pressed", async () => {
    const onAddAudio = vi.fn().mockRejectedValue(new Error("IndexedDB write failed"));
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    act(() => result.current.handleStopRecording());
    await waitFor(() => expect(result.current.audioSaveRetryAvailable).toBe(true));

    const androidBack = backHandlerMocks.registerModalCloseCallback.mock.calls.at(-1)?.[0];
    act(() => {
      expect(androidBack?.()).toBe(true);
    });

    const recoveryState = result.current as typeof result.current & {
      recordingDiscardPending: boolean;
    };
    expect(recoveryState.recordingDiscardPending).toBe(true);
    expect(result.current.showRecordingOverlay).toBe(true);
    expect(result.current.recorder.audioData).toBe("data:audio/webm;base64,dm9pY2U=");
    expect(onAddAudio).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "NotFoundError",
      "No microphone was found. You can keep writing without audio.",
    ],
    [
      "NotReadableError",
      "The microphone is busy or unavailable. You can keep writing and try again later.",
    ],
    [
      "AbortError",
      "The microphone could not start. You can keep writing without audio.",
    ],
  ])("explains %s microphone startup failures without mislabeling them as denial", async (name, expected) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Unavailable", name)),
      },
    });
    const { result } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleStartRecording();
    });

    expect(result.current.audioError).toBe(expected);
    expect(result.current.showRecordingOverlay).toBe(false);
  });

  it("waits for a stopped recording to reach durable storage before saving the entry", async () => {
    let resolveAudio!: (audio: JournalAudio) => void;
    const onAddAudio = vi.fn(
      () =>
        new Promise<JournalAudio>((resolve) => {
          resolveAudio = resolve;
        }),
    );
    const onSave = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio, onSave })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    act(() => result.current.setTitle("Thought with audio"));
    await act(async () => result.current.handleStartRecording());
    act(() => result.current.handleStopRecording());
    await waitFor(() => expect(onAddAudio).toHaveBeenCalledTimes(1));

    let saveSettled = false;
    const saving = result.current.handleSave().then(() => {
      saveSettled = true;
    });
    await Promise.resolve();
    expect(saveSettled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();

    resolveAudio({
      id: "audio-before-save",
      entryId: JOURNAL_DRAFT_ENTRY_ID,
      data: "data:audio/webm;base64,dm9pY2U=",
      duration: 0,
      mimeType: "audio/webm",
      createdAt: Date.now(),
    });
    await act(async () => saving);

    expect(onAddAudio).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ audioIds: ["audio-before-save"] }),
      expect.any(Object),
    );
    expect(result.current.hasPendingRecording).toBe(false);
  });

  it("compensates a durable audio write that resolves after the user discards it", async () => {
    let resolveAudio!: (audio: JournalAudio) => void;
    const onAddAudio = vi.fn(
      () =>
        new Promise<JournalAudio>((resolve) => {
          resolveAudio = resolve;
        }),
    );
    const onRemoveAudio = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio, onRemoveAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => result.current.handleStartRecording());
    act(() => result.current.handleStopRecording());
    await waitFor(() => expect(onAddAudio).toHaveBeenCalledTimes(1));

    act(() => result.current.handleDiscardRecording());
    resolveAudio({
      id: "discarded-after-write",
      entryId: JOURNAL_DRAFT_ENTRY_ID,
      data: "data:audio/webm;base64,dm9pY2U=",
      duration: 0,
      mimeType: "audio/webm",
      createdAt: Date.now(),
    });

    await waitFor(() =>
      expect(onRemoveAudio).toHaveBeenCalledWith(
        "discarded-after-write",
        getJournalDraftMediaOwnerId(null),
      ),
    );
    expect(result.current.audioIds).toEqual([]);
    expect(result.current.audioRecordings).toEqual([]);
    expect(result.current.audioNotice).toBeNull();
  });

  it("requires confirmation before permanently removing newly captured audio", async () => {
    const onRemoveAudio = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onRemoveAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    act(() => result.current.handleStopRecording());
    await waitFor(() => expect(result.current.audioIds).toEqual(["audio-recorded"]));
    expect(result.current.audioNotice).toBe("Audio saved");

    act(() => result.current.requestRemoveAudio("audio-recorded"));
    expect(result.current.audioRemovalPendingId).toBe("audio-recorded");
    expect(result.current.audioIds).toContain("audio-recorded");
    expect(onRemoveAudio).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmRemoveAudio();
    });
    expect(onRemoveAudio).toHaveBeenCalledWith(
      "audio-recorded",
      getJournalDraftMediaOwnerId(null),
    );
    expect(result.current.audioIds).not.toContain("audio-recorded");
  });

  it("keeps Escape inside audio removal confirmation instead of navigating beneath it", async () => {
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => result.current.requestRemoveAudio("audio-recorded"));
    expect(result.current.audioRemovalPendingId).toBe("audio-recorded");

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });

    expect(result.current.audioRemovalPendingId).toBe("audio-recorded");
    expect(onBack).not.toHaveBeenCalled();
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
      expect.any(String),
    );
  });

  it("persists one recording only once when lifecycle flushes overlap", async () => {
    let resolveAudio!: (audio: JournalAudio) => void;
    const onAddAudio = vi.fn(
      () =>
        new Promise<JournalAudio>((resolve) => {
          resolveAudio = resolve;
        }),
    );
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    await act(async () => result.current.handleStartRecording());
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
    });
    await waitFor(() => expect(onAddAudio).toHaveBeenCalledTimes(1));

    resolveAudio({
      id: "audio-overlapping-lifecycle",
      entryId: JOURNAL_DRAFT_ENTRY_ID,
      data: "data:audio/webm;base64,dm9pY2U=",
      duration: 0,
      mimeType: "audio/webm",
      createdAt: Date.now(),
    });

    await waitFor(() =>
      expect(result.current.audioIds).toEqual(["audio-overlapping-lifecycle"]),
    );
    expect(onAddAudio).toHaveBeenCalledTimes(1);
  });

  it("links an active recording into the recovery draft when the editor unmounts", async () => {
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-unmount",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 0,
        mimeType: "audio/webm",
        createdAt: Date.now(),
      }),
    );
    const { result, unmount } = renderHook(
      () => useJournalEditorState(makeProps({ onAddAudio })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));

    unmount();

    await waitFor(() => expect(onAddAudio).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
        "journal_draft_new",
        expect.objectContaining({ audioIds: ["audio-unmount"] }),
        expect.any(String),
      ),
    );
  });


  it("persists dirty draft content immediately when the app backgrounds", async () => {
    const props = makeProps();

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);
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
        expect.any(String),
      ),
    );
  });

  it("persists the latest draft when the editor unmounts before the debounce", async () => {
    const props = makeProps();
    const { result, unmount } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.innerHTML = "<p>Private thought before a fast route change</p>";

    act(() => {
      (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;
      result.current.handleEditorInput();
    });
    expect(draftStorageMocks.saveJournalDraft).not.toHaveBeenCalled();

    unmount();

    await waitFor(() =>
      expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
        "journal_draft_new",
        expect.objectContaining({
          content: "<p>Private thought before a fast route change</p>",
        }),
        expect.any(String),
      ),
    );
  });

  it("finishes persisting dirty draft content before an app update reload continues", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.innerHTML = "<p>Last keystrokes before update</p>";

    act(() => {
      (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;
      result.current.handleEditorInput();
    });

    await act(async () => {
      await prepareAppForReload();
    });

    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_new",
      expect.objectContaining({ content: "<p>Last keystrokes before update</p>" }),
      expect.any(String),
    );
  });

  it("does not recreate a private draft after an account boundary has suspended writers", async () => {
    const props = makeProps();
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.innerHTML = "<p>Account A private draft</p>";

    act(() => {
      (result.current.editorRef as MutableRefObject<HTMLDivElement | null>).current = editor;
      result.current.handleEditorInput();
      window.dispatchEvent(new Event("zenflow:account-boundary-writers-suspended"));
    });

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await prepareAppForReload();
    });

    expect(draftStorageMocks.saveJournalDraft).not.toHaveBeenCalled();
  });

  it("flushes an active recording into the draft before an app update reload continues", async () => {
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-before-reload",
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
      await prepareAppForReload();
    });

    expect(onAddAudio).toHaveBeenCalledWith(
      "data:audio/webm;base64,dm9pY2U=",
      0,
      "audio/webm",
      getJournalDraftMediaOwnerId(null),
    );
    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_new",
      expect.objectContaining({ audioIds: ["audio-before-reload"] }),
      expect.any(String),
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

  it("preserves an offered recovery draft when Back closes the untouched editor", async () => {
    draftStorageMocks.loadJournalDraft.mockResolvedValue({
      title: "Recover later",
      date: "2026-06-17",
      content: "<p>Private unsaved draft</p>",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      habitSnapshot: [],
      savedAt: Date.now(),
    });
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );

    await waitFor(() => expect(result.current.draftAvailable).not.toBeNull());
    act(() => result.current.handleBack());

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();
  });

  it("does not treat a handled nested Escape as an editor exit request", async () => {
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    const nestedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    nestedEscape.preventDefault();
    act(() => {
      document.dispatchEvent(nestedEscape);
    });

    expect(onBack).not.toHaveBeenCalled();
    expect(result.current.showUnsavedDialog).toBe(false);
  });

  it("keeps draft metadata when dismiss media cleanup fails and clears it after retry", async () => {
    draftStorageMocks.loadJournalDraft.mockResolvedValue({
      title: "Existing edit",
      date: "2026-06-17",
      content: "<p>Unsaved edit</p>",
      stickers: [],
      photoIds: ["photo-old", "photo-new"],
      audioIds: ["audio-old"],
      tags: [],
      habitSnapshot: [],
      savedAt: Date.now(),
    });
    storageMocks.discardJournalDraft
      .mockRejectedValueOnce(new Error("media cleanup unavailable"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(
      () =>
        useJournalEditorState(
          makeProps({ entry: makeExistingEntry() }),
        ),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );

    await waitFor(() => expect(result.current.draftAvailable).not.toBeNull());
    let firstDismiss = true;
    await act(async () => {
      firstDismiss = await result.current.handleDismissDraft();
    });
    expect(firstDismiss).toBe(false);
    await waitFor(() => expect(result.current.draftDismissError).toBeTruthy());
    expect(result.current.draftDismissSubmitting).toBe(false);
    expect(result.current.draftAvailable).not.toBeNull();
    expect(storageMocks.discardJournalDraft).toHaveBeenCalledTimes(1);

    let secondDismiss = false;
    await act(async () => {
      secondDismiss = await result.current.handleDismissDraft();
    });
    expect(secondDismiss).toBe(true);
    expect(storageMocks.discardJournalDraft).toHaveBeenLastCalledWith({
      draftKey: "journal_draft_entry-existing",
      mediaOwnerId: getJournalDraftMediaOwnerId("entry-existing"),
      writerId: expect.any(String),
    });
    await waitFor(() => expect(result.current.draftAvailable).toBeNull());
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
      getJournalDraftMediaOwnerId(null),
    );
  });

  it("leaves recording Escape to the mounted recovery-aware modal handler", async () => {
    const { result } = renderHook(() => useJournalEditorState(makeProps()), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));

    const getRecordingState = () => result.current as typeof result.current & {
      recordingDiscardPending: boolean;
      requestDiscardRecording: () => void;
    };
    act(() => getRecordingState().requestDiscardRecording());
    expect(getRecordingState().recordingDiscardPending).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(getRecordingState().recordingDiscardPending).toBe(true);
    expect(result.current.recorder.isRecording).toBe(true);
    expect(result.current.showRecordingOverlay).toBe(true);
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
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      await result.current.handleRemovePhoto("photo-old");
    });
    await act(async () => {
      await result.current.handleDiscard();
    });

    expect(onAddPhoto).toHaveBeenCalledWith(
      expect.any(File),
      getJournalDraftMediaOwnerId("entry-existing"),
    );
    expect(storageMocks.discardJournalDraft).toHaveBeenCalledWith({
      draftKey: "journal_draft_entry-existing",
      mediaOwnerId: getJournalDraftMediaOwnerId("entry-existing"),
      writerId: expect.any(String),
    });
    expect(onRemovePhoto).not.toHaveBeenCalledWith("photo-old", "entry-existing");
    expect(storageMocks.deleteDraftMedia).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it("keeps discard open and retryable when staged media cleanup fails", async () => {
    const onAddPhoto = vi.fn(() =>
      Promise.resolve({
        id: "photo-discard-retry",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:image/jpeg;base64,retry",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 100,
        createdAt: Date.now(),
      }),
    );
    const onBack = vi.fn();
    storageMocks.discardJournalDraft
      .mockRejectedValueOnce(new Error("temporary media cleanup failure"))
      .mockResolvedValue(undefined);
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const props = makeProps({ entry: makeExistingEntry(), onAddPhoto, onBack, onRemovePhoto });
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
      result.current.setShowUnsavedDialog(true);
    });

    let firstAttempt: boolean | undefined;
    await act(async () => {
      firstAttempt = await result.current.handleDiscard();
    });
    expect(firstAttempt).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
    expect(result.current.showUnsavedDialog).toBe(true);
    expect(result.current.discardError).toBeTruthy();

    await act(async () => {
      await result.current.handleDiscard();
    });
    expect(storageMocks.discardJournalDraft).toHaveBeenCalledTimes(2);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss a deletion in progress on Escape or Android Back", async () => {
    let finishDelete!: () => void;
    const onDelete = vi.fn(
      () => new Promise<void>((resolve) => {
        finishDelete = resolve;
      }),
    );
    const props = makeProps({ entry: makeExistingEntry(), onDelete });
    const { result } = renderHook(
      () => useJournalEditorState(props),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => result.current.setShowDeleteConfirm(true));
    let deletion!: Promise<boolean>;
    act(() => {
      deletion = result.current.handleDelete();
    });
    await waitFor(() => expect(result.current.deleteSubmitting).toBe(true));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.showDeleteConfirm).toBe(true);

    const androidBack = backHandlerMocks.registerModalCloseCallback.mock.calls.at(-1)?.[0];
    act(() => {
      void androidBack?.();
    });
    expect(result.current.showDeleteConfirm).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(1);

    act(() => finishDelete());
    await expect(deletion).resolves.toBe(true);
    await waitFor(() => expect(result.current.showDeleteConfirm).toBe(false));
  });

  it("does not dismiss a discard in progress on Escape or Android Back", async () => {
    let finishDraftClear!: () => void;
    storageMocks.discardJournalDraft.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishDraftClear = resolve;
      }),
    );
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => result.current.setShowUnsavedDialog(true));
    let discard!: Promise<boolean>;
    act(() => {
      discard = result.current.handleDiscard();
    });
    await waitFor(() => expect(result.current.discardSubmitting).toBe(true));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.showUnsavedDialog).toBe(true);

    const androidBack = backHandlerMocks.registerModalCloseCallback.mock.calls.at(-1)?.[0];
    act(() => {
      void androidBack?.();
    });
    expect(result.current.showUnsavedDialog).toBe(true);
    expect(onBack).not.toHaveBeenCalled();

    act(() => finishDraftClear());
    await expect(discard).resolves.toBe(true);
    await waitFor(() => expect(result.current.showUnsavedDialog).toBe(false));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending autosave after the storage-owned save commit", async () => {
    vi.useFakeTimers();
    try {
      const onSave = vi.fn(() => Promise.resolve());
      const { result } = renderHook(
        () => useJournalEditorState(makeProps({ onSave })),
        { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
      );
      await finishDraftPreflight(result);

      act(() => result.current.setTitle("Saved once"));
      let save!: Promise<void>;
      act(() => {
        save = result.current.handleSave();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await save;
      });

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();
      draftStorageMocks.saveJournalDraft.mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      expect(draftStorageMocks.saveJournalDraft).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not turn a durable save into an error through redundant draft cleanup", async () => {
    vi.useFakeTimers();
    try {
      draftStorageMocks.clearJournalDraft.mockRejectedValueOnce(
        new DOMException("settings unavailable", "UnknownError"),
      );
      const onSave = vi.fn(() => Promise.resolve());
      const { result } = renderHook(
        () => useJournalEditorState(makeProps({ onSave })),
        { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
      );
      await finishDraftPreflight(result);

      act(() => result.current.setTitle("Durably saved"));
      let save!: Promise<void>;
      act(() => {
        save = result.current.handleSave();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await save;
      });

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();
      expect(result.current.saveState).toBe("saved");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps save single-flight and blocks contradictory exits until it settles", async () => {
    let finishSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const onBack = vi.fn();
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onBack, onSave })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => result.current.setTitle("One intentional save"));
    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    act(() => {
      firstSave = result.current.handleSave();
      secondSave = result.current.handleSave();
    });

    await waitFor(() => expect(result.current.saveState).toBe("saving"));
    expect(onSave).toHaveBeenCalledTimes(1);

    act(() => result.current.handleBack());
    expect(result.current.showUnsavedDialog).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
    await expect(result.current.handleDiscard()).resolves.toBe(false);
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();

    act(() => finishSave());
    await act(async () => {
      await Promise.all([firstSave, secondSave]);
    });
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows an error state when the debounced draft write fails", async () => {
    vi.useFakeTimers();
    try {
      draftStorageMocks.saveJournalDraft.mockRejectedValueOnce(
        new DOMException("Storage quota reached", "QuotaExceededError")
      );
      const { result } = renderHook(() => useJournalEditorState(makeProps()), {
        wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
      });
      await finishDraftPreflight(result);

      act(() => result.current.setTitle("Keep this text visible"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.saveState).toBe("error");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not overwrite an unreadable draft and resumes only after a successful retry", async () => {
    vi.useFakeTimers();
    try {
      draftStorageMocks.loadJournalDraft
        .mockRejectedValueOnce(new DOMException("Database unavailable", "UnknownError"))
        .mockResolvedValueOnce(null);
      const { result } = renderHook(() => useJournalEditorState(makeProps()), {
        wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.draftLoadError).toBe(true);
      expect(result.current.draftReady).toBe(false);

      act(() => result.current.setTitle("Must not replace unread draft"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      expect(draftStorageMocks.saveJournalDraft).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.retryDraftLoad();
      });
      expect(result.current.draftLoadError).toBe(false);
      expect(result.current.draftReady).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
        "journal_draft_new",
        expect.objectContaining({ title: "Must not replace unread draft" }),
        expect.any(String),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a second editor locked while another window owns the draft", async () => {
    draftStorageMocks.acquireJournalDraftWriter.mockRejectedValueOnce(
      Object.assign(new Error("Draft is already open"), {
        name: "JournalDraftInUseError",
        code: "JOURNAL_DRAFT_IN_USE",
      }),
    );
    const onSave = vi.fn(() => Promise.resolve());
    const { result } = renderHook(
      () => useJournalEditorState(makeProps({ onSave })),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );

    await waitFor(() => expect(result.current.draftLoadError).toBe(true));
    expect(result.current.draftReady).toBe(false);
    expect(result.current.draftLoadInUse).toBe(true);
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("locks the editor after its draft lease is taken over while backgrounded", async () => {
    const { result } = renderHook(
      () => useJournalEditorState(makeProps()),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);
    draftStorageMocks.touchJournalDraftWriter.mockResolvedValueOnce(false);

    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow"));
    });

    await waitFor(() => expect(result.current.draftLoadError).toBe(true));
    expect(result.current.draftReady).toBe(false);
  });

  it("keeps a stale editor intact and can explicitly retry after the parent refreshes the version", async () => {
    const conflict = Object.assign(new Error("stale editor"), {
      name: "JournalEntryConflictError",
      code: "JOURNAL_ENTRY_CONFLICT",
    });
    const onSave = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(undefined);
    const props = makeProps({ entry: makeExistingEntry(), onSave });
    const { result } = renderHook(
      () => useJournalEditorState(props),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    act(() => result.current.setTitle("My unsaved version"));
    let save!: Promise<void>;
    act(() => {
      save = result.current.handleSave();
    });
    await save;
    await waitFor(() => expect(result.current.saveState).toBe("error"));

    expect(result.current.saveFailureReason).toBe("conflict");
    expect(result.current.title).toBe("My unsaved version");
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();

    act(() => result.current.handleRetry());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(result.current.title).toBe("My unsaved version");
  });

  it("keeps an existing-entry recovery draft until the durable delete commits", async () => {
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
    const onDelete = vi.fn(async () => {
      expect(storageMocks.discardJournalDraft).not.toHaveBeenCalled();
    });
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const props = makeProps({
      entry: makeExistingEntry(),
      onAddPhoto,
      onDelete,
      onRemovePhoto,
    });

    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    });
    await act(async () => {
      await (result.current as typeof result.current & { handleDelete: () => Promise<void> }).handleDelete();
    });

    expect(draftStorageMocks.saveJournalDraft).toHaveBeenCalledWith(
      "journal_draft_entry-existing",
      expect.objectContaining({ photoIds: ["photo-old", "photo-new"] }),
      expect.any(String),
    );
    expect(storageMocks.discardJournalDraft).not.toHaveBeenCalled();
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();
    expect(onRemovePhoto).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("preserves the recovery draft when durable delete staging fails before cleanup", async () => {
    const onAddPhoto = vi.fn(() =>
      Promise.resolve({
        id: "photo-retry",
        entryId: JOURNAL_DRAFT_ENTRY_ID,
        data: "data:image/jpeg;base64,retry",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 100,
        createdAt: Date.now(),
      }),
    );
    let deleteAttempt = 0;
    const onDelete = vi.fn(async () => {
      deleteAttempt += 1;
      if (deleteAttempt === 1) throw new Error("durable delete staging failed");
    });
    const onRemovePhoto = vi.fn(() => Promise.resolve());
    const props = makeProps({
      entry: makeExistingEntry(),
      onAddPhoto,
      onDelete,
      onRemovePhoto,
    });
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleAddPhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
    });

    let firstAttempt: boolean | undefined;
    await act(async () => {
      firstAttempt = await (result.current as typeof result.current & {
        handleDelete: () => Promise<boolean>;
      }).handleDelete();
    });
    expect(firstAttempt).toBe(false);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(storageMocks.discardJournalDraft).not.toHaveBeenCalled();
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();

    let retryAttempt: boolean | undefined;
    await act(async () => {
      retryAttempt = await (result.current as typeof result.current & {
        handleDelete: () => Promise<boolean>;
      }).handleDelete();
    });
    expect(retryAttempt).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(storageMocks.discardJournalDraft).not.toHaveBeenCalled();
    expect(onRemovePhoto).not.toHaveBeenCalled();
  });

  it("keeps the delete dialog and recovery draft when durable staging reports failure", async () => {
    const onDelete = vi.fn(async () => false);
    const props = makeProps({
      entry: makeExistingEntry(),
      onDelete,
    });
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    act(() => result.current.setShowDeleteConfirm(true));

    let deleteResult: boolean | undefined;
    await act(async () => {
      deleteResult = await result.current.handleDelete();
    });

    expect(deleteResult).toBe(false);
    expect(result.current.showDeleteConfirm).toBe(true);
    expect(result.current.deleteError).toBeTruthy();
    expect(storageMocks.discardJournalDraft).not.toHaveBeenCalled();
    expect(draftStorageMocks.clearJournalDraft).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("surfaces and retries existing audio load failures", async () => {
    storageMocks.getAudioForEntry
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([
        {
          id: "audio-old",
          entryId: "entry-existing",
          data: "data:audio/webm;base64,dm9pY2U=",
          duration: 12,
          mimeType: "audio/webm",
          createdAt: 1,
        },
      ]);
    const props = makeProps({ entry: makeExistingEntry() });
    const { result } = renderHook(
      () => useJournalEditorState(props),
      { wrapper: ({ children }: { children: ReactNode }) => <>{children}</> },
    );
    await finishDraftPreflight(result);

    await waitFor(() =>
      expect(result.current.audioError).toBe("This entry's audio could not be loaded."),
    );
    expect(result.current.audioLoadRetryAvailable).toBe(true);

    act(() => result.current.retryAudioLoad());

    await waitFor(() => expect(result.current.audioRecordings).toHaveLength(1));
    expect(result.current.audioError).toBeNull();
    expect(result.current.audioLoadRetryAvailable).toBe(false);
    expect(storageMocks.getAudioForEntry).toHaveBeenCalledTimes(2);
  });

  it("keeps a recording visible and reports when removal fails", async () => {
    const onAddAudio = vi.fn(() =>
      Promise.resolve({
        id: "audio-new",
        entryId: getJournalDraftMediaOwnerId("entry-existing"),
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 1,
        mimeType: "audio/webm",
        createdAt: 2,
      }),
    );
    const onRemoveAudio = vi.fn(() => Promise.reject(new Error("storage busy")));
    const props = makeProps({
      entry: makeExistingEntry({ audioIds: [] }),
      onAddAudio,
      onRemoveAudio,
    });
    const { result } = renderHook(() => useJournalEditorState(props), {
      wrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    });
    await finishDraftPreflight(result);

    await act(async () => {
      await result.current.handleStartRecording();
    });
    await waitFor(() => expect(result.current.recorder.isRecording).toBe(true));
    act(() => result.current.handleStopRecording());
    await waitFor(() => expect(result.current.audioIds).toContain("audio-new"));

    await act(async () => {
      await result.current.handleRemoveAudio("audio-new");
    });

    expect(result.current.audioIds).toContain("audio-new");
    expect(result.current.audioRecordings.map((audio) => audio.id)).toContain("audio-new");
    expect(result.current.audioError).toBe("This recording could not be removed.");
    expect(onRemoveAudio).toHaveBeenCalledWith(
      "audio-new",
      getJournalDraftMediaOwnerId("entry-existing"),
    );
  });

  it("delegates existing-entry staged media to the atomic entry save boundary", async () => {
    const draftMediaOwnerId = getJournalDraftMediaOwnerId("entry-existing");
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
    await finishDraftPreflight(result);

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
      draftMediaOwnerId,
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        audioIds: ["audio-recorded"],
        photoIds: ["photo-new"],
      }),
      {
        draftKey: "journal_draft_entry-existing",
        mediaOwnerId: draftMediaOwnerId,
        writerId: expect.any(String),
      },
    );
    expect(storageMocks.commitDraftMediaToEntry).not.toHaveBeenCalled();
    expect(onAddPhoto).toHaveBeenCalledWith(expect.any(File), draftMediaOwnerId);
    expect(onRemovePhoto).not.toHaveBeenCalled();
    expect(onRemoveAudio).not.toHaveBeenCalled();
  });
});
