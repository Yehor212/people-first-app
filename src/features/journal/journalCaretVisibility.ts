/** Keep the focused line inside the editor, without scrolling its native shell. */
export function observeJournalCaretVisibility(scrollArea: HTMLElement, owner: string): () => void {
  const shell = scrollArea.closest<HTMLElement>('[data-testid="journal-entry-editor"][role="dialog"]');
  let frame: number | null = null;
  let disposed = false;

  const reveal = () => {
    frame = null;
    if (disposed || !scrollArea.isConnected ||
        document.documentElement.dataset.journalKeyboardViewport !== owner) return;
    if (shell) {
      const overlap = Number.parseFloat(getComputedStyle(shell).paddingBottom) || 0;
      // A docked landscape IME can leave only 123px: two fixed toolbars would
      // cover the line even after scrolling. Keep the same actions in one row.
      const compact = overlap > 0 && shell.clientWidth >= 600 && shell.clientHeight - overlap < 240;
      if (compact && shell.dataset.journalKeyboardCompact !== owner) shell.dataset.journalKeyboardCompact = owner;
      else if (!compact && shell.dataset.journalKeyboardCompact === owner) delete shell.dataset.journalKeyboardCompact;
    }
    const field = document.activeElement;
    if (!(field instanceof HTMLElement) || !scrollArea.contains(field) ||
        !field.matches('input[type="text"], textarea, [contenteditable="true"]')) return;

    const visible = scrollArea.getBoundingClientRect();
    if (visible.height <= 0) return;
    let target = field.getBoundingClientRect();
    if (field.getAttribute("contenteditable") === "true") {
      const selection = document.getSelection();
      let caret: DOMRect | undefined;
      if (selection?.focusNode && field.contains(selection.focusNode)) {
        const range = document.createRange();
        range.setStart(selection.focusNode, selection.focusOffset);
        range.collapse(true);
        caret = Array.from(range.getClientRects()).find(rect => rect.height > 0);
      }
      // Enter can leave the caret in an empty <div><br></div>: its range has
      // no rectangle, but that paragraph still has a real line box.
      const focusElement = selection?.focusNode instanceof HTMLElement && field.contains(selection.focusNode)
        ? selection.focusNode : field;
      const emptyLine = focusElement.getBoundingClientRect();
      if (!caret && emptyLine.height > 0) target = emptyLine;
      const lineHeight = Number.parseFloat(getComputedStyle(field).lineHeight) || 24;
      target = caret ?? new DOMRect(target.x, target.y, target.width, lineHeight);
    }

    const margin = Math.min(8, visible.height / 4);
    const top = visible.top + margin;
    const bottom = visible.bottom - margin;
    const delta = target.top < top ? target.top - top
      : target.bottom > bottom ? target.bottom - bottom : 0;
    if (Math.abs(delta) > 0.5) {
      scrollArea.scrollTop = Math.max(0, Math.min(
        scrollArea.scrollHeight - scrollArea.clientHeight,
        scrollArea.scrollTop + delta,
      ));
    }
  };

  const schedule = () => {
    if (!disposed && frame === null) frame = window.requestAnimationFrame(reveal);
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(scrollArea);
  if (shell) observer?.observe(shell);
  scrollArea.addEventListener("focusin", schedule);
  scrollArea.addEventListener("input", schedule);
  document.addEventListener("selectionchange", schedule);
  window.addEventListener("resize", schedule);
  schedule();

  return () => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    observer?.disconnect();
    scrollArea.removeEventListener("focusin", schedule);
    scrollArea.removeEventListener("input", schedule);
    document.removeEventListener("selectionchange", schedule);
    window.removeEventListener("resize", schedule);
    if (shell?.dataset.journalKeyboardCompact === owner) delete shell.dataset.journalKeyboardCompact;
  };
}
