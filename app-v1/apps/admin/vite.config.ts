import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  preview: { port: 4174 },
  build: { target: "es2022", sourcemap: false },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
