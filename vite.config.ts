import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // In dev the API runs as a separate Node process (the same entry Railway runs).
      "/api": "http://localhost:3000",
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
