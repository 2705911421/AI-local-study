#!/usr/bin/env python3
"""
Zhiye Benchmark Synthetic Materials Generator
Generates 12 synthetic test files with known structures and content.
"""

import os
import random
import textwrap
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = PROJECT_ROOT / "benchmarks" / "corpus"
CORPUS_DIR.mkdir(parents=True, exist_ok=True)

# LQ = left quote, RQ = right quote (unicode)
LQ = "\u201c"
RQ = "\u201d"

CHINESE_FONT = "Helvetica"
_HAS_CN = False
for fp, fn in [("C:/Windows/Fonts/simsun.ttc", "SimSun"),
               ("C:/Windows/Fonts/msyh.ttc", "YaHei"),
               ("C:/Windows/Fonts/simhei.ttf", "SimHei")]:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont(fn, fp, subfontIndex=0))
            CHINESE_FONT = fn
            _HAS_CN = True
            break
        except Exception:
            continue
if not _HAS_CN:
    try:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        CHINESE_FONT = "STSong-Light"
        _HAS_CN = True
    except Exception:
        pass


def out(name):
    return CORPUS_DIR / name


def make_doc(fn, **kw):
    return SimpleDocTemplate(
        str(out(fn)), pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm, **kw,
    )


def cs(name="CS", fontSize=11, leading=16, bold=False, **kw):
    return ParagraphStyle(name, fontName=CHINESE_FONT, fontSize=fontSize, leading=leading, **kw)


def es(name="ES", fontSize=11, leading=16, bold=False, **kw):
    fn = "Helvetica-Bold" if bold else "Helvetica"
    return ParagraphStyle(name, fontName=fn, fontSize=fontSize, leading=leading, **kw)


# ===================== 1. Chinese Textbook =====================
def gen_chinese_textbook():
    doc = make_doc("synthetic-chinese-textbook.pdf")
    h1 = cs("H1", 18, 24, bold=True, alignment=TA_CENTER)
    h2 = cs("H2", 14, 20, bold=True)
    h3 = cs("H3", 12, 18, bold=True)
    bd = cs("BD", 10.5, 16, alignment=TA_JUSTIFY)
    cp = cs("CP", 9, 13, alignment=TA_CENTER, textColor=grey)
    S = lambda n=4*mm: Spacer(1, n)
    story = []

    story.append(Paragraph("第一章 细胞的分子组成", h1))
    story.append(S(8*mm))
    story.append(Paragraph("第一节 细胞中的元素和化合物", h2))
    story.append(S())
    story.append(Paragraph(
        "组成细胞的化学元素常见的有20多种，其中基本元素是碳（C）。"
        "细胞中含量最多的化合物是水，含量最多的有机化合物是蛋白质。"
        "这些元素和化合物构成了细胞结构和功能的物质基础。", bd))
    story.append(S())
    story.append(Paragraph("图1-1 组成细胞的主要元素及其含量", cp))
    story.append(S())

    data = [
        ["元素", "符号", "原子序数", "在细胞中的作用"],
        ["碳", "C", "6", "有机物骨架"],
        ["氢", "H", "1", "水和有机物组成"],
        ["氧", "O", "8", "水和有机物组成"],
        ["氮", "N", "7", "蛋白质和核酸组成"],
        ["磷", "P", "15", "ATP和核酸组成"],
        ["硫", "S", "16", "蛋白质二硫键"],
        ["铁", "Fe", "26", "血红蛋白"],
        ["钙", "Ca", "20", "骨骼和信号传导"],
    ]
    t = Table(data, colWidths=[60, 50, 70, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#4472C4")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#D9E2F3")]),
    ]))
    story.append(t)
    story.append(S(6*mm))

    story.append(Paragraph("第二节 细胞中的蛋白质", h2))
    story.append(S())
    story.append(Paragraph(
        "蛋白质是生命活动的主要承担者。蛋白质的基本组成单位是氨基酸，"
        "组成蛋白质的氨基酸约有20种。氨基酸通过脱水缩合形成多肽链，"
        "多肽链经过折叠形成具有特定空间结构的蛋白质。", bd))
    story.append(S())
    story.append(Paragraph(
        "蛋白质的功能具有多样性：催化功能（酶）、运输功能（血红蛋白）、"
        "免疫功能（抗体）、调节功能（胰岛素）、结构功能（肌肉蛋白）等。"
        "蛋白质功能的多样性是由其结构的多样性决定的。", bd))
    story.append(S())
    story.append(Paragraph("图1-2 蛋白质的四级结构示意图", cp))
    story.append(PageBreak())

    story.append(Paragraph("第二章 细胞的基本结构", h1))
    story.append(S(8*mm))
    story.append(Paragraph("第一节 细胞膜——系统的边界", h2))
    story.append(S())
    story.append(Paragraph(
        "细胞膜主要由磷脂双分子层和蛋白质组成，此外还有少量糖类。"
        "磷脂双分子层构成膜的基本支架，蛋白质分子镶嵌、贯穿或覆盖在磷脂双分子层上。"
        "细胞膜的功能包括：将细胞与外界环境分隔开、控制物质进出细胞、进行细胞间的信息交流。", bd))

    story.append(Paragraph("第二节 细胞器——系统内的分工合作", h2))
    story.append(S())
    story.append(Paragraph("一、线粒体", h3))
    story.append(S(3*mm))
    # Use LQ/RQ for Chinese quotes
    story.append(Paragraph(
        "线粒体是细胞进行有氧呼吸的主要场所，被称为" + LQ + "动力车间" + RQ + "。"
        "细胞生命活动所需的能量，大约95%来自线粒体。"
        "线粒体具有双层膜结构，内膜向内折叠形成嵴，增大了内膜面积。"
        "线粒体基质中含有与有氧呼吸有关的酶以及少量DNA。", bd))

    story.append(Paragraph("二、叶绿体", h3))
    story.append(S(3*mm))
    story.append(Paragraph(
        "叶绿体是绿色植物进行光合作用的场所，被称为"
        + LQ + "养料制造车间" + RQ + "和" + LQ + "能量转换站" + RQ + "。"
        "叶绿体也具有双层膜结构，内部含有类囊体和基质。"
        "类囊体堆叠形成基粒，增大了受光面积。叶绿体基质中含有与光合作用暗反应有关的酶以及少量DNA。", bd))

    story.append(Paragraph("三、内质网", h3))
    story.append(S(3*mm))
    story.append(Paragraph(
        "内质网是由膜连接而成的网状结构，是细胞内蛋白质合成和加工、"
        "以及脂质合成的" + LQ + "车间" + RQ + "。内质网分为粗面内质网和滑面内质网两种类型。", bd))

    story.append(S())
    story.append(Paragraph("表2-1 主要细胞器的比较", cp))
    story.append(S(2*mm))
    org = [
        ["细胞器", "膜结构", "主要功能", "特殊结构"],
        ["线粒体", "双层膜", "有氧呼吸", "嵴、基质DNA"],
        ["叶绿体", "双层膜", "光合作用", "基粒、基质DNA"],
        ["内质网", "单层膜", "蛋白质/脂质合成", "粗面/滑面"],
        ["高尔基体", "单层膜", "蛋白质加工分拣", "扁平囊泡"],
        ["溶酶体", "单层膜", "消化分解", "含水解酶"],
        ["核糖体", "无膜", "蛋白质合成", "大/小亚基"],
        ["中心体", "无膜", "细胞分裂", "两个中心粒"],
    ]
    t2 = Table(org, colWidths=[70, 60, 130, 110])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#548235")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#E2EFDA")]),
    ]))
    story.append(t2)
    story.append(PageBreak())

    story.append(Paragraph("第三章 细胞的代谢", h1))
    story.append(S(8*mm))
    story.append(Paragraph("第一节 物质跨膜运输的方式", h2))
    story.append(S())
    story.append(Paragraph(
        "物质跨膜运输的方式包括被动运输和主动运输。"
        "被动运输包括自由扩散和协助扩散，都是顺浓度梯度进行的，不需要消耗能量。"
        "主动运输是逆浓度梯度进行的，需要载体蛋白的协助并消耗能量（ATP）。", bd))

    story.append(Paragraph("第二节 细胞的能量通货——ATP", h2))
    story.append(S())
    story.append(Paragraph(
        "ATP（三磷酸腺苷）是细胞生命活动的直接能源物质，被称为"
        + LQ + "能量通货" + RQ + "。"
        "ATP的结构简式为A-P~P~P，其中A代表腺苷，P代表磷酸基团，~代表高能磷酸键。"
        "ATP与ADP可以相互转化：ATP转化为ADP + Pi + 能量。"
        "细胞中ATP的含量很少，但ATP与ADP的转化十分迅速，以满足细胞对能量的持续需求。", bd))

    story.append(Paragraph("第三节 酶在代谢中的作用", h2))
    story.append(S())
    story.append(Paragraph(
        "酶是活细胞产生的具有催化作用的有机物，其中绝大多数酶是蛋白质。"
        "酶具有高效性、专一性和作用条件温和的特性。"
        "酶的活性受温度和pH的影响：每种酶都有最适温度和最适pH，"
        "过高或过低的温度和pH都会影响酶的活性甚至导致酶变性失活。", bd))

    doc.build(story)
    print("  done synthetic-chinese-textbook.pdf")


