"""Generate deterministic adversarial PDF fixtures for the Zhiye benchmark."""

from io import BytesIO
from pathlib import Path
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas
except ImportError as exc:
    raise SystemExit(
        "Missing PDF dependencies. Use the Codex bundled Python runtime or install "
        "reportlab pypdf pillow."
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "benchmarks" / "corpus"
CORPUS.mkdir(parents=True, exist_ok=True)
FONT_PATHS = [
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
]
FONT_PATH = next((item for item in FONT_PATHS if item.exists()), None)
if FONT_PATH is None:
    raise SystemExit("A Chinese TrueType font is required (Microsoft YaHei or SimHei).")

pdfmetrics.registerFont(TTFont("BenchmarkCJK", str(FONT_PATH), subfontIndex=0))


def draw_wrapped(c, text, x, y, width, leading=18, size=11):
    c.setFont("BenchmarkCJK", size)
    line = ""
    for char in text:
        candidate = line + char
        if pdfmetrics.stringWidth(candidate, "BenchmarkCJK", size) > width:
            c.drawString(x, y, line)
            y -= leading
            line = char
        else:
            line = candidate
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_table(c, x, top, widths, rows, row_height=30):
    total_width = sum(widths)
    for row_index, row in enumerate(rows):
        y = top - row_index * row_height
        c.line(x, y, x + total_width, y)
        cell_x = x
        for column, width in enumerate(widths):
            c.line(cell_x, y, cell_x, y - row_height)
            c.setFont("BenchmarkCJK", 9)
            c.drawString(cell_x + 4, y - 19, row[column])
            cell_x += width
        c.line(x + total_width, y, x + total_width, y - row_height)
    c.line(x, top - len(rows) * row_height, x + total_width, top - len(rows) * row_height)


def generate_adversarial_pdf(destination):
    c = canvas.Canvas(str(destination), pagesize=A4, pageCompression=1)
    width, height = A4

    c.setTitle("知页中文医学复杂版面回归样本")
    c.setFont("BenchmarkCJK", 18)
    c.drawString(42, height - 48, "第一章 酸碱平衡与血气分析")
    c.setFont("BenchmarkCJK", 9)
    c.drawRightString(width - 42, height - 48, "页眉：病理生理学测试页")
    draw_table(
        c,
        42,
        height - 92,
        [70, 150, 255],
        [
            ["指标", "中文名称", "定义"],
            ["SB", "标准碳酸氢盐", "标准条件下测得的 HCO3-"],
            ["AB", "实际碳酸氢盐", "实际血气条件下测得的 HCO3-"],
            ["BE", "碱剩余", "标准条件下滴定至正常 pH 所需酸或碱"],
        ],
    )
    left_x, right_x = 42, 314
    y = height - 245
    y = draw_wrapped(c, "左栏先读：代谢性酸中毒可由酸负荷增加、碳酸氢根丢失或肾排酸障碍引起。Na+、K+、Cl- 与 HCO3- 的电荷符号不得丢失。", left_x, y, 230)
    y -= 12
    draw_wrapped(c, "左栏续文：阴离子间隙可帮助区分不同病因。", left_x, y, 230)
    y = height - 245
    y = draw_wrapped(c, "右栏后读：呼吸性代偿通过改变 PaCO2 缓冲 pH，但不能完全纠正原发代谢紊乱。", right_x, y, 230)
    y -= 12
    draw_wrapped(c, "右栏续文：引用应返回本页，而不能串到左栏相邻行。", right_x, y, 230)
    c.setFont("BenchmarkCJK", 9)
    c.drawCentredString(width / 2, 24, "1")
    c.showPage()

    c.setFont("BenchmarkCJK", 18)
    c.drawString(42, height - 48, "第二章 β受体阻断药")
    draw_wrapped(c, "β1受体阻断使交感神经对心脏的正性变时作用减弱，因此窦房结起搏频率下降、心率降低。β2 与字母 B 不可混淆。", 42, height - 90, width - 84, 20, 12)
    draw_table(
        c,
        42,
        height - 160,
        [95, 135, 120, 125],
        [
            ["药物", "作用机制", "临床应用", "不良反应"],
            ["普萘洛尔", "阻断 β1/β2", "心律失常", "心动过缓"],
            ["美托洛尔", "选择性阻断 β1", "高血压", "房室传导阻滞"],
            ["阿替洛尔", "选择性阻断 β1", "心绞痛", "乏力"],
        ],
    )
    c.setFont("BenchmarkCJK", 10)
    c.drawString(42, 100, "跨页表格提示：下页继续，表头应与本页语义关联。")
    c.drawCentredString(width / 2, 24, "2")
    c.showPage()

    c.setFont("BenchmarkCJK", 18)
    c.drawString(42, height - 48, "第三章 旋转页面与跨页表格")
    draw_table(
        c,
        42,
        height - 90,
        [95, 135, 120, 125],
        [
            ["药物（续）", "作用机制", "临床应用", "不良反应"],
            ["比索洛尔", "选择性阻断 β1", "慢性心衰", "低血压"],
        ],
    )
    draw_wrapped(c, "本页在 PDF 中旋转 90°。解析器应保留文字和真实页码 3。", 42, height - 190, width - 84, 20, 12)
    c.drawCentredString(width / 2, 24, "3")
    c.showPage()

    # An image-only page inside an otherwise text PDF reveals partial-scan handling.
    image = make_scan_image("图像页隐含答案：金黄色葡萄球菌呈葡萄串状排列；链球菌常呈链状排列。", 1240, 1754)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    from reportlab.lib.utils import ImageReader

    c.drawImage(ImageReader(buffer), 0, 0, width=width, height=height)
    c.showPage()
    c.save()

    temporary = destination.with_suffix(".rotated.pdf")
    reader = PdfReader(destination)
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index == 2:
            page.rotate(90)
        writer.add_page(page)
    with temporary.open("wb") as output:
        writer.write(output)
    temporary.replace(destination)


def load_pil_font(size):
    return ImageFont.truetype(str(FONT_PATH), size=size)


def make_scan_image(text, width, height):
    image = Image.new("L", (width, height), 242)
    draw = ImageDraw.Draw(image)
    title_font = load_pil_font(48)
    body_font = load_pil_font(34)
    draw.text((90, 90), "扫描版医学教材 OCR 压力页", fill=20, font=title_font)
    y = 210
    for sentence in text.split("；"):
        draw.text((90, y), sentence, fill=35, font=body_font)
        y += 82
    draw.text((90, y + 40), "易错符号：Na+  HCO3-  β1受体  PaCO2", fill=35, font=body_font)
    # Scan-like noise and a faint skewed rule.
    for x in range(70, width - 70, 17):
        image.putpixel((x, height - 110 + (x % 5)), 175)
    return image.rotate(0.7, expand=False, fillcolor=246)


def generate_scan_pdf(destination):
    images = [
        make_scan_image("代谢性酸中毒：酸负荷增加；碳酸氢根丢失；肾排酸障碍。", 1240, 1754),
        make_scan_image("β受体阻断药：减弱交感作用；降低窦房结频率；使心率下降。", 1240, 1754),
    ]
    images[0].save(CORPUS / "synthetic-medical-scan-page.png", "PNG")
    images[0].save(destination, "PDF", save_all=True, append_images=images[1:], resolution=150)


def generate_2001_page_pdf(destination):
    one_page = BytesIO()
    c = canvas.Canvas(one_page, pagesize=(72, 72), pageCompression=1)
    c.setFont("Helvetica", 6)
    c.drawString(4, 35, "page-limit")
    c.save()
    one_page.seek(0)
    source_page = PdfReader(one_page).pages[0]
    writer = PdfWriter()
    for _ in range(2001):
        writer.add_page(source_page)
    with destination.open("wb") as output:
        writer.write(output)


if __name__ == "__main__":
    outputs = {
        "synthetic-medical-adversarial.pdf": generate_adversarial_pdf,
        "synthetic-medical-scan.pdf": generate_scan_pdf,
        "synthetic-2001-pages.pdf": generate_2001_page_pdf,
    }
    for name, generator in outputs.items():
        destination = CORPUS / name
        generator(destination)
        print(f"generated {destination.relative_to(ROOT)} ({destination.stat().st_size} bytes)")
