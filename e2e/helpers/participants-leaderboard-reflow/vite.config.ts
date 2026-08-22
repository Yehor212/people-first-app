import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(helperDirectory, "../../..");

export default defineConfig({
  root: repositoryRoot,
  base: "/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@/lib/challengeService",
        replacement: path.resolve(helperDirectory, "challengeServiceStub.ts"),
      },
      { find: "@", replacement: path.resolve(repositoryRoot, "src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    watch: {
      ignored: ["**/output/**", "**/test-results/**"],
    },
  },
});
