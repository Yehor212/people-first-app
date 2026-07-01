import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  Home,
  BookOpen,
  CalendarClock,
  Settings,
  Repeat,
  PenLine,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import type { NavV2Page } from "@/hooks/useNavigationV2";

const RECENT_KEY = "zenflow-cmd-recent";
const MAX_RECENT = 5;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: NavV2Page) => void;
}

function getRecent(): string[] {
  const raw = storageGetRaw(RECENT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const items = getRecent().filter((r) => r !== id);
  items.unshift(id);
  storageSetRaw(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
}

export default function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [search, setSearch] = useState("");
  const [recentIds] = useState(() => getRecent());

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // Escape to close — defensive handler (also handled by Index.tsx shortcuts)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const runAction = useCallback(
    (id: string, action: () => void) => {
      pushRecent(id);
      action();
      onClose();
    },
    [onClose]
  );

  const goToPage = useCallback(
    (page: NavV2Page) => {
      runAction(`nav-v2-${page}`, () => onNavigate(page));
    },
    [onNavigate, runAction]
  );

  const toggleTheme = useCallback(() => {
    runAction("action-theme", () => {
      document.documentElement.classList.toggle("dark");
    });
  }, [runAction]);

  if (!open) return null;

  const isDark = document.documentElement.classList.contains("dark");

  const navItems = [
    {
      id: "nav-v2-orb",
      label: ts.navV2Orb || ts.somLogFeeling || ts.home,
      icon: Home,
      action: () => goToPage("orb"),
    },
    {
      id: "nav-v2-habits",
      label: ts.navV2Habits || ts.habits,
      icon: Repeat,
      action: () => goToPage("habits"),
    },
    {
      id: "nav-v2-diary",
      label: ts.navV2Diary || ts.diary,
      icon: BookOpen,
      action: () => goToPage("diary"),
    },
    {
      id: "nav-v2-planning",
      label: ts.navV2Planning,
      icon: CalendarClock,
      action: () => goToPage("planning"),
    },
    {
      id: "nav-v2-settings",
      label: ts.navV2Settings || ts.settings,
      icon: Settings,
      action: () => goToPage("settings"),
    },
  ];

  const actionItems = [
    {
      id: "action-journal",
      label: ts.somLogFeeling || ts.navV2Diary,
      icon: PenLine,
      action: () => goToPage("diary"),
    },
    {
      id: "action-theme",
      label: isDark ? ts.appearance : ts.navV2Theme,
      icon: isDark ? Sun : Moon,
      action: toggleTheme,
    },
  ];

  const recentItems = navItems
    .concat(actionItems)
    .filter((item) => recentIds.includes(item.id))
    .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ts.navV2Search || ts.search}
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[min(20vh,120px)]"
      onClick={onClose}
    >
      <Command
        className={cn(
          "w-full max-w-lg rounded-2xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden",
          "motion-safe:animate-in fade-in slide-in-from-top-4 motion-safe:duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
        shouldFilter
      >
        <div className="flex items-center gap-2 px-4 border-b border-border/20">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder={ts.navV2Search || ts.search}
            className="flex-1 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {ts.noResults || ts.navV2Search}
          </Command.Empty>

          {recentItems.length > 0 && !search && (
            <Command.Group heading={ts.recentActivity}>
              {recentItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.label}
                  onSelect={item.action}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted motion-safe:transition-colors min-h-[44px]"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading={ts.mainNavigation}>
            {navItems.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={item.action}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted motion-safe:transition-colors min-h-[44px]"
              >
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading={ts.appearance}>
            {actionItems.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={item.action}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted motion-safe:transition-colors min-h-[44px]"
              >
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
