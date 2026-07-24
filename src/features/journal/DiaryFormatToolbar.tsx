/**
 * DiaryFormatToolbar — Telegram-style floating WYSIWYG toolbar.
 *
 * Appears above the text selection when user selects text inside the
 * contentEditable editor. Uses document.execCommand for formatting.
 * Hides when selection is cleared or moves outside the editor.
 *
 * T1: Portal rendering + entrance/exit animation + viewport clamping + z-[80]
 * T2: Debounced selection detection + scroll-dismiss + tap-outside dismiss
 * T3: Haptic feedback on format actions + button pulse animation
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";

interface DiaryFormatToolbarProps {
  editorRef: React.RefObject<HTMLDivElement>;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  onContentChange?: () => void;
}

const FORMAT_ACTIONS = [
  { cmd: "bold", icon: "B", style: "font-bold", labelKey: "journalFormatBold" },
  { cmd: "italic", icon: "I", style: "italic", labelKey: "journalFormatItalic" },
  { cmd: "underline", icon: "U", style: "underline", labelKey: "journalFormatUnderline" },
  {
    cmd: "strikeThrough",
    icon: "S",
    style: "line-through",
    labelKey: "journalFormatStrikethrough",
  },
  { cmd: "formatBlock:blockquote", icon: "\u275D", style: "", labelKey: "journalFormatQuote" },
  {
    cmd: "insertHTML:<code>",
    icon: "</>",
    style: "font-mono text-xs",
    labelKey: "journalFormatCode",
  },
  { cmd: "createLink", icon: "\uD83D\uDD17", style: "", labelKey: "journalFormatLink" },
] as const;

const VIEWPORT_PADDING = 8;
const ARROW_OFFSET = 8;
const TOP_SAFE_ZONE = 150; // top glass toolbar height + safe margin
const BOTTOM_SAFE_ZONE = 80; // bottom glass toolbar height + safe margin
const SELECTION_DEBOUNCE_MS = 100;
const REPOSITION_DELAY_MS = 60;

/** Animation variants gated by shouldAnimate() — spring physics (Telegram-style) */
const getMotionProps = () => {
  const animate = shouldAnimate();
  return {
    initial: animate ? { opacity: 0, y: 6, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: animate ? { opacity: 0, y: 4, scale: 0.97 } : { opacity: 0 },
    transition: animate
      ? { type: "spring" as const, stiffness: 500, damping: 30 }
      : { duration: 0 },
  };
};

export const DiaryFormatToolbar = memo(function DiaryFormatToolbar({
  editorRef,
  scrollContainerRef,
  onContentChange,
}: DiaryFormatToolbarProps) {
  const { t, isRTL } = useLanguage();
  const ts = t;
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const [pulsingBtn, setPulsingBtn] = useState<string | null>(null);
  const [toolbarTabStopIndex, setToolbarTabStopIndex] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repositionRafRef = useRef<number | null>(null);

  // --- Active format detection ---
  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    try {
      if (document.queryCommandState("bold")) formats.add("bold");
      if (document.queryCommandState("italic")) formats.add("italic");
      if (document.queryCommandState("underline")) formats.add("underline");
      if (document.queryCommandState("strikeThrough")) formats.add("strikeThrough");

      const sel = window.getSelection();
      const node = sel?.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
      const element = node instanceof Element ? node : (node?.parentElement ?? null);
      if (element?.closest("blockquote")) formats.add("formatBlock:blockquote");
      if (element?.closest("code")) formats.add("insertHTML:<code>");
      if (element?.closest("a[href]")) formats.add("createLink");
    } catch {
      // queryCommandState may fail in some contexts
    }
    setActiveFormats(formats);
  }, []);

  // --- Selection tracking (T2: debounced 100ms) ---
  const updateSelectionImmediate = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const editorEl = editorRef.current;
    if (!editorEl || !editorEl.contains(range.commonAncestorContainer)) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    setSelectionRect(rect);
    setVisible(true);
    checkActiveFormats();
  }, [editorRef, checkActiveFormats]);

  // Debounced wrapper — prevents flicker during rapid selection changes
  const updateSelectionDebounced = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(updateSelectionImmediate, SELECTION_DEBOUNCE_MS);
  }, [updateSelectionImmediate]);

  // T2: Reposition while toolbar is visible (60ms spring delay via rAF)
  const repositionToolbar = useCallback(() => {
    if (repositionRafRef.current) cancelAnimationFrame(repositionRafRef.current);
    repositionRafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSelectionRect(rect);
          checkActiveFormats();
        }
      }, REPOSITION_DELAY_MS);
    });
  }, [checkActiveFormats]);

  // Listen for selection changes (T2: debounced)
  useEffect(() => {
    const onSelectionChange = () => {
      if (visible) {
        // Toolbar already showing — reposition with spring delay
        repositionToolbar();
      } else {
        // Toolbar hidden — debounce before showing
        updateSelectionDebounced();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (repositionRafRef.current) cancelAnimationFrame(repositionRafRef.current);
    };
  }, [visible, updateSelectionDebounced, repositionToolbar]);

  // Mobile: also catch touchend (selection may finalize after touch handles released)
  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    const onTouchEnd = () => {
      setTimeout(updateSelectionImmediate, 50);
    };
    editorEl.addEventListener("touchend", onTouchEnd);
    return () => editorEl.removeEventListener("touchend", onTouchEnd);
  }, [editorRef, updateSelectionImmediate]);

  // T2: Scroll dismiss — immediate unmount (no animation)
  useEffect(() => {
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) return;
    const onScroll = () => {
      if (!visible) return;
      // Immediate dismiss on scroll
      setVisible(false);
      setSelectionRect(null);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, visible]);

  // T2: Tap-outside dismiss — 100ms fade via AnimatePresence exit
  useEffect(() => {
    if (!visible) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const toolbar = toolbarRef.current;
      const editor = editorRef.current;
      // Dismiss if click is outside both toolbar and editor
      if (toolbar && !toolbar.contains(target) && editor && !editor.contains(target)) {
        setVisible(false);
        setSelectionRect(null);
      }
    };
    // Use a microtask delay to avoid catching the same pointer event that opened the toolbar
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [visible, editorRef]);

  // --- Positioning (T1: viewport clamping) ---
  const getPosition = useCallback((): React.CSSProperties => {
    if (!selectionRect || !toolbarRef.current) return {};

    const tbH = toolbarRef.current.offsetHeight;
    const tbW = toolbarRef.current.offsetWidth;

    // Prefer above selection, but respect top glass toolbar
    let top = selectionRect.top - tbH - ARROW_OFFSET;
    if (top < TOP_SAFE_ZONE) {
      // Flip below selection if near top
      top = selectionRect.bottom + ARROW_OFFSET;
    }
    // T1: Clamp top to viewport (8px padding)
    top = Math.max(VIEWPORT_PADDING, top);
    // Clamp: do not overlap bottom glass toolbar
    if (top + tbH > window.innerHeight - BOTTOM_SAFE_ZONE) {
      top = window.innerHeight - tbH - BOTTOM_SAFE_ZONE;
    }

    // T1: Center horizontally on selection with viewport clamping
    let left = selectionRect.left + selectionRect.width / 2 - tbW / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tbW - VIEWPORT_PADDING));

    return {
      position: "fixed" as const,
      top: `${top}px`,
      left: `${left}px`,
    };
  }, [selectionRect]);

  // --- Format execution (T3: haptic feedback) ---
  const execFormat = useCallback(
    (cmd: string) => {
      // T3: Haptic feedback on every format action
      void hapticTap();

      if (cmd === "createLink") {
        const url = prompt(ts.diaryFormatLinkPrompt || "URL:");
        if (url) {
          try {
            const parsed = new URL(url);
            if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
              document.execCommand("createLink", false, url);
            }
          } catch {
            // Invalid URL — ignore
          }
        }
      } else if (cmd === "insertHTML:<code>") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const parent = range.commonAncestorContainer.parentElement;
          if (parent?.tagName === "CODE") {
            const text = parent.textContent || "";
            parent.replaceWith(text);
          } else {
            const selectedText = range.toString();
            if (selectedText) {
              const escaped = selectedText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              document.execCommand("insertHTML", false, `<code>${escaped}</code>`);
            }
          }
        }
      } else if (cmd.startsWith("formatBlock:")) {
        document.execCommand("formatBlock", false, cmd.split(":")[1]);
      } else {
        document.execCommand(cmd, false);
      }

      onContentChange?.();

      // T3: Button pulse animation feedback
      setPulsingBtn(cmd);
      setTimeout(() => setPulsingBtn(null), 150);

      editorRef.current?.focus();
      checkActiveFormats();
      // Re-read position after formatting (selection may shift)
      setTimeout(updateSelectionImmediate, 0);
    },
    [editorRef, checkActiveFormats, updateSelectionImmediate, ts, onContentChange]
  );

  const handleToolbarKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const buttons = Array.from(
        toolbarRef.current?.querySelectorAll<HTMLButtonElement>("[data-format-action]") ?? [],
      );
      if (buttons.length === 0) return;

      const focusedIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const currentIndex = focusedIndex >= 0 ? focusedIndex : toolbarTabStopIndex;
      let nextIndex = currentIndex;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = buttons.length - 1;
      else {
        const visualStep = event.key === "ArrowRight" ? 1 : -1;
        const domStep = isRTL ? -visualStep : visualStep;
        nextIndex = (currentIndex + domStep + buttons.length) % buttons.length;
      }

      event.preventDefault();
      event.stopPropagation();
      setToolbarTabStopIndex(nextIndex);
      buttons[nextIndex].focus();
    },
    [isRTL, toolbarTabStopIndex],
  );

  // T1: Render via createPortal to escape transform ancestors
  const toolbar = (
    <AnimatePresence>
      {visible && selectionRect && (
        <motion.div
          ref={toolbarRef}
          {...getMotionProps()}
          style={getPosition()}
          role="toolbar"
          aria-label={ts.journalFormatToolbar || "Formatting tools"}
          className="z-[80] flex items-center gap-1 bg-popover/90 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] p-1.5 rounded-2xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.5)] gpu-layer"
          onPointerDown={(e) => e.preventDefault()}
          onKeyDown={handleToolbarKeyDown}
        >
          {FORMAT_ACTIONS.map((action, index) => {
            const isActive = activeFormats.has(action.cmd);
            const isPulsing = pulsingBtn === action.cmd;
            return (
              <motion.button
                key={action.cmd}
                whileTap={shouldAnimate() ? { scale: 0.85 } : undefined}
                whileHover={shouldAnimate() ? { scale: 1.05 } : undefined}
                animate={isPulsing && shouldAnimate() ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                onClick={() => execFormat(action.cmd)}
                onFocus={() => setToolbarTabStopIndex(index)}
                tabIndex={index === toolbarTabStopIndex ? 0 : -1}
                data-format-action={action.cmd}
                className={cn(
                  "min-w-[48px] min-h-[48px] h-12 w-12 rounded-xl flex items-center justify-center text-xs motion-safe:transition-colors",
                  action.style,
                  isActive
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40 shadow-[0_0_8px_rgba(var(--primary-rgb),0.15)]"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
                aria-label={ts[action.labelKey] || action.icon}
                aria-pressed={isActive}
              >
                {action.icon}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // T1: Portal to document.body to escape CSS containment
  return createPortal(toolbar, document.body);
});
