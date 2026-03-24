import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const channelConfig = {
  vue2: {
    tag: "vue2",
    peerRange: ">=2.6.14 <2.7.0",
  },
  "vue2.7": {
    tag: "vue2.7",
    peerRange: ">=2.7.0 <3.0.0",
  },
  vue3: {
    tag: "vue3",
    peerRange: ">=3.2.0 <4.0.0",
  },
};

function parseArgs(argv) {
  const options = {
    versions: {},
    latest: "vue3",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--latest") {
      const next = argv[i + 1];
      if (!next || !channelConfig[next]) {
        throw new Error("--latest requires one of: vue2, vue2.7, vue3");
      }
      options.latest = next;
      i += 1;
      continue;
    }
    if (arg === "--no-latest") {
      options.latest = null;
      continue;
    }
    if (arg === "--vue2" || arg === "--vue2.7" || arg === "--vue3") {
      const channel = arg.slice(2);
      const version = argv[i + 1];
      if (!version) {
        throw new Error(`${arg} requires a version, e.g. ${arg} 2.0.1`);
      }
      options.versions[channel] = version;
      i += 1;
      continue;
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  return options;
}

function parseSemver(version) {
  const matched = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/);
  if (!matched) return null;
  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
  };
}

function validateChannelVersion(channel, version) {
  const parsed = parseSemver(version);
  if (!parsed) {
    throw new Error(`[${channel}] invalid semver: ${version}`);
  }
  if (channel === "vue2" && !(parsed.major === 2 && parsed.minor === 0)) {
    throw new Error(`[${channel}] version must be 2.0.x, got ${version}`);
  }
  if (channel === "vue2.7" && !(parsed.major === 2 && parsed.minor === 7)) {
    throw new Error(`[${channel}] version must be 2.7.x, got ${version}`);
  }
  if (channel === "vue3" && parsed.major !== 3) {
    throw new Error(`[${channel}] version must be 3.x, got ${version}`);
  }
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

function usage() {
  console.log("Usage:");
  console.log(
    "  node ./scripts/release-multi.mjs --vue2 2.0.x --vue2.7 2.7.x --vue3 3.x.x [--latest vue3|vue2.7|vue2] [--dry-run]"
  );
  console.log("Examples:");
  console.log("  node ./scripts/release-multi.mjs --vue2 2.0.1 --vue2.7 2.7.1 --vue3 3.0.0 --latest vue3");
  console.log("  node ./scripts/release-multi.mjs --vue3 3.1.0 --latest vue3");
  console.log("  node ./scripts/release-multi.mjs --vue2 2.0.2 --no-latest --dry-run");
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}

const releaseOrder = ["vue2", "vue2.7", "vue3"].filter((channel) => options.versions[channel]);
if (releaseOrder.length === 0) {
  console.error("At least one channel version is required: --vue2 / --vue2.7 / --vue3");
  usage();
  process.exit(1);
}

for (const channel of releaseOrder) {
  validateChannelVersion(channel, options.versions[channel]);
}

if (options.latest && !channelConfig[options.latest]) {
  console.error("latest channel must be one of: vue2, vue2.7, vue3");
  process.exit(1);
}

const packageJsonPath = resolve(process.cwd(), "package.json");
const original = await readFile(packageJsonPath, "utf8");
const originalPkg = JSON.parse(original);
const packageName = originalPkg.name;

for (const channel of releaseOrder) {
  const version = options.versions[channel];
  const exists = await runQuiet("npm", ["view", `${packageName}@${version}`, "version"]);
  if (exists.code === 0 && exists.stdout.trim()) {
    console.error(`[${channel}] ${packageName}@${version} already exists on npm. Please choose a new version.`);
    process.exit(1);
  }
}

const publishedMap = {};

try {
  for (const channel of releaseOrder) {
    const version = options.versions[channel];
    const config = channelConfig[channel];
    const nextPkg = JSON.parse(original);
    nextPkg.version = version;
    nextPkg.peerDependencies = {
      ...(nextPkg.peerDependencies || {}),
      vue: config.peerRange,
    };

    await writeFile(packageJsonPath, `${JSON.stringify(nextPkg, null, 2)}\n`, "utf8");
    console.log(`[release] channel=${channel} version=${version} peer.vue=${config.peerRange}`);

    const publishArgs = ["publish", "--tag", config.tag];
    if (options.dryRun) publishArgs.push("--dry-run");
    await run("npm", publishArgs);

    if (!options.dryRun) {
      await run("npm", ["dist-tag", "add", `${packageName}@${version}`, config.tag]);
    }

    publishedMap[channel] = version;
  }

  if (options.latest) {
    const latestVersion = publishedMap[options.latest];
    if (!latestVersion) {
      console.warn(`[release] skip latest: selected channel "${options.latest}" was not published in this run`);
    } else if (options.dryRun) {
      console.log(`[release] dry-run: would set latest -> ${packageName}@${latestVersion}`);
    } else {
      await run("npm", ["dist-tag", "add", `${packageName}@${latestVersion}`, "latest"]);
      console.log(`[release] latest -> ${packageName}@${latestVersion}`);
    }
  }
} finally {
  await writeFile(packageJsonPath, original, "utf8");
}

console.log("[release] done");
