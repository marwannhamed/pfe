# -*- coding: utf-8 -*-
"""
Defense brief: how to turn the first-review deck (30 slides) into the
nine-section technical defense the supervisor asked for, in English.

Written for Claude Desktop, which edits the deck: every slide carries an
action (KEEP, EDIT, MOVE, NEW, DELETE, OPTIONAL), the exact text to put on it,
a layout line and a speaker note. Screens come from docs/defense-screens,
diagrams from docs/diagrams. A4 portrait.

Run from the repository root:  python docs/generate-defense-brief.py
"""
import os
import tempfile
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, PageBreak, HRFlowable,
                                ListFlowable, ListItem, Image, KeepTogether)

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.path.join(HERE, "defense-screens")
# The UML figures come from the PlantUML set: docs/diagrams/*.puml, rendered in docs/diagrams/out.
DIAGRAMS = os.path.join(HERE, "diagrams", "out")
OUT = os.path.join(HERE, "LeaseManager_Defense_Brief.pdf")
THUMBS = tempfile.mkdtemp(prefix="defense-thumbs-")

F = "C:/Windows/Fonts/"
for n, f in [("Geo", "georgia.ttf"), ("Geo-B", "georgiab.ttf"), ("Geo-I", "georgiai.ttf"),
             ("Cal", "calibri.ttf"), ("Cal-B", "calibrib.ttf"), ("Cal-I", "calibrii.ttf"),
             ("Mono", "consola.ttf")]:
    try:
        pdfmetrics.registerFont(TTFont(n, F + f))
    except Exception:
        pdfmetrics.registerFont(TTFont(n, F + "calibri.ttf"))
pdfmetrics.registerFontFamily("Geo", normal="Geo", bold="Geo-B", italic="Geo-I", boldItalic="Geo-B")
pdfmetrics.registerFontFamily("Cal", normal="Cal", bold="Cal-B", italic="Cal-I", boldItalic="Cal-B")

INK, INK2, INK3 = colors.HexColor("#0B0F14"), colors.HexColor("#39434F"), colors.HexColor("#6B7683")
ACC, ACC2 = colors.HexColor("#1F6FEB"), colors.HexColor("#0C2340")
WASH, LINE, SOFT = colors.HexColor("#E8F0FE"), colors.HexColor("#CBD5E1"), colors.HexColor("#F5F8FC")
OK, OKW = colors.HexColor("#15803D"), colors.HexColor("#E6F4EA")
WARN, WARNW = colors.HexColor("#92400E"), colors.HexColor("#FDF3E3")
ACTION = {  # tag: (text colour, background)
    "KEEP": (colors.HexColor("#15803D"), colors.HexColor("#E6F4EA")),
    "EDIT": (colors.HexColor("#1D4ED8"), colors.HexColor("#DBEAFE")),
    "MOVE": (colors.HexColor("#6D28D9"), colors.HexColor("#EDE9FE")),
    "NEW": (colors.HexColor("#B45309"), colors.HexColor("#FEF3C7")),
    "DELETE": (colors.HexColor("#B91C1C"), colors.HexColor("#FEE2E2")),
    "OPTIONAL": (colors.HexColor("#475569"), colors.HexColor("#F1F5F9")),
}

PW, PH = A4
ML = MR = 18 * mm
MT, MB = 18 * mm, 17 * mm
CW = PW - ML - MR
AR = "<font name='Mono'>\u2192</font>"   # Georgia has no U+2192 glyph

S = {
    "part": ParagraphStyle("p", fontName="Cal-B", fontSize=20, leading=24, textColor=colors.white),
    "psub": ParagraphStyle("ps", fontName="Cal", fontSize=10.5, leading=13.5, textColor=colors.HexColor("#A9C6F5")),
    "no": ParagraphStyle("no", fontName="Cal-B", fontSize=9, leading=11.5, textColor=ACC),
    "h": ParagraphStyle("h", fontName="Cal-B", fontSize=13.5, leading=17, textColor=INK),
    "h2": ParagraphStyle("h2", fontName="Cal-B", fontSize=11.5, leading=15, textColor=INK, spaceBefore=4, spaceAfter=3),
    "b": ParagraphStyle("b", fontName="Geo", fontSize=9.4, leading=13.8, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=4),
    "src": ParagraphStyle("src", fontName="Cal-I", fontSize=8.6, leading=11, textColor=INK3, spaceAfter=3),
    "li": ParagraphStyle("li", fontName="Geo", fontSize=9.4, leading=13.4, textColor=INK, alignment=TA_LEFT, spaceAfter=2),
    "th": ParagraphStyle("th", fontName="Cal-B", fontSize=8.2, leading=10.5, textColor=colors.white),
    "td": ParagraphStyle("td", fontName="Geo", fontSize=8.6, leading=12, textColor=INK),
    "say": ParagraphStyle("s", fontName="Geo-I", fontSize=8.9, leading=13, textColor=INK2, alignment=TA_JUSTIFY),
    "cap": ParagraphStyle("cap", fontName="Cal", fontSize=8.4, leading=10.8, textColor=INK2, alignment=TA_LEFT),
    "slide": ParagraphStyle("sl", fontName="Cal", fontSize=10, leading=14, textColor=INK, alignment=TA_LEFT, spaceAfter=2),
    "slideb": ParagraphStyle("slb", fontName="Cal-B", fontSize=10.5, leading=14, textColor=INK, spaceAfter=1),
    "cov": ParagraphStyle("c", fontName="Cal-B", fontSize=27, leading=33, textColor=INK, alignment=TA_CENTER),
    "covs": ParagraphStyle("cs", fontName="Geo-I", fontSize=12, leading=17, textColor=INK2, alignment=TA_CENTER),
    "badge": ParagraphStyle("bd", fontName="Cal-B", fontSize=8.4, leading=10, alignment=TA_CENTER),
}


def deco(cv, doc):
    cv.saveState()
    cv.setFont("Cal", 7.8)
    cv.setFillColor(INK3)
    cv.drawString(ML, MB - 7.5 * mm, "LeaseManager \u2014 technical defense brief for Claude Desktop")
    cv.drawRightString(PW - MR, MB - 7.5 * mm, str(doc.page))
    cv.setStrokeColor(LINE)
    cv.setLineWidth(0.4)
    cv.line(ML, MB - 5 * mm, PW - MR, MB - 5 * mm)
    cv.restoreState()


def P(t, s="b"):
    return Paragraph(t, S[s])


def bul(items, style="li"):
    return ListFlowable([ListItem(Paragraph(i, S[style]), leftIndent=11, value="circle") for i in items],
                        bulletType="bullet", bulletFontSize=4.5, bulletOffsetY=1.5, leftIndent=11,
                        spaceBefore=1, spaceAfter=5)


