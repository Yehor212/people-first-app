import { memo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Home, Settings, BookOpen, BarChart3, Compass, Repeat } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
  habitHubEnabled?: boolean;
}

export const Navigation = memo(function Navigation({
  activeTab,
  onTabChange,
  canvasEnabled,
  habitHubEnabled,
}: NavigationProps) {
  const { t } = useLanguage();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide nav when software keyboard is open (Android adjustResize shrinks viewport)
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => {
      setKeyboardOpen(window.innerHeight < threshold);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tabs = [
    { id: "home" as TabType, icon: Home, label: t.home },
    ...(habitHubEnabled
      ? [
          {
            id: "mindmap" as TabType,
            icon: Repeat,
            label: (t as unknown as Record<string, string>).habitHub || "Habits",
          },
        ]
      : canvasEnabled
        ? [{ id: "mindmap" as TabType, icon: Compass, label: t.map || "Map" }]
        : []),
    { id: "garden" as TabType, icon: BookOpen, label: t.diary },
    { id: "stats" as TabType, icon: BarChart3, label: t.stats },
    { id: "settings" as TabType, icon: Settings, label: t.settings },
  ];

  return (
    <>
      {/* Desktop sidebar — always visible at lg (1024px+), unaffected by keyboard */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-e lg:border-border lg:bg-card/95 lg:backdrop-blur-lg lg:z-50"
        role="navigation"
        aria-label={t.mainNavigation || "Main navigation"}
      >
        <div className="flex items-center gap-2 px-5 py-6 border-b border-border/50">
          <span className="text-lg font-bold text-foreground">ZenFlow</span>
        </div>
        <div className="flex-1 py-3 px-3 space-y-1" role="tablist" aria-orientation="vertical">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                void haptics.tabChanged();
                onTabChange(tab.id);
              }}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={tab.label}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors duration-200",
                  activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-sm truncate transition-colors duration-200",
                  activeTab === tab.id ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile bottom nav — hidden at lg (1024px+) and when keyboard is open */}
      {!keyboardOpen && (
        <nav
          className="fixed bottom-0 inset-x-0 bg-card/80 backdrop-blur-lg border-t border-border z-50 gpu-layer pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
          role="navigation"
          aria-label={t.mainNavigation || "Main navigation"}
        >
          <div className="mx-auto px-4 max-w-[var(--container-max-width)]">
            <div className="flex justify-between py-2" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    void haptics.tabChanged();
                    onTabChange(tab.id);
                  }}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-label={tab.label}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-3 flex-1 rounded-xl transition-all duration-200 min-w-0 min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    activeTab === tab.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "w-6 h-6 transition-colors duration-200",
                      activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "text-xs truncate max-w-full transition-colors duration-200",
                      activeTab === tab.id ? "text-primary font-medium" : "text-muted-foreground"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </>
  );
});
