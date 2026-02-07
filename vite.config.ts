import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from 'fs';
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { changelogPlugin } from "./vite-plugin-changelog";
import { versionPlugin } from "./vite-plugin-version";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use relative paths for Capacitor/Android builds
  // Automatically determined by npm script (build vs build:android)
  const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
  const base = isCapacitor ? "./" : "/people-first-app/";

  // Read version from package.json
  const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
  const appVersion = packageJson.version;

  return {
  base,
  server: {
    host: "::",
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
    !isCapacitor ? VitePWA({
      // P1 Fix: Use injectManifest for custom SW with Background Sync support
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],

        // Quick actions shortcuts
        shortcuts: [
          {
            name: "Log Mood",
            short_name: "Mood",
            description: "Quickly log your mood",
            url: "/?tab=home",
            icons: [{ src: "pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Track Habit",
            short_name: "Habit",
            description: "Mark a habit as completed",
            url: "/?tab=home",
            icons: [{ src: "pwa-192.png", sizes: "192x192" }],
          },
        ],
      },

      // P1 Fix: injectManifest configuration for custom SW
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
      },

      devOptions: {
        enabled: mode === "development",
        type: "module",
      },
    }) : null,
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    target: "esnext",
    minify: "esbuild",

    rollupOptions: {
      output: {
        // Enable code splitting for better performance
        manualChunks(id) {
          // Translations are huge (~16K lines) — separate chunk
          if (id.includes('translations')) {
            return 'i18n';
          }

          // Only split node_modules below this point
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Core React libraries
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          // React core (match 'react/' but not 'react-*' packages)
          if (/[\\/]node_modules[\\/]react[\\/]/.test(id)) {
            return 'react-vendor';
          }

          // UI library (Radix components)
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }

          // Note: recharts NOT manually chunked — its CJS interop helpers
          // get shared across chunks, creating circular deps + TDZ errors.
          // Vite auto-splits it into the StatsPage lazy chunk instead.

          // Supabase client
          if (id.includes('@supabase')) {
            return 'supabase';
          }

          // Dexie (IndexedDB)
          if (id.includes('dexie')) {
            return 'dexie';
          }

          // Framer Motion
          if (id.includes('framer-motion')) {
            return 'framer-motion';
          }

          // date-fns
          if (id.includes('date-fns')) {
            return 'date-fns';
          }

          // TanStack Query + Virtual
          if (id.includes('@tanstack')) {
            return 'tanstack';
          }

          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'lucide-icons';
          }

          // Capacitor native bridge
          if (id.includes('@capacitor')) {
            return 'capacitor';
          }

          // Lottie animations (lottie-react + lottie-web)
          if (id.includes('lottie-react') || id.includes('lottie-web')) {
            return 'lottie';
          }

          // Sentry error tracking
          if (id.includes('@sentry')) {
            return 'sentry';
          }

          // Form utilities (zod, react-hook-form, resolvers)
          if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) {
            return 'forms';
          }

          // Remaining small UI libs (sonner, vaul, cmdk, embla, etc.)
          if (id.includes('sonner') || id.includes('vaul') || id.includes('cmdk') || id.includes('embla-carousel') || id.includes('input-otp') || id.includes('react-day-picker') || id.includes('react-resizable-panels') || id.includes('next-themes')) {
            return 'ui-extras';
          }

          // Utility libs (clsx, class-variance-authority, tailwind-merge, nanoid, dompurify)
          if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('nanoid') || id.includes('dompurify')) {
            return 'utils-vendor';
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
    include: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js", "dexie", "nanoid"],
  },
};});
