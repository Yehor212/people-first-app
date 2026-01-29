import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from 'fs';
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { changelogPlugin } from "./vite-plugin-changelog";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use relative paths for Capacitor/Android builds
  // Set to true for Android builds, false for web deployment
  const isCapacitor = false; // Changed to false for web deployment
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
    mode === "development" && componentTagger(),
    // Disable PWA for Capacitor builds (native apps don't need service workers)
    !isCapacitor ? VitePWA({
      registerType: "prompt", // User controls updates
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
        name: "ZenFlow — Ежедневное благополучие",
        short_name: "ZenFlow",
        description: "Трекер привычек, настроения и продуктивности. Работает оффлайн.",

      start_url: base,
      scope: base,

        display: "standalone",
        orientation: "portrait-primary",

        theme_color: "#4a9d7c",
        background_color: "#ffffff",

        lang: "ru",
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
            name: "Записать настроение",
            short_name: "Настроение",
            description: "Быстро отметить настроение",
            url: "/?tab=home",
            icons: [{ src: "pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Отметить привычку",
            short_name: "Привычка",
            description: "Отметить выполнение привычки",
            url: "/?tab=home",
            icons: [{ src: "pwa-192.png", sizes: "192x192" }],
          },
        ],
      },

      // Workbox configuration
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          // Only cache Supabase Storage (public assets) - NOT auth/database/realtime
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
        ],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api/, /\.(?:png|jpg|jpeg|svg|gif|woff2?)$/],
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
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI library (heavy Radix components)
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover',
            '@radix-ui/react-toast',
          ],

          // Charts library (only loaded when viewing stats)
          'charts': ['recharts'],

          // Backend libraries
          'backend': ['@supabase/supabase-js', 'dexie'],

          // Animation library
          'animations': ['framer-motion'],

          // Date utilities
          'date-utils': ['date-fns'],
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
