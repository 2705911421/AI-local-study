import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const output = path.join(os.tmpdir(), `zhiye-electron-builder-${process.pid}`);
const artifacts = path.join(projectRoot, "artifacts");
const preparedRuntimes = path.join(projectRoot, "build", "runtimes");
const builderCli = path.join(
  projectRoot,
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js",
);
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const installerName = `Zhiye-${packageJson.version}-windows-x64.exe`;
const requireSignature = process.argv.includes("--require-signature");
const allowUnsigned = process.argv.includes("--unsigned");
const signingCertificate =
  process.env.WIN_CSC_LINK || process.env.CSC_LINK;

if (requireSignature === allowUnsigned) {
  throw new Error(
    "Choose exactly one release mode: --require-signature or --unsigned.",
  );
}
if (requireSignature && !signingCertificate) {
  throw new Error(
    "Signed Windows builds require WIN_CSC_LINK (or CSC_LINK) and WIN_CSC_KEY_PASSWORD. Use npm run desktop:build:unsigned only for local QA.",
  );
}

try {
  await run(process.execPath, [
    path.join(projectRoot, "scripts", "generate-brand-assets.mjs"),
  ]);
  await run(process.execPath, [
    path.join(projectRoot, "scripts", "prepare-agent-runtimes.mjs"),
  ]);
  await run(process.execPath, [
    builderCli,
    "--win",
    "nsis",
    "--x64",
    `--config.forceCodeSigning=${requireSignature}`,
    `--config.directories.output=${output.replaceAll("\\", "/")}`,
  ], {
    CSC_IDENTITY_AUTO_DISCOVERY: requireSignature ? "true" : "false",
  });
  const builtInstaller = path.join(output, installerName);
  if (requireSignature) await verifySignature(builtInstaller);
  await mkdir(artifacts, { recursive: true });
  await Promise.all([
    copyFile(
      builtInstaller,
      path.join(artifacts, installerName),
    ),
    copyFile(
      path.join(output, `${installerName}.blockmap`),
      path.join(artifacts, `${installerName}.blockmap`),
    ),
  ]);
  const digest = createHash("sha256")
    .update(await readFile(builtInstaller))
    .digest("hex")
    .toUpperCase();
  await writeFile(
    path.join(artifacts, `${installerName}.sha256`),
    `${digest}  ${installerName}\n`,
    "utf8",
  );
  if (requireSignature) {
    const installerBytes = await readFile(builtInstaller);
    const sha512 = createHash("sha512").update(installerBytes).digest("base64");
    const releaseDate = new Date().toISOString();
    const latestYaml = [
      `version: ${packageJson.version}`,
      `files:`,
      `  - url: ${installerName}`,
      `    sha512: ${sha512}`,
      `    size: ${installerBytes.byteLength}`,
      `path: ${installerName}`,
      `sha512: ${sha512}`,
      `releaseDate: '${releaseDate}'`,
      "",
    ].join("\n");
    await writeFile(
      path.join(artifacts, "latest.yml"),
      latestYaml,
      "utf8",
    );
    await writeFile(
      path.join(artifacts, "release-notes.json"),
      JSON.stringify(
        {
          version: packageJson.version,
          filename: installerName,
          size: installerBytes.byteLength,
          sha256: digest,
          releaseDate,
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  console.log(`Desktop installer: ${path.join(artifacts, installerName)}`);
  console.log(`SHA-256: ${digest}`);
  if (allowUnsigned) {
    console.warn(
      "Unsigned QA build created. Do not distribute it as a public release.",
    );
  }
} finally {
  await Promise.all([
    rm(output, { recursive: true, force: true }).catch(() => undefined),
    rm(preparedRuntimes, { recursive: true, force: true }).catch(
      () => undefined,
    ),
  ]);
}

function run(command, args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        ...envOverrides,
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`electron-builder exited with code ${code}`));
    });
  });
}

async function verifySignature(installer) {
  const command = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:ZHIYE_INSTALLER;",
    "if ($signature.Status -ne 'Valid') {",
    "  throw \"Installer signature is $($signature.Status): $($signature.StatusMessage)\"",
    "}",
  ].join(" ");
  await run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { ZHIYE_INSTALLER: installer },
  );
}
