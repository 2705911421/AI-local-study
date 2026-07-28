import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  access,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Codex } from "@openai/codex-sdk";
import { query as queryClaude } from "@anthropic-ai/claude-agent-sdk";
import extractZip from "extract-zip";
import { buildTask, parseStructured } from "./prompts.mjs";

const require = createRequire(import.meta.url);

export function createAgentSource({
  userData,
  settingsStore,
  openExternal,
  runtimeAssets,
  appVersion = "development",
}) {
  const runtimeRoot = path.join(userData, "agent-runtime");
  const providerRuntimeRoot = path.join(
    runtimeRoot,
    "providers",
    appVersion,
  );
  const codexHome = path.join(userData, "codex-home");
  const workspace = path.join(runtimeRoot, "empty-workspace");
  const images = path.join(runtimeRoot, "images");
  const runtimePreparations = new Map();

  async function initialize() {
    await Promise.all([
      mkdir(codexHome, { recursive: true }),
      mkdir(workspace, { recursive: true }),
      rm(images, { recursive: true, force: true }).then(() =>
        mkdir(images, { recursive: true }),
      ),
    ]);
  }

  async function statuses() {
    await initialize();
    const codexPath = await cachedProviderPath("codex");
    const [codexLoggedIn, claudeLoggedIn] = await Promise.all([
      codexPath ? codexStatus(codexPath, codexHome) : false,
      settingsStore.hasProviderCredential("claude"),
    ]);
    return [
      {
        provider: "codex",
        availability: codexLoggedIn ? "ready" : "not-authenticated",
        authenticated: codexLoggedIn,
        capabilities: { text: true, vision: true, modelList: false },
        label: "Codex",
        detail: codexLoggedIn
          ? undefined
          : codexPath
            ? "需要在知页中登录 Codex"
            : "首次连接时将准备 Codex 组件",
      },
      {
        provider: "claude",
        availability: claudeLoggedIn ? "ready" : "not-authenticated",
        authenticated: claudeLoggedIn,
        capabilities: { text: true, vision: true, modelList: false },
        label: "Claude",
        detail: claudeLoggedIn
          ? undefined
          : "需要连接 Claude 订阅或填写专用 API Key",
      },
    ];
  }

  async function login(provider) {
    await initialize();
    if (provider === "codex") {
      const codexPath = await ensureProviderPath("codex");
      await runLoginProcess(
        codexPath,
        ["login", "--device-auth"],
        codexEnvironment(codexHome),
        openExternal,
      );
    } else if (provider === "claude") {
      const claudePath = await ensureProviderPath("claude");
      const output = await runLoginProcess(
        claudePath,
        ["setup-token"],
        baseEnvironment(),
        openExternal,
      );
      const token = output.match(/sk-ant-[A-Za-z0-9_-]{20,}/)?.[0];
      if (!token) {
        throw new Error(
          "Claude 未返回应用专属令牌，请在设置中填写专用 Claude API Key",
        );
      }
      await settingsStore.setClaudeToken(token);
    } else {
      throw new Error("该来源不支持账号登录");
    }
    return (await statuses()).find((item) => item.provider === provider);
  }

  async function logout(provider) {
    if (provider === "codex") {
      const codexPath = await cachedProviderPath("codex");
      if (codexPath) {
        await runProcess(
          codexPath,
          ["logout"],
          codexEnvironment(codexHome),
          15_000,
        ).catch(() => undefined);
      }
      await rm(path.join(codexHome, "sessions"), {
        recursive: true,
        force: true,
      });
    } else if (provider === "claude") {
      await settingsStore.clearClaudeCredentials();
    }
    return (await statuses()).find((item) => item.provider === provider);
  }

  async function invoke(request, controller) {
    await initialize();
    const imagePath =
      request.task === "explain-image"
        ? await saveImage(images, request.id, request.payload.dataUrl)
        : undefined;
    try {
      const task = buildTask(request, imagePath);
      if (request.provider === "codex") {
        const codexPath = await ensureProviderPath("codex");
        return await invokeCodex({
          request,
          task,
          controller,
          codexPath,
          codexHome,
          workspace,
        });
      }
      if (request.provider === "claude") {
        const claudePath = await ensureProviderPath("claude");
        const token = await getClaudeCredential(settingsStore);
        if (!token) throw new Error("Claude 尚未登录，也没有可用的 API Key");
        return await invokeClaude({
          request,
          task,
          controller,
          claudePath,
          workspace,
          token,
        });
      }
      throw new Error("未知的桌面智能体来源");
    } finally {
      if (imagePath) await rm(imagePath, { force: true });
      await rm(path.join(codexHome, "sessions"), {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }
  }

  async function cleanup() {
    await rm(images, { recursive: true, force: true });
  }

  async function cachedProviderPath(provider) {
    if (!runtimeAssets) return developmentProviderPath(provider);
    const executable = packagedProviderPath(provider);
    try {
      await access(executable);
      return executable;
    } catch {
      return null;
    }
  }

  async function ensureProviderPath(provider) {
    if (!runtimeAssets) return developmentProviderPath(provider);
    const cached = await cachedProviderPath(provider);
    if (cached) return cached;
    if (runtimePreparations.has(provider)) {
      return runtimePreparations.get(provider);
    }
    const preparation = prepareProviderRuntime(provider).finally(() => {
      runtimePreparations.delete(provider);
    });
    runtimePreparations.set(provider, preparation);
    return preparation;
  }

  async function prepareProviderRuntime(provider) {
    const definition = runtimeDefinition(provider);
    const destination = path.join(providerRuntimeRoot, provider);
    const archive = path.join(runtimeAssets, definition.archive);
    try {
      return await extractProviderRuntime({
        archive,
        destination,
        executable: definition.executable,
      });
    } catch (error) {
      throw new Error(
        `${provider === "codex" ? "Codex" : "Claude"} 组件准备失败，请检查磁盘空间后重试`,
        { cause: error },
      );
    }
  }

  function packagedProviderPath(provider) {
    const definition = runtimeDefinition(provider);
    return path.join(
      providerRuntimeRoot,
      provider,
      ...definition.executable,
    );
  }

  function developmentProviderPath(provider) {
    if (provider === "codex") {
      return unpackedPath(
        path.join(
          path.dirname(
            require.resolve("@openai/codex-win32-x64/package.json"),
          ),
          "vendor",
          "x86_64-pc-windows-msvc",
          "bin",
          "codex.exe",
        ),
      );
    }
    return unpackedPath(
      path.join(
        path.dirname(
          require.resolve(
            "@anthropic-ai/claude-agent-sdk-win32-x64/package.json",
          ),
        ),
        "claude.exe",
      ),
    );
  }

  return { initialize, statuses, login, logout, invoke, cleanup };
}

export async function extractProviderRuntime({
  archive,
  destination,
  executable,
}) {
  const staging = `${destination}.preparing-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await extractZip(archive, { dir: staging });
    const stagedExecutable = path.join(staging, ...executable);
    await access(stagedExecutable);
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    return path.join(destination, ...executable);
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function getClaudeCredential(settingsStore) {
  const config = await settingsStore.getRuntimeConfig({ provider: "claude" });
  return config.claudeToken || config.apiKey;
}

function runtimeDefinition(provider) {
  if (provider === "codex") {
    return {
      archive: "codex-win32-x64.zip",
      executable: [
        "vendor",
        "x86_64-pc-windows-msvc",
        "bin",
        "codex.exe",
      ],
    };
  }
  if (provider === "claude") {
    return {
      archive: "claude-win32-x64.zip",
      executable: ["claude.exe"],
    };
  }
  throw new Error(`Unsupported desktop runtime: ${provider}`);
}

async function invokeCodex({
  request,
  task,
  controller,
  codexPath,
  codexHome,
  workspace,
}) {
  if (!(await codexStatus(codexPath, codexHome))) {
    throw new Error("Codex 尚未在知页中登录");
  }
  const codex = new Codex({
    codexPathOverride: codexPath,
    env: codexEnvironment(codexHome),
    config: {
      approval_policy: "never",
      web_search: "disabled",
    },
  });
  const thread = codex.startThread(codexThreadOptions(workspace));
  const input = task.imagePath
    ? [
        { type: "text", text: task.prompt },
        { type: "local_image", path: task.imagePath },
      ]
    : task.prompt;
  const turn = await thread.run(input, {
    outputSchema: task.schema,
    signal: controller.signal,
  });
  assertNoForbiddenCodexItems(turn.items);
  return parseStructured(turn.finalResponse, request.id);
}

async function invokeClaude({
  request,
  task,
  controller,
  claudePath,
  workspace,
  token,
}) {
  const prompt = task.imageDataUrl
    ? imagePrompt(task.prompt, task.imageDataUrl)
    : task.prompt;
  let result;
  for await (const message of queryClaude({
    prompt,
    options: claudeOptions({
      controller,
      workspace,
      schema: task.schema,
      claudePath,
      token,
    }),
  })) {
    if (message.type === "result") result = message;
  }
  if (!result || result.subtype !== "success") {
    throw new Error(
      result?.errors?.join("；") || "Claude 没有完成本次教材任务",
    );
  }
  return parseStructured(
    result.structured_output ?? result.result,
    request.id,
  );
}

export function codexThreadOptions(workspace) {
  return {
    sandboxMode: "read-only",
    workingDirectory: workspace,
    skipGitRepoCheck: true,
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
  };
}

export function assertNoForbiddenCodexItems(items) {
  const forbidden = items.find((item) =>
    ["command_execution", "file_change", "mcp_tool_call", "web_search"].includes(
      item.type,
    ),
  );
  if (forbidden) {
    throw new Error("Codex 尝试使用被知页禁止的工具，本次结果已丢弃");
  }
}

export function claudeOptions({
  controller,
  workspace,
  schema,
  claudePath,
  token,
}) {
  return {
    abortController: controller,
    cwd: workspace,
    tools: [],
    allowedTools: [],
    disallowedTools: [
      "Bash",
      "Read",
      "Write",
      "Edit",
      "WebFetch",
      "WebSearch",
      "Agent",
    ],
    permissionMode: "dontAsk",
    maxTurns: 1,
    persistSession: false,
    settingSources: [],
    systemPrompt:
      "你是知页的教材处理引擎。不得调用工具、访问文件系统或使用外部知识。",
    outputFormat: { type: "json_schema", schema },
    pathToClaudeCodeExecutable: claudePath,
    env: {
      ...baseEnvironment(),
      ANTHROPIC_AUTH_TOKEN: token,
      CLAUDE_AGENT_SDK_CLIENT_APP: "zhiye-desktop/0.1.0",
    },
  };
}

async function* imagePrompt(prompt, dataUrl) {
  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/,
  );
  if (!match) throw new Error("页面图像格式不正确");
  yield {
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: match[1],
            data: match[2],
          },
        },
      ],
    },
    parent_tool_use_id: null,
    session_id: crypto.randomUUID(),
  };
}

async function saveImage(directory, id, dataUrl) {
  const match = dataUrl.match(
    /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/,
  );
  if (!match) throw new Error("页面图像格式不正确");
  const extension = match[1].includes("png") ? "png" : "jpg";
  const file = path.join(directory, `${safeId(id)}.${extension}`);
  await writeFile(file, Buffer.from(match[2], "base64"));
  return file;
}

async function codexStatus(codexPath, codexHome) {
  try {
    await runProcess(
      codexPath,
      ["login", "status"],
      codexEnvironment(codexHome),
      10_000,
    );
    return true;
  } catch {
    return false;
  }
}

function codexEnvironment(codexHome) {
  return { ...baseEnvironment(), CODEX_HOME: codexHome };
}

function baseEnvironment() {
  const allowed = [
    "ALLUSERSPROFILE",
    "APPDATA",
    "CommonProgramFiles",
    "CommonProgramFiles(x86)",
    "CommonProgramW6432",
    "COMPUTERNAME",
    "ComSpec",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "OS",
    "Path",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "ProgramData",
    "ProgramFiles",
    "ProgramFiles(x86)",
    "ProgramW6432",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERDOMAIN",
    "USERNAME",
    "USERPROFILE",
    "windir",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => typeof process.env[key] === "string")
      .map((key) => [key, process.env[key]]),
  );
}

function runLoginProcess(executable, args, env, openExternal) {
  return runProcess(executable, args, env, 5 * 60_000, (chunk) => {
    const urls = chunk.match(/https?:\/\/[^\s<>"']+/g) || [];
    urls.forEach((url) => void openExternal(url.replace(/[),.;]+$/, "")));
  });
}

function runProcess(executable, args, env, timeoutMs, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const accept = (chunk) => {
      const text = chunk.toString();
      output += text;
      onOutput?.(text);
    };
    child.stdout.on("data", accept);
    child.stderr.on("data", accept);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("登录流程超时，请重试"));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(safeProcessError(output, code)));
    });
  });
}

function safeProcessError(output, code) {
  const cleaned = output
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[已隐藏凭据]")
    .trim()
    .slice(-400);
  return cleaned || `智能体登录进程退出（${code ?? "unknown"}）`;
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function unpackedPath(value) {
  return value.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}