# ===================== 2. Pharmacology =====================
def gen_pharmacology():
    doc = make_doc("synthetic-medical-pharmacology.pdf")
    h1 = cs("H1", 18, 24, bold=True, alignment=TA_CENTER)
    h2 = cs("H2", 14, 20, bold=True)
    bd = cs("BD", 10.5, 16, alignment=TA_JUSTIFY)
    cp = cs("CP", 9, 13, alignment=TA_CENTER, textColor=grey)
    S = lambda n=4*mm: Spacer(1, n)
    story = []

    story.append(Paragraph("第一章 肾上腺素受体阻断药", h1))
    story.append(S(8*mm))
    story.append(Paragraph("第一节 β受体阻断药", h2))
    story.append(S())
    story.append(Paragraph(
        "β受体阻断药能与去甲肾上腺素能神经递质或拟肾上腺素药竞争β受体，"
        "从而拮抗β受体激动效应。根据对β1和β2受体的选择性不同，"
        "β受体阻断药可分为非选择性β受体阻断药（如普萘洛尔）、"
        "选择性β1受体阻断药（如阿替洛尔、美托洛尔）和兼有α1受体阻断作用的β受体阻断药（如拉贝洛尔）。", bd))
    story.append(S())
    story.append(Paragraph(
        "β受体阻断药降低心率的机制：普萘洛尔通过阻断心脏β1受体，"
        "抑制交感神经兴奋引起的心率加快，减慢窦性心律，降低心肌收缩力，"
        "减少心输出量，从而降低血压。此外，普萘洛尔还能阻断肾脏β1受体，"
        "抑制肾素释放，进一步降低血压。因此，β受体阻断药是治疗高血压、"
        "心绞痛、心律失常和慢性心力衰竭的重要药物。", bd))
    story.append(S())

    drug = [
        ["药物", "受体选择性", "内在拟交感活性", "膜稳定作用", "临床应用", "不良反应"],
        ["普萘洛尔", "非选择性β1/β2", "无", "有", "高血压、心绞痛、心律失常", "心动过缓、支气管痉挛"],
        ["阿替洛尔", "选择性β1", "无", "无", "高血压、心绞痛", "心动过缓、疲劳"],
        ["美托洛尔", "选择性β1", "无", "弱", "高血压、心梗后", "心动过缓、头晕"],
        ["拉贝洛尔", "α1+β", "无", "无", "高血压急症、妊娠高血压", "体位性低血压"],
        ["吲哚洛尔", "非选择性", "有", "有", "高血压、心绞痛", "多梦、失眠"],
        ["比索洛尔", "选择性β1", "无", "无", "高血压、心力衰竭", "头痛、疲劳"],
    ]
    t = Table(drug, colWidths=[55, 65, 60, 55, 90, 85])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#C00000")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#FBE5D6")]),
    ]))
    story.append(t)
    story.append(PageBreak())

    story.append(Paragraph("第二节 血管紧张素转化酶抑制剂（ACEI）", h2))
    story.append(S())
    story.append(Paragraph(
        "ACEI通过抑制血管紧张素转化酶（ACE），减少血管紧张素II（AngII）的生成，"
        "从而扩张血管、降低血压。ACEI还抑制缓激肽的降解，增加缓激肽水平，"
        "促进一氧化氮（NO）和前列腺素的释放，进一步增强扩血管效应。"
        "常用药物包括卡托普利、依那普利、赖诺普利等。", bd))
    story.append(S())
    story.append(Paragraph(
        "ACEI的主要不良反应包括：干咳（发生率10-15%，与缓激肽蓄积有关）、"
        "高血钾（抑制醛固酮分泌）、血管神经性水肿（罕见但严重）、"
        "肾功能损害（双侧肾动脉狭窄患者禁用）、胎儿畸形（孕妇禁用）。", bd))

    story.append(Paragraph("第三节 钙通道阻滞药（CCB）", h2))
    story.append(S())
    story.append(Paragraph(
        "钙通道阻滞药通过阻断L型钙通道，抑制Ca2+内流，从而松弛血管平滑肌、降低血压。"
        "二氢吡啶类（如硝苯地平、氨氯地平）主要作用于血管平滑肌，"
        "非二氢吡啶类（如维拉帕米、地尔硫卓）主要作用于心脏。"
        "硝苯地平的常见不良反应包括面部潮红、头痛、踝部水肿和心悸。", bd))
    story.append(S())
    ccb = [
        ["药物", "分类", "作用部位", "半衰期", "主要用途"],
        ["硝苯地平", "二氢吡啶", "血管为主", "2-5h", "高血压、心绞痛"],
        ["氨氯地平", "二氢吡啶", "血管为主", "35-50h", "高血压、心绞痛"],
        ["维拉帕米", "苯烷胺", "心脏为主", "6-8h", "心律失常、心绞痛"],
        ["地尔硫卓", "苯并硫氮卓", "心脏和血管", "3-5h", "心绞痛、心律失常"],
    ]
    t2 = Table(ccb, colWidths=[65, 70, 70, 55, 110])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#7030A0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#E4D5F0")]),
    ]))
    story.append(t2)
    doc.build(story)
    print("  done synthetic-medical-pharmacology.pdf")


