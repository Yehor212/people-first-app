import { memo, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { shouldAnimate } from "@/lib/animationUtils";
import { hapticTap } from "@/lib/haptics";

interface SlashCommandMenuProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onCommand: (cmd: string) => void;
  onClose: () => void;
}

const COMMANDS = [
  { id: "mood", icon: "\u{1F60A}", label: "Mood", description: "Set entry mood" },
  { id: "heading", icon: "H", label: "Heading", description: "Insert heading" },
  { id: "quote", icon: "\u275D", label: "Quote", description: "Insert blockquote" },
  { id: "checklist", icon: "\u2611", label: "Checklist", description: "Insert checklist" },
  { id: "breathe", icon: "\u{1F9D8}", label: "Breathe", description: "Breathing exercise" },
  { id: "gratitude", icon: "\u{1F331}", label: "Gratitude", description: "Gratitude prompt" },
  { id: "burn", icon: "\u{1F525}", label: "Burn", description: "Burn a thought" },
  { id: "focus", icon: "\u270D\uFE0F", label: "Focus", description: "Zen focus mode" },
  { id: "template", icon: "\u{1F4CB}", label: "Template", description: "Pick template" },
  { id: "photo", icon: "\u{1F4F8}", label: "Photo", description: "Attach photo" },
  { id: "audio", icon: "\u{1F3A4}", label: "Audio", description: "Record audio" },
] as const;

type CommandId = (typeof COMMANDS)[number]["id"];

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
}: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const slashRangeRef = useRef<{ node: Node; offset: number } | null>(null);

  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.id.toLowerCase().includes(filter.toLowerCase()),
  );

  const close = useCallback(() => {
    setOpen(false);
    setFilter("");
    setSelectedIndex(0);
    slashRangeRef.current = null;
    onClose();
  }, [onClose]);

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
    [editorRef, onCommand, close],
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
    const onStart = () => { composingRef.current = true; };
    const onEnd = () => { composingRef.current = false; };
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
      if (inputEvent.inputType === "insertFromPaste" || inputEvent.inputType === "insertFromDrop") return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const text = editor.textContent ?? "";
      const cursorOffset = getCursorOffset(editor, range);
      const textBeforeCursor = text.slice(0, cursorOffset);
      const lastSlash = textBeforeCursor.lastIndexOf("/");

      if (lastSlash === -1 || (lastSlash > 0 && text[lastSlash - 1] !== " " && text[lastSlash - 1] !== "\n")) {
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
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter") { e.preventDefault(); const cmd = filtered[selectedIndex]; if (cmd) executeCommand(cmd.id); return; }
      if (e.key === "Backspace") {
        requestAnimationFrame(() => {
          const text = editorRef.current?.textContent ?? "";
          if (!slashRangeRef.current) { close(); return; }
          const node = slashRangeRef.current.node;
          const offset = slashRangeRef.current.offset;
          if (!node.parentNode || (node.textContent?.charAt(offset) ?? "") !== "/") close();
          else {
            const cursorText = text.slice(0, getCursorOffsetFromEditor(editorRef.current!, window.getSelection()));
            if (!cursorText.includes("/")) close();
          }
        });
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, filtered, selectedIndex, close, executeCommand, editorRef]);

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
  const activeId = filtered[selectedIndex] ? `slash-cmd-${filtered[selectedIndex].id}` : undefined;

  return createPortal(
    <AnimatePresence>
      {open && filtered.length > 0 && (
        <motion.div
          ref={menuRef}
          role="listbox"
          aria-label="Slash commands"
          aria-activedescendant={activeId}
          className="fixed bg-popover/95 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] rounded-2xl border border-border/30 shadow-2xl p-1.5 min-w-[200px] max-h-[280px] overflow-y-auto z-[90]"
          style={{ top: position.top, left: position.left }}
          variants={menuVariants}
          initial={animate ? "hidden" : false}
          animate="visible"
          exit="exit"
          transition={animate ? SPRING : INSTANT}
        >
          {filtered.map((cmd, i) => (
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
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm cursor-pointer min-h-[44px] transition-colors",
                i === selectedIndex && "bg-primary/10",
              )}
              onClick={() => executeCommand(cmd.id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-base shrink-0">
                {cmd.icon}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-medium text-foreground">{cmd.label}</span>
                <span className="text-xs text-muted-foreground truncate">{cmd.description}</span>
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