def tab(rows, widths, fs=8.6, head=ACC2):
    S["td"].fontSize = fs
    S["td"].leading = fs * 1.4
    data = [[Paragraph(str(x), S["th" if r == 0 else "td"]) for x in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    cm = [("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
          ("BACKGROUND", (0, 0), (-1, 0), head),
          ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
          ("BOX", (0, 0), (-1, -1), 0.5, LINE)]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            cm.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cm))
    return t


def box(lbl, txt, tone=ACC, bg=WASH, width=CW):
    inner = [Paragraph(lbl, ParagraphStyle("bl", fontName="Cal-B", fontSize=8.2, leading=10.5, textColor=tone, spaceAfter=2))]
    inner += [Paragraph(x, S["say"]) for x in (txt if isinstance(txt, list) else [txt])]
    t = Table([[inner]], colWidths=[width], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg),
                           ("LINEBEFORE", (0, 0), (0, -1), 2, tone),
                           ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    return t


def onslide(flowables):
    """The text that goes on the slide, framed so it reads as slide copy."""
    t = Table([[flowables]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, LINE),
                           ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                           ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9)]))
    return t


def badge(action):
    fg, bg = ACTION[action]
    t = Table([[Paragraph("<font color='%s'>%s</font>" % (fg.hexval().replace("0x", "#"), action), S["badge"])]],
              colWidths=[24 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg),
                           ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                           ("BOX", (0, 0), (-1, -1), 0.6, fg)]))
    return t


def thumb(name, folder=SCREENS, max_w=1400):
    """A JPEG copy small enough to keep the PDF light; the full PNG stays in the folder."""
    src = os.path.join(folder, name)
    dst = os.path.join(THUMBS, os.path.splitext(name)[0] + ".jpg")
    if not os.path.exists(dst):
        im = PILImage.open(src).convert("RGB")
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), PILImage.LANCZOS)
        im.save(dst, "JPEG", quality=84)
    w, h = PILImage.open(dst).size
    return dst, w, h


def img(name, width, folder=SCREENS, max_h=None):
    path, w, h = thumb(name, folder)
    height = width * h / w
    if max_h and height > max_h:
        width, height = max_h * w / h, max_h
    im = Image(path, width=width, height=height)
    im.hAlign = "CENTER"
    return im


def shot_pair(left, right, cap_l, cap_r):
    w = (CW - 6 * mm) / 2
    cell = lambda n, c: [img(n, w), Spacer(1, 2), Paragraph("<font name='Mono' size='7.5'>%s</font><br/>%s" % (n, c), S["cap"])]
    t = Table([[cell(left, cap_l), cell(right, cap_r)]], colWidths=[w + 3 * mm, w + 3 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm)]))
    return t


def shot_one(name, cap, width=CW * 0.78):
    return [img(name, width), Spacer(1, 2),
            Paragraph("<font name='Mono' size='7.5'>%s</font> \u2014 %s" % (name, cap), S["cap"])]


def slide(num, title, action, src=None, content=None, layout=None, say=None, confirm=None):
    head = Table([[Paragraph("Slide %s" % num, S["no"]), Paragraph(title, S["h"]), badge(action)]],
                 colWidths=[22 * mm, CW - 22 * mm - 25 * mm, 25 * mm], hAlign="LEFT")
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                              ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                              ("LINEABOVE", (0, 0), (-1, 0), 0.9, ACC)]))
    out = [Spacer(1, 7), head]
    if src:
        out.append(P(src, "src"))
    if content:
        out.append(P("<b>On the slide</b>", "b"))
        out.append(onslide(content))
        out.append(Spacer(1, 4))
    if layout:
        out.append(P("<b>Layout</b> \u2014 " + layout))
    if confirm:
        out += [box("Confirm before presenting \u2014 do not present this unchecked", confirm, WARN, WARNW), Spacer(1, 3)]
    if say:
        out.append(box("Say this (speaker notes, not on the slide)", say))
    # one slide per block: a heading never strands at the foot of a page
    return [KeepTogether(out)]


