import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta fixa: o Tauri aponta para ela em modo dev.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 900 },
});