# ===================== 3. Pathophysiology =====================
def gen_pathophysiology():
    doc = make_doc("synthetic-medical-pathophysiology.pdf")
    h1 = cs("H1", 18, 24, bold=True, alignment=TA_CENTER)
    h2 = cs("H2", 14, 20, bold=True)
    bd = cs("BD", 10.5, 16, alignment=TA_JUSTIFY)
    cp = cs("CP", 9, 13, alignment=TA_CENTER, textColor=grey)
    S = lambda n=4*mm: Spacer(1, n)
    story = []

    story.append(Paragraph("第一章 酸碱平衡紊乱", h1))
    story.append(S(8*mm))
    story.append(Paragraph("第一节 酸碱平衡的基本概念", h2))
    story.append(S())
    story.append(Paragraph(
        "正常人体液的pH维持在7.35至7.45之间，平均7.40。"
        "机体通过缓冲系统、肺和肾脏三个环节来维持酸碱平衡。"
        "血液中的缓冲系统包括碳酸氢盐缓冲系统（HCO3-/H2CO3）、"
        "磷酸盐缓冲系统（Na2HPO4/NaH2PO4）和血浆蛋白缓冲系统等。", bd))
    story.append(S())
    story.append(Paragraph("第二节 血气分析指标", h2))
    story.append(S())
    story.append(Paragraph("血气分析是评估酸碱平衡状态的重要检查手段。主要指标包括：", bd))
    story.append(S(3*mm))

    bg = [
        ["指标", "缩写", "正常值", "临床意义"],
        ["动脉血pH", "pH", "7.35-7.45", "酸碱度"],
        ["标准碳酸氢盐", "SB", "22-27 mmol/L", "排除呼吸因素的代谢指标"],
        ["实际碳酸氢盐", "AB", "22-27 mmol/L", "实际代谢指标"],
        ["碱剩余", "BE", "-3至+3 mmol/L", "代谢性酸碱指标"],
        ["二氧化碳分压", "PaCO2", "35-45 mmHg", "呼吸性酸碱指标"],
        ["氧分压", "PaO2", "80-100 mmHg", "氧合状态"],
        ["氧饱和度", "SaO2", "95-98%", "血红蛋白携氧能力"],
        ["阴离子间隙", "AG", "8-16 mmol/L", "代谢性酸中毒分类"],
    ]
    t = Table(bg, colWidths=[75, 55, 90, 150])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0070C0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#DAEEF3")]),
    ]))
    story.append(t)
    story.append(PageBreak())

    story.append(Paragraph("第三节 代谢性酸中毒", h2))
    story.append(S())
    story.append(Paragraph(
        "代谢性酸中毒是最常见的酸碱平衡紊乱类型，以血浆HCO3-浓度原发性降低为特征。"
        "根据阴离子间隙（AG）的不同，代谢性酸中毒可分为AG增高型和AG正常型两大类。", bd))
    story.append(S())
    story.append(Paragraph(
        "代谢性酸中毒的原因主要包括：（1）酸负荷增加：如糖尿病酮症酸中毒时酮体大量生成、"
        "乳酸酸中毒、严重缺氧时无氧酵解增强；（2）碳酸氢根丢失：如严重腹泻、"
        "肠瘘、胰瘘等导致HCO3-直接丢失；（3）肾排酸障碍：如急性肾功能衰竭、"
        "慢性肾功能衰竭时肾小管排酸功能下降，硫酸根和磷酸根在体内蓄积。", bd))
    story.append(S())
    story.append(Paragraph(
        "代谢性酸中毒的代偿机制：呼吸代偿是最迅速的反应，H+浓度升高刺激外周化学感受器，"
        "引起呼吸加深加快（Kussmaul呼吸），使PaCO2降低，从而减轻pH下降的程度。"
        "预计代偿公式为：PaCO2 = 1.5 x HCO3- + 8 正负2。"
        "肾脏代偿需要3至5天才能充分发挥作用，通过增加H+排出和HCO3-重吸收来纠正酸中毒。", bd))
    story.append(PageBreak())

    story.append(Paragraph("第四节 呼吸性酸中毒", h2))
    story.append(S())
    story.append(Paragraph(
        "呼吸性酸中毒以血浆PaCO2原发性升高为特征，常见于："
        "（1）呼吸中枢抑制：如镇静药过量、脑血管意外；"
        "（2）气道阻塞：如哮喘、COPD急性加重；"
        "（3）胸廓和肺部疾病：如气胸、重症肺炎、ARDS；"
        "（4）呼吸肌麻痹：如重症肌无力、Guillain-Barre综合征。", bd))
    story.append(S())
    story.append(Paragraph(
        "急性呼吸性酸中毒时，由于肾脏来不及代偿，pH显著下降。"
        "HCO3-每升高10mmol/L，pH约下降0.08至0.11。"
        "慢性呼吸性酸中毒时，肾脏充分代偿，HCO3-每升高10mmol/L，pH仅下降0.03至0.04。"
        "治疗的关键是改善通气，必要时进行机械通气。", bd))

    doc.build(story)
    print("  done synthetic-medical-pathophysiology.pdf")


