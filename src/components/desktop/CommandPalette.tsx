import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import {
  Home,
  BookOpen,
  BarChart3,
  Settings,
  Repeat,
  PenLine,
  Sun,
  Moon,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppStore } from "@/stores";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

const RECENT_KEY = "zenflow-cmd-recent";
const MAX_RECENT = 5;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
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

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const setActiveTab = useAppStore((s) => s.setActiveTab);
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

  const goToTab = useCallback(
    (tab: TabType) => {
      runAction(`nav-${tab}`, () => setActiveTab(tab));
    },
    [runAction, setActiveTab]
  );

  const toggleTheme = useCallback(() => {
    runAction("action-theme", () => {
      document.documentElement.classList.toggle("dark");
    });
  }, [runAction]);

  if (!open) return null;

  const isDark = document.documentElement.classList.contains("dark");

  const navItems = [
    { id: "nav-home", label: t.home, icon: Home, action: () => goToTab("home") },
    { id: "nav-garden", label: t.diary, icon: BookOpen, action: () => goToTab("garden") },
    { id: "nav-mindmap", label: "Habits", icon: Repeat, action: () => goToTab("mindmap") },
    { id: "nav-stats", label: t.stats, icon: BarChart3, action: () => goToTab("stats") },
    { id: "nav-settings", label: t.settings, icon: Settings, action: () => goToTab("settings") },
  ];

  const actionItems = [
    {
      id: "action-journal",
      label: t.somLogFeeling || "New journal entry",
      icon: PenLine,
      action: () => goToTab("garden"),
    },
    {
      id: "action-theme",
      label: isDark ? "Light mode" : "Dark mode",
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
      aria-label={ts.search || "Command palette"}
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[min(20vh,120px)]"
      onClick={onClose}
    >
      <Command
        className={cn(
          "w-full max-w-lg rounded-2xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden",
          "animate-in fade-in slide-in-from-top-4 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
        shouldFilter
      >
        <div className="flex items-center gap-2 px-4 border-b border-border/20">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder={ts.search || "Search..."}
            className="flex-1 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {ts.noResults || "No results found."}
          </Command.Empty>

          {recentItems.length > 0 && !search && (
            <Command.Group heading="Recent">
              {recentItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.label}
                  onSelect={item.action}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted transition-colors min-h-[44px]"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading={t.mainNavigation || "Navigation"}>
            {navItems.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={item.action}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted transition-colors min-h-[44px]"
              >
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{item.label}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading={ts.actions || "Actions"}>
            {actionItems.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={item.action}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer data-[selected]:bg-muted transition-colors min-h-[44px]"
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
