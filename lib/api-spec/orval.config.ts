import { defineConfig } from "orval";

export default defineConfig({
  memory: {
    input: "./openapi.yaml",
    output: {
      target: "../api-zod/src/generated/api.ts",
      client: "zod",
      mode: "single",
    },
  },
});