def part(n, title, sub, fr=None):
    rows = [Paragraph("SECTION %s" % n + (" \u00b7 supervisor's outline: <i>%s</i>" % fr if fr else ""), S["psub"]),
            Paragraph(title, S["part"]), Paragraph(sub, S["psub"])]
    t = Table([[rows]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACC2),
                           ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    return [t, Spacer(1, 6)]


def sl(*lines):
    """Slide copy: first argument may be a list of bullets; strings are lines."""
    out = []
    for x in lines:
        if isinstance(x, list):
            out.append(bul(x, "slide"))
        else:
            out.append(Paragraph(x, S["slide"]))
    return out


st = []

# ───────────────────────────── cover ────────────────────────────────────────
st += [Spacer(1, 22 * mm), P("Technical defense \u2014 deck changes", "cov"), Spacer(1, 3 * mm),
       P("From the first-review deck to the supervisor's nine-section outline, in English", "covs"),
       Spacer(1, 6 * mm), HRFlowable(width="32%", thickness=0.8, color=LINE, hAlign="CENTER"), Spacer(1, 6 * mm),
       P("LeaseManager \u2014 office lease management platform", "covs"),
       P("Final year project \u00b7 ESPRIT \u00d7 Quicky Prime \u00b7 Marwan Hamed", "covs"),
       Spacer(1, 10 * mm)]
st += [box("Who this is for",
           ["<b>Claude Desktop</b>, editing the existing deck <i>\u201cLeaseManager \u2014 Final Year Project "
            "Presentation (ESPRIT 2026)\u201d</i> (30 slides). Every slide below says what to do with it "
            "(keep, edit, move, create, delete), gives the exact text, and keeps the speaker note separate.",
            "Marwan: attach this PDF together with the screenshots in <font name='Mono'>docs/defense-screens/</font> "
            "and the diagrams in <font name='Mono'>docs/diagrams/</font>, so Claude Desktop can place the images."]),
       Spacer(1, 5),
       box("Figures", "Every number in this brief was checked on 27 October 2026 against the code and the running "
           "application: counts from the source, 42/42 access-audit probes from a live run, 297 automated tests "
           "from the test suites. Where the deck's figure was already right, it is left alone.", OK, OKW),
       Spacer(1, 5),
       box("Three things only you can confirm",
           "The sprint dates (slide 19), the Scrum master and product owner (slide 18), and the board tool you "
           "used (slide 18). The brief proposes them from what was delivered and marks them; do not present them "
           "unchecked.", WARN, WARNW),
       PageBreak()]

# ───────────────────────── outline + instructions ───────────────────────────
st += part("0", "The new outline", "The supervisor's nine sections, in English, and how to apply this brief")
st += [P("<b>The supervisor's outline, translated</b>", "h2"),
       tab([["#", "Supervisor's outline (French)", "Section title in the deck (English)", "Slides"],
            ["01", "Organisme d'accueil", "Host organisation", "2 (+1 optional)"],
            ["02", "Probl\u00e9matique", "Problem statement", "3"],
            ["03", "\u00c9tude et critique de l'existant", "Study and critique of existing solutions", "3"],
            ["04", "La solution propos\u00e9e", "Proposed solution", "5"],
            ["05", "La m\u00e9thodologie adopt\u00e9e", "Adopted methodology", "4 \u2014 new section"],
            ["06", "Besoins fonctionnels et non fonctionnels", "Functional and non-functional requirements", "5 (+1 optional)"],
            ["07", "Technologies et outils utilis\u00e9s", "Technologies and tools used", "3"],
            ["08", "Les parties r\u00e9alis\u00e9es", "Completed work", "9 (+3 optional)"],
            ["09", "Conclusion et perspectives", "Conclusion and perspectives", "5"]],
           [10 * mm, 52 * mm, 70 * mm, CW - 132 * mm], fs=8.5),
       Spacer(1, 4),
       P("Cover, agenda and the closing slide bring the core deck to <b>42 slides</b>, nine of them section "
         "dividers that take a few seconds each: about 30 content slides, <b>20 to 22 minutes</b> at a steady "
         "pace. The optional slides add about three minutes; leave them out if the slot is 20 minutes."),
       P("<b>What changes, in short</b>", "h2"),
       bul(["<b>New section 05 \u2014 Adopted methodology</b> (Scrum): four new slides.",
            "<b>The former \u201cDesign\u201d section is dissolved</b>: the class diagram moves into "
            "<i>Proposed solution</i>, the use case diagram into <i>Requirements</i>. The supervisor's outline has "
            "no design section, and both diagrams belong where they now go.",
            "<b>\u201cProgress\u201d becomes \u201cCompleted work\u201d</b> and gains six slides of real screens "
            "from the running application.",
            "<b>\u201cWhat is not done yet\u201d becomes \u201cCurrent limitations\u201d</b> inside the conclusion: "
            "the project stops here, so it is no longer progress, it is the honest boundary of the result.",
            "<b>One figure changes</b>: 252 automated tests become <b>297</b>, on slides 24 and 29. Everything "
            "else in the deck was re-counted and stands."]),
       P("<b>Rules for Claude Desktop</b>", "h2"),
       bul(["<b>Keep the deck's visual identity</b>: dark navy starfield background, white bold headings, the "
            "periwinkle/blue accent, numbered section dividers over the Earth image, rounded cards. New slides "
            "must be indistinguishable in style from the existing ones.",
            "<b>All slide text in English.</b> The French titles in the table above are for reference only; they go on no slide.",
            "<b>Actions</b>: "
            "<b>KEEP</b> = leave the slide exactly as it is (only renumber the page); "
            "<b>EDIT</b> = same slide, change only what is listed; "
            "<b>MOVE</b> = same slide in a new position, content unchanged unless listed; "
            "<b>NEW</b> = create it in the deck's style; "
            "<b>DELETE</b> = remove it; <b>OPTIONAL</b> = create only if the user asks for the longer version.",
            "Section numbers on dividers and in each slide's eyebrow label (e.g. \u201c04 \u00b7 PROPOSED "
            "SOLUTION\u201d) must follow the new order. Slide page numbers are renumbered at the end.",
            "Screenshots: insert the PNG from <font name='Mono'>docs/defense-screens/</font> (2400\u00d71350, "
            "16:9) inside a rounded frame with a thin accent border; never stretch, never crop away the "
            "application's header. Diagrams come from <font name='Mono'>docs/diagrams/</font>.",
            "Speaker notes (\u201cSay this\u201d) go in the notes field, never on the slide."]),
       PageBreak()]

# ─────────────────────────────── old → new map ──────────────────────────────
st += part("0", "From the old deck to the new one", "Each of the 30 current slides, and where it goes")
OLD = [
    ["1", "Cover", "KEEP", "1"],
    ["2", "Agenda", "EDIT \u2014 nine new section names", "2"],
    ["3", "Divider 01 \u00b7 Host organisation", "KEEP", "3"],
    ["4", "Quicky Prime", "KEEP", "4"],
    ["5", "Divider 02 \u00b7 Problem statement", "KEEP", "5"],
    ["6", "The question", "KEEP", "6"],
    ["7", "Three difficulties inside the question", "KEEP", "7"],
    ["8", "Divider 03 \u00b7 Existing solutions", "EDIT \u2014 title", "8"],
    ["9", "The platforms already on the market", "KEEP", "9"],
    ["10", "What they don't cover", "EDIT \u2014 title", "10"],
    ["11", "Divider 04 \u00b7 Proposed solution", "KEEP", "11"],
    ["12", "A three-level tenancy model", "KEEP", "12"],
    ["13", "One record, two owners", "KEEP", "13"],
    ["14", "Deployment architecture", "MOVE", "15"],
    ["15", "Divider 05 \u00b7 Requirements", "MOVE + EDIT \u2014 becomes 06", "20"],
    ["16", "Functional requirements worth stopping on", "MOVE", "23"],
    ["17", "Non-functional requirements", "MOVE + EDIT \u2014 figures", "24"],
    ["18", "Divider 06 \u00b7 Technologies", "MOVE + EDIT \u2014 becomes 07", "25"],
    ["19", "Why these choices", "MOVE", "26"],
    ["20", "Divider 07 \u00b7 Design", "DELETE", "\u2014"],
    ["21", "Use case diagram", "MOVE \u2014 into requirements", "21"],
    ["22", "Class diagram: the business core", "MOVE \u2014 into proposed solution", "14"],
    ["23", "Divider 08 \u00b7 Progress", "EDIT \u2014 \u201cCompleted work\u201d", "28"],
    ["24", "The project in figures", "EDIT \u2014 figures", "29"],
    ["25", "What is finished", "EDIT \u2014 one bullet", "30"],
    ["26", "What is not done yet", "MOVE + EDIT \u2014 \u201cCurrent limitations\u201d", "40"],
    ["27", "Divider 09 \u00b7 Conclusion", "KEEP", "37"],
    ["28", "The finding worth taking away", "MOVE", "39"],
    ["29", "Perspectives", "KEEP", "41"],
    ["30", "Questions", "KEEP", "42"],
]
st += [tab([["Old", "Current slide", "Action", "New"]] + OLD, [12 * mm, 82 * mm, 62 * mm, CW - 156 * mm], fs=8.3),
       Spacer(1, 5),
       P("<b>New slides</b>: 16\u201319 (methodology), 22 (main functional requirements), 27 (development "
         "tools), 31\u201336 (screens of the completed work) and 38 (conclusion). Optional: 4b, 23b, 36b, "
         "36c and 36d."),
       PageBreak()]

# ═════════════════════════ cover + agenda ═══════════════════════════════════
st += part("\u2014", "Cover and agenda", "2 slides")
st += slide("1", "Cover", "KEEP", "Old slide 1. Title, presenter and both supervisors are correct as they are.")
st += slide("2", "Outline of the presentation", "EDIT", "Old slide 2. Keep the layout (numbered tiles, Earth on the left); replace the nine labels.",
            content=sl("<b>01</b> Host organisation", "<b>02</b> Problem statement",
                       "<b>03</b> Study and critique of existing solutions", "<b>04</b> Proposed solution",
                       "<b>05</b> Adopted methodology", "<b>06</b> Functional and non-functional requirements",
                       "<b>07</b> Technologies and tools used", "<b>08</b> Completed work",
                       "<b>09</b> Conclusion and perspectives"),
            layout="two columns as now: 01\u201305 on the left, 06\u201309 on the right. Labels 03 and 06 are long: "
                   "let them wrap onto two lines rather than shrinking the type.",
            say="Nine sections, in the order the supervisor asked for. The heart of the talk is 04, 06 and 08: "
                "the solution, what it had to do, and the platform running.")
st += [PageBreak()]

# ═════════════════════════ 01 host organisation ═════════════════════════════
st += part("01", "Host organisation", "2 slides \u00b7 under two minutes", "Organisme d'accueil")
st += slide("3", "Divider 01 \u00b7 Host organisation", "KEEP", "Old slide 3.")
st += slide("4", "Quicky Prime", "KEEP", "Old slide 4. Positioning, sector, location, team size and Sawti, sourced from the company's LinkedIn page.",
            say="A small AI-focused firm in Sousse. Two sentences, then move on: this section is expected, but it "
                "earns no technical marks.")
st += slide("4b", "The assignment", "OPTIONAL", "New. Only if the supervisor wants the internship framed before the problem.",
            content=sl("<b>The brief</b> \u2014 design and build a web platform that lets property companies lease "
                       "office space to other companies, from the first public enquiry to the collected rent.",
                       "<b>Period</b> \u2014 15 February \u2013 15 August 2026 (six months)",
                       "<b>Team</b> \u2014 one developer, a product owner at Quicky Prime",
                       "<b>The constraint that shaped everything</b> \u2014 several competing property companies on "
                       "one installation"),
            layout="four short lines on a single card, the last one in the accent colour.",
            confirm="\u201cA product owner at Quicky Prime\u201d must match slide 18.",
            say="This is the brief I was given. The last line is the one that drives the rest of the talk.")
st += [PageBreak()]

# ═════════════════════════ 02 problem statement ═════════════════════════════
st += part("02", "Problem statement", "3 slides", "Probl\u00e9matique")
st += slide("5", "Divider 02 \u00b7 Problem statement", "KEEP", "Old slide 5.")
st += slide("6", "The question", "KEEP", "Old slide 6. The single question this project answers.",
            say="Read the question slowly. Then name the three difficulties inside it, which the next slide lists.")
st += slide("7", "Three difficulties inside the question", "KEEP", "Old slide 7. Isolation, process, model.")

# ═════════════════════════ 03 existing solutions ════════════════════════════
st += part("03", "Study and critique of existing solutions", "3 slides", "\u00c9tude et critique de l'existant")
st += slide("8", "Divider 03", "EDIT", "Old slide 8. Change the title and subtitle only.",
            content=sl("<b>03</b>", "<b>Study and critique of existing solutions</b>",
                       "Four platforms on the market, and the gaps that matter here"))
st += slide("9", "The platforms already on the market", "KEEP",
            "Old slide 9 \u2014 this is the <i>study</i>: Nexudus, OfficeRnD Flex, Yardi Kube, Optix, with their sources.")
st += slide("10", "Critique: what they don't cover", "EDIT",
            "Old slide 10 \u2014 this is the <i>critique</i>. Change only the title, from \u201cWhat they don't cover\u201d "
            "to \u201cCritique: what they don't cover\u201d. The two gap rows stay as they are.",
            say="Each of these products isolates one operator from another. None has a second level of client "
                "underneath, and none models an intake that happens in person. That is the space this project fills.")
st += [PageBreak()]

# ═════════════════════════ 04 proposed solution ═════════════════════════════
st += part("04", "Proposed solution", "5 slides", "La solution propos\u00e9e")
st += slide("11", "Divider 04 \u00b7 Proposed solution", "KEEP", "Old slide 11.")
st += slide("12", "A three-level tenancy model", "KEEP", "Old slide 12.")
st += slide("13", "One record, two owners", "KEEP", "Old slide 13.")
st += slide("14", "Class diagram: the business core", "MOVE",
            "Old slide 22, moved here from the dissolved Design section. Change its eyebrow label to "
            "\u201c04 \u00b7 PROPOSED SOLUTION\u201d; content unchanged (diagram "
            "<font name='Mono'>docs/diagrams/out/class-01-overview.png</font>).",
            say="The same duality as the previous slide, now drawn formally: the composition chain Tenant, "
                "Building, Floor, Space is the landlord's path; the tenant_id on Booking and MaintenanceTicket is "
                "the renter's.")
st += slide("15", "Deployment architecture", "MOVE", "Old slide 14, one position later. Content unchanged.")
st += [PageBreak()]

# ═════════════════════════ 05 methodology ═══════════════════════════════════
st += part("05", "Adopted methodology", "4 new slides", "La m\u00e9thodologie adopt\u00e9e")
st += slide("16", "Divider 05 \u00b7 Adopted methodology", "NEW",
            "Copy the style of the other dividers (Earth arc at the top, large numeral).",
            content=sl("<b>05</b>", "<b>Adopted methodology</b>", "Scrum: the platform delivered in sprints, reviewed with the company"))
st += slide("17", "Why Scrum", "NEW", None,
            content=sl("<b>1 \u00b7 Requirements that moved</b> \u2014 The specification asked for one level of "
                       "multi-tenancy; the business turned out to need two, nested. A design fixed up front would "
                       "have built the wrong model.",
                       "<b>2 \u00b7 A product owner on site</b> \u2014 Quicky Prime reviewed a working increment at the "
                       "end of each sprint and reordered what came next.",
                       "<b>3 \u00b7 The riskiest requirement handled continuously</b> \u2014 Isolation is not a "
                       "feature delivered once: every sprint put its new routes behind the same access policy, with "
                       "their own tests.",
                       "<i>Short iterations \u00b7 a working increment every sprint \u00b7 the backlog reordered at "
                       "every review</i>"),
            layout="three numbered cards stacked like old slide 7 (\u201cThree difficulties\u201d), the italic line "
                   "as a bottom bar in the accent colour.",
            confirm="Card 2 and the bottom line describe how the reviews went. Keep them only if that is how your "
                    "sprints actually ran; otherwise soften to \u201creviewed regularly with the company supervisor\u201d.",
            say="The first card is the strongest argument, and it is the project's own story: the second tenancy "
                "level was discovered, not specified. A process that waits for a complete specification would have "
                "found it at the end.")
st += slide("18", "Roles, artefacts and ceremonies", "NEW", None,
            content=sl("<b>Roles</b>",
                       ["Product owner \u2014 Mr Hassen Amri, Quicky Prime",
                        "Scrum master \u2014 <i>[to confirm]</i>",
                        "Development team \u2014 Marwan Hamed"],
                       "<b>Artefacts</b>",
                       ["Product backlog \u2014 user stories grouped by actor: visitor, platform owner, landlord "
                        "staff, renter",
                        "Sprint backlog \u2014 the stories taken into the sprint",
                        "Increment \u2014 a working build, demonstrated at the review"],
                       "<b>Ceremonies</b>",
                       ["Sprint planning \u00b7 short daily follow-up \u00b7 sprint review with a demo \u00b7 retrospective",
                        "Sprints of three weeks \u00b7 board: <i>[Jira / Trello / GitHub Projects \u2014 to confirm]</i>"]),
            layout="three columns (Roles, Artefacts, Ceremonies) as rounded cards, each with its three lines.",
            confirm=["Who acted as Scrum master. In a one-developer internship this is usually the company "
                     "supervisor or yourself; name whoever actually did it.",
                     "The board tool, the sprint length (three weeks is proposed) and what your daily follow-up "
                     "was. If there was no daily meeting, write \u201cdaily log\u201d instead."],
            say="One developer means Scrum adapted, not Scrum abandoned: the roles exist, the reviews happened with "
                "the company, and the increment was always something that ran.")
SPR = [["Sprint", "Dates", "Goal", "Delivered"],
       ["0", "15 Feb \u2013 7 Mar", "Analysis and set-up", "Study of existing solutions, requirements, architecture, development environment and CI"],
       ["1", "8 \u2013 28 Mar", "Identity and access", "Sign-in with refresh sessions, nine roles, three-level organisations"],
       ["2", "29 Mar \u2013 18 Apr", "Portfolio and dashboards", "Buildings, floors, spaces, floor map, one dashboard per role"],
       ["3", "19 Apr \u2013 9 May", "Public discovery", "Public map, published listings, guest and company applications"],
       ["4", "10 \u2013 30 May", "Booking workflow", "Twelve booking states, reception intake (call, visit, documents), overlap check"],
       ["5", "31 May \u2013 20 Jun", "Leases and billing", "Contracts, invoices, cash / transfer / cheque payments, promo codes, add-ons"],
       ["6", "21 Jun \u2013 11 Jul", "Operations", "Maintenance tickets, live notifications, audit log, analytics, exports"],
       ["7", "12 Jul \u2013 1 Aug", "AI features", "Ticket triage, space-finder assistant, document reading"],
       ["8", "2 \u2013 15 Aug", "Hardening and delivery", "Cross-tenant audit (42 probes), automated tests, Docker deployment"]]
st += slide("19", "Sprint plan", "NEW", None,
            content=[tab(SPR, [14 * mm, 28 * mm, 38 * mm, CW - 98 * mm], fs=8.3)],
            layout="a horizontal timeline from 15 February to 15 August with nine bars (S0\u2013S8), each "
                   "labelled with its goal; the \u201cDelivered\u201d column becomes the small text under each bar. "
                   "If it does not fit, two rows of bars (S0\u2013S4, S5\u2013S8).",
            confirm=["<b>The dates and the contents are a proposal</b>, reconstructed from what was delivered and "
                     "the only two dated milestones in the repository: role-based sign-in on 28 March (end of "
                     "sprint 1) and the per-role dashboards on 6 April (sprint 2). Replace them with your real "
                     "sprint log.",
                     "The repository also shows hardening, AI and Docker work committed in September. If that work "
                     "happened after 15 August, add a <b>Sprint 9 \u00b7 stabilisation (September\u2013October)</b> "
                     "bar rather than squeezing it into August."],
            say="Each sprint closed with something that ran. The order follows the business chain: who you are, "
                "what you own, how a visitor finds it, how a booking becomes a lease, how the lease is billed, "
                "then operations, then AI, then proof.")
st += [PageBreak()]

# ═════════════════════════ 06 requirements ══════════════════════════════════
st += part("06", "Functional and non-functional requirements", "5 slides (+1 optional)",
           "Besoins fonctionnels et non fonctionnels")
st += slide("20", "Divider 06", "MOVE", "Old slide 15 (was 05). Change the numeral to 06, the title and the subtitle.",
            content=sl("<b>06</b>", "<b>Functional and non-functional requirements</b>",
                       "Who uses the platform, what it must do, and how well"))
st += slide("21", "Actors and use cases", "MOVE",
            "Old slide 21, moved from the dissolved Design section. Retitle it \u201cActors and use cases\u201d and "
            "change its eyebrow to \u201c06 \u00b7 REQUIREMENTS\u201d. Diagram, \u201cWhat it shows\u201d and "
            "\u201cWhy a receptionist?\u201d unchanged (<font name='Mono'>docs/diagrams/out/uc-01-complete.png</font>).",
            say="Nine actors across three levels. The receptionist is the actor other systems do not have: it exists "
                "because a lease here is concluded in person.")
FR = [["Module", "The platform must\u2026", "Main actors"],
      ["Identity and organisations", "sign users in with refresh sessions; manage nine roles over three tenancy "
       "levels; create a renter company from an approved application", "Platform owner, client admin"],
      ["Portfolio", "manage buildings, floors and spaces (seven types); place spaces on a floor map; publish "
       "vacancies to the public map", "Manager"],
      ["Applications and bookings", "take guest and company applications; run the intake (call, visit, documents, "
       "signature); book rooms with an overlap check", "Visitor, receptionist, manager, renter"],
      ["Leases and billing", "issue lease contracts; invoice rent and one-off charges in QAR; record cash, transfer "
       "and cheque payments; promotion codes and add-ons", "Manager, finance, renter admin"],
      ["Maintenance", "report issues on occupied spaces; suggest category, priority and technician; assign, accept, "
       "resolve, close", "Renter, manager, technician"],
      ["Oversight", "dashboards and analytics per role; audit log; CSV and Excel exports; live notifications",
       "All staff roles"]]
st += slide("22", "Main functional requirements", "NEW", None,
            content=[tab(FR, [36 * mm, CW - 36 * mm - 46 * mm, 46 * mm], fs=8.4)],
            layout="a six-row table in the style of old slide 9 (blue header bar, rounded rows).",
            say="Six modules, one row each. The next slide stops on the four requirements that were harder than "
                "they look.")
st += slide("23", "Functional requirements worth stopping on", "MOVE",
            "Old slide 16. Change the eyebrow to \u201c06 \u00b7 REQUIREMENTS\u201d; content unchanged (\u201cTwelve "
            "states, not four\u201d is verified: the booking model has exactly 12 statuses).")
st += slide("23b", "The booking lifecycle", "OPTIONAL",
            "New. The state diagram behind \u201cTwelve states, not four\u201d: "
            "<font name='Mono'>docs/diagrams/out/stm-01-booking.png</font>.",
            content=[img("stm-01-booking.png", 120 * mm, DIAGRAMS)],
            layout="the diagram on the left two thirds; on the right, the in-person phase highlighted: "
                   "pending phone confirmation " + AR + " awaiting visit " + AR + " documents pending " + AR + " active.")
NFR = [["Requirement", "How it is met", "Evidence"],
       ["(eight rows unchanged)", "", ""],
       ["Maintainability", "Modular back end, CI/CD, Swagger", "<b>297 tests</b> (281 server, 16 client) \u00b7 CI on push and PR"],
       ["Confidentiality <i>(new row, optional)</i>", "Password hashes and session tokens stripped from every API response",
        "Covered by unit tests"]]
st += slide("24", "Non-functional requirements", "MOVE",
            "Old slide 17. Change the eyebrow to \u201c06 \u00b7 REQUIREMENTS\u201d, then update two figures:",
            content=[tab(NFR, [42 * mm, 72 * mm, CW - 114 * mm], fs=8.4), Spacer(1, 4),
                     Paragraph("Bottom bar: \u201cBacked by measurement, not only by design: 42 cross-tenant probes and "
                               "<b>297</b> automated tests.\u201d", S["slide"])],
            say="The right-hand column is what makes this slide defensible: each claim has a check behind it. The "
                "42 probes were re-run on 27 October, all passing.")
st += [PageBreak()]

# ═════════════════════════ 07 technologies ══════════════════════════════════
st += part("07", "Technologies and tools used", "3 slides", "Technologies et outils utilis\u00e9s")
st += slide("25", "Divider 07", "MOVE", "Old slide 18 (was 06). Numeral 07; keep the four stack lines, which are verified.",
            content=sl("<b>07</b>", "<b>Technologies and tools used</b>", "One TypeScript stack, and the tools around it",
                       "Server: NestJS 11 \u00b7 Prisma 5 \u00b7 PostgreSQL 13 \u00b7 Passport-JWT \u00b7 Socket.IO 4",
                       "Client: React 19 \u00b7 Vite 7 \u00b7 TypeScript 5 \u00b7 Ant Design 6 \u00b7 TanStack Query 5 \u00b7 Recharts 3 \u00b7 Leaflet",
                       "Infrastructure: Docker Compose \u00b7 nginx \u00b7 GitHub Actions",
                       "External services: Groq (LLM) \u00b7 Brevo (email) \u00b7 Cloudinary (files) \u00b7 Typeform (applications)"))
st += slide("26", "Why these choices", "MOVE", "Old slide 19. Eyebrow \u201c07 \u00b7 TECHNOLOGIES\u201d; content unchanged (Groq running gpt-oss-120b is the configured model).")
TOOLS = [["Tool", "Used for"],
         ["Visual Studio Code", "Editor for both projects"],
         ["Git and GitHub", "Version control and pull requests"],
         ["GitHub Actions", "Continuous integration on every push and pull request: lint, type check, tests with coverage, build, dependency audit"],
         ["Docker and Docker Compose", "The four-container stack, started with one command"],
         ["Swagger (OpenAPI)", "About 220 documented API endpoints, served at /api"],
         ["Jest and Vitest", "281 server and 16 client automated tests"],
         ["ESLint and Prettier", "Static checks and consistent formatting"],
         ["PlantUML", "The nine UML diagrams: use case, class, sequence, state, deployment"],
         ["Adminer", "Inspecting the database during development"]]
st += slide("27", "Development tools", "NEW", None,
            content=[tab(TOOLS, [44 * mm, CW - 44 * mm], fs=8.4)],
            layout="two-column table like old slide 19's cards, or a 3\u00d73 grid of tool tiles with a one-line purpose each.",
            confirm="Add your Scrum board tool here once slide 18 names it.",
            say="The stack is on the divider; these are the tools around it. The one to stop on is GitHub Actions: "
                "no change reaches the main branch without lint, type check, tests and a build passing.")
st += [PageBreak()]

# ═════════════════════════ 08 completed work ════════════════════════════════
st += part("08", "Completed work", "9 slides (+3 optional) \u00b7 the platform, running", "Les parties r\u00e9alis\u00e9es")
st += slide("28", "Divider 08", "EDIT", "Old slide 23. Title and subtitle change.",
            content=sl("<b>08</b>", "<b>Completed work</b>", "What was built, shown on the running application"))
FIG = [["Tile", "Old", "New", "Source"],
       ["data models", "25", "25", "schema.prisma"],
       ["controllers", "30", "30", "backend controllers"],
       ["pages", "55", "55", "frontend pages"],
       ["roles", "9", "9", "USER_ROLE, guest included"],
       ["automated tests", "252", "<b>297</b>", "281 server + 16 client, all passing"],
       ["audit probes", "42", "42", "npm run audit:access, 42/42 on 27 Oct"]]
st += slide("29", "The project in figures", "EDIT", "Old slide 24. One tile changes, and the bottom bar:",
            content=[tab(FIG, [34 * mm, 16 * mm, 18 * mm, CW - 68 * mm], fs=8.4), Spacer(1, 4),
                     Paragraph("Bottom bar: \u201cAll 297 tests pass \u00b7 type checking clean on both projects \u00b7 "
                               "the whole stack starts with one command\u201d", S["slide"])],
            confirm="The old bar said \u201cContinuous integration green\u201d. The October fixes are not committed yet, "
                    "so CI has not run on them. Commit and push first if you want to keep that wording; the "
                    "replacement above is true today without it.")
st += slide("30", "What is finished", "EDIT",
            "Old slide 25. In the AI column, end the last bullet at \u201c(trade licence, commercial registration)\u201d: "
            "drop \u201cthe upload interface comes next\u201d, which now belongs to slide 40.")
st += [PageBreak()]
st += slide("31", "Visitor: browse, ask, apply", "NEW", "Two screens side by side.",
            content=[shot_pair("01-public-map.png", "02-ai-space-finder.png",
                               "Public map: published offices with photos, monthly rent in QAR, transport notes and "
                               "an Apply button. No account needed.",
                               "Space-finder assistant: a request in plain words, answered with real listings only.")],
            layout="title on top; the two screens as large rounded frames; one caption line under each.",
            say="A visitor finds a space on the map, or simply asks. The assistant only ever answers with listings "
                "the database returned: the model describes them, it never selects or invents one.")
st += slide("32", "Two dashboards, two scopes", "NEW", None,
            content=[shot_pair("04-owner-dashboard.png", "05-manager-dashboard.png",
                               "Platform owner: every organisation \u2014 123 spaces, 22 active organisations.",
                               "Property manager, same screens: 52 spaces, only Msheireb's own buildings.")],
            say="Same application, two scopes. The platform owner is the only account that reads across "
                "organisations; a property manager sees her own portfolio and nothing else.")
st += slide("33", "The face-to-face intake, in the software", "NEW", None,
            content=[shot_pair("06-booking-applications.png", "07-reception-pipeline.png",
                               "Applications from the public map, accepted or refused by the manager.",
                               "Reception: confirmation call, site visit, documents \u2014 each a booking state.")],
            say="This is the process existing products ignore. Every in-person step has its state, and the "
                "receptionist role exists only to carry it.")
st += [PageBreak()]
st += slide("34", "Maintenance: the model proposes", "NEW", "One large screen.",
            content=shot_one("08-ai-ticket-triage.png",
                             "the model suggests Electrical / Emergency with its reason; the technician, Rajesh Nair, "
                             "comes from ticket history: \u201c9 electrical tickets resolved, 2 open now\u201d."),
            layout="the screen large on the left two thirds; on the right, two short labels: \u201cCategory and "
                   "priority: the model\u201d and \u201cTechnician: ticket history\u201d.",
            say="The model proposes, it does not decide. A value outside the application's own list is discarded "
                "and a keyword classifier takes over; and the technician is never the model's guess, because a "
                "model asked to name a person invents people who do not work here.")
st += slide("35", "Isolation you can see", "NEW", None,
            content=[shot_pair("09-isolation-msheireb.png", "10-isolation-west-bay.png",
                               "Msheireb's property manager: 48 maintenance tickets.",
                               "West Bay's property manager, the same screen: 30 tickets, none of Msheireb's.")],
            say="Two competitors, one installation, the same page: different rows, no overlap. Their totals add up "
                "exactly to the platform's 102 tickets \u2014 if anything leaked or was counted twice, the sum would "
                "not close.")
st += slide("36", "Billing in QAR, and the renter's side", "NEW", None,
            content=[shot_pair("11-finance-payments.png", "13-renter-contract.png",
                               "Finance confirms the payments renters report: cash, bank transfer or cheque.",
                               "The renter sees the same lease from its side: QAR 38,050 a month.")],
            say="No card processor: in this market rent is paid by cheque or transfer, so a named member of staff "
                "confirms each payment. On the right, the same lease the landlord manages, seen by the renter.")
st += [PageBreak()]
st += slide("36b", "Analytics and occupancy", "OPTIONAL", None,
            content=[shot_pair("14-analytics.png", "15-occupancy-heatmap.png",
                               "Analytics per property company: revenue trend, bookings by status, top spaces.",
                               "Occupancy heatmap: the share of bookable hours each space was used.")])
st += slide("36c", "The audit trail", "OPTIONAL", None,
            content=shot_one("16-audit-logs.png", "every privileged action with the person, the organisation, the "
                             "IP address and a severity.", width=CW * 0.6))
st += slide("36d", "Live demonstration", "OPTIONAL",
            "Only if the defense includes a demo: a full-screen link or embedded video. The recorded walkthrough "
            "is <font name='Mono'>demo-video/out/LeaseManager-demo.mp4</font>.",
            say="If the room allows it, show the video rather than clicking live: it cannot fail on a network or a "
                "login.")
st += [PageBreak()]

# ═════════════════════════ 09 conclusion ════════════════════════════════════
st += part("09", "Conclusion and perspectives", "5 slides", "Conclusion et perspectives")
st += slide("37", "Divider 09 \u00b7 Conclusion and perspectives", "KEEP", "Old slide 27.")
st += slide("38", "Conclusion", "NEW", None,
            content=sl([
                "A multi-tenant platform for leasing office space, from the public enquiry to the collected rent, "
                "used by nine roles across three tenancy levels.",
                "The face-to-face commercial process modelled as twelve booking states, with a receptionist role "
                "built for it.",
                "Isolation proved by measurement: 42 cross-tenant probes and 297 automated tests, all passing.",
                "AI that proposes but does not decide: maintenance triage, a space-finder assistant, document reading."]),
            layout="four short statements as numbered cards, in the style of old slide 25's columns.",
            say="Four results, each tied to one of the three difficulties named at the start: the model, the "
                "process and the isolation \u2014 plus the AI, beyond the specification.")
st += slide("39", "The finding worth taking away", "MOVE", "Old slide 28, now after the conclusion. Content unchanged.")
LIM = [["Limitation", "State", "Reason"],
       ["Document-reading interface", "Server only", "Extraction works; the drag-and-drop into the form was not built"],
       ["Scanned documents", "Limited", "The configured model is text-only; Groq offers vision models"],
       ["External marketplaces", "Waiting", "Generic adapters for Coworker.com, LiquidSpace; vendor APIs pending"],
       ["Google Business profile", "On hold", "Requires a verified account held by the property owner"],
       ["Production email", "Degraded mode", "Brevo needs the server's address allow-listed; fallback active"],
       ["Mobile application", "Out of scope", "The web interface is responsive"]]
st += slide("40", "Current limitations", "MOVE",
            "Old slide 26 (\u201cWhat is not done yet\u201d). Retitle it \u201cCurrent limitations\u201d, eyebrow "
            "\u201c09 \u00b7 CONCLUSION & PERSPECTIVES\u201d, first column header \u201cLimitation\u201d, and "
            "reword the first row's reason to the past tense, as below. The project stops here, so these are the "
            "boundaries of the result, not work in progress.",
            content=[tab(LIM, [42 * mm, 26 * mm, CW - 68 * mm], fs=8.3), Spacer(1, 4),
                     Paragraph("Bottom card unchanged: \u201cEach item has either a degraded mode or a manual equivalent "
                               "already in place.\u201d", S["slide"])],
            say="Said plainly: none of these blocks a business journey. Each has a fallback or a manual equivalent.")
st += slide("41", "Perspectives", "KEEP", "Old slide 29: document intake, a bounded assistant, learned triage, field application.")
st += slide("42", "Questions", "KEEP", "Old slide 30.")
st += [PageBreak()]

# ═════════════════════════ assets ═══════════════════════════════════════════
st += part("A", "Assets", "Screens of the running application and the UML diagrams")
st += [P("Screens were captured on 27 October 2026 from the running application with the demo data, at "
         "2400\u00d71350 (16:9). The full-resolution PNGs are in <font name='Mono'>docs/defense-screens/</font>; "
         "the previews below are reduced.")]
SHOTS = [
    ("01-public-map.png", "Guest: public map with Suite 502 open", "31"),
    ("02-ai-space-finder.png", "Guest: space-finder assistant answering a request", "31"),
    ("03-home-page.png", "Public home page with the real listings", "spare"),
    ("04-owner-dashboard.png", "Platform owner dashboard", "32"),
    ("05-manager-dashboard.png", "Property manager dashboard", "32"),
    ("06-booking-applications.png", "Booking applications from the public map", "33"),
    ("07-reception-pipeline.png", "Reception: call, visit, documents", "33"),
    ("08-ai-ticket-triage.png", "AI triage of a new maintenance ticket", "34"),
    ("09-isolation-msheireb.png", "Msheireb manager: 48 tickets", "35"),
    ("10-isolation-west-bay.png", "West Bay manager: 30 tickets", "35"),
    ("11-finance-payments.png", "Finance: payments to confirm", "36"),
    ("12-renter-portal.png", "Renter admin dashboard", "spare"),
    ("13-renter-contract.png", "Renter: lease contract details", "36"),
    ("14-analytics.png", "Analytics (property manager)", "36b"),
    ("15-occupancy-heatmap.png", "Occupancy heatmap", "36b"),
    ("16-audit-logs.png", "Audit trail", "36c"),
    ("17-employee-floor-map.png", "Renter employee: floor map with bookable rooms", "spare"),
]
w = (CW - 8 * mm) / 3
cells, row = [], []
for name, label, used in SHOTS:
    row.append([img(name, w), Spacer(1, 1.5),
                Paragraph("<font name='Mono' size='7'>%s</font><br/>%s \u00b7 <b>slide %s</b>" % (name, label, used), S["cap"])])
    if len(row) == 3:
        cells.append(row)
        row = []
if row:
    cells.append(row + [""] * (3 - len(row)))
g = Table(cells, colWidths=[w + 4 * mm] * 3, hAlign="LEFT")
g.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                       ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
st += [g, Spacer(1, 6), P("<b>Diagrams</b> (<font name='Mono'>docs/diagrams/out/</font>, rendered from PlantUML)", "h2"),
       tab([["File", "Diagram", "Used on"],
            ["uc-01-complete.png", "Complete use case diagram (zoom in, or use uc-02 to uc-05)", "21"],
            ["class-01-overview.png", "Domain model overview: packages and entities", "14"],
            ["stm-01-booking.png", "Booking state machine, twelve states", "23b (optional)"],
            ["dep-01-architecture-deployment.png", "Deployment (the deck already draws its own on slide 15)", "spare"],
            ["seq-01a-authentication-login.png", "Sequence: login", "spare, for questions"],
            ["seq-02b-booking-application-accept.png", "Sequence: the manager accepts an application", "spare"],
            ["seq-05a-ai-maintenance-triage.png", "Sequence: AI triage", "spare, for questions"],
            ["seq-03b-lease-contract-sign.png", "Sequence: lease signed, onboarding e-mails start", "spare"]],
           [62 * mm, 72 * mm, CW - 134 * mm], fs=8.2)]
st += [PageBreak()]

# ═════════════════════════ figures + checklist ══════════════════════════════
st += part("B", "Figures and checklist", "What was verified, and what to confirm yourself")
st += [tab([["Figure", "In the deck", "Verified value", "How it was checked (27 Oct 2026)"],
            ["Automated tests", "252", "<b>297</b>", "jest: 281 tests in 23 suites; vitest: 16 tests"],
            ["Access-audit probes", "42, all pass", "42, all pass", "npm run audit:access against the running stack"],
            ["Data models", "25", "25", "models in backend/prisma/schema.prisma"],
            ["Controllers", "30", "30", "*.controller.ts in backend/src"],
            ["Pages", "55", "55", "*.tsx in frontend/src/pages"],
            ["Roles", "9", "9", "USER_ROLE, including the guest visitor"],
            ["Booking states", "12", "12", "BOOKING_STATUS"],
            ["Space types", "7", "7", "SPACE_TYPE"],
            ["Database", "PostgreSQL 13, 25 tables", "PostgreSQL 13.5, 25 tables", "running database"],
            ["LLM", "Groq, gpt-oss-120b", "Groq, openai/gpt-oss-120b", "backend configuration"],
            ["API endpoints", "\u2014", "about 220", "route decorators in the controllers (221)"],
            ["Public listings", "\u2014", "19", "public map on 27 Oct; date-dependent"]],
           [30 * mm, 30 * mm, 34 * mm, CW - 94 * mm], fs=8.2),
       Spacer(1, 8),
       box("Before the defense \u2014 your checklist",
           ["1 \u00b7 Slide 19: replace the proposed sprint dates and contents with your real ones.",
            "2 \u00b7 Slide 18: name the Scrum master, the board tool, the sprint length and your daily practice.",
            "3 \u00b7 Slide 17: keep \u201creviewed at the end of each sprint\u201d only if that is what happened.",
            "4 \u00b7 Slide 29: commit and push the October fixes if you want to say \u201cCI green\u201d.",
            "5 \u00b7 Choose the optional slides (4b, 23b, 36b\u201336d) according to the time slot.",
            "6 \u00b7 Reseed the demo data on the morning of the defense (<font name='Mono'>cd backend</font>, "
            "<font name='Mono'>npm run db:seed:full</font>) if you show the application live."],
           WARN, WARNW)]


def build():
    doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB,
                          title="LeaseManager \u2014 technical defense brief", author="Marwan Hamed",
                          subject="Deck changes for the technical defense, for Claude Desktop")
    frame = Frame(ML, MB, CW, PH - MT - MB, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=deco)])
    doc.build(st)
    print("written", OUT)


if __name__ == "__main__":
    build()
