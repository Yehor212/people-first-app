/// <reference types="vite/client" />

// Global app version injected by Vite
declare const __APP_VERSION__: string;

// GLSL shader files imported as raw strings via Vite ?raw
declare module '*.frag?raw' {
  const src: string;
  export default src;
}
declare module '*.vert?raw' {
  const src: string;
  export default src;
}

// Virtual module for changelog data (parsed from CHANGELOG.md at build time)
declare module 'virtual:changelog' {
  import type { ChangelogVersion } from './types/changelog';
  const changelog: ChangelogVersion[];
  export default changelog;
}
