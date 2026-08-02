import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const projectRoot = new URL("../", import.meta.url);

const forbiddenRoots = new Set([
  ".playwright-cli",
  ".playwright-mcp",
  ".reasonix",
  ".tmp-preview",
  ".wrangler",
  "artifacts",
  "coverage",
  "dist",
  "dist-electron",
  "output",
  "playwright-report",
  "release",
  "test-results",
  "node_modules",
]);
const forbiddenFiles = new Set([
  "reasonix.toml",
  "vite.config.d.ts",
  "vite.config.js",
]);
const forbiddenSuffixes = [".log", ".tsbuildinfo"];
const requiredProjectFiles = [
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "NOTICE",
  "SECURITY.md",
  "SUPPORT.md",
];
const result = spawnSync("git", ["ls-files", "-z"], {
  cwd: projectRoot,
  encoding: "utf8",
  windowsHide: true,
});

if (result.status !== 0) {
  throw new Error(result.stderr.trim() || "Unable to inspect tracked files.");
}

const violations = result.stdout
  .split("\0")
  .filter(Boolean)
  .filter((file) => existsSync(new URL(file, projectRoot)))
  .filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    const [root] = normalized.split("/");
    return (
      forbiddenRoots.has(root) ||
      forbiddenFiles.has(normalized) ||
      (normalized.startsWith(".openai/") && normalized.endsWith(".tar.gz")) ||
      forbiddenSuffixes.some((suffix) => normalized.endsWith(suffix))
    );
  });

const missingProjectFiles = requiredProjectFiles.filter(
  (file) => !existsSync(new URL(file, projectRoot)),
);

if (violations.length || missingProjectFiles.length) {
  console.error("Repository hygiene check failed.");
  if (violations.length) {
    console.error("Remove these generated files from Git:");
    violations.forEach((file) => console.error(`- ${file}`));
  }
  if (missingProjectFiles.length) {
    console.error("Add these required project files:");
    missingProjectFiles.forEach((file) => console.error(`- ${file}`));
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Repository hygiene check passed.\n");
}
