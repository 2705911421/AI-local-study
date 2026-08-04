# 知页 Benchmark 教材测试集

## 概述

知页 Benchmark 是一个自动化的教材解析测试框架，用于验证 PDF/EPUB 解析器在真实教材环境下的可靠程度。

## 素材清单

### 核心素材（profile: smoke）

| ID                                     | 类型         | 文件                                  | 大小        | 用途               |
| -------------------------------------- | ------------ | ------------------------------------- | ----------- | ------------------ |
| gutenberg-physiology-epub              | EPUB         | physiology-gutenberg.epub             | 5.1 MB      | EPUB解析、虚拟页码 |
| tablex-two-column                      | 双栏论文     | tablex-2105.06400.pdf                 | 787 KB      | 双栏阅读顺序       |
| pubtabnet-tables                       | 表格论文     | pubtabnet-1911.10683.pdf              | 1.45 MB     | 复杂表格识别       |
| pdfjs-rotated-page                     | 旋转页       | pdfjs-hello-world-rotated.pdf         | 1.3 KB      | 旋转页面处理       |
| pdfjs-missing-cmap                     | 字体编码     | pdfjs-truetype-without-cmap.pdf       | 3.9 KB      | 缺失CMap字体       |
| pdfjs-real-two-column                  | 双栏PDF      | pdfjs-issue9552-two-column.pdf        | 1.46 MB     | 真实双栏文档       |
| public-domain-scanned-medical-textbook | 扫描OCR      | human-body-1907-scan.pdf              | 9.3 MB      | 扫描版OCR          |
| **libretexts-anatomy-physiology**      | **标准教材** | **libretexts-anatomy-physiology.pdf** | **1.9 MB**  | **标准医学教材**   |
| **fda-orange-book**                    | **表格密集** | **fda-orange-book-2025.pdf**          | **274 KB**  | **密集药物表格**   |
| **chinese-medicine-textbook**          | **中文OCR**  | **chinese-medicine-textbook.pdf**     | **44.5 MB** | **中文扫描教材**   |
| synthetic-medical-adversarial          | 合成夹具     | synthetic-medical-adversarial.pdf     | 147 KB      | 中文医学复杂版面   |
| synthetic-medical-scan                 | 合成扫描     | synthetic-medical-scan.pdf            | 110 KB      | 纯图像PDF          |
| synthetic-2001-pages                   | 合成超限     | synthetic-2001-pages.pdf              | 427 KB      | 2001页超限拒绝     |

### 参考素材（profile: reference，不默认下载）

| ID                          | 类型     | 文件                                | 大小    | 用途         |
| --------------------------- | -------- | ----------------------------------- | ------- | ------------ |
| wellcome-chinese-collection | 中文手稿 | wellcome-chinese-collection-103.pdf | ~195 MB | 繁体竖排手稿 |
| unisq-anatomy-oversize-epub | 超限EPUB | unisq-anatomy-oversize.epub         | 189 MB  | 超限文件拒绝 |
| unisq-anatomy-oversize-pdf  | 超限PDF  | unisq-anatomy-oversize.pdf          | 180 MB  | 超限文件拒绝 |

## 测试用例

### 结构解析测试（16个）

- 所有素材的解析结果验证
- 章节数量、文本块数、页数、表格块数
- 超限文件拒绝
- 扫描文档OCR识别

### 检索质量测试（15个）

- TabLeX 双栏论文检索
- PubTabNet 表格论文检索
- 合成中文医学文档检索
- LibreTexts 解剖学教材检索
- FDA Orange Book 药物信息检索
- Gutenberg EPUB 生理学检索
- PDF.js 双栏文档检索
- 扫描版医学教材检索

### OCR 测试

- Tesseract.js 中文+英文识别
- 医学符号识别准确率
- 8个关键词检查

## 运行命令

```bash
# 下载素材
npm run benchmark:download -- --profile smoke

# 生成合成夹具
npm run benchmark:fixtures

# 运行结构解析基准
npm run benchmark:run

# 运行OCR测试
npm run benchmark:ocr
```

## 结果文件

- `results/latest.json` — 最新结构解析测试结果
- `results/ocr-latest.json` — 最新OCR测试结果

## 报告

详细报告请查看 `docs/benchmark-report-v2.md`。

## 测试集覆盖的刁钻场景

1. **标准文本型医学教材** — LibreTexts Anatomy & Physiology
2. **EPUB格式** — Gutenberg 生理学
3. **中文普通教材** — 合成中文医学PDF
4. **医学专业教材** — 中医古籍（扫描版）
5. **双栏论文PDF** — TabLeX + PDF.js
6. **含复杂表格PDF** — PubTabNet + FDA Orange Book
7. **扫描版PDF** — 1907年公版医学教材 + 中医古籍
8. **超大型PDF** — 合成2001页 + UniSQ超限参考
9. **异常格式PDF** — 旋转页、缺失CMap、截断等
10. **自动评分系统** — 15个测试用例 + 8个OCR检查
