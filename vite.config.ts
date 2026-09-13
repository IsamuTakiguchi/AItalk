import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The manifest is a real file in public/ so it can be read and edited
      // directly; the plugin only needs to generate the service worker.
      injectRegister: "auto",
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        // The API must never be served from cache: a stale tutor reply or a
        // stale progress snapshot would be worse than an error.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // In dev the API runs as a separate Node process (the same entry Railway runs).
      "/api": "http://localhost:3000",
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
