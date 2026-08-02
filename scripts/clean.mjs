import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);
const groups = {
  "build:web": ["dist"],
  "build:electron": ["dist-electron"],
  build: [
    "dist",
    "dist-electron",
    "tsconfig.app.tsbuildinfo",
    "tsconfig.node.tsbuildinfo",
    "vite.config.d.ts",
    "vite.config.js",
  ],
  test: ["coverage", "test-results", "playwright-report"],
  release: ["release", "artifacts"],
  qa: ["output"],
  cache: [
    ".tmp-preview",
    ".playwright-cli",
    ".playwright-mcp",
    ".reasonix",
    ".wrangler",
  ],
  dependencies: ["node_modules"],
};
groups.generated = [
  ...new Set([
    ...groups.build,
    ...groups.test,
    ...groups.release,
    ...groups.qa,
    ...groups.cache,
  ]),
];

const group = process.argv[2];
if (!group || !(group in groups)) {
  console.error(`Choose one clean group: ${Object.keys(groups).join(", ")}`);
  process.exitCode = 1;
} else {
  const targets = groups[group].map(resolveTarget);
  await Promise.all(
    targets.map((target) => rm(target, { force: true, recursive: true })),
  );
  process.stdout.write(`Cleaned ${group}: ${groups[group].join(", ")}\n`);
}

function resolveTarget(relativePath) {
  const target = path.resolve(projectRoot, relativePath);
  if (
    target === projectRoot ||
    !target.startsWith(`${projectRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to clean outside the project: ${relativePath}`);
  }
  return target;
}
