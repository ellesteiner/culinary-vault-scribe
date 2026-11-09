import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "Culinary Vault API",
      source: "functions/api/index.ts",
      env: {
        // Optional: ai-sous-chef/parse-recipe/suggest-tags return "AI not
        // configured" (matching the old edge functions) when this is unset.
        OPENAI_API_KEY: { value: process.env.OPENAI_API_KEY, required: false },
      },
    },
  },
});
