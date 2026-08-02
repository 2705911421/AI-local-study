# 知页

![知页 Logo](brand/logo-mark.svg)

[![CI](https://github.com/2705911421/AI-local-study/actions/workflows/ci.yml/badge.svg)](https://github.com/2705911421/AI-local-study/actions/workflows/ci.yml)
[![CodeQL](https://github.com/2705911421/AI-local-study/actions/workflows/codeql.yml/badge.svg)](https://github.com/2705911421/AI-local-study/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/2705911421/AI-local-study?display_name=tag&sort=semver)](https://github.com/2705911421/AI-local-study/releases/latest)
[![License](https://img.shields.io/github/license/2705911421/AI-local-study)](LICENSE)

知页是一款面向 Windows 的本地教材伴学工具。用户导入 PDF 或 EPUB 后，可以在教材范围内阅读、检索、提问、练习和记录笔记；回答与智能文本都保留原文引用，便于随时回到教材核对。

项目同时提供 Web 版和 Electron 桌面版。Web 版支持本机 Ollama 与 OpenAI Chat Completions 兼容服务；桌面版在此基础上增加 Codex、Claude 智能来源及 Windows 本地凭据保护。

## 主要功能

- 在浏览器本地解析 PDF、EPUB，教材与学习记录保存在 IndexedDB
- PDF 原版 Canvas 阅读，支持页码、按钮、滚轮和方向键翻页
- 章节识别、复杂版面语义分段、关键词 + 本地向量混合检索及原文定位
- 原版页面与智能文本双向跳转、对应范围高亮
- 扫描版 PDF 可按需启用 Tesseract 本地 OCR
- 基于当前教材内容提问，并通过引用跳回原文
- 依据不足时给出保守结果，不自动引入外部资料
- 章节练习、教材参考反馈、掌握度和复习记录
- 分章节笔记、笔记检索及 Markdown 导出
- 教材、解析正文和学习记录的加密完整备份
- 批量智能生成的 Token/费用预估、断点续传、并发控制与速率限制
- 桌面版签名更新检查、后台下载和确认安装
- 桌面与移动端自适应界面

## 技术栈

- React 19、TypeScript、Vite
- Electron、electron-builder、NSIS
- PDF.js、JSZip、Tesseract.js
- Vitest、Testing Library、Playwright、axe-core
- Cloudflare Workers / Static Assets

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm
- Windows x64（桌面端开发和打包）

安装依赖并启动 Web 开发服务器：

```powershell
npm install
npm run dev
```

访问以下地址：

- `http://127.0.0.1:4173/`：产品介绍页
- `http://127.0.0.1:4173/app`：学习工作区

启动 Electron 桌面开发环境：

```powershell
npm run desktop:dev
```

## 获取发布版本

- 源码与版本说明：[GitHub Releases](https://github.com/2705911421/AI-local-study/releases)
- Web 容器：`ghcr.io/2705911421/ai-local-study:<version>`

```bash
docker run --rm -p 8080:8080 ghcr.io/2705911421/ai-local-study:latest
```

访问 `http://127.0.0.1:8080/`。正式 Windows 安装包只会在通过 Authenticode 签名验证后附加到 Release；未签名构建仅供本地验收。

## 构建与预览

构建 Web 版：

```powershell
npm run build
```

产物位于 `dist/client`，站点 Worker 位于 `dist/server`。本地预览静态客户端或完整 Worker：

```powershell
npm run preview
npm run preview:worker
```

构建仅用于本机验收的未签名 Windows 安装包：

```powershell
npm run desktop:build:unsigned
```

安装包、Blockmap 和 SHA-256 校验文件输出至 `artifacts/desktop/`。未签名安装包不可作为正式版本对外发布。

正式发布必须配置 Windows Authenticode 证书：

```powershell
$env:WIN_CSC_LINK = "C:\secure\zhiye-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<证书密码>"
$env:ZHIYE_UPDATE_URL = "https://downloads.example.com/zhiye"
npm run desktop:build
```

缺少证书、HTTPS 更新地址或签名验证失败时，正式构建会直接终止。将 `artifacts/desktop/` 中的安装包、Blockmap 和 `latest.yml` 上传到该地址后，正式安装包会读取内置更新配置并自动检查更新。

## 智能来源

| 来源            | Web 版 | 桌面版 | 配置方式                                    |
| --------------- | :----: | :----: | ------------------------------------------- |
| 本机 Ollama     |   ✓    |   ✓    | 服务地址与模型名称                          |
| OpenAI 兼容服务 |   ✓    |   ✓    | Chat Completions 基础地址、模型 ID、API Key |
| Codex           |   —    |   ✓    | 应用内官方设备登录                          |
| Claude          |   —    |   ✓    | 官方订阅令牌流程或专用 API Key              |

在右上角“设置”中选择来源、获取模型列表并测试连接。未连接模型时，应用仍可使用本地教材检索和基础学习功能。

使用外部智能来源时，完成当前任务所需的教材原文会发送给所选服务商；图示讲解还会发送当前 PDF 页面。来源调用失败后不会静默切换到另一家服务商。

Web 版仅在当前页面会话的内存中保存 API Key，刷新后需要重新填写。桌面版的 API Key 和 Claude 令牌由 Electron 主进程通过 Windows 安全凭据存储加密，且不会写入智能来源日志或学习备份。

## 数据与备份

- 教材、解析结果、笔记、练习和阅读状态默认保存在当前设备
- 新导出的 `.zhiye-backup` 使用 AES-256-GCM 加密
- 备份密码至少 12 个字符；密码遗失后无法恢复
- 单份备份的未加密内容上限为 256 MB
- 可以导入旧版未加密备份，但恢复前会明确提示风险
- 完整备份包含教材原文件和解析正文，请妥善保管

## 导入限制

| 类型 | 文件上限 | 其他限制                                 |
| ---- | -------: | ---------------------------------------- |
| PDF  |   150 MB | 最多 2,000 页                            |
| EPUB |    50 MB | 解压后最多 300 MB，章节清单最多 2,000 项 |

扫描版 PDF 的 OCR 默认关闭。首次启用时需要联网下载并缓存中英文识别模型，后续识别在本机完成；速度和准确率取决于页面质量与设备性能。

文本型 PDF 会按坐标识别多栏阅读顺序，并保留明显的表格行。EPUB 在章节/段落定位之外生成每 800 字一页的虚拟页码和全书阅读进度百分比。

## 检索与批量生成

问答检索默认融合 BM25 关键词分数和完全在本机运行的紧凑向量模型；可在设置中关闭语义检索。模型不下载远程权重，也不会发送查询或教材正文。

批量智能文本按字符预算切分请求，每批完成后立即保存结果和任务检查点。设置中可调整 1–4 路并发、每分钟请求上限，以及输入/输出百万 Token 单价；开始前会展示剩余任务的 Token 与费用估算。中断或重启后再次生成会跳过已经落盘的片段。

## 测试与质量检查

```powershell
# 静态分析、格式与 TypeScript 检查
npm run lint
npm run format:check
npm run typecheck

# 单元与组件测试
npm test

# 生成 V8 覆盖率报告（coverage/index.html）
npm run test:coverage

# Web 端到端测试（桌面和移动视口）
npm run test:e2e

# Electron 主进程测试
npm run test:desktop

# Electron 桌面端到端测试
npm run test:desktop:e2e

# 生产依赖安全审计
npm run audit:runtime
```

## 项目结构

```text
.
├─ src/                    React 应用、组件、业务逻辑与数据层
│  ├─ components/         导入、阅读、练习、设置等界面组件
│  ├─ workspace/          工作区领域接口、运行时与业务操作
│  └─ lib/                文档解析、检索、学习引擎、存储和备份
├─ electron/              TypeScript 主进程、预加载脚本和智能来源运行时
├─ tests/                 Web 与桌面端 Playwright 测试
├─ scripts/               Web/桌面构建、品牌资源和运行时准备脚本
├─ sites/                 Cloudflare Worker 入口
├─ public/                字体、PDF CMap 与公开静态资源
├─ brand/                 品牌源文件
└─ docs/                  补充技术文档
```

## 常用命令

| 命令                             | 说明                            |
| -------------------------------- | ------------------------------- |
| `npm run dev`                    | 启动 Vite 开发服务器            |
| `npm run desktop:dev`            | 启动 Web 开发服务器和 Electron  |
| `npm run build`                  | 构建 Web 版及站点 Worker        |
| `npm run build:desktop-client`   | 仅构建 Electron 渲染端          |
| `npm run build:electron`         | 编译 Electron TypeScript 主进程 |
| `npm run lint`                   | 运行 ESLint 静态分析            |
| `npm run format`                 | 使用 Prettier 统一格式          |
| `npm run test:coverage`          | 运行测试并生成覆盖率报告        |
| `npm run clean:generated`        | 清理生成物并保留依赖目录        |
| `npm run clean:dependencies`     | 单独清理 `node_modules`         |
| `npm run desktop:build:unsigned` | 生成本地验收用未签名安装包      |
| `npm run desktop:build`          | 生成并验证正式签名安装包        |
| `npm run brand:generate`         | 重新生成桌面品牌资源            |

## 当前限制

- 第一阶段只发布 Windows x64 桌面版
- 扫描版、图片化表格或极端自由排版的 PDF 仍可能需要 OCR 或手动核对分段
- EPUB 虚拟页码用于稳定定位，不等同于不同阅读器排版后的屏幕页码
- OpenAI 兼容服务的实际计费由服务商决定，费用估算依赖用户填写的 Token 单价

## 安全说明

Web 正式部署必须通过 HTTP 响应头设置：

```text
Content-Security-Policy: frame-ancestors 'none'
```

浏览器会忽略 HTML `<meta>` 中的 `frame-ancestors`，因此该策略必须由服务器返回。构建工具链的安全边界和审计约定见 [`docs/security-toolchain.md`](docs/security-toolchain.md)。

## 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源。第三方组件与随附资源仍受各自许可证约束，归属信息见 [NOTICE](NOTICE)。贡献方式、安全报告和支持渠道分别见 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 与 [SUPPORT.md](SUPPORT.md)。
