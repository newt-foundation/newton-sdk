import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@newton-protocol/zktls-twitter-example": fileURLToPath(new URL("../sdk/src/index.ts", import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});
