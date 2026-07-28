import { ZipArchive } from "archiver";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const projectRoot = path.resolve(import.meta.dirname, "..");
const output = path.join(projectRoot, "build", "runtimes");
const runtimes = [
  {
    name: "codex-win32-x64",
    source: path.join(
      projectRoot,
      "node_modules",
      "@openai",
      "codex-win32-x64",
    ),
  },
  {
    name: "claude-win32-x64",
    source: path.join(
      projectRoot,
      "node_modules",
      "@anthropic-ai",
      "claude-agent-sdk-win32-x64",
    ),
  },
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const runtime of runtimes) {
  const target = path.join(output, `${runtime.name}.zip`);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.directory(runtime.source, false);
  archive.finalize();
  await pipeline(archive, createWriteStream(target));
  console.log(`Prepared ${target}`);
}
