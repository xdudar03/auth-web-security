import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: true,
    target: "node20",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/server.ts",
      output: {
        entryFileNames: "server.mjs",
        format: "esm",
      },
      external: [
        // Keep native Node deps and sqlite native bindings external
        "node:fs",
        "node:path",
        "node:sqlite",
      ],
    },
  },
  ssr: {
    noExternal: [
      // Ensure Express and middleware are bundled compatibly
      "express",
      "cors",
      "express-session",
      "@simplewebauthn/server",
    ],
  },
});
