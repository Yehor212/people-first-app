import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
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
    },
    plugins: [
      react(),
      changelogPlugin(),
      versionPlugin(),
      mode === "development" && componentTagger(),
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
              globIgnores: ["version-check.js", "version.json"],
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

    build: {
      target: "esnext",
      minify: "esbuild",

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

            // Sentry error tracking (no React dependency in core)
            if (id.includes("@sentry") && !id.includes("react")) {
              return "sentry";
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

      sourcemap: mode === "development",
      chunkSizeWarningLimit: 600, // KB
    },

    optimizeDeps: {
      include: ["react", "react-dom", "@supabase/supabase-js", "dexie", "nanoid"],
    },
  };
});
