import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  GearSix,
  ShieldCheck,
  DownloadSimple,
  FileArrowUp,
  X,
} from "@phosphor-icons/react";
import type { UserPreferences } from "../types";
import type {
  DesktopAutoBackupSettings,
  DesktopUpdateStatus,
} from "../lib/intelligence/types";
import { isDesktopApp, type LlmProvider } from "../lib/intelligence/client";
import {
  inspectBackupFormat,
  validateBackupPassphrase,
  type BackupFormat,
} from "../lib/backupCrypto";
import { useAppContext } from "../AppContext";

export function SettingsDialog({
  onTestModel,
  onFetchModelOptions,
  onSaveSettings,
  onChangeAgentLogin,
  onClearApiKey,
  onExportBackup,
  onRestoreBackup,
  onSavePreferences,
}: {
  onTestModel: () => void;
  onFetchModelOptions: () => void;
  onSaveSettings: () => void;
  onChangeAgentLogin: (action: "login" | "logout") => void;
  onClearApiKey: () => Promise<boolean>;
  onExportBackup: (passphrase: string) => Promise<boolean>;
  onRestoreBackup: (
    file: File,
    passphrase?: string,
    mode?: "replace" | "merge",
  ) => Promise<boolean>;
  onSavePreferences: (next: UserPreferences) => void;
}) {
  const ctx = useAppContext();
  const {
    config,
    setConfig,
    preferences,
    modelOnline,
    modelSupportsVision,
    isTestingModel,
    modelOptions,
    modelListState,
    providerStatuses,
  } = ctx;
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordConfirmation, setBackupPasswordConfirmation] =
    useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupFormat, setBackupFormat] = useState<BackupFormat | null>(null);
  const [legacyConfirmed, setLegacyConfirmed] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("merge");
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus | null>(
    null,
  );
  const [autoBackup, setAutoBackup] =
    useState<DesktopAutoBackupSettings | null>(null);

  useEffect(() => {
    if (ctx.overlay !== "settings" || !window.zhiyeDesktop) return;
    let cancelled = false;
    void window.zhiyeDesktop.getUpdateStatus().then((status) => {
      if (!cancelled) setUpdateStatus(status);
    });
    void window.zhiyeDesktop.getAutoBackupSettings().then((settings) => {
      if (!cancelled) setAutoBackup(settings);
    });
    const timer = window.setInterval(() => {
      void window.zhiyeDesktop?.getUpdateStatus().then((status) => {
        if (!cancelled) setUpdateStatus(status);
      });
    }, 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ctx.overlay]);

  const clearBackupSecrets = () => {
    setBackupPassword("");
    setBackupPasswordConfirmation("");
  };

  const closeSettings = () => {
    clearBackupSecrets();
    setBackupFile(null);
    setBackupFormat(null);
    setLegacyConfirmed(false);
    setBackupError("");
    ctx.setOverlay(null);
  };

  const exportEncryptedBackup = async () => {
    setBackupError("");
    try {
      validateBackupPassphrase(backupPassword);
      if (backupPassword !== backupPasswordConfirmation) {
        throw new Error("两次输入的备份密码不一致");
      }
      setBackupBusy(true);
      await onExportBackup(backupPassword);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "备份导出失败");
    } finally {
      clearBackupSecrets();
      setBackupBusy(false);
    }
  };

  const selectBackupFile = async (file?: File) => {
    setBackupFile(file || null);
    setBackupFormat(null);
    setLegacyConfirmed(false);
    setBackupError("");
    if (!file) return;
    try {
      setBackupFormat(await inspectBackupFormat(file));
    } catch (error) {
      setBackupError(
        error instanceof Error ? error.message : "备份密码错误或文件已损坏",
      );
    }
  };

  const restoreSelectedBackup = async () => {
    if (!backupFile || !backupFormat) return;
    if (backupFormat === "legacy-v1" && !legacyConfirmed) return;
    setBackupError("");
    try {
      setBackupBusy(true);
      const restored = await onRestoreBackup(
        backupFile,
        backupFormat === "encrypted-v2" ? backupPassword : undefined,
        restoreMode,
      );
      if (restored) {
        setBackupFile(null);
        setBackupFormat(null);
        setLegacyConfirmed(false);
      }
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "备份恢复失败");
    } finally {
      clearBackupSecrets();
      setBackupBusy(false);
    }
  };

  const selectedProviderStatus = providerStatuses.find(
    (status) => status.provider === config.provider,
  );

  return (
    <Dialog.Root
      open={ctx.overlay === "settings"}
      onOpenChange={(open) => !open && closeSettings()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay">
          <Dialog.Content className="modal settings-modal">
            <Dialog.Close asChild>
              <button className="modal-close" aria-label="关闭设置窗口">
                <X size={19} />
              </button>
            </Dialog.Close>
            <span className="modal-icon">
              <GearSix size={28} />
            </span>
            <Dialog.Title>设置</Dialog.Title>
            <Dialog.Description>
              智能来源用于教材问答、评分和智能文本整理。
              {isDesktopApp()
                ? "桌面版可连接 Codex、Claude、本机 Ollama或兼容服务。"
                : "网页版支持本机 Ollama和采用 Chat Completions 接口的兼容服务。"}
            </Dialog.Description>
            <fieldset className="reading-preferences">
              <legend>阅读偏好</legend>
              <label>
                主题
                <select
                  value={preferences.theme}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      theme: event.target.value as UserPreferences["theme"],
                    })
                  }
                >
                  <option value="auto">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </label>
              <label>
                字号
                <select
                  value={preferences.fontScale}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      fontScale: event.target
                        .value as UserPreferences["fontScale"],
                    })
                  }
                >
                  <option value="small">紧凑</option>
                  <option value="medium">标准</option>
                  <option value="large">较大</option>
                </select>
              </label>
              <label>
                行距
                <select
                  value={preferences.lineHeight}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      lineHeight: event.target
                        .value as UserPreferences["lineHeight"],
                    })
                  }
                >
                  <option value="compact">紧凑</option>
                  <option value="comfortable">舒适</option>
                  <option value="relaxed">宽松</option>
                </select>
              </label>
              <label>
                阅读宽度
                <select
                  value={preferences.readingWidth}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      readingWidth: event.target
                        .value as UserPreferences["readingWidth"],
                    })
                  }
                >
                  <option value="narrow">窄</option>
                  <option value="medium">标准</option>
                  <option value="wide">宽</option>
                </select>
              </label>
            </fieldset>
            <fieldset className="reading-preferences">
              <legend>智能检索与批量生成</legend>
              <label>
                <span>本地语义检索</span>
                <input
                  type="checkbox"
                  checked={preferences.semanticSearchEnabled !== false}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      semanticSearchEnabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label>
                并发请求数
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={preferences.batchConcurrency ?? 2}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      batchConcurrency: Math.max(
                        1,
                        Math.min(4, Number(event.target.value) || 1),
                      ),
                    })
                  }
                />
              </label>
              <label>
                每分钟请求上限
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={preferences.batchRequestsPerMinute ?? 30}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      batchRequestsPerMinute: Math.max(
                        1,
                        Math.min(600, Number(event.target.value) || 1),
                      ),
                    })
                  }
                />
              </label>
              <label>
                输入单价（¥ / 百万 Token）
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={preferences.inputPricePerMillion ?? 0}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      inputPricePerMillion: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                />
              </label>
              <label>
                输出单价（¥ / 百万 Token）
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={preferences.outputPricePerMillion ?? 0}
                  onChange={(event) =>
                    onSavePreferences({
                      ...preferences,
                      outputPricePerMillion: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    })
                  }
                />
              </label>
            </fieldset>
            <section className="backup-security" aria-labelledby="backup-title">
              <h3 id="backup-title">加密完整备份</h3>
              <p>
                备份包含教材原文件、正文和学习记录，但不包含任何账号凭据。密码遗失后无法恢复。
              </p>
              <label>
                备份密码
                <input
                  aria-label="备份密码"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={backupPassword}
                  onChange={(event) => setBackupPassword(event.target.value)}
                  placeholder="至少 12 个字符"
                />
              </label>
              <label>
                再次输入密码
                <input
                  aria-label="确认备份密码"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={backupPasswordConfirmation}
                  onChange={(event) =>
                    setBackupPasswordConfirmation(event.target.value)
                  }
                  placeholder="仅导出时需要"
                />
              </label>
              <div className="backup-actions">
                <button
                  className="secondary-button"
                  onClick={() => void exportEncryptedBackup()}
                  disabled={backupBusy}
                >
                  <DownloadSimple size={15} />
                  导出加密备份
                </button>
                {isDesktopApp() && (
                  <div className="auto-backup-control">
                    <div>
                      <strong>每日自动备份</strong>
                      <span>
                        {autoBackup?.enabled
                          ? `已启用 · 保留 ${autoBackup.retention} 份`
                          : "默认关闭，密码由 Windows 安全存储保护"}
                      </span>
                    </div>
                    {autoBackup?.enabled ? (
                      <button
                        className="secondary-button"
                        onClick={async () =>
                          setAutoBackup(
                            await window.zhiyeDesktop!.disableAutoBackup(),
                          )
                        }
                      >
                        关闭
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        disabled={backupPassword.length < 12}
                        onClick={async () => {
                          validateBackupPassphrase(backupPassword);
                          setAutoBackup(
                            await window.zhiyeDesktop!.chooseAutoBackupDirectory(
                              backupPassword,
                            ),
                          );
                          clearBackupSecrets();
                        }}
                      >
                        选择目录并启用
                      </button>
                    )}
                  </div>
                )}
                <label className="secondary-button">
                  <FileArrowUp size={15} />
                  选择备份
                  <input
                    type="file"
                    accept=".zhiye-backup,.zip,.zhiye-backup.zip"
                    onChange={(event) =>
                      void selectBackupFile(event.target.files?.[0])
                    }
                  />
                </label>
                {backupFile && (
                  <label>
                    恢复方式
                    <select
                      value={restoreMode}
                      onChange={(event) =>
                        setRestoreMode(
                          event.target.value as "replace" | "merge",
                        )
                      }
                    >
                      <option value="merge">合并恢复（保留较新记录）</option>
                      <option value="replace">替换当前全部数据</option>
                    </select>
                  </label>
                )}
                <button
                  className="secondary-button"
                  onClick={() => void restoreSelectedBackup()}
                  disabled={
                    backupBusy ||
                    !backupFile ||
                    !backupFormat ||
                    (backupFormat === "legacy-v1" && !legacyConfirmed)
                  }
                >
                  恢复所选备份
                </button>
              </div>
              {backupFile && (
                <small className="backup-file-name">{backupFile.name}</small>
              )}
              {backupFormat === "legacy-v1" && (
                <label className="legacy-backup-warning">
                  <input
                    type="checkbox"
                    checked={legacyConfirmed}
                    onChange={(event) =>
                      setLegacyConfirmed(event.target.checked)
                    }
                  />
                  此旧版备份未加密且包含教材正文；我确认仍要恢复
                </label>
              )}
              {backupError && (
                <div className="import-error" role="alert">
                  {backupError}
                </div>
              )}
            </section>
            {isDesktopApp() && updateStatus && (
              <section
                className="update-settings"
                aria-labelledby="update-title"
              >
                <h3 id="update-title">应用更新</h3>
                <p>
                  {updateStatus.message ||
                    (updateStatus.status === "idle"
                      ? "可检查签名更新"
                      : "更新服务已就绪")}
                </p>
                {updateStatus.status === "downloading" && (
                  <progress value={updateStatus.progress} max={100}>
                    {updateStatus.progress}%
                  </progress>
                )}
                <div className="settings-actions">
                  <button
                    className="secondary-button"
                    disabled={
                      updateStatus.status === "checking" ||
                      updateStatus.status === "downloading" ||
                      updateStatus.status === "disabled"
                    }
                    onClick={async () =>
                      setUpdateStatus(
                        await window.zhiyeDesktop!.checkForUpdates(),
                      )
                    }
                  >
                    检查更新
                  </button>
                  {updateStatus.status === "ready" && (
                    <button
                      className="primary-button"
                      onClick={() => void window.zhiyeDesktop!.installUpdate()}
                    >
                      重启并安装 {updateStatus.availableVersion}
                    </button>
                  )}
                </div>
              </section>
            )}
            <h3>AI 服务</h3>
            <label>
              服务类型
              <select
                aria-label="LLM 服务类型"
                value={config.provider}
                onChange={(event) => {
                  const provider = event.target.value as LlmProvider;
                  setConfig({
                    provider,
                    endpoint:
                      provider === "ollama"
                        ? "http://localhost:11434"
                        : provider === "openai-compatible"
                          ? "https://api.openai.com/v1"
                          : "",
                    model: provider === "ollama" ? "qwen3:4b" : "",
                    apiKey: "",
                  });
                  ctx.setModelOnline(null);
                  ctx.setModelOptions([]);
                  ctx.setModelListState("");
                }}
              >
                {isDesktopApp() && <option value="codex">Codex</option>}
                {isDesktopApp() && <option value="claude">Claude</option>}
                <option value="ollama">本机 Ollama</option>
                <option value="openai-compatible">OpenAI 兼容服务</option>
              </select>
            </label>
            {(config.provider === "ollama" ||
              config.provider === "openai-compatible") && (
              <>
                <label>
                  服务地址
                  <input
                    aria-label="LLM 服务地址"
                    value={config.endpoint}
                    onChange={(event) => {
                      setConfig({ ...config, endpoint: event.target.value });
                      ctx.setModelOptions([]);
                      ctx.setModelListState("");
                    }}
                    placeholder={
                      config.provider === "ollama"
                        ? "http://localhost:11434"
                        : "https://api.example.com/v1"
                    }
                  />
                </label>
                <label>
                  模型名称
                  <div className="model-field-row">
                    <input
                      aria-label="LLM 模型名称"
                      value={config.model}
                      onChange={(event) =>
                        setConfig({ ...config, model: event.target.value })
                      }
                      placeholder="填写或从上游获取模型 ID"
                    />
                    <button
                      className="secondary-button fetch-models-button"
                      onClick={onFetchModelOptions}
                    >
                      获取模型列表
                    </button>
                  </div>
                </label>
              </>
            )}
            {modelOptions.length > 0 && (
              <label>
                上游可用模型
                <select
                  aria-label="上游模型列表"
                  value={config.model}
                  onChange={(event) =>
                    setConfig({ ...config, model: event.target.value })
                  }
                >
                  {modelOptions.map((model) => (
                    <option value={model} key={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {modelListState && (
              <span className="model-list-state">{modelListState}</span>
            )}
            {(config.provider === "openai-compatible" ||
              config.provider === "claude") && (
              <label>
                {config.provider === "claude"
                  ? "Claude API Key（订阅登录不可用时备用）"
                  : "API Key"}
                <input
                  aria-label="LLM API Key"
                  type="password"
                  autoComplete="off"
                  value={config.apiKey}
                  onChange={(event) =>
                    setConfig({ ...config, apiKey: event.target.value })
                  }
                  placeholder={
                    config.provider === "claude" ? "sk-ant-…" : "sk-…"
                  }
                />
              </label>
            )}
            {isDesktopApp() &&
              (config.provider === "claude" ||
                config.provider === "openai-compatible") && (
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => void onClearApiKey()}
                >
                  清除当前来源已保存的 API Key
                </button>
              )}
            {isDesktopApp() &&
              (config.provider === "codex" || config.provider === "claude") && (
                <div className="agent-login-actions">
                  <span>
                    {selectedProviderStatus?.availability === "ready"
                      ? `${selectedProviderStatus.label} 账号已连接`
                      : selectedProviderStatus?.detail || "账号尚未连接"}
                  </span>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      onChangeAgentLogin(
                        selectedProviderStatus?.availability === "ready"
                          ? "logout"
                          : "login",
                      )
                    }
                    disabled={isTestingModel}
                  >
                    {selectedProviderStatus?.availability === "ready"
                      ? "退出此账号"
                      : "通过浏览器连接"}
                  </button>
                </div>
              )}
            <div className="settings-privacy-note">
              <ShieldCheck size={15} />
              <span>
                {isDesktopApp()
                  ? "账号与 API Key 由 Windows 安全凭据存储加密；renderer、学习备份和日志均不包含凭据。"
                  : "服务地址和模型名称保存在当前浏览器中；API Key 仅保留在本次页面会话。"}
                使用智能来源时，当前任务所需的教材原文会发送给所选来源；图示讲解还会发送当前
                PDF 页面图像。知页不会在失败后静默发送给其他提供商。
              </span>
            </div>
            <div
              className={`connection-state ${
                modelOnline === true ? "online" : ""
              }`}
            >
              <i />
              {isTestingModel
                ? "正在测试模型服务"
                : modelOnline
                  ? modelSupportsVision
                    ? "连接正常，已识别多模态能力；图示讲解已开放"
                    : "连接正常，当前为文本模型；图示讲解不显示"
                  : modelOnline === false
                    ? config.provider === "codex" ||
                      config.provider === "claude"
                      ? "连接失败，请检查账号状态或备用密钥"
                      : "连接失败，请检查地址、模型、密钥与 CORS"
                    : "尚未测试连接"}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={onTestModel}>
                测试连接
              </button>
              <button className="primary-button" onClick={onSaveSettings}>
                保存设置
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
