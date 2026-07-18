import { access, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "src/content/portfolio-manifest.json");
const args = process.argv.slice(2);
const sourceArg = args.find((arg) => !arg.startsWith("--"));
const execute = args.includes("--execute");
const concurrency = readPositiveOption("--concurrency", 6);
const bucket = readTextOption("--bucket", "yakov-public-assets");

if (!sourceArg) {
  throw new Error(
    "Usage: node scripts/upload-portfolio-to-r2.mjs /path/to/fable/public " +
      "[--execute] [--bucket=name] [--concurrency=6]"
  );
}

const sourceRoot = resolve(sourceArg);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const taskMap = new Map();

for (const album of manifest.albums ?? []) {
  for (const image of album.images ?? []) {
    addTask(image.srcKey, image.srcBytes);
    addTask(image.thumbKey, image.thumbBytes);
  }
}

const tasks = [...taskMap.values()];
let totalBytes = 0;

for (const task of tasks) {
  const sourcePath = resolve(sourceRoot, task.key);
  if (!sourcePath.startsWith(`${sourceRoot}${sep}`)) {
    throw new Error(`Asset path escapes the source root: ${task.key}`);
  }

  const fileStat = await stat(sourcePath);
  if (!fileStat.isFile()) throw new Error(`Asset is not a file: ${sourcePath}`);
  if (fileStat.size !== task.bytes) {
    throw new Error(
      `Asset size mismatch for ${task.key}: manifest=${task.bytes}, disk=${fileStat.size}`
    );
  }

  task.sourcePath = sourcePath;
  totalBytes += fileStat.size;
}

console.log(
  `${execute ? "Uploading" : "Validated"} ${tasks.length} JPEGs ` +
    `(${formatBytes(totalBytes)}) for bucket ${bucket}.`
);

if (!execute) {
  console.log("Dry run only. Add --execute to upload through Wrangler.");
  process.exit(0);
}

const wranglerBin = resolve(projectRoot, "node_modules/.bin/wrangler");
await access(wranglerBin);

let nextIndex = 0;
let completed = 0;
let firstFailure;

await Promise.all(
  Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (!firstFailure) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;

      try {
        await upload(tasks[index]);
        completed += 1;
        if (completed % 25 === 0 || completed === tasks.length) {
          console.log(`Uploaded ${completed}/${tasks.length}`);
        }
      } catch (error) {
        firstFailure = error;
      }
    }
  })
);

if (firstFailure) throw firstFailure;
console.log(`Upload complete: ${tasks.length} objects in ${bucket}.`);

function addTask(key, bytes) {
  if (typeof key !== "string" || !key || !Number.isInteger(bytes) || bytes <= 0) {
    throw new Error("Every manifest asset needs a key and positive byte count.");
  }

  const normalizedKey = key.replace(/^\/+/, "");
  const existing = taskMap.get(normalizedKey);
  if (existing && existing.bytes !== bytes) {
    throw new Error(`Conflicting manifest entries for ${normalizedKey}`);
  }
  taskMap.set(normalizedKey, { key: normalizedKey, bytes });
}

function upload(task) {
  const objectPath = `${bucket}/${task.key}`;
  const child = spawn(
    wranglerBin,
    [
      "r2",
      "object",
      "put",
      objectPath,
      "--remote",
      "--file",
      task.sourcePath,
      "--content-type",
      "image/jpeg",
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--force"
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, WRANGLER_LOG: "none" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  return new Promise((resolvePromise, rejectPromise) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(`Upload failed for ${task.key} (exit ${code}):\n${output.slice(-2000)}`)
      );
    });
  });
}

function readPositiveOption(name, fallback) {
  const value = readTextOption(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 16) {
    throw new Error(`${name} must be an integer from 1 to 16.`);
  }
  return parsed;
}

function readTextOption(name, fallback) {
  const prefix = `${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : fallback;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
