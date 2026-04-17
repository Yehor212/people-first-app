import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Palette, Archive, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";

interface DrawerV2Props {
  open: boolean;
  onClose: () => void;
  onOpenCommandPalette: () => void;
  onOpenThemeSwitcher?: () => void;
  onOpenArchive?: () => void;
  onOpenAccount?: () => void;
}

/**
 * DrawerV2 — mobile sidebar-as-drawer secondary nav.
 *
 * Triggered from top-left menu button on mobile. Intentionally does NOT
 * duplicate bottom-tab targets (Orb/Habits/Diary/Settings). Instead exposes
 * secondary chrome: command palette, theme switcher, archive, account.
 *
 * - 85% viewport width, paper surface, backdrop blur
 * - Bloom open / Fold close via CSS transitions (verb-aligned timings)
 * - Android back closes drawer first (handled by parent via handleBackButton)
 * - Renders via createPortal to escape transform ancestors (see modal-standard.md)
 */
export const DrawerV2 = memo(function DrawerV2({
  open,
  onClose,
  onOpenCommandPalette,
  onOpenThemeSwitcher,
  onOpenArchive,
  onOpenAccount,
}: DrawerV2Props) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll + autofocus first action when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => firstFocusRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open]);

  // Escape to close (complements Android hardware back)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const actions: Array<{
    id: string;
    icon: typeof Search;
    label: string;
    onTap?: () => void;
    disabled?: boolean;
  }> = [
    {
      id: "command-palette",
      icon: Search,
      label: tx.navV2Search || "Search",
      onTap: () => {
        onClose();
        onOpenCommandPalette();
      },
    },
    {
      id: "theme",
      icon: Palette,
      label: tx.navV2Theme || "Theme",
      onTap: onOpenThemeSwitcher
        ? () => {
            onClose();
            onOpenThemeSwitcher();
          }
        : undefined,
      disabled: !onOpenThemeSwitcher,
    },
    {
      id: "archive",
      icon: Archive,
      label: tx.navV2Archive || "Archive",
      onTap: onOpenArchive
        ? () => {
            onClose();
            onOpenArchive();
          }
        : undefined,
      disabled: !onOpenArchive,
    },
    {
      id: "account",
      icon: User,
      label: tx.navV2Account || "Account",
      onTap: onOpenAccount
        ? () => {
            onClose();
            onOpenAccount();
          }
        : undefined,
      disabled: !onOpenAccount,
    },
  ];

  const content = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] zen-bloom"
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-v2-backdrop"
      />

      {/* Drawer body */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={tx.navV2Menu || "Menu"}
        data-testid="drawer-v2"
        className={cn(
          "fixed inset-y-0 start-0 z-[60] w-[85%] max-w-sm",
          "bg-card/95 border-e border-border/60",
          "backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "shadow-2xl overflow-y-auto zen-bloom",
        )}
      >
        <header className="flex items-center justify-between px-4 py-4 border-b border-border/40">
          <span className="font-display text-lg font-semibold">
            {tx.navV2Menu || "Menu"}
          </span>
          <button
            type="button"
            ref={firstFocusRef}
            onClick={() => {
              void haptics.tabChanged();
              onClose();
            }}
            aria-label={tx.navV2CloseMenu || "Close menu"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-paper-surface/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <nav className="flex flex-col gap-1 p-3" aria-label="drawer-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                if (!action.onTap) return;
                void haptics.tabChanged();
                action.onTap();
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 min-h-[48px]",
                "font-display text-sm text-start",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                action.disabled
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "text-foreground hover:bg-paper-surface/60",
              )}
              data-testid={`drawer-v2-action-${action.id}`}
            >
              <action.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{action.label}</span>
              {!action.disabled && (
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );

  return createPortal(content, document.body);
});
