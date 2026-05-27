from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


OUT_PATH = r"C:\Users\yaozh\Desktop\mei ka\Notarized Itinerary\行程_04_1128147887114215.docx"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, **kwargs):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        if edge in kwargs:
            edge_data = kwargs.get(edge)
            tag = "w:{}".format(edge)
            element = borders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                borders.append(element)
            for key, value in edge_data.items():
                element.set(qn("w:{}".format(key)), str(value))


def set_table_borders(table, color="000000", size="6"):
    for row in table.rows:
        for cell in row.cells:
            set_cell_border(
                cell,
                top={"val": "single", "sz": size, "color": color},
                bottom={"val": "single", "sz": size, "color": color},
                left={"val": "single", "sz": size, "color": color},
                right={"val": "single", "sz": size, "color": color},
            )


def set_cell_margins(cell, top=90, start=90, bottom=90, end=90):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.first_child_found_in("w:tcW")
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width))
    tc_w.set(qn("w:type"), "dxa")


def set_table_width(table, widths):
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_layout = tbl_pr.find(qn("w:tblLayout"))
    if tbl_layout is None:
        tbl_layout = OxmlElement("w:tblLayout")
        tbl_pr.append(tbl_layout)
    tbl_layout.set(qn("w:type"), "fixed")

    grid = table._tbl.tblGrid
    if grid is None:
        grid = OxmlElement("w:tblGrid")
        table._tbl.insert(0, grid)
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)

    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            set_cell_width(cell, widths[idx])


def set_row_height(row, height):
    tr_pr = row._tr.get_or_add_trPr()
    tr_height = tr_pr.find(qn("w:trHeight"))
    if tr_height is None:
        tr_height = OxmlElement("w:trHeight")
        tr_pr.append(tr_height)
    tr_height.set(qn("w:val"), str(height))
    tr_height.set(qn("w:hRule"), "atLeast")


def set_page_border(section):
    sect_pr = section._sectPr
    pg_borders = sect_pr.find(qn("w:pgBorders"))
    if pg_borders is None:
        pg_borders = OxmlElement("w:pgBorders")
        sect_pr.append(pg_borders)
    pg_borders.set(qn("w:offsetFrom"), "page")
    for edge in ("top", "left", "bottom", "right"):
        element = pg_borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            pg_borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "8")
        element.set(qn("w:space"), "22")
        element.set(qn("w:color"), "000000")


def paragraph_format(paragraph, size=10.5, font="SimSun", bold=False, color="000000", align=None):
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.05
    if align is not None:
        paragraph.alignment = align
    for run in paragraph.runs:
        run.font.name = font
        run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = RGBColor.from_string(color)


def add_text(paragraph, text, size=10.5, font="SimSun", bold=False, color="000000"):
    run = paragraph.add_run(text)
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    return run


def add_section_label(doc, label):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    set_table_width(table, [1520, 7600])
    table.allow_autofit = False
    for cell in table.rows[0].cells:
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(0)
    label_cell = table.cell(0, 0)
    line_cell = table.cell(0, 1)
    set_cell_border(
        label_cell,
        top={"val": "nil"},
        bottom={"val": "nil"},
        left={"val": "nil"},
        right={"val": "nil"},
    )
    set_cell_border(
        line_cell,
        top={"val": "nil"},
        bottom={"val": "single", "sz": "6", "color": "000000"},
        left={"val": "nil"},
        right={"val": "nil"},
    )
    set_cell_shading(label_cell, "BFBFBF")
    set_cell_margins(label_cell, top=0, bottom=0, start=75, end=60)
    set_cell_margins(line_cell, top=0, bottom=0, start=0, end=0)
    label_cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = label_cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_text(p, label, size=12, font="SimHei", bold=True, color="FFFFFF")
    paragraph_format(p, size=12, font="SimHei", bold=True, color="FFFFFF")
    p2 = line_cell.paragraphs[0]
    paragraph_format(p2, size=1)
    return table


def add_spacer(doc, points):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(points)
    p.paragraph_format.line_spacing = 1


def fill_cell(cell, lines, size=9, font="SimSun", bold=False, align=WD_ALIGN_PARAGRAPH.CENTER):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    cell.text = ""
    for i, line in enumerate(lines):
        p = cell.paragraphs[0] if i == 0 else cell.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.05
        add_text(p, line, size=size, font=font, bold=bold)


