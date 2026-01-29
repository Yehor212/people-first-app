/**
 * Vite Plugin: Changelog Parser
 *
 * Parses CHANGELOG.md at build time and exposes it as a virtual module.
 * Import in components: import changelog from 'virtual:changelog'
 *
 * This enables automatic changelog updates - just edit CHANGELOG.md
 * and the UI will update on next build. No manual UI changes needed.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

export interface ChangelogSection {
  title: string;
  emoji?: string;
  items: string[];
}

export interface ChangelogVersion {
  version: string;
  codename?: string;
  date: string;
  sections: ChangelogSection[];
}

const VIRTUAL_MODULE_ID = 'virtual:changelog';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Parse CHANGELOG.md into structured data
 */
function parseChangelog(content: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  // Handle both Unix (\n) and Windows (\r\n) line endings
  const lines = content.split(/\r?\n/);

  let currentVersion: ChangelogVersion | null = null;
  let currentSection: ChangelogSection | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    // Skip code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Version header formats:
    // ## [1.3.0] - "Harmony" - 2026-01-25
    // ## [1.1.3] - "Android UX Improvements" - 2026-01-23
    // ## [1.0.0] - Initial Release
    const versionMatch = line.match(/^##\s+\[([^\]]+)\]\s*(?:-\s*"([^"]+)")?\s*(?:-\s*(.+))?$/);
    if (versionMatch) {
      if (currentVersion) {
        if (currentSection && currentSection.items.length > 0) {
          currentVersion.sections.push(currentSection);
        }
        versions.push(currentVersion);
      }

      currentVersion = {
        version: versionMatch[1],
        codename: versionMatch[2] || undefined,
        date: versionMatch[3] || '',
        sections: []
      };
      currentSection = null;
      continue;
    }

    // Section header: ### Added / ### 📱 Android UX Enhancements
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch && currentVersion) {
      if (currentSection && currentSection.items.length > 0) {
        currentVersion.sections.push(currentSection);
      }

      const title = sectionMatch[1].trim();
      // Extract emoji if present
      const emojiMatch = title.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}])\s*(.+)$/u);

      currentSection = {
        title: emojiMatch ? emojiMatch[2] : title,
        emoji: emojiMatch ? emojiMatch[1] : undefined,
        items: []
      };
      continue;
    }

    // List item: - **NEW:** Feature description
    // or: - Feature description
    const itemMatch = line.match(/^-\s+(.+)$/);
    if (itemMatch && currentSection) {
      // Clean up markdown formatting for display
      let item = itemMatch[1]
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .trim();

      if (item) {
        currentSection.items.push(item);
      }
      continue;
    }

    // Sub-section header (####) - treat as items with bold prefix
    const subSectionMatch = line.match(/^####\s+(.+)$/);
    if (subSectionMatch && currentSection) {
      currentSection.items.push(`**${subSectionMatch[1].trim()}**`);
      continue;
    }
  }

  // Push last version
  if (currentVersion) {
    if (currentSection && currentSection.items.length > 0) {
      currentVersion.sections.push(currentSection);
    }
    versions.push(currentVersion);
  }

  return versions;
}

/**
 * Vite plugin that parses CHANGELOG.md and exposes as virtual module
 */
export function changelogPlugin(): Plugin {
  let changelogData: ChangelogVersion[] = [];

  return {
    name: 'vite-plugin-changelog',

    buildStart() {
      try {
        const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
        const content = readFileSync(changelogPath, 'utf-8');
        changelogData = parseChangelog(content);

        if (changelogData.length === 0) {
          // Debug: show first few lines to check format
          const firstLines = content.split('\n').slice(0, 20).join('\n');
          console.log('[changelog] Warning: No versions parsed. First lines:', firstLines.substring(0, 200));
        } else {
          console.log(`[changelog] Parsed ${changelogData.length} versions from CHANGELOG.md`);
          console.log(`[changelog] Versions: ${changelogData.map(v => v.version).join(', ')}`);
        }
      } catch (error) {
        console.warn('[changelog] Could not read CHANGELOG.md:', error);
        changelogData = [];
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return `export default ${JSON.stringify(changelogData, null, 2)};`;
      }
    }
  };
}

export default changelogPlugin;
