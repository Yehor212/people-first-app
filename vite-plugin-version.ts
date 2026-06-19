import type { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface VersionManifest {
  version: string;
  buildTime: number;
}

interface VersionPluginOptions {
  buildTime?: number;
}

/**
 * Vite plugin that generates a version.json file during build
 * AND loads an external version check script via index.html.
 *
 * The script is injected before bundled JS and checks version mismatches with
 * a deferred no-store fetch.
 *
 * Older builds used synchronous XHR here to block the HTML parser before module
 * scripts. That protected stale chunks, but it also froze the browser on slow
 * networks. The app now handles stale deploys through the runtime version check
 * and `vite:preloadError`, so the HTML guard must stay off the critical path.
 *
 * Uses both `version` (semver) and `buildTime` (epoch ms) to detect
 * mismatches — catches same-version rebuilds where only chunk hashes change.
 *
 * The version.json is fetched with cache-bust query param to bypass CDN.
 *
 * NOTE: The script is external (not inline) to comply with CSP
 * script-src without 'unsafe-inline'.
 */
export function versionPlugin(options: VersionPluginOptions = {}): Plugin {
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
      buildTime = options.buildTime ?? Date.now();
      outDir = config.build.outDir;
      base = config.base || '/';
      shouldInjectVersionScript = config.command === 'build';
    },

    transformIndexHtml() {
      if (!shouldInjectVersionScript) {
        return undefined;
      }

      // Inject the guard early, but defer execution so it never blocks the HTML
      // parser or first paint. Runtime stale-chunk handling covers late deploys.
      return [
        {
          tag: 'script',
          attrs: { src: `${base}version-check.js?bt=${buildTime}`, defer: true },
          injectTo: 'head-prepend' as const,
        },
      ];
    },

    writeBundle() {
      // Generate version-check.js — external script for CSP compliance
      //
      // Strategy: async fetch keeps the browser responsive on slow networks.
      // On mismatch: clear caches/service workers, then hard-reload with a
      // cache-busting query. Runtime preload-error handling covers the narrow
      // window where a module starts before this check finishes.
      // On bfcache restore: pageshow handler re-checks.
      const script = `(function(){
try{
var RL='_zf_rl';var VCF='zenflow_check_version';
var V='${version}';var B='${base}';
var S=document.currentScript&&document.currentScript.src;
var BT=Number(S?new URL(S,location.origin).searchParams.get('bt'):0)||${buildTime};
var t=sessionStorage.getItem(RL);
if(t&&Date.now()-Number(t)<30000)return;
function mismatch(d){return d.version!==V||d.buildTime!==BT;}
function reload(){
sessionStorage.setItem(RL,String(Date.now()));
sessionStorage.setItem(VCF,'true');
location.reload();
}
function clearCaches(){
var jobs=[];
if('caches'in window){jobs.push(caches.keys().then(function(n){return Promise.all(n.map(function(k){return caches.delete(k)}))}));}
if(navigator.serviceWorker){jobs.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(s){return s.unregister()}))}));}
return Promise.all(jobs.map(function(p){return p.catch(function(){})}));
}
function check(){return fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(mismatch(d)){return clearCaches().then(reload)}}).catch(function(){});}
check();
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