# ===================== 4. Two-column academic =====================
def gen_two_column():
    doc = make_doc("synthetic-two-column-academic.pdf")
    t1 = es("T1", 16, 20, bold=True, alignment=TA_CENTER)
    au = es("AU", 10, 14, alignment=TA_CENTER)
    h1 = es("H1", 12, 16, bold=True)
    h2 = es("H2", 10.5, 14, bold=True)
    bd = es("BD", 9, 12, alignment=TA_JUSTIFY)
    cp = es("CP", 8, 11, alignment=TA_CENTER, textColor=grey)
    S = lambda n=3*mm: Spacer(1, n)
    story = []

    story.append(Paragraph("Document Layout Analysis with Deep Learning: A Survey", t1))
    story.append(S(4*mm))
    story.append(Paragraph("John Smith, Jane Doe, Alice Johnson - University of Technology", au))
    story.append(S(2*mm))
    story.append(Paragraph("Abstract", h1))
    story.append(Paragraph(
        "Document layout analysis is a fundamental task in document understanding that involves "
        "identifying and categorizing regions of interest in a document image. Recent advances in "
        "deep learning have significantly improved the performance of layout analysis systems. "
        "This survey reviews 150+ papers published between 2018 and 2024, covering object detection "
        "based methods [1], semantic segmentation approaches [2], and graph neural network models [3]. "
        "We provide a comprehensive taxonomy of methods, benchmark comparisons on standard datasets "
        "(PubLayNet [4], DocBank [5], TableBank [6]), and discuss open challenges including "
        "multi-column reading order detection, table structure recognition, and formula extraction.", bd))

    story.append(S(6*mm))
    story.append(Paragraph("1. Introduction", h1))
    story.append(S())
    story.append(Paragraph(
        "Document layout analysis aims to partition a document image into meaningful regions "
        "such as text blocks, titles, figures, tables, and formulas. This task is crucial for "
        "optical character recognition (OCR) systems, digital library construction, and "
        "accessibility applications. The challenge lies in handling diverse document formats, "
        "complex layouts, and varying content types within a single document [7].", bd))
    story.append(S())
    story.append(Paragraph(
        "Traditional approaches relied on heuristic rules based on projection profiles, "
        "connected component analysis, and morphological operations [8]. While effective for "
        "simple layouts, these methods often fail on documents with complex structures such as "
        "multi-column text, embedded tables, or overlapping regions. The introduction of "
        "convolutional neural networks (CNNs) revolutionized the field by enabling data-driven "
        "feature extraction [9].", bd))
    story.append(S())
    story.append(Paragraph(
        "The mathematical formulation of the layout analysis problem can be expressed as: "
        "given a document image I, the goal is to predict a set of bounding boxes B = {b1, b2, ..., bn} "
        "and corresponding labels L = {l1, l2, ..., ln}, where each bi = (xi, yi, wi, hi) represents "
        "the position and size of a layout element, and li is a category label "
        "in {text, title, figure, table, formula, list, header, footer}.", bd))

    story.append(S(6*mm))
    story.append(Paragraph("2. Related Work", h1))
    story.append(S())
    story.append(Paragraph("2.1 Object Detection Methods", h2))
    story.append(S(2*mm))
    story.append(Paragraph(
        "Object detection approaches treat layout analysis as a detection problem where each "
        "layout element is a bounding box to be detected. Faster R-CNN [10] and its variants "
        "have been widely adopted for this task. The key innovation was the Region Proposal "
        "Network (RPN) which generates candidate regions efficiently. More recently, "
        "transformer-based detectors like DETR [11] have shown promising results by "
        "formulating detection as a set prediction problem, eliminating the need for "
        "non-maximum suppression (NMS).", bd))

    story.append(S())
    story.append(Paragraph("2.2 Segmentation Methods", h2))
    story.append(S(2*mm))
    story.append(Paragraph(
        "Semantic segmentation approaches classify each pixel in the document image into "
        "one of the predefined layout categories. Fully Convolutional Networks (FCN) [12] "
        "and U-Net [13] architectures have been adapted for document segmentation. These "
        "methods provide pixel-level precision but may struggle with boundary accuracy "
        "between closely spaced regions.", bd))

    story.append(S(4*mm))
    story.append(Paragraph("Table 1: Performance comparison on PubLayNet test set", cp))
    story.append(S(2*mm))
    perf = [
        ["Method", "Backbone", "mAP@0.5", "FPS", "Year"],
        ["Faster R-CNN", "ResNet-50", "0.782", "8.5", "2019"],
        ["Mask R-CNN", "ResNet-101-FPN", "0.824", "5.2", "2020"],
        ["DETR", "R50", "0.835", "12.1", "2021"],
        ["LayoutLMv3", "Large", "0.912", "3.8", "2022"],
        ["DiT", "Base", "0.926", "2.5", "2023"],
        ["LayoutDETR", "Swin-L", "0.934", "1.8", "2024"],
    ]
    t = Table(perf, colWidths=[80, 80, 70, 50, 40])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#333333")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F2F2F2")]),
    ]))
    story.append(t)
    story.append(PageBreak())

    story.append(Paragraph("3. Methodology", h1))
    story.append(S())
    story.append(Paragraph(
        "Our proposed method combines the strengths of transformer-based detection with "
        "multi-scale feature extraction. The architecture consists of three main components: "
        "(1) a backbone network for hierarchical feature extraction, (2) a feature pyramid "
        "network (FPN) for multi-scale representation, and (3) a transformer decoder for "
        "layout element prediction. The loss function combines classification loss and "
        "regression loss: L = L1*L_cls + L2*L_reg, where L_cls is the focal loss [14] "
        "and L_reg is the generalized IoU loss [15].", bd))

    story.append(S(6*mm))
    story.append(Paragraph("4. Experiments", h1))
    story.append(S())
    story.append(Paragraph("4.1 Datasets", h2))
    story.append(S(2*mm))
    story.append(Paragraph(
        "We evaluate our method on three standard benchmarks: PubLayNet (336K images), "
        "DocBank (500K images), and TableBank (188K images). All experiments follow the "
        "standard train/validation/test splits. Data augmentation includes random rotation "
        "(plus/minus 5 degrees), random scaling (0.8-1.2x), and horizontal flipping.", bd))
    story.append(S())
    story.append(Paragraph("4.2 Results", h2))
    story.append(S(2*mm))
    story.append(Paragraph(
        "Our method achieves state-of-the-art performance on all three benchmarks. "
        "On PubLayNet, we obtain mAP@0.5 of 0.941, surpassing the previous best (LayoutDETR) "
        "by 0.7%. The improvement is particularly significant for small text blocks (+2.3%) "
        "and table regions (+1.8%). On DocBank, we achieve mAP@0.5 of 0.918, demonstrating "
        "strong generalization across different document types.", bd))

    story.append(S(6*mm))
    story.append(Paragraph("5. Conclusion", h1))
    story.append(S())
    story.append(Paragraph(
        "We presented a comprehensive survey of deep learning methods for document layout "
        "analysis and proposed a novel transformer-based architecture that achieves "
        "state-of-the-art results. Our method demonstrates robust performance across "
        "diverse document types and layouts. Future work will focus on extending the "
        "approach to handle curved text, handwritten documents, and real-time processing "
        "requirements.", bd))

    story.append(S(6*mm))
    story.append(Paragraph("References", h1))
    refs = [
        "[1] He et al., Faster R-CNN, NeurIPS 2015.",
        "[2] Long et al., Fully Convolutional Networks, CVPR 2015.",
        "[3] Li et al., Graph Neural Networks for Document Layout, AAAI 2022.",
        "[4] Zhong et al., PubLayNet, ACM MM 2019.",
        "[5] Li et al., DocBank, ACL 2020.",
        "[6] Li et al., TableBank, ACL 2019 Workshop.",
        "[7] Mao et al., Document Structure Analysis, IJDAR 2003.",
        "[8] O'Gorman, The document spectrum for page layout analysis, PAMI 1993.",
        "[9] Chen and Gupta, An empirical study of CNNs for document analysis, CVPR 2015.",
        "[10] Ren et al., Faster R-CNN, NeurIPS 2015.",
        "[11] Carion et al., DETR, ECCV 2020.",
        "[12] Long et al., Fully Convolutional Networks, CVPR 2015.",
        "[13] Ronneberger et al., U-Net, MICCAI 2015.",
        "[14] Lin et al., Focal Loss, ICCV 2017.",
        "[15] Rezatofighi et al., Generalized IoU, CVPR 2019.",
    ]
    for r in refs:
        story.append(Paragraph(r, es("R", 8, 10)))

    doc.build(story)
    print("  done synthetic-two-column-academic.pdf")


