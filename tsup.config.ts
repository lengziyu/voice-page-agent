import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  target: "es2019",
  noExternal: [
    /^page-agent$/,
    /^@page-agent\//,
    /^ai-motion$/,
    /^chalk$/,
    /^zod$/,
  ],
});
