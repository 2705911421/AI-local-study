import { useCallback } from "react";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import {
  checkModel,
  detectModelCapabilities,
  getProviderStatuses,
  isDesktopApp,
  listModels,
  loginProvider,
  logoutProvider,
  saveDesktopSettings,
} from "../../lib/intelligence/client";

type ModelConfigRuntime = Pick<
  WorkspaceRuntime,
  | "config"
  | "modelListControllerRef"
  | "modelTestControllerRef"
  | "setConfig"
  | "setIsTestingModel"
  | "setModelListState"
  | "setModelOnline"
  | "setModelOptions"
  | "setModelSupportsVision"
  | "setProviderStatuses"
>;

export function useModelConfig(ctx: ModelConfigRuntime) {
  const { config, setConfig } = ctx;

  const testModel = useCallback(async () => {
    ctx.modelTestControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.modelTestControllerRef.current = controller;
    ctx.setIsTestingModel(true);
    ctx.setModelOnline(null);
    try {
      if (isDesktopApp()) {
        await saveDesktopSettings(config, true);
        if (config.apiKey) {
          setConfig((current) => ({ ...current, apiKey: "" }));
        }
      }
      const online = await checkModel(config, controller.signal);
      if (!controller.signal.aborted) {
        ctx.setModelOnline(online);
        if (online) {
          const capabilities = await detectModelCapabilities(
            config,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            ctx.setModelSupportsVision(capabilities.vision);
          }
        } else {
          ctx.setModelSupportsVision(false);
        }
        if (isDesktopApp()) {
          const statuses = await getProviderStatuses(config);
          if (!controller.signal.aborted) ctx.setProviderStatuses(statuses);
        }
      }
    } catch {
      // A superseded test should not overwrite the latest connection state.
    } finally {
      if (ctx.modelTestControllerRef.current === controller) {
        ctx.modelTestControllerRef.current = null;
        ctx.setIsTestingModel(false);
      }
    }
  }, [config, ctx, setConfig]);

  const fetchModelOptions = useCallback(async () => {
    ctx.modelListControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.modelListControllerRef.current = controller;
    ctx.setModelListState("正在从上游获取模型…");
    ctx.setModelOptions([]);
    try {
      if (isDesktopApp()) {
        await saveDesktopSettings(config, true);
        if (config.apiKey) {
          setConfig((current) => ({ ...current, apiKey: "" }));
        }
      }
      const models = await listModels(config, controller.signal);
      if (controller.signal.aborted) return;
      ctx.setModelOptions(models);
      if (models.length) {
        setConfig((current) => ({
          ...current,
          model: models.includes(current.model) ? current.model : models[0],
        }));
        ctx.setModelListState(`已获取 ${models.length} 个模型`);
      } else {
        ctx.setModelListState("上游未返回模型，可继续手动填写");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      ctx.setModelListState(
        error instanceof Error
          ? `${error.message}，可继续手动填写`
          : "获取失败，可继续手动填写",
      );
    } finally {
      if (ctx.modelListControllerRef.current === controller) {
        ctx.modelListControllerRef.current = null;
      }
    }
  }, [config, ctx, setConfig]);

  const saveSettings = useCallback(async () => {
    try {
      localStorage.setItem("zhiye-llm-provider", config.provider);
      localStorage.setItem("zhiye-llm-endpoint", config.endpoint);
      localStorage.setItem("zhiye-llm-model", config.model);
      localStorage.removeItem("zhiye-llm-api-key");
    } catch {
      ctx.setModelListState("浏览器无法保存设置；本次会话仍可继续使用");
    }
    if (isDesktopApp()) {
      try {
        await saveDesktopSettings(config, true);
        setConfig((current) => ({ ...current, apiKey: "" }));
      } catch (error) {
        ctx.setModelListState(
          error instanceof Error ? error.message : "桌面设置保存失败",
        );
        return;
      }
    }
    void testModel();
  }, [config, ctx, setConfig, testModel]);

  const changeAgentLogin = useCallback(
    async (action: "login" | "logout") => {
      if (config.provider !== "codex" && config.provider !== "claude") return;
      ctx.setIsTestingModel(true);
      ctx.setModelListState(
        action === "login" ? "请在浏览器中完成官方登录…" : "正在退出登录…",
      );
      try {
        const status =
          action === "login"
            ? await loginProvider(config.provider)
            : await logoutProvider(config.provider);
        ctx.setProviderStatuses((current) => [
          ...current.filter((item) => item.provider !== status.provider),
          status,
        ]);
        ctx.setModelOnline(status.availability === "ready");
        ctx.setModelSupportsVision(status.capabilities.vision);
        ctx.setModelListState(
          status.availability === "ready" ? "账号已连接" : "账号已退出",
        );
      } catch (error) {
        ctx.setModelOnline(false);
        ctx.setModelListState(
          error instanceof Error ? error.message : "账号连接失败",
        );
      } finally {
        ctx.setIsTestingModel(false);
      }
    },
    [config, ctx],
  );

  return { testModel, fetchModelOptions, saveSettings, changeAgentLogin };
}
