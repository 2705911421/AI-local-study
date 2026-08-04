# 知页 Benchmark 教材测试集 v1.0：素材来源与权利清单

核验日期：2026-08-02（Asia/Shanghai）

本清单只收录一手来源：出版机构/政府机构官网、作者或机构的官方数据集仓库，以及馆藏机构的 item metadata。这里的“可下载”不等于“可随项目重分发”；默认做法应是保存下载清单、来源、许可与哈希，让测试机按需取得文件，大文件不进 Git。

## 结论与最小可行集

建议 v1.0 先落地 7 个下载项和 2 个派生项：

| ID                | 素材                                                | 覆盖能力                         | 建议处置                 |
| ----------------- | --------------------------------------------------- | -------------------------------- | ------------------------ |
| `MED-TEXT-01`     | OSU _Anatomy & Physiology 2e_ Digital PDF           | 标准医学教材、目录、图文、引用   | 默认下载                 |
| `EPUB-01`         | UniSQ _Fundamentals of Anatomy and Physiology_ EPUB | EPUB 解包、章节树、虚拟页码      | 默认下载                 |
| `ZH-TEXT-01`      | 人教社《普通高中生物学课程标准》                    | 中文标题、目录、表格、术语       | 仅内部按需下载，不重分发 |
| `LAYOUT-01`       | TabLeX 论文 PDF                                     | 双栏、公式、引用编号、表格       | 默认下载                 |
| `TABLE-01`        | FDA Orange Book 2025-04                             | 密集药物记录、跨行字段、页眉页脚 | 默认下载                 |
| `OCR-EN-01`       | NLM 1854 年人体解剖/生理扫描本                      | 英文 OCR、插图、旧字体、噪声     | 默认下载（约 77.5 MiB）  |
| `OCR-ZH-01`       | Wellcome Chinese Collection 103                     | 中文手稿 OCR 极限、1,037 张图    | 夜间/按需下载            |
| `ODD-ROTATE-01`   | PDF.js 固定提交的旋转测试 PDF                       | `/Rotate`、文本层/注释坐标       | 默认下载（极小）         |
| `STRESS-PAGES-01` | 由 `LAYOUT-01` 合法派生的 1,501+ 页 PDF             | 页数上限、内存、索引中止         | 在 CI 本地生成           |

这套组合不依赖商业教材，除中文项外均有明确开放许可或公共领域声明；基础下载量可控制在约 210 MiB 以内（不含 Wellcome 中文手稿和 UniSQ 大 PDF）。

## 1. 标准文本型医学教材与 EPUB

### MED-TEXT-01：Oregon State University《Anatomy & Physiology 2e》

