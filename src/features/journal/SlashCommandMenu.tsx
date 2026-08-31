import { memo, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { Mic } from "lucide-react";

interface SlashCommandMenuProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onCommand: (cmd: string) => void;
  onClose: () => void;
  disabledCommandIds?: ReadonlySet<CommandId>;
}

const COMMANDS = [
  {
    id: "mood",
    icon: "\u{1F60A}",
    labelKey: "journalSlashMoodLabel",
    descriptionKey: "journalSlashMoodDescription",
    fallbackLabel: "Mood",
    fallbackDescription: "Set entry mood",
  },
  {
    id: "heading",
    icon: "H",
    labelKey: "journalSlashHeadingLabel",
    descriptionKey: "journalSlashHeadingDescription",
    fallbackLabel: "Heading",
    fallbackDescription: "Insert a heading",
  },
  {
    id: "quote",
    icon: "\u275D",
    labelKey: "journalSlashQuoteLabel",
    descriptionKey: "journalSlashQuoteDescription",
    fallbackLabel: "Quote",
    fallbackDescription: "Insert a quote block",
  },
  {
    id: "checklist",
    icon: "\u2611",
    labelKey: "journalSlashChecklistLabel",
    descriptionKey: "journalSlashChecklistDescription",
    fallbackLabel: "Checklist",
    fallbackDescription: "Insert a checklist",
  },
  {
    id: "breathe",
    icon: "\u{1F9D8}",
    labelKey: "journalSlashBreatheLabel",
    descriptionKey: "journalSlashBreatheDescription",
    fallbackLabel: "Breathe",
    fallbackDescription: "Open a breathing exercise",
  },
  {
    id: "gratitude",
    icon: "\u{1F331}",
    labelKey: "journalSlashGratitudeLabel",
    descriptionKey: "journalSlashGratitudeDescription",
    fallbackLabel: "Gratitude",
    fallbackDescription: "Add a gratitude prompt",
  },
  {
    id: "burn",
    icon: "\u{1F525}",
    labelKey: "journalSlashBurnLabel",
    descriptionKey: "journalSlashBurnDescription",
    fallbackLabel: "Release",
    fallbackDescription: "Let go of a thought",
  },
  {
    id: "focus",
    icon: "\u270D\uFE0F",
    labelKey: "journalSlashFocusLabel",
    descriptionKey: "journalSlashFocusDescription",
    fallbackLabel: "Focus",
    fallbackDescription: "Open focused writing mode",
  },
  {
    id: "template",
    icon: "\u{1F4CB}",
    labelKey: "journalSlashTemplateLabel",
    descriptionKey: "journalSlashTemplateDescription",
    fallbackLabel: "Template",
    fallbackDescription: "Choose a diary template",
  },
  {
    id: "photo",
    icon: "\u{1F4F8}",
    labelKey: "journalSlashPhotoLabel",
    descriptionKey: "journalSlashPhotoDescription",
    fallbackLabel: "Photo",
    fallbackDescription: "Attach a photo",
  },
  {
    id: "audio",
    icon: null,
    labelKey: "journalSlashAudioLabel",
    descriptionKey: "journalSlashAudioDescription",
    fallbackLabel: "Audio",
    fallbackDescription: "Record audio",
  },
] as const;

export type CommandId = (typeof COMMANDS)[number]["id"];

const SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };
const INSTANT = { duration: 0 };

const menuVariants = {
  hidden: { opacity: 0, y: 4, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.95 },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: shouldAnimate() ? { delay: i * 0.02 } : INSTANT,
  }),
};

