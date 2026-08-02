import { readdir, readFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const workflow = await readFile(
  new URL(".github/workflows/ci.yml", projectRoot),
  "utf8",
);
const snapshotFiles = await readdir(
  new URL("tests/e2e/core-flows.spec.ts-snapshots/", projectRoot),
);

const e2eJob = workflow
  .split(/^[ ]{2}e2e-tests:\s*$/m)[1]
  ?.split(/^[ ]{2}[\w-]+:\s*$/m)[0];
const runner = e2eJob?.match(/^[ ]{4}runs-on:\s*(\S+)\s*$/m)?.[1];
const runnerPlatform = runner?.startsWith("windows-")
  ? "win32"
  : runner?.startsWith("ubuntu-")
    ? "linux"
    : runner?.startsWith("macos-")
      ? "darwin"
      : null;

if (!runnerPlatform) {
  throw new Error(
    "Unable to determine the e2e-tests runner platform in ci.yml.",
  );
}

const visualSnapshots = snapshotFiles.filter((file) => file.endsWith(".png"));
const missingForRunner = visualSnapshots
  .filter((file) => /-(?:win32|linux|darwin)\.png$/.test(file))
  .filter((file) => !file.endsWith(`-${runnerPlatform}.png`))
  .map((file) =>
    file.replace(/-(?:win32|linux|darwin)\.png$/, `-${runnerPlatform}.png`),
  )
  .filter((expected) => !snapshotFiles.includes(expected));

if (missingForRunner.length) {
  console.error(
    `E2E snapshot check failed: ${runner} requires ${runnerPlatform} baselines:`,
  );
  missingForRunner.forEach((file) => console.error(`- ${file}`));
  process.exitCode = 1;
} else {
  process.stdout.write(
    `E2E snapshot check passed for ${runner} (${runnerPlatform}).\n`,
  );
}
