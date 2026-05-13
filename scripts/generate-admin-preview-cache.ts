import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { photos } from "../src/content/seed";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicPreviewRoot = join(repoRoot, "public", "_admin-previews");
const sourceCacheRoot = join(repoRoot, "tmp", "admin-preview-sources");
const targetBytes = 220 * 1024;
const maxLongEdges = [960, 840, 720, 640];

async function main() {
  let generated = 0;
  let skipped = 0;

  for (const photo of photos) {
    const sourceUrl = `${photo.r2.assetBaseUrl}/${photo.r2.originalKey}`;
    const sourcePath = join(sourceCacheRoot, photo.r2.originalKey);
    const outputPath = join(publicPreviewRoot, photo.r2.originalKey);

    if (await isUsablePreview(outputPath)) {
      skipped += 1;
      continue;
    }

    await downloadIfMissing(sourceUrl, sourcePath);
    await makePreview(sourcePath, outputPath);
    await removeSourceCache(sourcePath);
    generated += 1;
  }

  console.log(`Admin preview cache ready: ${generated} generated, ${skipped} skipped.`);
}

async function isUsablePreview(path: string) {
  try {
    const info = await stat(path);

    return info.isFile() && info.size > 0 && info.size <= targetBytes;
  } catch {
    return false;
  }
}

async function downloadIfMissing(url: string, outputPath: string) {
  try {
    const info = await stat(outputPath);

    if (info.isFile() && info.size > 0) return;
  } catch {
    // Download below.
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

async function makePreview(sourcePath: string, outputPath: string) {
  await mkdir(dirname(outputPath), { recursive: true });

  for (const [index, maxLongEdge] of maxLongEdges.entries()) {
    const temporaryPath = `${outputPath}.tmp-${maxLongEdge}.jpg`;

    await run("sips", [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      "62",
      "-Z",
      String(maxLongEdge),
      sourcePath,
      "--out",
      temporaryPath
    ]);

    const info = await stat(temporaryPath);
    const isLastAttempt = index === maxLongEdges.length - 1;

    if (info.size <= targetBytes || isLastAttempt) {
      await rename(temporaryPath, outputPath);
      return;
    }
  }
}

async function removeSourceCache(path: string) {
  try {
    await unlink(path);
  } catch {
    // The temporary source cache is best-effort only.
  }
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
