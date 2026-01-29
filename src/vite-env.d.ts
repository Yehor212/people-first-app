/// <reference types="vite/client" />

// Global app version injected by Vite
declare const __APP_VERSION__: string;

// Virtual module for changelog data (parsed from CHANGELOG.md at build time)
declare module 'virtual:changelog' {
  import type { ChangelogVersion } from './types/changelog';
  const changelog: ChangelogVersion[];
  export default changelog;
}
