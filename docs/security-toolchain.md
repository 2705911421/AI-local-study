# 构建工具链安全边界

发布包的运行时依赖必须通过：

```powershell
npm audit --omit=dev
```

`electron-builder` 仅在受控的 Windows 构建机中运行，只处理本仓库内经过审查的配置、图标、运行时压缩包和构建输出。不得把来自用户上传、网络下载或其他不可信来源的路径、模板、归档文件或命令参数传给打包流程。

当前最新版 `electron-builder` 的若干传递开发依赖仍会被 `npm audit` 报告为高风险，且上游给出的自动修复要求降级到与 Electron 43 及现有签名流程不匹配的旧版本。因此发布门禁以生产依赖审计为准，同时在每次升级 `electron-builder` 时重新执行完整审计并复核该例外；不得使用 `npm audit fix --force` 自动降级打包链。
