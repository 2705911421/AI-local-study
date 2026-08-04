# 参与贡献

感谢你帮助完善知页。提交代码前，请先搜索现有 Issue 和 Pull Request；较大的功能或行为变更建议先创建讨论 Issue。

## 开发环境

- Node.js 22
- npm 10 或更高版本
- Windows x64（仅桌面构建和桌面 E2E 必需）

```powershell
npm ci
npm run dev
```

## 提交要求

1. 从最新 `main` 创建功能分支。
2. 保持变更单一、提交信息简洁，并为行为变更补充测试。
3. 不提交教材、密钥、Token、日志、构建产物或用户数据。
4. 在提交 PR 前至少运行：

```powershell
npm run lint
npm run format:check
npm run check:repo
npm run typecheck
npm run test:coverage
npm run test:desktop
npm run test:site
npm run build:web
```

涉及 UI 时还应运行 `npm run test:e2e`；涉及 Electron 时运行 `npm run test:desktop:e2e`。

## Pull Request

PR 需要说明变更目的、用户影响、验证方式和风险。请不要在同一 PR 中混入无关格式化或重构。提交贡献即表示你同意按照仓库的 Apache-2.0 许可证授权该贡献。