# ===================== 5. Complex Tables =====================
def gen_complex_tables():
    doc = make_doc("synthetic-complex-tables.pdf")
    h1 = cs("H1", 16, 22, bold=True, alignment=TA_CENTER)
    cp = cs("CP", 9, 13, alignment=TA_CENTER, textColor=grey)
    S = lambda n=4*mm: Spacer(1, n)
    story = []
    story.append(Paragraph("合成复杂表格测试文档", h1))
    story.append(S(6*mm))
    story.append(Paragraph("表1 抗菌药物分类及代表药物", cp))
    story.append(S(2*mm))

    d1 = [
        ["分类", "代表药物", "作用机制", "抗菌谱", "临床应用"],
        ["β-内酰胺类", "青霉素G", "抑制细胞壁合成", "G+菌为主", "链球菌感染"],
        ["", "阿莫西林", "抑制细胞壁合成", "G+/G-菌", "呼吸道感染"],
        ["", "头孢曲松", "抑制细胞壁合成", "广谱", "严重感染"],
        ["大环内酯类", "红霉素", "抑制蛋白质合成", "G+菌、支原体", "呼吸道感染"],
        ["", "阿奇霉素", "抑制蛋白质合成", "广谱", "呼吸道/泌尿道"],
        ["喹诺酮类", "左氧氟沙星", "抑制DNA旋转酶", "广谱", "泌尿道/呼吸道"],
        ["", "莫西沙星", "抑制DNA旋转酶", "广谱+厌氧", "复杂感染"],
        ["氨基糖苷类", "庆大霉素", "抑制蛋白质合成", "G-菌为主", "严重G-感染"],
        ["四环素类", "多西环素", "抑制蛋白质合成", "广谱", "立克次体/支原体"],
        ["糖肽类", "万古霉素", "抑制细胞壁合成", "G+菌", "MRSA感染"],
        ["抗真菌药", "氟康唑", "抑制麦角固醇合成", "念珠菌/隐球菌", "深部真菌感染"],
    ]
    t1 = Table(d1, colWidths=[70, 75, 90, 75, 80])
    t1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#2E75B6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("SPAN", (0, 1), (0, 3)),
        ("SPAN", (0, 4), (0, 5)),
        ("SPAN", (0, 6), (0, 7)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#D6E4F0")]),
    ]))
    story.append(t1)
    story.append(PageBreak())

    story.append(Paragraph("表2 临床常用电解质参考值及异常意义", cp))
    story.append(S(2*mm))
    d2 = [
        ["电解质", "正常范围", "单位", "升高意义", "降低意义"],
        ["Na+", "135-145", "mmol/L", "脱水、醛固酮下降", "腹泻、SIADH"],
        ["K+", "3.5-5.5", "mmol/L", "肾衰、溶血", "呕吐、碱中毒"],
        ["Ca2+", "2.25-2.75", "mmol/L", "甲旁亢、骨肿瘤", "甲旁减、维D缺乏"],
        ["Mg2+", "0.75-1.25", "mmol/L", "肾衰", "酒精中毒、腹泻"],
        ["Cl-", "96-106", "mmol/L", "脱水、肾小管酸中毒", "呕吐、利尿剂"],
        ["HCO3-", "22-27", "mmol/L", "代谢性碱中毒", "代谢性酸中毒"],
        ["HPO42-", "0.8-1.6", "mmol/L", "甲旁减、肾衰", "甲旁亢、范可尼综合征"],
    ]
    t2 = Table(d2, colWidths=[55, 65, 60, 100, 100])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#BF8F00")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#FFF2CC")]),
    ]))
    story.append(t2)

    story.append(S(8*mm))
    story.append(Paragraph("表3 不同抗生素的药代动力学参数", cp))
    story.append(S(2*mm))
    d3 = [
        ["药物", "口服生物利用度", "蛋白结合率", "分布容积", "半衰期", "消除途径", "剂量调整"],
        ["阿莫西林", "75-90%", "20%", "0.3L/kg", "1-1.5h", "肾脏", "肾功能不全"],
        ["头孢曲松", "不可口服", "95%", "0.15L/kg", "6-9h", "胆汁+肾脏", "一般无需"],
        ["左氧氟沙星", "99%", "24%", "1.1L/kg", "6-8h", "肾脏", "肾功能不全"],
        ["万古霉素", "不可口服", "55%", "0.7L/kg", "4-6h", "肾脏", "必须调整"],
        ["阿奇霉素", "37%", "7-50%", "31L/kg", "68h", "胆汁", "无需"],
        ["多西环素", "93%", "93%", "0.7L/kg", "18h", "粪便", "无需"],
    ]
    t3 = Table(d3, colWidths=[55, 60, 50, 50, 45, 55, 65])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#548235")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#E2EFDA")]),
    ]))
    story.append(t3)
    doc.build(story)
    print("  done synthetic-complex-tables.pdf")


