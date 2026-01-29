/**
 * ChangelogPanel - Version History Display
 *
 * Displays all app versions parsed from CHANGELOG.md.
 * Data is automatically loaded at build time via vite-plugin-changelog.
 *
 * To update: just edit CHANGELOG.md and rebuild - no code changes needed!
 */

import { useState } from 'react';
import { X, ChevronDown, ChevronUp, Sparkles, Bug, Zap, Trash2, History } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import changelog from 'virtual:changelog';
import type { ChangelogVersion, ChangelogSection } from '@/types/changelog';

interface ChangelogPanelProps {
  onClose: () => void;
}

// Map section titles to icons
function getSectionIcon(title: string, emoji?: string): React.ReactNode {
  if (emoji) {
    return <span className="text-lg">{emoji}</span>;
  }

  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('add') || lowerTitle.includes('new') || lowerTitle.includes('feature')) {
    return <Sparkles className="w-4 h-4 text-green-500" />;
  }
  if (lowerTitle.includes('fix') || lowerTitle.includes('bug')) {
    return <Bug className="w-4 h-4 text-orange-500" />;
  }
  if (lowerTitle.includes('change') || lowerTitle.includes('improve') || lowerTitle.includes('enhance')) {
    return <Zap className="w-4 h-4 text-blue-500" />;
  }
  if (lowerTitle.includes('remove') || lowerTitle.includes('deprecat')) {
    return <Trash2 className="w-4 h-4 text-red-500" />;
  }

  return <Sparkles className="w-4 h-4 text-primary" />;
}

// Translate section titles
function translateSectionTitle(title: string, t: Record<string, string>): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle === 'added' || lowerTitle.includes('new')) {
    return t.changelogAdded || 'Added';
  }
  if (lowerTitle === 'fixed' || lowerTitle.includes('bug fix')) {
    return t.changelogFixed || 'Fixed';
  }
  if (lowerTitle === 'changed') {
    return t.changelogChanged || 'Changed';
  }
  if (lowerTitle === 'removed') {
    return t.changelogRemoved || 'Removed';
  }

  return title;
}

function VersionCard({
  version,
  isExpanded,
  onToggle,
  t
}: {
  version: ChangelogVersion;
  isExpanded: boolean;
  onToggle: () => void;
  t: Record<string, string>;
}) {
  return (
    <div className="bg-card rounded-xl overflow-hidden zen-shadow-sm">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">v{version.version}</span>
              {version.codename && (
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {version.codename}
                </span>
              )}
            </div>
            {version.date && (
              <span className="text-xs text-muted-foreground">{version.date}</span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {isExpanded && version.sections.length > 0 && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {version.sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <div className="flex items-center gap-2 mb-2">
                {getSectionIcon(section.title, section.emoji)}
                <h4 className="text-sm font-semibold text-foreground">
                  {translateSectionTitle(section.title, t)}
                </h4>
              </div>
              <ul className="space-y-1.5 pl-6">
                {section.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="text-sm text-muted-foreground list-disc"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChangelogPanel({ onClose }: ChangelogPanelProps) {
  const { t } = useLanguage();
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(() => {
    // Expand the first (latest) version by default
    if (changelog.length > 0) {
      return new Set([changelog[0].version]);
    }
    return new Set();
  });

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedVersions(new Set(changelog.map(v => v.version)));
  };

  const collapseAll = () => {
    setExpandedVersions(new Set());
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background animate-fade-in overflow-hidden flex flex-col" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <h2 id="changelog-title" className="text-xl font-bold text-foreground">
            {t.changelogTitle || 'Version History'}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label={t.close || 'Close'}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex gap-2 p-4 border-b border-border">
        <button
          onClick={expandAll}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-muted transition-colors"
        >
          {t.changelogExpandAll || 'Expand All'}
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-muted transition-colors"
        >
          {t.changelogCollapseAll || 'Collapse All'}
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
        {changelog.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t.changelogEmpty || 'No version history available'}
          </div>
        ) : (
          changelog.map((version) => (
            <VersionCard
              key={version.version}
              version={version}
              isExpanded={expandedVersions.has(version.version)}
              onToggle={() => toggleVersion(version.version)}
              t={t as Record<string, string>}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ChangelogPanel;
