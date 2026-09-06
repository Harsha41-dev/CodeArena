import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/monaco-editor/") || normalized.includes("/node_modules/@monaco-editor/")) {
            return "monaco-editor";
          }
          if (
            normalized.includes("/node_modules/react/") ||
            normalized.includes("/node_modules/react-dom/") ||
            normalized.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (
            normalized.includes("/node_modules/@tanstack/") ||
            normalized.includes("/node_modules/axios/") ||
            normalized.includes("/node_modules/react-router/") ||
            normalized.includes("/node_modules/zustand/")
          ) {
            return "app-vendor";
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 5173
  },
  preview: {
    port: 5173
  }
});