# ===================== 6. Cross-page table =====================
def gen_cross_page_table():
    doc = make_doc("synthetic-cross-page-table.pdf")
    h1 = cs("H1", 14, 20, bold=True, alignment=TA_CENTER)
    bd = cs("BD", 10, 14)
    cp = cs("CP", 9, 13, alignment=TA_CENTER, textColor=grey)
    S = lambda n=4*mm: Spacer(1, n)
    story = []
    story.append(Paragraph("跨页表格测试文档", h1))
    story.append(S())
    story.append(Paragraph("以下表格包含40行数据，将跨越两页以上。验证解析器能否正确关联跨页表格的内容。", bd))
    story.append(S())
    story.append(Paragraph("表1 常见药物相互作用表", cp))
    story.append(S(2*mm))

    rows = [["序号", "药物A", "药物B", "相互作用", "临床意义"]]
    drugs_a = ["华法林", "地高辛", "环孢素", "苯妥英钠", "利福平", "酮康唑", "红霉素",
               "胺碘酮", "氟康唑", "西咪替丁"]
    drugs_b = ["阿司匹林", "胺碘酮", "红霉素", "氟康唑", "伊曲康唑", "特非那定",
               "辛伐他汀", "地尔硫卓", "利福平", "苯妥英钠"]
    inter = [
        "出血风险增加", "地高辛浓度升高", "环孢素浓度升高", "苯妥英钠浓度升高",
        "利福平浓度降低", "QT间期延长", "横纹肌溶解风险", "胺碘酮浓度升高",
        "利福平浓度降低", "苯妥英钠浓度升高",
    ] * 4
    sig = ["高风险", "高风险", "高风险", "中风险", "中风险", "高风险",
           "高风险", "高风险", "中风险", "中风险"] * 4
    for i in range(40):
        rows.append([str(i+1), drugs_a[i % 10], drugs_b[i % 10], inter[i], sig[i]])

    t = Table(rows, colWidths=[30, 60, 60, 110, 60])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0070C0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, -1), CHINESE_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#DAEEF3")]),
    ]))
    story.append(t)
    doc.build(story)
    print("  done synthetic-cross-page-table.pdf")


# ===================== 7. Rotated pages =====================
def gen_rotated_pages():
    from reportlab.pdfgen import canvas
    fp = str(out("synthetic-rotated-pages.pdf"))
    c = canvas.Canvas(fp, pagesize=A4)
    w, h = A4
    pages = [
        ("Page 1 - Normal", "Normal page with standard text content.", 0),
        ("Page 2 - Normal", "Second page, also normal direction.", 0),
        ("Page 3 - ROTATED 90", "This page is set to rotate 90 degrees.", 90),
        ("Page 4 - Normal", "Fourth page, back to normal.", 0),
        ("Page 5 - ROTATED 180", "This page is set to rotate 180 degrees.", 180),
    ]
    for i, (title, desc, rot) in enumerate(pages):
        if i > 0:
            c.showPage()
        if rot:
            c.setPageRotation(rot)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, h - 72, title)
        c.setFont("Helvetica", 12)
        y = h - 110
        for line in textwrap.wrap(desc, width=60):
            c.drawString(72, y, line)
            y -= 18
        c.setFont("Helvetica", 10)
        y -= 20
        for j in range(5):
            c.drawString(72, y, f"Line {j+1}: Additional content for page {i+1}. " * 2)
            y -= 14
    c.save()
    print("  done synthetic-rotated-pages.pdf")


