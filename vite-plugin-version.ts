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
 * The script runs BEFORE any bundled JS (head-prepend) and detects
 * version mismatches using SYNCHRONOUS XHR to block the HTML parser.
 * This prevents stale module scripts from downloading before the
 * version check completes.
 *
 * Uses both `version` (semver) and `buildTime` (epoch ms) to detect
 * mismatches — catches same-version rebuilds where only chunk hashes change.
 *
 * The version.json is fetched with cache-bust query param to bypass CDN.
 *
 * NOTE: The script is external (not inline) to comply with CSP
 * script-src without 'unsafe-inline'.
 */
export function versionPlugin(): Plugin {
  let version: string;
  let buildTime: number;
  let outDir: string;
  let base: string;
  let shouldInjectVersionScript = false;

  return {
    name: 'version-plugin',

    configResolved(config) {
      // Read version from package.json
      const packageJson = JSON.parse(
        readFileSync(resolve(config.root, 'package.json'), 'utf-8')
      );
      version = packageJson.version;
      buildTime = Date.now();
      outDir = config.build.outDir;
      base = config.base || '/';
      shouldInjectVersionScript = config.command === 'build';
    },

    transformIndexHtml() {
      if (!shouldInjectVersionScript) {
        return undefined;
      }

      // Inject <script src> at head-prepend so it runs BEFORE Vite's
      // module scripts and modulepreload hints. This is critical —
      // 'head' (default) injects AFTER modules, causing stale chunk downloads.
      return [
        {
          tag: 'script',
          attrs: { src: `${base}version-check.js` },
          injectTo: 'head-prepend' as const,
        },
      ];
    },

    writeBundle() {
      // Generate version-check.js — external script for CSP compliance
      //
      // Strategy: SYNCHRONOUS XHR blocks the HTML parser. Since this script
      // is injected at head-prepend (before module scripts), no stale chunk
      // downloads start until the version check passes.
      //
      // On mismatch: immediate location.replace() — modules never load.
      // On sync XHR failure: async fetch fallback with window.stop().
      // On bfcache restore: pageshow handler re-checks.
      const script = `(function(){
try{
var RL='_zf_rl';var VCF='zenflow_check_version';
var V='${version}';var BT=${buildTime};var B='${base}';
var t=sessionStorage.getItem(RL);
if(t&&Date.now()-Number(t)<30000)return;
function mismatch(d){return d.version!==V||d.buildTime!==BT;}
function fastReload(){
sessionStorage.setItem(RL,String(Date.now()));
sessionStorage.setItem(VCF,'true');
var u=new URL(location.href);u.searchParams.set('_v',String(Date.now()));
location.replace(u.toString());
}
function hardReload(){
sessionStorage.setItem(RL,String(Date.now()));
sessionStorage.setItem(VCF,'true');
var p=Promise.resolve();
if('caches'in window){p=p.then(function(){return caches.keys().then(function(n){return Promise.all(n.map(function(k){return caches.delete(k)}))})});}
if(navigator.serviceWorker){p=p.then(function(){return navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(s){return s.unregister()}))})});}
p.then(function(){var u=new URL(location.href);u.searchParams.set('_v',String(Date.now()));location.replace(u.toString());}).catch(function(){location.reload()});
}
try{
var x=new XMLHttpRequest();
x.open('GET',B+'version.json?_t='+Date.now(),false);
x.send();
if(x.status===200){var d=JSON.parse(x.responseText);if(mismatch(d)){fastReload();return;}}
}catch(e){
fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(mismatch(d)){try{window.stop();}catch(e){}hardReload();}}).catch(function(){});
}
window.addEventListener('pageshow',function(e){if(e.persisted){fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(mismatch(d))location.reload()}).catch(function(){});}});
}catch(e){}
})();`;

      writeFileSync(resolve(outDir, 'version-check.js'), script);

      // Generate version.json in the output directory
      const manifest: VersionManifest = {
        version,
        buildTime,
      };

      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(manifest, null, 2));

      console.log(`\n📦 Generated version-check.js + version.json (v${version})`);
    },
  };
}
