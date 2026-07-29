# 知页

![知页 Logo](brand/logo-mark.svg)

知页是一款面向 Windows 的本地教材伴学工具。用户导入 PDF 或 EPUB 后，可以在教材范围内阅读、检索、提问、练习和记录笔记；回答与智能文本都保留原文引用，便于随时回到教材核对。

项目同时提供 Web 版和 Electron 桌面版。Web 版支持本机 Ollama 与 OpenAI Chat Completions 兼容服务；桌面版在此基础上增加 Codex、Claude 智能来源及 Windows 本地凭据保护。

## 主要功能

- 在浏览器本地解析 PDF、EPUB，教材与学习记录保存在 IndexedDB
- PDF 原版 Canvas 阅读，支持页码、按钮、滚轮和方向键翻页
- 章节识别、语义分段、正文检索及原文定位
- 原版页面与智能文本双向跳转、对应范围高亮
- 扫描版 PDF 可按需启用 Tesseract 本地 OCR
- 基于当前教材内容提问，并通过引用跳回原文
- 依据不足时给出保守结果，不自动引入外部资料
- 章节练习、教材参考反馈、掌握度和复习记录
- 分章节笔记、笔记检索及 Markdown 导出
- 教材、解析正文和学习记录的加密完整备份
- 桌面与移动端自适应界面

## 技术栈

- React 19、TypeScript、Vite
- Electron、electron-builder、NSIS
- PDF.js、JSZip、Tesseract.js
- Vitest、Testing Library、Playwright、axe-core
- Cloudflare Workers / Static Assets

## 快速开始

### 环境要求

- Node.js 20 或更高版本
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

安装包、Blockmap 和 SHA-256 校验文件输出至 `artifacts/`。未签名安装包不可作为正式版本对外发布。

正式发布必须配置 Windows Authenticode 证书：

```powershell
$env:WIN_CSC_LINK = "C:\secure\zhiye-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<证书密码>"
npm run desktop:build
```

缺少证书或签名验证失败时，正式构建会直接终止。

## 智能来源

| 来源 | Web 版 | 桌面版 | 配置方式 |
| --- | :---: | :---: | --- |
| 本机 Ollama | ✓ | ✓ | 服务地址与模型名称 |
| OpenAI 兼容服务 | ✓ | ✓ | Chat Completions 基础地址、模型 ID、API Key |
| Codex | — | ✓ | 应用内官方设备登录 |
| Claude | — | ✓ | 官方订阅令牌流程或专用 API Key |

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

| 类型 | 文件上限 | 其他限制 |
| --- | ---: | --- |
| PDF | 150 MB | 最多 2,000 页 |
| EPUB | 50 MB | 解压后最多 300 MB，章节清单最多 2,000 项 |

扫描版 PDF 的 OCR 默认关闭。首次启用时需要联网下载并缓存中英文识别模型，后续识别在本机完成；速度和准确率取决于页面质量与设备性能。

## 测试与质量检查

```powershell
# 单元与组件测试
npm test

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
│  ├─ hooks/              应用交互与业务流程
│  └─ lib/                文档解析、检索、学习引擎、存储和备份
├─ electron/              Electron 主进程、预加载脚本和智能来源运行时
├─ tests/                 Web 与桌面端 Playwright 测试
├─ scripts/               Web/桌面构建、品牌资源和运行时准备脚本
├─ sites/                 Cloudflare Worker 入口
├─ public/                字体、PDF CMap 与公开静态资源
├─ brand/                 品牌源文件
└─ docs/                  补充技术文档
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run desktop:dev` | 启动 Web 开发服务器和 Electron |
| `npm run build` | 构建 Web 版及站点 Worker |
| `npm run build:desktop-client` | 仅构建 Electron 渲染端 |
| `npm run desktop:build:unsigned` | 生成本地验收用未签名安装包 |
| `npm run desktop:build` | 生成并验证正式签名安装包 |
| `npm run brand:generate` | 重新生成桌面品牌资源 |

## 当前限制

- 第一阶段只发布 Windows x64 桌面版
- 暂未接入自动更新，升级需要重新运行完整 NSIS 安装包
- EPUB 使用章节和段落定位，没有固定页码
- PDF 目录和语义分段依赖版面规则，复杂多栏、表格或非标准标题可能需要重建分段
- 当前检索为轻量关键词检索，尚未加入本地向量模型和混合检索
- 全教材批量智能生成尚无 Token 预算、费用预估和断点续传，建议使用选择生成

## 安全说明

Web 正式部署必须通过 HTTP 响应头设置：

```text
Content-Security-Policy: frame-ancestors 'none'
```

浏览器会忽略 HTML `<meta>` 中的 `frame-ancestors`，因此该策略必须由服务器返回。构建工具链的安全边界和审计约定见 [`docs/security-toolchain.md`](docs/security-toolchain.md)。

## 许可证

当前仓库未声明开源许可证，默认保留全部权利。
