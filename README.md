# 知页

面向大学生的本地教材伴学 MVP。导入 PDF 或 EPUB 后，问答、引用、练习与笔记均限定在当前教材范围内。

## 本地启动

要求 Node.js 20 或更高版本。

```powershell
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:4173`。

生产构建：

```powershell
npm run build
npm run preview
```

网页版正式部署时，必须由 Web 服务器通过 HTTP 响应头设置
`Content-Security-Policy: frame-ancestors 'none'`，防止页面被其他站点嵌入。
浏览器会忽略 HTML `<meta>` 中的 `frame-ancestors`，因此该指令不能只写在页面内。

## Windows 桌面版

桌面版使用 Electron 封装同一套阅读界面，并内置 Codex 与 Claude Agent
Windows x64 运行时。第一阶段仅发布 Windows x64 版本。普通用户不需要安装或操作
命令行工具，首次启动会自动打开智能来源向导。Codex 与 Claude 组件以压缩形式随安装包
提供，第一次连接对应来源时按需展开。

开发与打包：

```powershell
npm run desktop:dev
npm run test:desktop:e2e
npm run desktop:build
```

正式发布构建必须配置 Windows Authenticode 证书：

```powershell
$env:WIN_CSC_LINK = "C:\secure\zhiye-signing.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<证书密码>"
npm run desktop:build
```

`desktop:build` 在缺少证书或签名验证失败时会中止，避免误发“未知发布者”安装包。
仅本机验收可使用 `npm run desktop:build:unsigned`。该命令生成的安装包不可对外发布。
构建同时生成 `.sha256` 校验文件。

桌面设置支持四种智能来源：

- Codex：在知页内通过官方设备登录，凭据保存在应用专属 `CODEX_HOME`。
- Claude：通过官方订阅令牌流程连接；不可用时可填写专用 Claude API Key。
- 本机 Ollama。
- OpenAI Chat Completions 兼容服务。

Codex 与 Claude 请求在应用专属空目录运行。Codex 使用只读沙箱、关闭网络和批准；
Claude 禁用全部工具、限制为单轮且不保存会话。API Key 和 Claude 令牌使用 Windows
安全凭据存储加密，凭据不会写入智能来源日志或学习备份。完整学习备份包含教材原文件、解析正文和学习记录，因此新导出的备份必须设置至少 12 个字符的密码，并使用 AES-256-GCM 加密；密码遗失后无法恢复。为限制浏览器进程的内存峰值，单份完整备份的未压缩内容上限为 256 MB。旧版未加密备份仍可导入，但恢复前会明确警告其包含教材正文。

## 已实现

- PDF、EPUB 浏览器本地解析
- 扫描版 PDF 可选择使用本地 Tesseract OCR；首次使用会下载并缓存中英文识别模型，教材页面在本机完成识别
- 无浏览器插件侧栏与黑边的 PDF Canvas 原版阅读器
- 原文段落与智能文本双向快捷跳转及短时对应高亮
- PDF 按钮、页码、页边缘滚轮与键盘方向键翻页
- 章、节两级目录识别与正文分块
- 基于 PDF 行坐标、标题层级、缩进和行距的语义分段
- 旧教材可一键“重建智能分段”
- 教材数据保存到 IndexedDB
- 当前章节优先的原文检索
- 回答引用与原文位置跳转
- 依据不足时拒绝回答
- 章节练习及教材参考反馈
- 分章节本地笔记
- 可选的 Ollama 或 OpenAI 兼容 LLM 服务
- 从 Ollama 或兼容服务自动获取可用模型列表
- 原文跨页多段选择与定向 AI 智能文本整理
- 原版页面标记已有智能文本的对应范围
- 桌面三栏阅读界面与移动端适配
- Windows Electron 桌面外壳与首次智能来源向导
- 内置 Codex、Claude Agent、Ollama 与 OpenAI 兼容来源
- 智能来源单并发、取消、超时和本地保守回退

## 可选的 LLM 服务

网页版右上角“设置”支持两种连接方式：

- 本机 Ollama：填写服务地址和模型名称。
- OpenAI 兼容服务：填写 Chat Completions API 基础地址、模型 ID 和 API Key。

可点击“获取模型列表”从上游选择模型，也可以继续手动填写模型 ID。连接后，可在 PDF 原版模式点击“选择内容生成”，跨页选择需要整理的原文，再只为所选段落生成智能文本。模型只负责清理版面噪声、修复断词和整理表达，原始 PDF 文本仍保留用于引用及双向定位。已有智能文本的原文会显示绿色标记。未连接模型时自动使用原文检索模式。

服务地址和模型名称保存在当前浏览器的本地存储中；API Key 只保留在当前页面会话的内存中，刷新后需要重新填写。使用外部服务时，当前章节原文会发送给所配置的服务商，且该服务必须允许浏览器跨域请求。

桌面版中，地址、模型与来源选择保存在应用设置中，密钥只在 Electron main
进程中解密。来源失败时不会静默把教材内容发送给另一家提供商；界面先使用本地教材原文给出保守结果，再由用户决定是否切换来源。

## 当前限制

- 扫描版 PDF 的 OCR 默认关闭；启用后首次使用需要联网下载中英文识别模型，后续可使用浏览器缓存。识别速度和准确率取决于页面质量与本机性能。
- PDF 目录与语义分段采用版面规则，复杂多栏、表格或非标准标题仍可能需要手动校正。
- EPUB 使用章节与段落定位，没有固定页码。
- 当前检索为轻量关键词检索，后续可增加本地嵌入模型和混合检索。
- 全教材批量生成尚未加入 Token 预算、费用预估与中断续传，建议当前使用选择生成。
- 第一阶段仅面向 Windows x64，不提供 macOS、Linux 安装包或多用户服务器部署。
- 自动更新暂未接入，当前版本通过完整 NSIS 安装包升级。