export const SlashCommandMenu = memo(function SlashCommandMenu({
  editorRef,
  onCommand,
  onClose,
  disabledCommandIds = new Set<CommandId>(),
}: SlashCommandMenuProps) {
  const { t } = useLanguage();
  const ts = t;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const slashRangeRef = useRef<{ node: Node; offset: number } | null>(null);

  const localizedCommands = useMemo(
    () =>
      COMMANDS.map((cmd) => ({
        ...cmd,
        label: ts[cmd.labelKey] || cmd.fallbackLabel,
        description: ts[cmd.descriptionKey] || cmd.fallbackDescription,
      })),
    [ts]
  );

  const filtered = localizedCommands.filter((cmd) => {
    if (disabledCommandIds.has(cmd.id)) return false;
    const normalizedFilter = filter.toLocaleLowerCase();
    return (
      cmd.label.toLocaleLowerCase().includes(normalizedFilter) ||
      cmd.id.toLocaleLowerCase().includes(normalizedFilter)
    );
  });

  const close = useCallback(() => {
    setOpen(false);
    setFilter("");
    setSelectedIndex(0);
    slashRangeRef.current = null;
    onClose();
  }, [onClose]);

  useBackHandler(open, close);

  const executeCommand = useCallback(
    (id: CommandId | string) => {
      const editor = editorRef.current;
      if (editor && slashRangeRef.current) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = document.createRange();
          range.setStart(slashRangeRef.current.node, slashRangeRef.current.offset);
          range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
          range.deleteContents();
        }
      }
      void hapticTap();
      onCommand(id);
      close();
    },
    [editorRef, onCommand, close]
  );

  // Viewport-clamped position update
  const updatePosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    requestAnimationFrame(() => {
      const menuW = 220;
      const menuH = 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (left + menuW > vw - 8) left = vw - menuW - 8;
      if (left < 8) left = 8;
      if (top + menuH > vh - 8) top = rect.top - menuH - 4;
      setPosition({ top, left });
    });
  }, []);

  // IME composition guard
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onStart = () => {
      composingRef.current = true;
    };
    const onEnd = () => {
      composingRef.current = false;
    };
    editor.addEventListener("compositionstart", onStart);
    editor.addEventListener("compositionend", onEnd);
    return () => {
      editor.removeEventListener("compositionstart", onStart);
      editor.removeEventListener("compositionend", onEnd);
    };
  }, [editorRef]);

  // Listen for input events on the editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleInput = (e: Event) => {
      if (composingRef.current) return;
      const inputEvent = e as InputEvent;
      if (inputEvent.inputType === "insertFromPaste" || inputEvent.inputType === "insertFromDrop")
        return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const text = editor.textContent ?? "";
      const cursorOffset = getCursorOffset(editor, range);
      const textBeforeCursor = text.slice(0, cursorOffset);
      const lastSlash = textBeforeCursor.lastIndexOf("/");

      if (
        lastSlash === -1 ||
        (lastSlash > 0 && text[lastSlash - 1] !== " " && text[lastSlash - 1] !== "\n")
      ) {
        if (open) close();
        return;
      }

      const typed = textBeforeCursor.slice(lastSlash + 1);
      if (typed.includes(" ")) {
        if (open) close();
        return;
      }

      // Store slash position as node+offset for Range-based deletion
      if (!open) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        let node: Text | null = null;
        while (walker.nextNode()) {
          node = walker.currentNode as Text;
          if (charCount + node.length > lastSlash) {
            slashRangeRef.current = { node, offset: lastSlash - charCount };
            break;
          }
          charCount += node.length;
        }
      }

      setFilter(typed);
      setSelectedIndex(0);
      updatePosition();
      if (!open) setOpen(true);
    };

    editor.addEventListener("input", handleInput);
    return () => editor.removeEventListener("input", handleInput);
  }, [editorRef, open, close, updatePosition]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) executeCommand(cmd.id);
        return;
      }
      if (e.key === "Backspace") {
        requestAnimationFrame(() => {
          const text = editorRef.current?.textContent ?? "";
          if (!slashRangeRef.current) {
            close();
            return;
          }
          const node = slashRangeRef.current.node;
          const offset = slashRangeRef.current.offset;
          if (!node.parentNode || (node.textContent?.charAt(offset) ?? "") !== "/") close();
          else {
            const cursorText = text.slice(
              0,
              getCursorOffsetFromEditor(editorRef.current!, window.getSelection())
            );
            if (!cursorText.includes("/")) close();
          }
        });
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, filtered, selectedIndex, close, executeCommand, editorRef]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  // Scroll dismiss
  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    const scrollParent = editor?.closest("[class*='overflow']") ?? editor?.parentElement;
    if (!scrollParent) return;
    const onScroll = () => close();
    scrollParent.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollParent.removeEventListener("scroll", onScroll);
  }, [open, editorRef, close]);

  const animate = shouldAnimate();
  const slashListboxId = "journal-slash-command-listbox";
  const activeId = filtered[selectedIndex] ? `slash-cmd-${filtered[selectedIndex].id}` : undefined;

  useEffect(() => {
    if (!open || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, open]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!open) {
      editor.removeAttribute("aria-controls");
      editor.removeAttribute("aria-activedescendant");
      editor.removeAttribute("aria-expanded");
      editor.removeAttribute("aria-haspopup");
      editor.removeAttribute("aria-autocomplete");
      return;
    }

    editor.setAttribute("aria-controls", slashListboxId);
    editor.setAttribute("aria-expanded", "true");
    editor.setAttribute("aria-haspopup", "listbox");
    editor.setAttribute("aria-autocomplete", "list");
    if (activeId) {
      editor.setAttribute("aria-activedescendant", activeId);
    } else {
      editor.removeAttribute("aria-activedescendant");
    }

    return () => {
      editor.removeAttribute("aria-controls");
      editor.removeAttribute("aria-activedescendant");
      editor.removeAttribute("aria-expanded");
      editor.removeAttribute("aria-haspopup");
      editor.removeAttribute("aria-autocomplete");
    };
  }, [activeId, editorRef, open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          id={slashListboxId}
          role="listbox"
          aria-label={ts.journalSlashCommands || "Diary commands"}
          aria-activedescendant={activeId}
          className="fixed z-[90] max-h-[280px] w-[min(calc(100vw-1rem),20rem)] min-w-0 overflow-y-auto rounded-2xl border border-border/30 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]"
          style={{ top: position.top, left: position.left }}
          variants={menuVariants}
          initial={animate ? "hidden" : false}
          animate="visible"
          exit="exit"
          transition={animate ? SPRING : INSTANT}
        >
          {filtered.length > 0 ? (
            filtered.map((cmd, i) => (
              <motion.div
                key={cmd.id}
                id={`slash-cmd-${cmd.id}`}
                role="option"
                aria-selected={i === selectedIndex}
                custom={i}
                variants={itemVariants}
                initial={animate ? "hidden" : false}
                animate="visible"
                className={cn(
                  "flex min-h-[44px] items-start gap-3 rounded-xl px-3 py-2 text-sm cursor-pointer motion-safe:transition-colors",
                  i === selectedIndex && "bg-primary/10"
                )}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  executeCommand(cmd.id);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-base shrink-0">
                  {cmd.id === "audio" ? (
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  ) : cmd.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words font-medium text-foreground [overflow-wrap:break-word]">
                    {cmd.label}
                  </span>
                  <span className="break-words text-xs text-muted-foreground [overflow-wrap:break-word]">
                    {cmd.description}
                  </span>
                </span>
              </motion.div>
            ))
          ) : (
            <div role="status" className="px-3 py-3 text-sm text-muted-foreground">
              {ts.journalSlashNoResults || "No diary commands found"}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});

function getCursorOffset(container: Node, range: Range): number {
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function getCursorOffsetFromEditor(editor: HTMLDivElement, sel: Selection | null): number {
  if (!sel || sel.rangeCount === 0) return 0;
  return getCursorOffset(editor, sel.getRangeAt(0));
}
