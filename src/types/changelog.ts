/**
 * Changelog Types
 *
 * These types match the structure produced by vite-plugin-changelog
 */

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

