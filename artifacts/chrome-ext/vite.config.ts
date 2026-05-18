import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      webExtension({
        manifest: "manifest.json",
        additionalInputs: [
          "src/content/index.tsx",
          "src/background/service-worker.ts",
          "src/sidepanel/main.tsx",
        ],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "dist",
    },
    define: {
      __API_BASE_URL__: JSON.stringify(
        env["VITE_API_BASE_URL"] ?? "http://localhost:5000"
      ),
      __SUPABASE_URL__: JSON.stringify(
        env["VITE_SUPABASE_URL"] ?? ""
      ),
      __SUPABASE_ANON_KEY__: JSON.stringify(
        env["VITE_SUPABASE_ANON_KEY"] ?? ""
      ),
    },
  };
});
