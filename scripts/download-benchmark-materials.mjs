/* eslint-disable no-console */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const projectRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(projectRoot, "benchmarks", "manifest.json");
const corpusDir = path.join(projectRoot, "benchmarks", "corpus");
const profileArg = process.argv.indexOf("--profile");
const profile = profileArg >= 0 ? process.argv[profileArg + 1] : "smoke";
const includeReference = process.argv.includes("--include-reference");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(corpusDir, { recursive: true });

async function sha256(filename) {
  const hash = createHash("sha256");
  hash.update(await readFile(filename));
  return hash.digest("hex");
}

for (const material of manifest.materials) {
  if (
    material.profile !== profile &&
    !(includeReference && material.profile === "reference")
  ) {
    continue;
  }
  const destination = path.join(corpusDir, material.filename);
  const partial = `${destination}.partial`;
  let current;
  try {
    current = await stat(destination);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current) {
    const cachedHash = await sha256(destination);
    if (material.sha256 && cachedHash !== material.sha256) {
      throw new Error(
        `${material.id}: cached sha256 ${cachedHash} does not match manifest ${material.sha256}`,
      );
    }
    console.log(
      `cached  ${material.id} (${current.size} bytes, sha256 ${cachedHash})`,
    );
    continue;
  }

  console.log(`fetch   ${material.id}`);
  const response = await fetch(material.url, {
    redirect: "follow",
    headers: { "user-agent": "zhiye-benchmark/1.0" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`${material.id}: HTTP ${response.status}`);
  }
  await rm(partial, { force: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, destination);
  const downloaded = await stat(destination);
  const downloadedHash = await sha256(destination);
  if (material.sha256 && downloadedHash !== material.sha256) {
    throw new Error(
      `${material.id}: downloaded sha256 ${downloadedHash} does not match manifest ${material.sha256}`,
    );
  }
  console.log(
    `saved   ${material.filename} (${downloaded.size} bytes, sha256 ${downloadedHash})`,
  );
}
