import type { Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface VersionManifest {
  version: string;
  buildTime: number;
}

/**
 * Vite plugin that generates a version.json file during build.
 *
 * This file is used by the client to detect when a new version
 * has been deployed, allowing for graceful updates instead of
 * chunk load errors after deployment.
 *
 * The version.json is fetched with cache: 'no-store' to always
 * get the latest version from the server.
 */
export function versionPlugin(): Plugin {
  let version: string;
  let outDir: string;

  return {
    name: 'version-plugin',

    configResolved(config) {
      // Read version from package.json
      const packageJson = JSON.parse(
        readFileSync(resolve(config.root, 'package.json'), 'utf-8')
      );
      version = packageJson.version;
      outDir = config.build.outDir;
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
