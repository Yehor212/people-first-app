import { cn } from '@/lib/utils';
import { Home, Settings, Sparkles, BarChart3 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type TabType = 'home' | 'garden' | 'stats' | 'achievements' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const { t } = useLanguage();

  const tabs = [
    { id: 'home' as TabType, icon: Home, label: t.home },
    { id: 'garden' as TabType, icon: Sparkles, label: t.myWorld },
    { id: 'stats' as TabType, icon: BarChart3, label: t.stats },
    { id: 'settings' as TabType, icon: Settings, label: t.settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t border-border z-50">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex justify-around py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-8 rounded-xl transition-all",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-all",
                activeTab === tab.id && "zen-gradient text-primary-foreground zen-shadow-soft"
              )}>
                <tab.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