# ===================== 8. Mixed image-text =====================
def gen_mixed_image_text():
    from reportlab.pdfgen import canvas
    fp = str(out("synthetic-mixed-image-text.pdf"))
    c = canvas.Canvas(fp, pagesize=A4)
    w, h = A4
    for i in range(6):
        if i > 0:
            c.showPage()
        if i % 3 == 1:
            c.setFillColor(HexColor("#E0E0E0"))
            c.rect(50, 50, w - 100, h - 100, fill=1, stroke=1)
            c.setFillColor(HexColor("#666666"))
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(w / 2, h / 2 + 20, "[IMAGE PLACEHOLDER]")
            c.setFont("Helvetica", 10)
            c.drawCentredString(w / 2, h / 2 - 10, f"Figure page {i+1}")
        else:
            c.setFillColor(black)
            c.setFont("Helvetica-Bold", 14)
            c.drawString(72, h - 72, f"Text Page {i+1}")
            c.setFont("Helvetica", 10)
            y = h - 100
            paras = [
                f"This is text page {i+1} of the mixed document.",
                "The document alternates between text and image pages.",
                "Na+ and HCO3- are important electrolytes.",
                "beta-receptor blockers are used in cardiovascular medicine.",
                "Enzyme kinetics follow Michaelis-Menten equation.",
            ]
            for p in paras:
                for line in textwrap.wrap(p, width=80):
                    c.drawString(72, y, line)
                    y -= 14
                y -= 8
    c.save()
    print("  done synthetic-mixed-image-text.pdf")


# ===================== 9. Scanned-like =====================
def gen_scanned_like():
    doc = make_doc("synthetic-chinese-scanned-like.pdf")
    h1 = cs("H1", 16, 22, bold=True, alignment=TA_CENTER)
    bd = cs("BD", 10.5, 16, alignment=TA_JUSTIFY)
    story = []
    story.append(Paragraph("模拟扫描版医学教材（OCR 输出质量测试）", h1))
    story.append(Spacer(1, 6*mm))
    paras = [
        "代谢性酸中毒是最常见的酸碱平衡紊乱类型。以血浆HCO3-浓度原发性降低为特征。"
        "根据阴离子间隙(AG)的不同，可分为AG增高型和AG正常型两大类。",
        "代谢性酸中毒的原因：(1)酸负荷增加：如糖尿病酮症酸中毒时酮体大量生成；"
        "(2)碳酸氢根丢失：如严重腹泻导致HCO3-直接丢失；"
        "(3)肾排酸障碍：如肾功能衰竭时肾小管排酸功能下降。",
        "血气分析主要指标：SB代表标准碳酸氢盐，正常值22-27 mmol/L；"
        "AB代表实际碳酸氢盐；BE代表碱剩余，正常值-3至+3 mmol/L；"
        "PaCO2代表二氧化碳分压，正常值35-45 mmHg。",
        "易错符号验证：Na+、HCO3-、B1受体、PaCO2、Ca2+、Mg2+、K+、Cl-。"
        "这些符号在扫描件中容易被错误识别。",
        "呼吸性酸中毒以血浆PaCO2原发性升高为特征。常见于呼吸中枢抑制、"
        "气道阻塞、胸廓和肺部疾病等。治疗的关键是改善通气。",
        "beta受体阻断药通过阻断心脏beta1受体，抑制交感神经兴奋引起的心率加快。"
        "普萘洛尔是常用的非选择性beta受体阻断药。"
        "阿替洛尔和美托洛尔是选择性beta1受体阻断药。",
    ]
    for p in paras:
        story.append(Paragraph(p, bd))
        story.append(Spacer(1, 4*mm))
    doc.build(story)
    print("  done synthetic-chinese-scanned-like.pdf")


# ===================== 10. Overlapping text =====================
def gen_overlapping_text():
    from reportlab.pdfgen import canvas
    fp = str(out("synthetic-overlapping-text.pdf"))
    c = canvas.Canvas(fp, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, h - 72, "Page 1: Text Overlap Test")
    c.setFont("Helvetica", 11)
    y = h - 110
    for line in [
        "This is the primary text layer that should be readable.",
        "The secondary text layer overlaps with this one slightly.",
        "In real scanned documents, OCR can produce overlapping text.",
        "This test verifies the parser handles overlapping text.",
    ]:
        c.drawString(72, y, line)
        y -= 16
    c.setFillColor(HexColor("#888888"))
    y = h - 106
    for line in [
        "This is secondary text that overlaps with the primary layer.",
        "It creates noise in the text extraction process.",
    ]:
        c.drawString(74, y, line)
        y -= 16
    c.setFillColor(black)

    c.showPage()
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, h - 72, "Page 2: Tight Multi-Column Layout")
    c.setFont("Helvetica", 9)
    y = h - 100
    left = [
        "Left column line 1 about medical topics.",
        "Left column line 2 with Na+ and HCO3-.",
        "Left column line 3 discusses acid-base balance.",
        "Left column line 4 mentions metabolic acidosis.",
        "Left column line 5 covers respiratory alkalosis.",
    ]
    for line in left:
        c.drawString(50, y, line)
        y -= 13
    y = h - 100
    right = [
        "Right column line 1 about cardiovascular system.",
        "Right column line 2 discusses blood pressure.",
        "Right column line 3 mentions heart rate regulation.",
        "Right column line 4 covers beta-blockers.",
        "Right column line 5 discusses ACE inhibitors.",
    ]
    for line in right:
        c.drawString(240, y, line)
        y -= 13

    c.showPage()
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, h - 72, "Page 3: Normal Content (Baseline)")
    c.setFont("Helvetica", 11)
    y = h - 110
    for i in range(20):
        c.drawString(72, y, f"Normal line {i+1}: Standard text without overlapping.")
        y -= 16
    c.save()
    print("  done synthetic-overlapping-text.pdf")


