import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/config/animations";
import { useLanguage } from "@/contexts/LanguageContext";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "Cmd" : "Ctrl";

const SHORTCUT_GROUPS = [
  {
    category: "Navigation",
    items: [
      { keys: [`${mod}+\\`], label: "Toggle sidebar" },
      { keys: [`${mod}+Shift+\\`], label: "Compact/hidden toggle" },
      { keys: ["Escape"], label: "Close / go back" },
    ],
  },
  {
    category: "Editor",
    items: [
      { keys: [`${mod}+B`], label: "Bold" },
      { keys: [`${mod}+I`], label: "Italic" },
      { keys: [`${mod}+U`], label: "Underline" },
      { keys: ["/"], label: "Slash commands" },
    ],
  },
  {
    category: "View",
    items: [
      { keys: [`${mod}+S`], label: "Save entry" },
      { keys: ["?"], label: "Show shortcuts" },
    ],
  },
] as const;

const Kbd = ({ children }: { children: string }) => (
  <kbd className="bg-muted rounded-md px-1.5 py-0.5 text-[11px] font-mono text-foreground/80">
    {children}
  </kbd>
);

export const KeyboardShortcutsOverlay = memo(function KeyboardShortcutsOverlay({
  open,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  const prefersReduced = useReducedMotion();
  const { t } = useLanguage();
  const returnRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      returnRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => panelRef.current?.focus());
    } else {
      returnRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [open, onClose]);

  const motionProps = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1, transition: springs.quick },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
            initial={prefersReduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Keyboard shortcuts"
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              "fixed inset-0 z-[60] overflow-y-auto outline-none",
              "md:mx-auto md:my-6 md:max-w-md md:rounded-2xl md:shadow-2xl",
              "bg-popover/95 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]",
            )}
            {...motionProps}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {t.settings?.title ? "Keyboard Shortcuts" : "Keyboard Shortcuts"}
              </h2>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              {SHORTCUT_GROUPS.map((group) => (
                <section key={group.category}>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.category}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item.label}
                        className="flex items-center justify-between rounded-md px-2 py-1.5"
                      >
                        <span className="text-sm text-foreground/90">{item.label}</span>
                        <span className="flex gap-1">
                          {item.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
});
