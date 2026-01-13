import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_VERSION__: JSON.stringify("2.0.0"),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
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

        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",

        theme_color: "#4a9d7c",
        background_color: "#ffffff",

        lang: "ru",
        dir: "ltr",

        categories: ["health", "lifestyle", "productivity"],

        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
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
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Отметить привычку",
            short_name: "Привычка",
            description: "Отметить выполнение привычки",
            url: "/?tab=home",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
        ],
      },

      // Workbox configuration
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              networkTimeoutSeconds: 10,
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
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /\.(?:png|jpg|jpeg|svg|gif|woff2?)$/],
      },

      devOptions: {
        enabled: mode === "development",
        type: "module",
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    target: "esnext",
    minify: "terser",

    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },

    rollupOptions: {
      output: {
        // Optimized chunking for caching
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
          "charts": ["recharts"],
          "supabase": ["@supabase/supabase-js"],
          "storage": ["dexie"],
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
}));
