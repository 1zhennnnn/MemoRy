import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  envDir: path.resolve(__dirname, "../../"),  // read .env from workspace root
  server: { port: 3000 },
  build: { outDir: "dist" },
});
