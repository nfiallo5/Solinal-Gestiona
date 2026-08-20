import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Where the API lives during `npm run dev`. The dev server proxies `/api/*`
 * to it, so the browser always talks to its own origin and CORS never enters
 * the picture — including when Vite falls back to a port the backend's
 * CORS_ORIGIN list does not know about. See src/lib/api.ts.
 */
const API_TARGET = process.env.VITE_API_URL ?? "http://localhost:3001";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
