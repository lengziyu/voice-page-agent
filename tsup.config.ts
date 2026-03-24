import { defineConfig } from "tsup";
import { fileURLToPath } from "node:url";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  target: "es2019",
  platform: "browser",
  esbuildOptions(options) {
    options.conditions = ["browser", "import", "default"];
    options.alias = {
      ...(options.alias || {}),
      chalk: fileURLToPath(new URL("./src/shims/chalk.ts", import.meta.url)),
    };
  },
  noExternal: [
    /^page-agent$/,
    /^@page-agent\//,
    /^ai-motion$/,
    /^chalk$/,
    /^zod$/,
  ],
});
