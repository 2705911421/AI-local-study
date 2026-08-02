# 发布指南

## 版本规则

项目遵循语义化版本。`package.json`、`package-lock.json`、`CHANGELOG.md` 和 Git 标签必须使用同一版本；标签格式为 `vMAJOR.MINOR.PATCH`。

## 发布前检查

1. 将 `CHANGELOG.md` 的 Unreleased 内容归档到新版本标题。
2. 使用 `npm version <major|minor|patch> --no-git-tag-version` 同步包元数据。
3. 在 `main` 上通过全部 CI，并确认工作区干净。
4. 创建并推送带注释标签：

```powershell
git tag -a v0.1.0 -m "知页 v0.1.0"
git push github v0.1.0
```

标签会触发 `.github/workflows/release.yml`：验证版本、创建 GitHub Release、生成发行说明、构建 GHCR 镜像并写入来源证明。

## Windows 正式安装包

默认只发布源码和 Web 容器。Windows 正式安装包必须具备有效 Authenticode 签名：

1. 添加 Actions Secrets：`WIN_CSC_LINK`、`WIN_CSC_KEY_PASSWORD`。
2. 添加仓库变量 `ENABLE_SIGNED_WINDOWS_RELEASE=true`。
3. 确认证书、时间戳服务和 GitHub Release 更新地址可用。
4. 推送版本标签；工作流会验证签名后上传安装包、blockmap、校验文件和更新元数据。

不要公开分发 `npm run desktop:build:unsigned` 生成的本地 QA 安装包。

## 回滚与撤回

- 工作流失败时不要复用或移动已公开标签；修复后发布新的补丁版本。
- 需要阻止下载时，将 Release 标记为草稿或删除对应资产，并撤回受影响容器标签。
- 已被用户拉取的源码、镜像和安装包无法可靠收回，应在安全公告中明确受影响版本与升级路径。
