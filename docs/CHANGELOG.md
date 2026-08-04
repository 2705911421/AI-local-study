# Changelog

本项目的显著变更记录在此文件中，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 开源项目治理、自动发布、依赖更新和安全扫描基础设施。
- GitHub Container Registry Web 镜像发布流程。

## [0.1.0-beta.1] - 2026-08-04

### Added

- 面向受邀内测人员的 Windows x64 Beta 发布渠道和签名安装包流程。
- 用户主动导出的低敏诊断信息，不包含教材、学习记录或凭据。

### Changed

- Beta 版本关闭自动更新，升级通过私有 GitHub Release 手动完成。
- 发布页明确标识 Beta 暂不提供公开安装包下载。

### Known limitations

- 仅支持 Windows x64；外部智能来源需要用户自行配置。
- 扫描版 PDF 可能需要启用本地 OCR。
- Beta 阶段不提供收费、账号、云同步和自动更新。

## [0.1.0] - 2026-08-02

### Added

- PDF 与 EPUB 本地导入、解析、检索和阅读。
- 基于教材引用的问答、练习、笔记与复习工作流。
- 加密完整备份与恢复。
- Web 版和 Windows Electron 桌面版。

[Unreleased]: https://github.com/2705911421/AI-local-study/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/2705911421/AI-local-study/releases/tag/v0.1.0-beta.1
[0.1.0]: https://github.com/2705911421/AI-local-study/releases/tag/v0.1.0
