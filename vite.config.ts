import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { compression } from "vite-plugin-compression2";
import { changelogPlugin } from "./vite-plugin-changelog";
import { versionPlugin } from "./vite-plugin-version";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use relative paths for Capacitor/Android builds
  // Automatically determined by npm script (build vs build:android)
  const isCapacitor = process.env.CAPACITOR_BUILD === "true";
  const base = isCapacitor ? "./" : "/people-first-app/";

  // Read version from package.json
  const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
  const appVersion = packageJson.version;

  return {
    base,
    server: {
      host: "localhost",
      port: 8080,
    },
    preview: {
      host: "localhost",
      port: 8080,
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
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
      react(),
      changelogPlugin(),
      versionPlugin(),
      mode === "development" && componentTagger(),
      // Precompress JS/CSS/HTML/SVG with Brotli (default q=11) + gzip (default q=9).
      // Production only. Skips < 1 KB. Keeps originals for servers that can't
      // serve precompressed. Brotli-11 ~17-25% smaller than gzip-9 on minified JS.
      mode !== "development" &&
        compression({
          algorithms: ["brotliCompress", "gzip"],
          include: [/\.(js|mjs|css|html|svg|json|txt|ico)$/],
          threshold: 1024,
          deleteOriginalAssets: false,
        }),
      // Disable PWA for Capacitor builds (native apps don't need service workers)
      !isCapacitor
        ? VitePWA({
            // P1 Fix: Use injectManifest for custom SW with Background Sync support
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            registerType: "autoUpdate",
            includeAssets: [
              "favicon.ico",
              "apple-touch-icon.png",
              "pwa-192.png",
              "pwa-512.png",
              "robots.txt",
              "offline.html",
            ],

            // Production-ready manifest
            manifest: {
              name: "ZenFlow — Daily Wellness",
              short_name: "ZenFlow",
              description: "Habit, mood and productivity tracker. Works offline.",

              start_url: base,
              scope: base,

              display: "standalone",
              orientation: "portrait-primary",

              theme_color: "#4a9d7c",
              background_color: "#ffffff",

              lang: "en",
              dir: "ltr",

              categories: ["health", "lifestyle", "productivity"],

              icons: [
                { src: "pwa-72.png", sizes: "72x72", type: "image/png", purpose: "any" },
                { src: "pwa-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
                { src: "pwa-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
                { src: "pwa-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
                { src: "pwa-152.png", sizes: "152x152", type: "image/png", purpose: "any" },
                { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "pwa-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
                { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                {
                  src: "pwa-maskable-512.png",
                  sizes: "512x512",
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
                  url: `${base}?tab=home`,
                  icons: [{ src: "pwa-192.png", sizes: "192x192" }],
                },
                {
                  name: "Track Habit",
                  short_name: "Habit",
                  description: "Mark a habit as completed",
                  url: `${base}?tab=home`,
                  icons: [{ src: "pwa-192.png", sizes: "192x192" }],
                },
              ],
            },

            // P1 Fix: injectManifest configuration for custom SW
            injectManifest: {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
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
                "**/jspdf*.js",
                "**/chartTokens*.js",
              ],
              maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
            },

            devOptions: {
              enabled: mode === "development",
              type: "module",
            },
          })
        : null,
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Use lottie-web light build (no eval/expressions) to comply with CSP
        "lottie-web": path.resolve(
          __dirname,
          "node_modules/lottie-web/build/player/lottie_light.js"
        ),
        // Exclude unused jspdf optional dep from bundle (-202 kB).
        // jspdf loads html2canvas dynamically only for .html() method,
        // which ZenFlow never calls (verified: 0 .html() calls in codebase).
        html2canvas: path.resolve(__dirname, "src/lib/noop.ts"),
      },
    },

    // LightningCSS transformer: 2-3x faster than postcss, ~3-5% smaller CSS.
    // Preserves vendor prefixes (verified for -webkit-backdrop-filter).
    css: {
      transformer: "lightningcss",
    },
    build: {
      target: "esnext",
      minify: "esbuild",
      // LightningCSS minifier — paired with css.transformer above.
      cssMinify: "lightningcss",
      // Capacitor WebView + modern browsers all support native modulepreload.
      // Polyfill is 1.2 KB injected per HTML entry — not needed for our targets.
      modulePreload: { polyfill: false },
      // Speeds up CI build ~15s by skipping gzip-size probe (cosmetic log only).
      reportCompressedSize: false,

      rollupOptions: {
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
            // lottie-react, react-hook-form, react-day-picker, cmdk, vaul, input-otp)
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

            // Sentry Replay (rrweb-based session recording) — web only, big chunk,
            // changes independently from core → separate chunk for better cache.
            // TDZ-safe (no React dep — verified via @sentry-internal/replay pkg.json).
            if (
              id.includes("@sentry-internal/replay") ||
              id.includes("@sentry-internal/replay-canvas")
            ) {
              return "sentry-replay";
            }

            // Sentry Feedback widget — optional integration, split for cache.
            if (id.includes("@sentry-internal/feedback")) {
              return "sentry-feedback";
            }

            // Sentry core (error tracking + tracing + browser-utils). No React dep.
            if (id.includes("@sentry") && !id.includes("react")) {
              return "sentry";
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

          // Merge tiny chunks < 20 KB into neighbors — reduces HTTP overhead and
          // improves compression ratio. Vite 6 stable option.
          experimentalMinChunkSize: 20_000,
        },
      },

      sourcemap: mode === "development",
      chunkSizeWarningLimit: 600, // KB
    },

    optimizeDeps: {
      include: ["react", "react-dom", "@supabase/supabase-js", "dexie", "nanoid"],
    },

    // Strip /*! license */ banners from bundle. Ship THIRD_PARTY_LICENSES.txt
    // alongside the app for compliance. Saves 0.5-2 KB gzip.
    esbuild: {
      legalComments: "none",
    },
  };
});
