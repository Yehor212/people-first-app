import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync, readFileSync, renameSync } from "fs";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { compression } from "vite-plugin-compression2";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { changelogPlugin } from "./vite-plugin-changelog.ts";
import { versionPlugin } from "./vite-plugin-version.ts";
import { createCompactI18nBuildPlugin } from "./scripts/compact-i18n-build-plugin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const T184_QA_OUT_DIR = "output/t184-android-qa";

function normalizeBasePath(value: string): string {
  if (!value || value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

function collapseDuplicatedBasePathUrls(html: string, base: string): string {
  const normalizedBase = normalizeBasePath(base);
  if (!normalizedBase.startsWith("/") || normalizedBase === "/") return html;

  const duplicatedBase = `${normalizedBase}${normalizedBase.replace(/^\//, "")}`;
  return html.replaceAll(duplicatedBase, normalizedBase);
}

function normalizeIndexBasePathPlugin(base: string) {
  return {
    name: "zenflow-normalize-index-base-path",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return collapseDuplicatedBasePathUrls(html, base);
    },
  };
}

function moveT184QaHtmlToRootPlugin(outDir: string) {
  const qaHtmlPath = path.resolve(__dirname, outDir, "src/test/t184/index.html");
  const rootHtmlPath = path.resolve(__dirname, outDir, "index.html");

  return {
    name: "zenflow-t184-qa-html-root",
    closeBundle() {
      if (!existsSync(qaHtmlPath)) {
        throw new Error("T184 QA HTML output was not emitted");
      }
      renameSync(qaHtmlPath, rootHtmlPath);
    },
  };
}

function stripPwaManifestLink(html: string): string {
  return html.replace(/^\s*<link\s+rel=["']manifest["'][^>]*>\s*$/im, "");
}

function stripDisabledPwaManifestPlugin(pwaEnabled: boolean) {
  return {
    name: "zenflow-strip-disabled-pwa-manifest",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return pwaEnabled ? html : stripPwaManifestLink(html);
    },
  };
}

function isDeferredObservabilityPreload(dep: string): boolean {
  return dep.startsWith("assets/sentry-");
}

function isDeferredJournalPreload(dep: string): boolean {
  return (
    dep.startsWith("assets/JournalCalendarFull-") ||
    dep.startsWith("assets/JournalSettingsContent-") ||
    dep.startsWith("assets/KeyboardShortcutsOverlay-") ||
    dep.startsWith("assets/RemovePasswordConfirmDialog-") ||
    dep.startsWith("assets/StreakCelebration-") ||
    dep.startsWith("assets/journalExport-")
  );
}

const brandLogoAssets = JSON.parse(readFileSync("./config/brand-logo-assets.json", "utf-8")) as {
  pwaInstallIconRevision: string;
};
const PWA_INSTALL_ICON_REVISION = brandLogoAssets.pwaInstallIconRevision;
const pwaIconSrc = (file: string) => `${file}?v=${PWA_INSTALL_ICON_REVISION}`;

function isPlaceholderSentryUploadValue(value: string | undefined): boolean {
  const raw = value?.trim();
  if (!raw) return true;

  const normalized = raw.toLowerCase();
  return (
    /^<[^>]+>$/.test(raw) ||
    normalized === "todo" ||
    normalized === "changeme" ||
    normalized.startsWith("your-") ||
    normalized.startsWith("your_") ||
    normalized.startsWith("set-") ||
    normalized.startsWith("set_") ||
    normalized.includes("placeholder")
  );
}

function hasUsableSentryUploadEnv(values: Array<string | undefined>): boolean {
  return values.every((value) => !isPlaceholderSentryUploadValue(value));
}
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, __dirname, "VITE_");
  // Use relative paths for Capacitor/Android builds
  // Automatically determined by npm script (build vs build:android)
  const isCapacitor = process.env.CAPACITOR_BUILD === "true";
  const t184QaBuild = process.env.VITE_T184_QA_BUILD === "true";
  const outDir = t184QaBuild ? T184_QA_OUT_DIR : "dist";
  const androidMotionBenchmark =
    isCapacitor && process.env.ZENFLOW_ANDROID_MOTION_BENCHMARK === "true";
  const webBase = normalizeBasePath(process.env.VITE_APP_BASE || "/people-first-app/");
  const base = t184QaBuild ? "/" : isCapacitor ? "./" : webBase;
  const pwaEnabled = !isCapacitor && process.env.VITE_DISABLE_PWA !== "true";
  const journalSaveCeremonyBuildEnabled =
    process.env.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED === "true";
  const t173LifecycleProofEnabled =
    mode === "t173-lifecycle-proof" ||
    (process.env.VITE_T173_LIFECYCLE_PROOF ?? fileEnvironment.VITE_T173_LIFECYCLE_PROOF) === "true";

  // Read version from package.json
  const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
  const appVersion = packageJson.version;
  const appBuildTime = Number(process.env.VITE_APP_BUILD_TIME || Date.now());
  const sentrySourceMapUploadEnabled =
    mode === "production" &&
    hasUsableSentryUploadEnv([
      process.env.SENTRY_AUTH_TOKEN,
      process.env.SENTRY_ORG,
      process.env.SENTRY_PROJECT,
    ]);

  return {
    base,
    server: {
      host: "localhost",
      port: 8080,
      watch: {
        ignored: [
          "**/.codex/auto-context/**",
          "**/.codex-artifacts/**",
          "**/android/app/build/**",
          "**/coverage/**",
          "**/dist/**",
          "**/output/**",
          "**/playwright-report/**",
          "**/screenshots/**",
          "**/test-results/**",
          "**/tmp/**",
        ],
      },
    },
    preview: {
      host: "localhost",
      port: 8080,
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_TIME__: JSON.stringify(appBuildTime),
      // Keep the default-disabled ceremony runtime out of production bundles.
      // A literal build constant lets Rolldown prune its dynamic import graph.
      __JOURNAL_SAVE_CEREMONY_BUILD_ENABLED__: JSON.stringify(journalSaveCeremonyBuildEnabled),
      // Local profileable Android builds expose motion probes without changing
      // production release assets or WebView debugging policy.
      __ANDROID_MOTION_BENCHMARK__: JSON.stringify(androidMotionBenchmark),
      // Sentry tree-shaking (docs: getsentry/sentry-javascript CONTRIBUTING.md)
      // Replaces __DEBUG_BUILD__ → false in Sentry's bundles, strips all logger.* calls.
      __SENTRY_DEBUG__: false,
      // rrweb tree-shaking for Replay (Sentry v7.75.0+):
      // We don't embed iframes or shadow DOM → exclude those rrweb features.
      // Canvas kept (orb renders to canvas, Replay captures it).
      __RRWEB_EXCLUDE_IFRAME__: true,
      __RRWEB_EXCLUDE_SHADOW_DOM__: true,
    },
    plugins: [
      mode !== "development" && createCompactI18nBuildPlugin({ root: __dirname }),
      react(),
      changelogPlugin(),
      versionPlugin({ buildTime: appBuildTime }),
      mode === "development" && componentTagger(),
      // Precompress JS/CSS/HTML/SVG with Brotli (default q=11) + gzip (default q=9).
      // PWA web build only — Capacitor's default WebViewAssetLoader does NOT
      // do Content-Encoding negotiation, so .br/.gz files shipped inside the
      // APK would be dead weight (doubling asset footprint).
      // Skips < 1 KB. Keeps originals for servers that can't serve precompressed.
      // Brotli-11 ~17-25% smaller than gzip-9 on minified JS.
      pwaEnabled &&
        mode !== "development" &&
        compression({
          algorithms: ["brotliCompress", "gzip"],
          include: [/\.(js|mjs|css|html|svg|json|txt|ico)$/],
          threshold: 1024,
          deleteOriginalAssets: false,
        }),
      // Disable PWA for Capacitor builds (native apps don't need service workers)
      pwaEnabled
        ? VitePWA({
            // P1 Fix: Use injectManifest for custom SW with Background Sync support
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            injectRegister: "script-defer",
            registerType: "autoUpdate",
            includeAssets: [
              "favicon.ico",
              "favicon-16.png",
              "favicon-32.png",
              "favicon-48.png",
              "favicon-64.png",
              "apple-touch-icon.png",
              "pwa-192.png",
              "pwa-512.png",
              "pwa-maskable-512.png",
              "pwa-maskable-1024.png",
              "pwa-windows-44.png",
              "pwa-windows-50.png",
              "pwa-windows-71.png",
              "pwa-windows-150.png",
              "pwa-windows-310.png",
              "pwa-windows-wide-310x150.png",
              "pwa-windows-splash-620x300.png",
              "robots.txt",
              "offline.html",
              "runtime-perf-bootstrap.js",
              "registerSW.js",
            ],

            // Production-ready manifest
            manifest: {
              name: "ZenFlow - Daily Wellness",
              short_name: "ZenFlow",
              description:
                "Habit, mood and productivity tracker. Previously opened areas can work offline; some features need internet.",

              id: base,
              start_url: base,
              scope: base,

              display: "standalone",

              theme_color: "#4a9d7c",
              background_color: "#071513",

              lang: "en",
              dir: "ltr",

              categories: ["health", "lifestyle", "productivity"],

              icons: [
                {
                  src: pwaIconSrc("pwa-72.png"),
                  sizes: "72x72",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-96.png"),
                  sizes: "96x96",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-128.png"),
                  sizes: "128x128",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-144.png"),
                  sizes: "144x144",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-152.png"),
                  sizes: "152x152",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-192.png"),
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-384.png"),
                  sizes: "384x384",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-512.png"),
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-44.png"),
                  sizes: "44x44",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-50.png"),
                  sizes: "50x50",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-71.png"),
                  sizes: "71x71",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-150.png"),
                  sizes: "150x150",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-310.png"),
                  sizes: "310x310",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-wide-310x150.png"),
                  sizes: "310x150",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-windows-splash-620x300.png"),
                  sizes: "620x300",
                  type: "image/png",
                  purpose: "any",
                },
                {
                  src: pwaIconSrc("pwa-maskable-512.png"),
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
                {
                  src: pwaIconSrc("pwa-maskable-1024.png"),
                  sizes: "1024x1024",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],

              // Quick actions shortcuts
              shortcuts: [
                {
                  name: "Log Mood",
                  short_name: "Mood",
                  description: "Quickly log your mood",
                  url: `${base}orb/?nav=v2`,
                  icons: [
                    { src: pwaIconSrc("pwa-192.png"), sizes: "192x192", type: "image/png" },
                  ],
                },
                {
                  name: "Track Habit",
                  short_name: "Habit",
                  description: "Mark a habit as completed",
                  url: `${base}habits/?nav=v2`,
                  icons: [
                    { src: pwaIconSrc("pwa-192.png"), sizes: "192x192", type: "image/png" },
                  ],
                },
              ],
            },

            // P1 Fix: injectManifest configuration for custom SW
            injectManifest: {
              // Keep install precache to the real app shell and canonical orb boot path.
              // Large/lazy route chunks and social graphics are cached on demand by sw.ts.
              globPatterns: [
                "index.html",
                "assets/index-*.js",
                "assets/index-*.css",
                "assets/state-vendor-*.js",
                "assets/capacitor-*.js",
                "assets/lucide-icons-*.js",
                "assets/supabase-*.js",
                "assets/utils-vendor-*.js",
                "assets/dexie-*.js",
                "assets/OrbPage-*.js",
                "assets/OrbPage-*.css",
                "assets/orbWorker-*.js",
                ...(journalSaveCeremonyBuildEnabled
                  ? ["assets/atelier-v12-3-*.tgs", "assets/atelier-v12-3-*-reduced*.svg"]
                  : []),
                "assets/*.woff2",
              ],
              // version-check.js and version.json MUST always be fetched from network.
              // If precached, the old SW serves stale version-check.js with the old
              // version string baked in, making the version check pass incorrectly.
              globIgnores: [
                "version-check.js",
                "version.json",
                // Language chunks load on-demand when user selects a language.
                // Precaching all 7 adds ~750 KB to first install for unused locales.
                "**/uk-*.js",
                "**/es-*.js",
                "**/de-*.js",
                "**/fr-*.js",
                "**/ja-*.js",
                "**/ar-*.js",
                "**/he-*.js",
                // Heavy feature chunks — lazy-loaded, not needed for offline shell
                "**/chartTokens*.js",
              ],
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
            },

            devOptions: {
              enabled: false,
              type: "module",
            },
          })
        : null,
      stripDisabledPwaManifestPlugin(pwaEnabled),
      normalizeIndexBasePathPlugin(base),
      t184QaBuild && moveT184QaHtmlToRootPlugin(outDir),
      sentrySourceMapUploadEnabled
        ? sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            telemetry: false,
            release: {
              name: `zenflow@${appVersion}`,
            },
            sourcemaps: {
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          })
        : null,
    ].filter(Boolean),

    resolve: {
      alias: [
        ...(t173LifecycleProofEnabled
          ? [
              {
                find: "/src/main.tsx",
                replacement: path.resolve(__dirname, "./src/test/t173LifecycleProofEntry.tsx"),
              },
            ]
          : []),
        ...(mode === "production" && !isCapacitor
          ? [
              {
                find: "./AndroidDayLargeEffects",
                replacement: path.resolve(
                  __dirname,
                  "./src/pages/nav-v2/AndroidDayLargeEffects.web.tsx"
                ),
              },
              {
                find: /^.*habitTgsRuntime$/,
                replacement: path.resolve(
                  __dirname,
                  "./src/components/habit-pictogram/habitTgsRuntime.web.ts"
                ),
              },
            ]
          : []),
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },

    // LightningCSS transformer DISABLED — bypasses PostCSS pipeline which means
    // Tailwind directives (@tailwind base/components/utilities) never expand.
    // Result: CSS bundle ships only custom CSS without Tailwind utilities,
    // making EVERY md:flex / fixed / hidden / rounded-* class non-functional.
    // 2026-04-19 root cause of "design missing" visual regression.
    // Keep `cssMinify: "lightningcss"` below — minifier alone is safe.
    build: {
      outDir,
      target: "esnext",
      // Terser ~1-2% smaller than esbuild (20-40x slower, acceptable on CI only).
      // esbuild stays for dev minification via optimizeDeps.
      minify: mode === "production" ? "terser" : "esbuild",
      terserOptions: {
        module: true,
        compress: {
          drop_console: true,
          module: true,
          keep_fargs: false,
          passes: 3,
          pure_funcs: [
            "console.log",
            "console.debug",
            "console.warn",
            "console.info",
            "console.error",
            "console.trace",
            "logger.log",
            "logger.debug",
            "logger.info",
            "logger.warn",
            "logger.error",
            "logger.sync",
            "logger.auth",
          ],
        },
        format: { comments: false },
      },
      // LightningCSS minifier — paired with css.transformer above.
      cssMinify: "lightningcss",
      // Capacitor WebView + modern browsers all support native modulepreload.
      // Polyfill is 1.2 KB injected per HTML entry — not needed for our targets.
      modulePreload: {
        polyfill: false,
        resolveDependencies: (_filename, deps, context) => {
          return deps.filter((dep) => {
            if (isDeferredJournalPreload(dep)) return false;
            if (context.hostType === "html" && isDeferredObservabilityPreload(dep)) return false;
            return true;
          });
        },
      },
      // Speeds up CI build ~15s by skipping gzip-size probe (cosmetic log only).
      reportCompressedSize: false,
      // Keep ratchet/bundle evidence honest across repeated local and CI builds.
      emptyOutDir: true,

      rollupOptions: {
        input: t184QaBuild ? { index: "src/test/t184/index.html" } : undefined,
        output: {
          // Enable code splitting for better performance
          manualChunks(id) {
            // TDZ FIX: translations.ts and i18n/index.ts MUST stay in the main chunk
            // because LanguageContext imports from them. If they get split into a
            // separate chunk, module init order becomes non-deterministic → TDZ crash.
            // Language files (uk, es, de, fr, ja, ar, he) are dynamic imports — Vite
            // code-splits them automatically. en.ts is statically imported → stays in main.
            // DO NOT add a manualChunks rule for i18n/translations/languages here.

            // Only split node_modules below this point
            if (!id.includes("node_modules")) {
              return undefined;
            }

            // TDZ FIX (Sentry: "Cannot access 'V' before initialization"):
            // Libraries that import React (radix-ui, framer-motion, sonner, tanstack,
            // react-hook-form, react-day-picker, cmdk, vaul, input-otp)
            // MUST NOT be in manual chunks. When React internals get split across
            // chunks, browser module init order is non-deterministic and causes TDZ.
            // Only chunk libraries with ZERO React dependency.
            // Research: vitejs/vite#12209, vitejs/vite#9686, nuxt/nuxt#23354

            // Supabase client (no React dependency)
            if (id.includes("@supabase")) {
              return "supabase";
            }

            // Zustand state manager (no React dependency in core)
            if (id.includes("zustand")) {
              return "state-vendor";
            }

            // Dexie / IndexedDB (no React dependency)
            if (id.includes("dexie")) {
              return "dexie";
            }

            // Capacitor native bridge (no React dependency)
            if (id.includes("@capacitor")) {
              return "capacitor";
            }

            // Lucide icons (212 imports across 209 files). Tree-shakeable with
            // no React runtime dependency — SAFE to chunk per TDZ feedback doc.
            // Splits ~80-150 KB off the main bundle for better HTTP/2 parallelism.
            if (id.includes("lucide-react")) {
              return "lucide-icons";
            }

            // Pure utility libs (no React dependency)
            if (
              id.includes("class-variance-authority") ||
              id.includes("clsx") ||
              id.includes("tailwind-merge") ||
              id.includes("nanoid") ||
              id.includes("dompurify") ||
              id.includes("zod")
            ) {
              return "utils-vendor";
            }
          },

          // Hashed filenames for cache busting
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },

      sourcemap:
        mode === "production"
          ? sentrySourceMapUploadEnabled
            ? "hidden"
            : false
          : mode === "development",
      chunkSizeWarningLimit: 600, // KB
    },

    optimizeDeps: {
      include: ["react", "react-dom", "@supabase/supabase-js", "dexie", "nanoid"],
      // Vite's default dep scan crawls every HTML file under the project root.
      // Android build intermediates and Playwright reports contain generated
      // HTML that points at bundled JS, which must never become dev-server input.
      entries: ["index.html"],
    },
  };
});
