export const DIARY_OPEN_EDITOR_EVENT = "zenflow-open-journal-editor";

let pendingDiaryEditorOpen = false;

export function requestDiaryEditorOpen(): void {
  pendingDiaryEditorOpen = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DIARY_OPEN_EDITOR_EVENT));
}

export function consumePendingDiaryEditorOpen(): boolean {
  if (!pendingDiaryEditorOpen) return false;
  pendingDiaryEditorOpen = false;
  return true;
}

export function subscribeToDiaryEditorOpen(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => {
    pendingDiaryEditorOpen = false;
    callback();
  };

  window.addEventListener(DIARY_OPEN_EDITOR_EVENT, handler);
  return () => window.removeEventListener(DIARY_OPEN_EDITOR_EVENT, handler);
}