- 官方落地页：[Anatomy & Physiology 2e](https://open.oregonstate.education/anatomy2e/)
- 直接下载：[Digital PDF](https://open.oregonstate.education/anatomy2e/open/download?type=pdf)；[Print PDF](https://open.oregonstate.education/anatomy2e/open/download?type=print_pdf)；[EPUB](https://open.oregonstate.education/anatomy2e/open/download?type=epub)
- 许可：官方页标示 CC BY-SA 4.0，个别素材可能另有声明，归档时需保留署名与例外说明。
- 已核验大小：Digital PDF `131,537,536` bytes（125.4 MiB）；Print PDF `128,896,213` bytes（122.9 MiB）。官方未公布 PDF 页数，应在下载后用 `pdfinfo` 写入 manifest。
- 刁钻点：千页级医学术语、彩色插图、表格、层级目录、索引、图注与正文相邻，适合作为 PDF 解析与引用定位的主基线。

### EPUB-01 / LIMIT-SIZE-01：UniSQ《Fundamentals of Anatomy and Physiology》

- 官方落地页：[Fundamentals of Anatomy and Physiology](https://usq.pressbooks.pub/anatomy/)
- 直接下载：[EPUB](https://usq.pressbooks.pub/anatomy/open/download?type=epub)；[Digital PDF](https://usq.pressbooks.pub/anatomy/open/download?type=pdf)；[Print PDF](https://usq.pressbooks.pub/anatomy/open/download?type=print_pdf)
- 许可：官方书目信息明确为 [CC BY-SA 4.0](https://usq.pressbooks.pub/anatomy/#book-information)，但机构标志与品牌不在许可内，部分第三方素材可能另有说明。
- 已核验大小：Digital PDF `188,977,195` bytes（180.2 MiB）；Print PDF `238,379,486` bytes（227.3 MiB）。二者都超过项目 150 MB 上限，可直接验证“拒绝并给出可理解错误”；官方未公布页数。CloudFront 可能拒绝 `HEAD` 或机器人请求，下载器需支持普通 `GET` 与重定向。
- EPUB 用途：章节树、脚注/图像资源、锚点、每 800 字虚拟页码、阅读进度恢复；同书 PDF 可用于 EPUB/PDF 检索结果一致性对照。

### MED-PHARM-01：Open RN《Nursing Pharmacology 2e》（建议扩展项）

- 官方许可与说明：[Introduction](https://wtcs.pressbooks.pub/pharmacology2e/front-matter/introduction/)
- 直接下载：[PDF](https://wtcs.pressbooks.pub/pharmacology2e/open/download?type=pdf)；[EPUB](https://wtcs.pressbooks.pub/pharmacology2e/open/download?type=epub)
- 许可：CC BY 4.0，第三方素材例外以正文标注为准。
- 用途：药物类别、作用机制、临床应用、不良反应与表格问答；可替代权利不清的商业《药理学》扫描本。

## 2. 中文素材

### ZH-TEXT-01：教育部/人民教育出版社《普通高中生物学课程标准（2017 年版 2020 年修订）》

- 官方 PDF：[直接下载](https://www.pep.com.cn/xw/zt/rjwy/gzkb2020/202205/P020220517519140545267.pdf)
- 已核验大小：`2,189,836` bytes（2.09 MiB）。
- 权利：官方页面未给开放许可。只允许测试机按需从一手来源下载并用于内部评测；不要将 PDF 随公开 benchmark 或安装包重分发。
- 用途：中文目录、多级标题、表格、编号、术语和跨页引用。它不是完整教科书，因此只能作为可重复下载的中文基线，不能替代真实教材验收。

### ZH-TEXT-02：普通高中《生物学 必修 1 分子与细胞》（人工验收项）

- 一手入口：[国家中小学智慧教育平台教材入口](https://basic.smartedu.cn/tchMaterial)；[人教社相关产品/目录页](https://www.pep.com.cn/products/jc/jks/201510/t20151026_1250847.shtml)
- 权利与下载：没有核验到“官方稳定直链 + 明确开放再分发许可”的完整 PDF。平台内可访问不代表可复制或公开打包。只在取得单位/用户合法副本后做本地验收，并在 manifest 中记录来源与授权依据。
- 明确排除：个人博客、网盘和“电子教材下载站”镜像不能进入黄金测试集，也不能作为真值来源。

## 3. 双栏、公式与复杂表格

### LAYOUT-01：TabLeX 论文

- 一手论文页：[arXiv:2105.06400](https://arxiv.org/abs/2105.06400)
- 直接下载：[PDF](https://arxiv.org/pdf/2105.06400)（`805,446` bytes，arXiv 页面记录 v1 为约 777 KB）
- 许可：论文页的“view license”指向 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，允许复制与改编，需署名并注明修改。
- 用途：双栏阅读顺序、页眉页脚、章节/引用编号、公式、表格与图注。它本身比随便选一篇 arXiv 论文更适合，因为内容正是科学表格结构抽取。

### TABLE-01：FDA Orange Book 2025 年 4 月变更表

- 官方数据入口：[Orange Book Data Files](https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files)
- 固定月份 PDF：[Orange Book April 2025](https://www.fda.gov/media/186374/download)（`280,346` bytes，搜索索引显示 26 页）
- 权利：FDA [Website Policies](https://www.fda.gov/about-fda/about-website/website-policies) 说明除非另有标注，FDA 网站文字和图形处于公共领域；FDA 名称/标志仍受单独规则约束，使用时不得暗示背书。
- 用途：药品名、剂型、规格、申请号、状态和日期在视觉上形成密集多列/跨行记录，适合测试列归属、重复表头、页眉页脚和“药物—机制/状态”式检索。

### DATA-TABLE-01：PubTables-1M（只抽样，不整包）

- 官方仓库：[Microsoft Table Transformer / PubTables-1M](https://github.com/microsoft/table-transformer)
- 官方下载说明：[Training and Evaluation Data](https://github.com/microsoft/table-transformer#training-and-evaluation-data)；下载需从 Microsoft Research Open Data 页面生成带 SAS token 的 Azure 链接。
- 规模：官方仓库列出 575,305 个带表格的页面、947,642 个完整标注表格和 401,733 份源 PDF 标注；不是适合应用级 CI 的“小 PDF 测试集”。
- 权利注意：仓库的 MIT 许可是代码许可，不能自动推定为全部源论文 PDF 的统一许可。源自 PMC Open Access 的内容许可逐篇不同。v1.0 只在研究环境中抽取明确许可样本及其标注，不把全包或来源 PDF 重分发。

### DATA-LAYOUT-01：DocLayNet（可选离线黄金标注）

- 官方仓库：[DS4SD/DocLayNet](https://github.com/DS4SD/DocLayNet)
- 官方文件：[Core ZIP（约 28 GiB）](https://codait-cos-dax.s3.us.cloud-object-storage.appdomain.cloud/dax-doclaynet/1.0.0/DocLayNet_core.zip)；[Extra ZIP（约 7.5 GiB）](https://codait-cos-dax.s3.us.cloud-object-storage.appdomain.cloud/dax-doclaynet/1.0.0/DocLayNet_extra.zip)
- 规模/许可：官方仓库说明共 80,863 页、11 类版面元素，许可为 CDLA-Permissive-1.0。
- 用途：论文、专利、手册、法规等复杂版面及边界框真值。不要在开发机整包下载；由数据管理员抽取 20–100 页并保存原始 split/id。

## 4. OCR 扫描材料

### OCR-EN-01：NLM《Human anatomy, physiology and hygiene》（1854）

- 官方馆藏页：[National Library of Medicine Digital Collections](https://collections.nlm.nih.gov/catalog/nlm%3Anlmuid-61430510R-bk)
- 直接下载：[PDF](https://collections.nlm.nih.gov/pdf/nlm%3Anlmuid-61430510R-bk)
- 馆藏元数据：正文至 456 页并有 8 页图版；NLM 明示“believes this item to be in the public domain”。
- 已核验大小：重定向目标响应 `81,263,803` bytes（77.5 MiB）。
- 用途：整页图像、旧字体、污点/歪斜、插图、页码与 OCR 文本层。建议专测 `Na+`、希腊字母、连字符断词和页边注。

### OCR-ZH-01：Wellcome Chinese Collection 103

- 官方馆藏页：[Wellcome Chinese Collection 103](https://wellcomecollection.org/works/urdkgabj)
- 直接下载：[Whole item PDF](https://iiif.wellcomecollection.org/pdf/b14870472)
- 馆藏元数据：1,037 张图像，中文手稿；[Public Domain Mark](https://creativecommons.org/publicdomain/mark/1.0/)，官方署名格式为 “Wellcome Chinese Collection 103. Public Domain Mark. Source: Wellcome Collection.”
- 用途：繁体/异体字、竖排或手稿、无可靠文本层、低对比度、超长图像型 PDF。这是 OCR 极限项，不应把全文正确率与现代印刷教材使用同一阈值。

### OCR-STRESS-01：Internet Archive 公版医学词典（可选超阈值项）

- Item：[A dictionary of medical science](https://archive.org/details/bub_gb_NlAPAAAAYAAJ)
- 一手 metadata：[JSON](https://archive.org/metadata/bub_gb_NlAPAAAAYAAJ)
- 直接下载：[PDF](https://archive.org/download/bub_gb_NlAPAAAAYAAJ/bub_gb_NlAPAAAAYAAJ.pdf)
- metadata：Public Domain Mark 1.0；`175,702,697` bytes（167.6 MiB）、`imagecount=1221`、MD5 `d2f132b6776c6ee6d3eec5c31fb1fd8f`。
- 用途：同时覆盖 OCR、词典式多栏密排和 150 MB 超限拒绝。Internet Archive 的上传者元数据仍应在下载时快照保存，不能只抄文件名判断权利。

## 5. 旋转、损坏与异常 PDF

### ODD-ROTATE-01：Mozilla PDF.js 官方测试样本

固定到 PDF.js 提交 `7fc7072f9c8e499b068dfc0d860f90ebe6eda36d`，不要使用漂移的 `master`：

- [`rotated.pdf`](https://raw.githubusercontent.com/mozilla/pdf.js/7fc7072f9c8e499b068dfc0d860f90ebe6eda36d/test/pdfs/rotated.pdf)
- [`rotation.pdf`](https://raw.githubusercontent.com/mozilla/pdf.js/7fc7072f9c8e499b068dfc0d860f90ebe6eda36d/test/pdfs/rotation.pdf)
- [`rotated_freetexts.pdf`](https://raw.githubusercontent.com/mozilla/pdf.js/7fc7072f9c8e499b068dfc0d860f90ebe6eda36d/test/pdfs/rotated_freetexts.pdf)
- [`hello_world_rotated.pdf`](https://raw.githubusercontent.com/mozilla/pdf.js/7fc7072f9c8e499b068dfc0d860f90ebe6eda36d/test/pdfs/hello_world_rotated.pdf)

来源与许可：[mozilla/pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0；归档时同时保存仓库 LICENSE）。这些小文件用于 `/Rotate`、旋转文字、FreeText 注释和坐标映射，不用于问答质量。

### ODD-DERIVED-01：从 CC BY 的 TabLeX 派生可重复异常件

不要从版权不明教材制作并公开异常副本。以 `LAYOUT-01` 为母本，生成并记录脚本版本、参数、SHA-256：

1. 第 2–3 页旋转 90°；
2. 插入空白页、重复页、不同页面尺寸；
3. 将双栏页面裁成异常 CropBox/MediaBox；
4. 截断副本末尾固定字节数，制造坏 xref（预期“受控拒绝/不崩溃”，不是预期成功解析）；
5. 叠加一块半透明矩形，模拟图片覆盖文字；
6. 把同一表格拆到连续两页，模拟跨页表格。

TabLeX 的 CC BY 4.0 允许这些改编，但必须署名并明确标记“为测试而修改”。异常件只能在隔离测试目录处理；不要让安全扫描、索引器或预览器自动遍历未知的外部恶意 PDF 语料库。

### 不建议默认纳入：Isartor PDF/A 测试套件

[PDF Association 官方页](https://pdfa.org/resource/isartor-test-suite/) 与[使用条款/下载页](https://pdfa.org/isartor-test-suite-terms-of-use-download/)提供系统性不合规 PDF，但许可限定于 PDF/A 验证/结构一致性测试并禁止重分发。知页的教材解析测试未必落在授权目的内，因此除非取得书面许可，不纳入 v1.0。

## 6. 极限性能测试的可重复生成

### STRESS-PAGES-01：1,501+ 页但小于 150 MB

以 `LAYOUT-01`（CC BY 4.0）为母本，在测试机重复合并页面，直到 `pdfinfo` 报告 1,501 页；若文件仍远低于 150 MB，这是理想的“只触发页数上限”样本。输出文件须带派生说明，不能伪装成原论文。

验收预期：

- 1,500 页：允许进入解析流程；
- 1,501 页：在耗时 OCR/索引前拒绝；
- 拒绝路径不应把整文件加载进内存；
- 错误信息应同时显示实测页数与允许上限。

### STRESS-SIZE-01：只触发 150 MB 上限

优先使用 UniSQ Digital PDF（180.2 MiB）或 IA 医学词典（167.6 MiB）验证超限拒绝。另生成 149 MiB、150 MiB、150 MiB + 1 byte 三个边界夹具，明确产品中的 MB 是十进制 `150,000,000` bytes 还是二进制 `150 MiB = 157,286,400` bytes；README、服务端校验和前端提示必须一致。

## 7. 明确排除与权利风险

### 当前 OpenStax《Anatomy and Physiology 2e》不进入默认自动集

[OpenStax 官方书页](https://openstax.org/details/books/anatomy-and-physiology-2e/)标 CC BY-NC-SA 4.0，但其[当前 Preface](https://openstax.org/books/anatomy-and-physiology-2e/pages/preface)还明确写出：未经许可，不得用于训练大语言模型，也不得摄取到大语言模型/生成式 AI 产品中。知页的 RAG/问答摄取是否落入该限制存在明显风险。因此：

- 自动 benchmark 用 OSU/UniSQ 的开放改编版替代；
- 若必须测试 OpenStax 原版，先取得 OpenStax 书面许可并在 manifest 记录许可范围；
- 不要根据旧版许可记忆或第三方镜像绕过当前一手来源条款。

同理，用户自有《病理生理学》《药理学》《医学微生物学》等商业教材可以做私有验收，但不应进入可下载、可复制的公共 benchmark。

## 8. 下载与 provenance 规范

每个文件至少记录：

```json
{
  "id": "LAYOUT-01",
  "source_page": "https://arxiv.org/abs/2105.06400",
  "download_url": "https://arxiv.org/pdf/2105.06400",
  "retrieved_at": "2026-08-02T00:00:00+08:00",
  "license": "CC-BY-4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "bytes": 805446,
  "sha256": "DOWNLOAD_THEN_FILL",
  "pdf_pages": "DOWNLOAD_THEN_FILL",
  "redistributable": true,
  "notes": "Pin arXiv version v1; preserve attribution"
}
```

下载器要求：

- 允许重定向，但只接受 HTTPS 最终地址；
- 下载到临时文件，校验大小/哈希后原子改名；
- 保存响应头、最终 URL、下载时间、许可证快照或其稳定链接；
- CI 默认只取最小集，小于 10 MiB 的项目常跑；OCR/大文件由 nightly job 跑；
- 版权受限项只存 manifest，不上传 PDF；开放项重分发时仍保留署名、许可与修改声明；
- 数据集抽样必须保存原始 item/page/table id，不能只保存重命名后的图片。

这样可以把“能下载”与“能公开打包”分开，也能在上游文件更新时定位 benchmark 漂移。
