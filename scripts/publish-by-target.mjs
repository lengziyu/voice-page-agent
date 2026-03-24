import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const target = process.argv[2];
const publishArgs = process.argv.slice(3);

const vueRanges = {
  vue2: ">=2.6.14 <2.7.0",
  "vue2.7": ">=2.7.0 <3.0.0",
  vue3: ">=3.2.0 <4.0.0",
};

if (!target || !vueRanges[target]) {
  console.error("Usage: node ./scripts/publish-by-target.mjs <vue2|vue2.7|vue3> [npm-publish-args...]");
  process.exit(1);
}

function run(cmd, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => {
      if (code === 0) resolveRun(undefined);
      else rejectRun(new Error(`${cmd} ${args.join(" ")} failed with code ${code}`));
    });
    child.on("error", rejectRun);
  });
}

function runQuiet(cmd, args) {
  return new Promise((resolveRun) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: true });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolveRun({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
    child.on("error", () => {
      resolveRun({
        code: 1,
        stdout: "",
        stderr: "",
      });
    });
  });
}

const packageJsonPath = resolve(process.cwd(), "package.json");
const original = await readFile(packageJsonPath, "utf8");
const pkg = JSON.parse(original);
const packageName = pkg.name;
const packageVersion = pkg.version;

const viewResult = await runQuiet("npm", ["view", `${packageName}@${packageVersion}`, "version"]);
if (viewResult.code === 0 && viewResult.stdout.trim()) {
  console.error(
    `[voice-page-agent] ${packageName}@${packageVersion} already exists on npm. ` +
      "You must bump version before publishing."
  );
  console.error("[voice-page-agent] Try: npm version patch --no-git-tag-version");
  process.exit(1);
}

pkg.peerDependencies = {
  ...(pkg.peerDependencies || {}),
  vue: vueRanges[target],
};

await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log(`[voice-page-agent] publishing tag "${target}" with peer vue range ${pkg.peerDependencies.vue}`);

try {
  await run("npm", ["publish", "--tag", target, ...publishArgs]);
} finally {
  await writeFile(packageJsonPath, original, "utf8");
}
