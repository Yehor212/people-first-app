import { memo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/config/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import type { TranslationStrings } from "@/i18n/types";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "Cmd" : "Ctrl";

function getShortcutGroups(ts: TranslationStrings) {
  return [
  {
    category: ts.journalShortcutNavigation || "Navigation",
    items: [
      { keys: [`${mod}+\\`], label: ts.journalShortcutToggleSidebar || "Toggle sidebar" },
      { keys: [`${mod}+Shift+\\`], label: ts.journalShortcutToggleCompact || "Compact or hidden sidebar" },
      { keys: ["Escape"], label: ts.journalShortcutCloseOrBack || "Close or go back" },
    ],
  },
  {
    category: ts.journalShortcutEditor || "Editor",
    items: [
      { keys: [`${mod}+B`], label: ts.journalFormatBold || "Bold" },
      { keys: [`${mod}+I`], label: ts.journalFormatItalic || "Italic" },
      { keys: [`${mod}+U`], label: ts.journalFormatUnderline || "Underline" },
      { keys: ["/"], label: ts.journalSlashCommands || "Slash commands" },
    ],
  },
  {
    category: ts.journalShortcutView || "View",
    items: [
      { keys: [`${mod}+Enter`], label: ts.journalShortcutSaveEntry || "Save entry" },
      { keys: [`${mod}+Shift+L`], label: ts.journalPanicLockTitle || "Lock diary" },
      { keys: ["?"], label: ts.journalShortcutShowHelp || "Show shortcuts" },
    ],
  },
  ] as const;
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="whitespace-normal break-words rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80">
    {children}
  </kbd>
);

export const KeyboardShortcutsOverlay = memo(function KeyboardShortcutsOverlay({
  open,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  const prefersReduced = !useShouldAnimate();
  const { t: ts } = useLanguage();
  const shortcutGroups = getShortcutGroups(ts);
  const { modalRef, handleKeyDown } = useModalA11y(open, onClose);

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
            ref={modalRef}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-label={ts.keyboardShortcuts || "Keyboard shortcuts"}
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              "fixed inset-0 z-[60] overflow-y-auto outline-none",
              "md:mx-auto md:my-6 md:max-w-md md:rounded-2xl md:shadow-2xl",
              "bg-popover/95 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]",
            )}
            {...motionProps}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2 border-b border-border/50 px-5 py-4">
              <h2 className="min-w-0 whitespace-normal break-words text-base font-semibold text-foreground">
                {ts.keyboardShortcuts || "Keyboard Shortcuts"}
              </h2>
              <button
                onClick={onClose}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                aria-label={ts.close || "Close"}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              {shortcutGroups.map((group) => (
                <section key={group.category}>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.category}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item.label}
                        className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-center rounded-md px-2 py-1.5"
                      >
                        <span className="min-w-0 whitespace-normal break-words text-sm text-foreground/90">{item.label}</span>
                        <span className="flex flex-wrap gap-1 min-[420px]:justify-end">
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