# ===================== 11. Large 1500-page PDF =====================
def gen_large_pdf():
    from reportlab.pdfgen import canvas
    fp = str(out("synthetic-large-1500pages.pdf"))
    c = canvas.Canvas(fp, pagesize=A4)
    w, h = A4
    topics = ["Cell Biology", "Molecular Biology", "Genetics", "Biochemistry",
              "Physiology", "Pharmacology", "Pathology", "Immunology",
              "Microbiology", "Neuroscience"]
    for page in range(1500):
        if page > 0:
            c.showPage()
        topic = topics[page % 10]
        c.setFont("Helvetica-Bold", 12)
        c.drawString(72, h - 50, f"Page {page + 1} - {topic}")
        c.setFont("Helvetica", 10)
        y = h - 80
        for ln in range(35):
            c.drawString(50, y,
                f"Line {ln+1}: Content about {topic.lower()}. "
                f"Keywords: anatomy, physiology, cell, protein, Na+, K+, Ca2+, HCO3-. "
                f"Page {page+1} of 1500.")
            y -= 15
    c.save()
    print("  done synthetic-large-1500pages.pdf")


# ===================== 12. Chinese Medical EPUB =====================
def gen_chinese_medical_epub():
    import zipfile
    fp = str(out("synthetic-chinese-medical.epub"))
    chapters = [
        ("绪论", [
            "病理生理学是研究疾病发生发展规律和机制的科学。它在基础医学与临床医学之间起着桥梁作用。",
            "病理生理学的主要任务是研究疾病的病因、发病机制以及患病机体的功能代谢变化。",
            "疾病概论主要阐述疾病的概念、病因学和发病学的一般规律。",
        ]),
        ("第一章 水、电解质代谢紊乱", [
            "水和电解质平衡是维持内环境稳态的重要组成部分。正常成人体液总量约占体重的60%。",
            "脱水可分为高渗性脱水、低渗性脱水和等渗性脱水三种类型。",
            "高钾血症的常见原因包括：钾摄入过多、肾脏排钾减少、细胞内钾向细胞外转移。",
            "低钾血症的主要原因有：钾摄入不足、消化道丢失钾增多、肾脏排钾增多。",
        ]),
        ("第二章 酸碱平衡和酸碱平衡紊乱", [
            "正常人体液pH维持在7.35-7.45之间。机体通过血液缓冲系统、肺和肾三方面调节酸碱平衡。",
            "代谢性酸中毒是最常见的酸碱平衡紊乱。AG增高型的原因包括乳酸酸中毒、酮症酸中毒、尿毒症等。",
            "AG正常型代谢性酸中毒的原因包括严重腹泻、肾小管酸中毒等。",
            "呼吸性酸中毒的特征是PaCO2原发性升高。常见于呼吸中枢抑制、气道阻塞等。",
            "呼吸性碱中毒的特征是PaCO2原发性降低。常见于精神性过度通气、高热等。",
        ]),
        ("第三章 缺氧", [
            "缺氧是指组织供氧不足或利用氧障碍的病理过程。",
            "缺氧可分为低张性缺氧、血液性缺氧、循环性缺氧和组织性缺氧四种类型。",
            "低张性缺氧的特点是PaO2降低、SaO2降低、血氧含量降低。",
            "血液性缺氧的特点是PaO2正常、SaO2正常、血氧含量降低。",
        ]),
        ("第四章 发热", [
            "发热是指体温调节中枢调定点上移引起调节性体温升高的病理过程。",
            "发热的机制包括致热原的作用、体温调定点上移、产热增加和散热减少。",
            "内源性致热原主要包括IL-1、IL-6、TNF等细胞因子。",
            "发热的时相包括体温上升期、高温持续期和体温下降期。",
        ]),
    ]
    with zipfile.ZipFile(fp, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("mimetype", "application/epub+zip")
        zf.writestr("META-INF/container.xml", """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>""")
        mi = si = ""
        for i, (title, _) in enumerate(chapters):
            mi += f'  <item id="ch{i}" href="ch{i}.xhtml" media-type="application/xhtml+xml"/>\n'
            si += f'  <itemref idref="ch{i}"/>\n'
        zf.writestr("OEBPS/content.opf", f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>合成医学教材 EPUB</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="uid">synthetic-chinese-medical-epub-001</dc:identifier>
  </metadata>
  <manifest>
{mi}  </manifest>
  <spine>
{si}  </spine>
</package>""")
        for i, (title, paras) in enumerate(chapters):
            body = f"<h1>{title}</h1>\n"
            for j, p in enumerate(paras):
                body += f'<p id="p{i}-{j}">{p}</p>\n'
            if i == 2:
                body += """<h2>酸碱平衡紊乱分类</h2>
<ul>
  <li>代谢性酸中毒（AG增高型）</li>
  <li>代谢性酸中毒（AG正常型）</li>
  <li>代谢性碱中毒</li>
  <li>呼吸性酸中毒</li>
  <li>呼吸性碱中毒</li>
</ul>"""
            zf.writestr(f"OEBPS/ch{i}.xhtml", f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head><title>{title}</title></head>
<body>
{body}
</body>
</html>""")
    print("  done synthetic-chinese-medical.epub")


# ===================== Main =====================
def main():
    print("Zhiye Benchmark Synthetic Materials Generator")
    print(f"Output: {CORPUS_DIR}")
    print(f"Chinese font: {CHINESE_FONT} ({'OK' if _HAS_CN else 'MISSING'})")
    print()
    fns = [
        ("1/12 Chinese textbook", gen_chinese_textbook),
        ("2/12 Pharmacology", gen_pharmacology),
        ("3/12 Pathophysiology", gen_pathophysiology),
        ("4/12 Two-column academic", gen_two_column),
        ("5/12 Complex tables", gen_complex_tables),
        ("6/12 Cross-page table", gen_cross_page_table),
        ("7/12 Rotated pages", gen_rotated_pages),
        ("8/12 Mixed image-text", gen_mixed_image_text),
        ("9/12 Scanned-like", gen_scanned_like),
        ("10/12 Overlapping text", gen_overlapping_text),
        ("11/12 Large 1500-page", gen_large_pdf),
        ("12/12 Chinese medical EPUB", gen_chinese_medical_epub),
    ]
    for label, fn in fns:
        print(f"[{label}]", end=" ")
        try:
            fn()
        except Exception as e:
            print(f"FAILED: {e}")
    print("\nAll done.")


if __name__ == "__main__":
    main()