doc = Document()
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.62)
section.bottom_margin = Inches(0.62)
section.left_margin = Inches(0.62)
section.right_margin = Inches(0.62)
section.header_distance = Inches(0.2)
section.footer_distance = Inches(0.2)
set_page_border(section)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "SimSun"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "SimSun")
normal.font.size = Pt(10.5)
normal.paragraph_format.space_before = Pt(0)
normal.paragraph_format.space_after = Pt(0)
normal.paragraph_format.line_spacing = 1.05

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_before = Pt(6)
title.paragraph_format.space_after = Pt(26)
add_text(title, "行程单", size=21, font="SimHei")

add_section_label(doc, "预订详情")
add_spacer(doc, 18)

details = doc.add_table(rows=3, cols=2)
set_table_width(details, [4860, 4260])
details.allow_autofit = False
for row in details.rows:
    set_row_height(row, 260)
    for cell in row.cells:
        set_cell_border(cell, top={"val": "nil"}, bottom={"val": "nil"}, left={"val": "nil"}, right={"val": "nil"})
        set_cell_margins(cell, top=0, bottom=0, start=40, end=40)
fill_cell(details.cell(0, 0), ["订单编号： 1128147887114215"], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
fill_cell(details.cell(0, 1), ["发行日期： 2026年5月7日"], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
fill_cell(details.cell(1, 0), ["乘客： WANG/SHENGZE"], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
fill_cell(details.cell(1, 1), [""], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
fill_cell(details.cell(2, 0), ["发行航空公司： Neos"], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)
fill_cell(details.cell(2, 1), [""], size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)

add_spacer(doc, 32)
add_section_label(doc, "飞行详情")
add_spacer(doc, 20)

flight = doc.add_table(rows=2, cols=7)
flight.allow_autofit = False
widths = [1620, 880, 800, 1900, 1900, 760, 800]
set_table_width(flight, widths)
set_table_borders(flight)
headers = [
    ["日期"],
    ["航空公", "司", "PNR"],
    ["飞行"],
    ["出发", "时间", "航站楼"],
    ["到达", "时间", "终端"],
    ["级别"],
    ["现状"],
]
for col, lines in enumerate(headers):
    fill_cell(flight.cell(0, col), lines, size=10, align=WD_ALIGN_PARAGRAPH.CENTER)
for col, lines in enumerate(
    [
        ["2026年6月4日"],
        ["NO4M8R"],
        ["NO977"],
        ["NKG-南京", "6月4日 10:05", "2号航站楼", "禄口国际机场"],
        ["MXP-米兰", "6月4日 16:40", "1号航站楼", "马尔彭萨机场（意大利）"],
        ["经济"],
        ["好的"],
    ]
):
    fill_cell(flight.cell(1, col), lines, size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER)
set_row_height(flight.rows[0], 900)
set_row_height(flight.rows[1], 1720)
for row in flight.rows:
    for cell in row.cells:
        set_cell_margins(cell, top=90, bottom=90, start=80, end=80)

add_spacer(doc, 32)
add_section_label(doc, "付款详情")
add_spacer(doc, 18)
p = doc.add_paragraph()
add_text(p, "票价： 人民币4380. 00元， 税费： 人民币1510. 00元， 总计： 人民币5890. 00元。", size=10.5)
paragraph_format(p, size=10.5, align=WD_ALIGN_PARAGRAPH.LEFT)

add_spacer(doc, 34)
add_section_label(doc, "通知")
add_spacer(doc, 14)

notices = [
    "您必须在预定起飞时间前2小时内抵达指定机场，在柜台办理登机手续。您必须出示购买机票时使用的有效身份证。",
    "通过安检时，您必须出示有效的旅行证件、登机证以及收据。",
    "未按顺序使用航班优惠券将被罚款并额外支付票价。",
    "承运人提供的运输及其他服务，但受承运条件约束，特此以参考方式纳入。这些条件可以从发行方获得。对于涉及最终目的地或停留在出发国以外国家的旅客，请注意，相关国际条约和运输条件可能限制承运人的责任。",
]
for notice in notices:
    p = doc.add_paragraph(style=None)
    p.paragraph_format.left_indent = Cm(0.28)
    p.paragraph_format.first_line_indent = Cm(-0.2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.05
    add_text(p, "• ", size=9)
    add_text(p, notice, size=9)

doc.save(OUT_PATH)
print(OUT_PATH)
