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
      const script = `<script>
(function(){
  try{
    var RL='_zf_rl';var t=sessionStorage.getItem(RL);
    if(t&&Date.now()-Number(t)<30000)return;
    fetch('${base}version.json?_t='+Date.now(),{cache:'no-store'})
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.version!=='${version}'){
          sessionStorage.setItem(RL,String(Date.now()));
          if('caches'in window)caches.keys().then(function(n){n.forEach(function(k){caches.delete(k)})});
          if(navigator.serviceWorker)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(s){s.unregister()})});
          var u=new URL(location.href);u.searchParams.set('_v',Date.now());
          setTimeout(function(){location.replace(u.toString())},150);
        }
      }).catch(function(){});
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
