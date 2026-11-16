import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porta diferente da do launcher (1420), para dar para rodar os dois juntos.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
});
