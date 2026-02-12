import type { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface VersionManifest {
  version: string;
  buildTime: number;
}

/**
 * Vite plugin that generates a version.json file during build
 * AND injects an inline version check script into index.html.
 *
 * The inline script runs BEFORE any bundled JS and detects version
 * mismatches even when the user has very old cached JS bundles.
 * This breaks the "cache deadlock" where old code has no version
 * check system and can't self-update.
 *
 * The version.json is fetched with cache: 'no-store' to always
 * get the latest version from the server.
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

    transformIndexHtml(html) {
      // Inject inline version check that runs before any bundled JS.
      // This catches version mismatches even when old bundles are cached
      // (e.g., user stuck on v1.3.0 with no versionCheck.ts).
      //
      // CRITICAL: All cache clearing and SW unregistration MUST complete
      // before reload. Fire-and-forget + setTimeout(150ms) caused users
      // to reload into stale cached content from not-yet-cleared SW caches.
      const script = `<script>
(function(){
  try{
    var RL='_zf_rl';var V='${version}';var B='${base}';
    var t=sessionStorage.getItem(RL);
    if(t&&Date.now()-Number(t)<30000)return;

    function hardReload(){
      sessionStorage.setItem(RL,String(Date.now()));
      var p=Promise.resolve();
      if('caches'in window){
        p=p.then(function(){return caches.keys().then(function(n){return Promise.all(n.map(function(k){return caches.delete(k)}))})});
      }
      if(navigator.serviceWorker){
        p=p.then(function(){return navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(s){return s.unregister()}))})});
      }
      p.then(function(){
        var u=new URL(location.href);u.searchParams.set('_v',String(Date.now()));
        location.replace(u.toString());
      }).catch(function(){location.reload()});
    }

    fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'})
      .then(function(r){return r.json()})
      .then(function(d){if(d.version!==V)hardReload()})
      .catch(function(){});

    window.addEventListener('pageshow',function(e){
      if(e.persisted){
        fetch(B+'version.json?_t='+Date.now(),{cache:'no-store'})
          .then(function(r){return r.json()})
          .then(function(d){if(d.version!==V)location.reload()})
          .catch(function(){});
      }
    });
  }catch(e){}
})();
</script>`;
      return html.replace('</head>', script + '\n  </head>');
    },

    writeBundle() {
      // Generate version.json in the output directory
      const manifest: VersionManifest = {
        version,
        buildTime: Date.now(),
      };

      const outputPath = resolve(outDir, 'version.json');
      writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

      console.log(`\n📦 Generated version.json (v${version})`);
    },
  };
}
