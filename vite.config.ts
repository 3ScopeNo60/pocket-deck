import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// `--mode single` inlines everything into one HTML file (used to publish prototypes as an Artifact).
export default defineConfig(({ mode, command }) => {
  let sha = "nogit";
  try { sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* not a repo */ }
  const buildId = command === "serve" ? "dev" : `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)}-${sha}`;
  const notes = JSON.parse(readFileSync("release-notes.json", "utf8"));
  return {
    base: "./",
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      mode === "single" ? viteSingleFile() : {
        // version.json lets an open copy of the app notice that a newer build has been published.
        name: "emit-version",
        generateBundle() {
          this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id: buildId, builtAt: new Date().toISOString(), ...notes }) });
        },
      },
    ],
    build: { outDir: mode === "single" ? "dist-single" : "dist" },
  };
});
