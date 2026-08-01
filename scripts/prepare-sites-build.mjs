import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const clientIndexUrl = new URL("../dist/client/index.html", import.meta.url);
const workerTemplateUrl = new URL("../sites/worker.mjs", import.meta.url);
const workerOutputUrl = new URL("../dist/server/index.js", import.meta.url);
const indexHtml = await readFile(clientIndexUrl, "utf8");
const workerTemplate = await readFile(workerTemplateUrl, "utf8");
const workerSource = workerTemplate.replace(
  "const INDEX_HTML = null;",
  `const INDEX_HTML = ${JSON.stringify(indexHtml)};`,
);

if (workerSource === workerTemplate) {
  throw new Error("无法把网站文档嵌入 Sites Worker");
}

await rm(new URL("../dist/server/", import.meta.url), {
  force: true,
  recursive: true,
});
await mkdir(new URL("../dist/server/", import.meta.url), { recursive: true });
await writeFile(workerOutputUrl, workerSource, "utf8");
await rm(clientIndexUrl);
await rm(new URL("../dist/client/_headers", import.meta.url), { force: true });
await mkdir(new URL("../dist/.openai/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../.openai/hosting.json", import.meta.url),
  new URL("../dist/.openai/hosting.json", import.meta.url),
);
