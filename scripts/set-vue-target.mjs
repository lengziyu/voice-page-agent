import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv[2];

const vueRanges = {
  vue2: ">=2.6.14 <2.7.0",
  "vue2.7": ">=2.7.0 <3.0.0",
  vue3: ">=3.2.0 <4.0.0",
};

if (!target || !vueRanges[target]) {
  console.error("Usage: node ./scripts/set-vue-target.mjs <vue2|vue2.7|vue3>");
  process.exit(1);
}

const packageJsonPath = resolve(process.cwd(), "package.json");
const source = await readFile(packageJsonPath, "utf8");
const pkg = JSON.parse(source);

pkg.peerDependencies = {
  ...(pkg.peerDependencies || {}),
  vue: vueRanges[target],
};

await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log(`[voice-page-agent] peerDependencies.vue -> ${pkg.peerDependencies.vue}`);
