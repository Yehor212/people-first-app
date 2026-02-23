import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Home, Settings, BookOpen, BarChart3, Compass } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { haptics } from '@/lib/haptics';

type TabType = 'home' | 'garden' | 'stats' | 'achievements' | 'settings' | 'mindmap';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
}

export function Navigation({ activeTab, onTabChange, canvasEnabled }: NavigationProps) {
  const { t } = useLanguage();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Hide nav when software keyboard is open (Android adjustResize shrinks viewport)
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => {
      setKeyboardOpen(window.innerHeight < threshold);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const tabs = [
    { id: 'home' as TabType, icon: Home, label: t.home },
    ...(canvasEnabled ? [{ id: 'mindmap' as TabType, icon: Compass, label: t.map || 'Map' }] : []),
    { id: 'garden' as TabType, icon: BookOpen, label: t.diary },
    { id: 'stats' as TabType, icon: BarChart3, label: t.stats },
    { id: 'settings' as TabType, icon: Settings, label: t.settings },
  ];

  if (keyboardOpen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-lg border-t border-border z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label={t.mainNavigation || 'Main navigation'}
    >
      <div className="mx-auto px-4" style={{ maxWidth: 'var(--container-max-width)' }}>
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
              <div className={cn(
                "p-2.5 rounded-xl transition-all duration-200",
                activeTab === tab.id && "zen-gradient text-primary-foreground zen-shadow-soft"
              )}>
                <tab.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium truncate max-w-full">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
