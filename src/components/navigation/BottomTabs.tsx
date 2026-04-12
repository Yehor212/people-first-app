import { memo } from "react";
import { cn } from "@/lib/utils";
import { Home, Settings, BookOpen, BarChart3, Compass, Repeat } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

interface BottomTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
  habitHubEnabled?: boolean;
}

export const BottomTabs = memo(function BottomTabs({
  activeTab,
  onTabChange,
  canvasEnabled,
  habitHubEnabled,
}: BottomTabsProps) {
  const { t } = useLanguage();

  const mainTabs = [
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
  ];

  const settingsTab = { id: "settings" as TabType, icon: Settings, label: t.settings };

  const allTabs = [...mainTabs, settingsTab];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-card/80 backdrop-blur-lg border-t border-border z-50 gpu-layer pb-safe lg:hidden"
      role="navigation"
      aria-label={t.mainNavigation || "Main navigation"}
    >
      <div className="mx-auto px-4 max-w-[var(--container-max-width)]">
        <div className="flex justify-between py-2" role="tablist">
          {allTabs.map((tab) => (
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
  );
});
