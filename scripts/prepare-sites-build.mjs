import { copyFile, mkdir, rm } from "node:fs/promises";

await rm(new URL("../dist/server/", import.meta.url), {
  force: true,
  recursive: true,
});
await mkdir(new URL("../dist/server/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../sites/worker.mjs", import.meta.url),
  new URL("../dist/server/index.js", import.meta.url),
);
await mkdir(new URL("../dist/.openai/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../.openai/hosting.json", import.meta.url),
  new URL("../dist/.openai/hosting.json", import.meta.url),
);
