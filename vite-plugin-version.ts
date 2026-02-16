import type { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface VersionManifest {
  version: string;
  buildTime: number;
}

/**
 * Vite plugin that generates a version.json file during build
 * AND loads an external version check script via index.html.
 *
 * The script runs BEFORE any bundled JS and detects version
 * mismatches even when the user has very old cached JS bundles.
 * This breaks the "cache deadlock" where old code has no version
 * check system and can't self-update.
 *
 * The version.json is fetched with cache: 'no-store' to always
 * get the latest version from the server.
 *
 * NOTE: The script is external (not inline) to comply with CSP
 * script-src without 'unsafe-inline'.
 */
export function versionPlugin(): Plugin {
  let version: string;
  let outDir: string;
  let base: string;

  return {
    name: 'version-plugin',

    configResolved(config) {
      // Read version from package.json
      const packageJson = JSON.parse(
        readFileSync(resolve(config.root, 'package.json'), 'utf-8')
      );
      version = packageJson.version;
      outDir = config.build.outDir;
      base = config.base || '/';
    },

    transformIndexHtml() {
      // Inject <script src> for the external version check file.
      // The actual JS is written to dist/ in writeBundle().
      return [
        {
          tag: 'script',
          attrs: { src: `${base}version-check.js` },
          injectTo: 'head' as const,
        },
      ];
    },

    writeBundle() {
      // Generate version-check.js — external script for CSP compliance
      // CRITICAL: All cache clearing and SW unregistration MUST complete
      // before reload. Fire-and-forget + setTimeout(150ms) caused users
      // to reload into stale cached content from not-yet-cleared SW caches.
      const script = `(function(){
try{
var RL='_zf_rl';var V='${version}';var B='${base}';
var t=sessionStorage.getItem(RL);
if(t&&Date.now()-Number(t)<30000)return;
function hardReload(){
sessionStorage.setItem(RL,String(Date.now()));
var p=Promise.resolve();
if('caches'in window){p=p.then(function(){return caches.keys().then(function(n){return Promise.all(n.map(function(k){return caches.delete(k)}))})});}
if(navigator.serviceWorker){p=p.then(function(){return navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(s){return s.unregister()}))})});}
p.then(function(){var u=new URL(location.href);u.searchParams.set('_v',String(Date.now()));location.replace(u.toString());}).catch(function(){location.reload()});
}
fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(d.version!==V)hardReload()}).catch(function(){});
window.addEventListener('pageshow',function(e){if(e.persisted){fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(d.version!==V)location.reload()}).catch(function(){});}});
}catch(e){}
})();`;

      writeFileSync(resolve(outDir, 'version-check.js'), script);

      // Generate version.json in the output directory
      const manifest: VersionManifest = {
        version,
        buildTime: Date.now(),
      };

      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(manifest, null, 2));

      console.log(`\n📦 Generated version-check.js + version.json (v${version})`);
    },
  };
}
