# -*- coding: utf-8 -*-
"""
Presentation content — first review (premiere restitution).

One block per slide: the title to reuse, the content to paste into Canva, the
layout hint, and the speaker note kept separate. A4 portrait, meant to be read
beside Canva while building the deck.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, PageBreak, HRFlowable,
                                ListFlowable, ListItem)

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

# Quicky Prime palette: near-black ground, electric blue accent.
INK, INK2, INK3 = colors.HexColor("#0B0F14"), colors.HexColor("#39434F"), colors.HexColor("#6B7683")
ACC, ACC2 = colors.HexColor("#1F6FEB"), colors.HexColor("#0C2340")
WASH, LINE, SOFT = colors.HexColor("#E8F0FE"), colors.HexColor("#CBD5E1"), colors.HexColor("#F5F8FC")
OK, OKW = colors.HexColor("#15803D"), colors.HexColor("#E6F4EA")
WARN, WARNW = colors.HexColor("#92400E"), colors.HexColor("#FDF3E3")
L3 = colors.HexColor("#9A3412")

PW, PH = A4
ML = MR = 19 * mm
MT, MB = 19 * mm, 17 * mm
CW = PW - ML - MR
AR = "<font name='Mono'>\u2192</font>"   # Georgia has no U+2192 glyph

S = {
 "part": ParagraphStyle("p", fontName="Cal-B", fontSize=20, leading=24, textColor=colors.white),
 "psub": ParagraphStyle("ps", fontName="Cal", fontSize=10.5, leading=13.5,
                        textColor=colors.HexColor("#A9C6F5")),
 "no": ParagraphStyle("no", fontName="Cal-B", fontSize=9, leading=11.5, textColor=ACC),
 "h": ParagraphStyle("h", fontName="Cal-B", fontSize=13.5, leading=17, textColor=INK),
 "b": ParagraphStyle("b", fontName="Geo", fontSize=9.6, leading=14.2, textColor=INK,
                     alignment=TA_JUSTIFY, spaceAfter=4),
 "li": ParagraphStyle("li", fontName="Geo", fontSize=9.6, leading=13.8, textColor=INK,
                      alignment=TA_LEFT, spaceAfter=2),
 "th": ParagraphStyle("th", fontName="Cal-B", fontSize=8.2, leading=10.5, textColor=colors.white),
 "td": ParagraphStyle("td", fontName="Geo", fontSize=8.7, leading=12.2, textColor=INK),
 "say": ParagraphStyle("s", fontName="Geo-I", fontSize=9, leading=13.2, textColor=INK2,
                       alignment=TA_JUSTIFY),
 "mono": ParagraphStyle("m", fontName="Mono", fontSize=8.4, leading=12.4, textColor=ACC2),
 "cov": ParagraphStyle("c", fontName="Cal-B", fontSize=27, leading=33, textColor=INK,
                       alignment=TA_CENTER),
 "covs": ParagraphStyle("cs", fontName="Geo-I", fontSize=12, leading=17, textColor=INK2,
                        alignment=TA_CENTER),
}


def deco(cv, doc):
    cv.saveState()
    cv.setFont("Cal", 7.8); cv.setFillColor(INK3)
    cv.drawString(ML, MB - 7.5 * mm, "LeaseManager \u2014 presentation content")
    cv.drawRightString(PW - MR, MB - 7.5 * mm, str(doc.page))
    cv.setStrokeColor(LINE); cv.setLineWidth(0.4)
    cv.line(ML, MB - 5 * mm, PW - MR, MB - 5 * mm)
    cv.restoreState()


def P(t, s="b"): return Paragraph(t, S[s])


def bul(items):
    return ListFlowable([ListItem(Paragraph(i, S["li"]), leftIndent=11, value="circle")
                         for i in items], bulletType="bullet", bulletFontSize=4.5,
                        bulletOffsetY=1.5, leftIndent=11, spaceBefore=1, spaceAfter=5)


def tab(rows, widths, fs=8.7, head=ACC2):
    S["td"].fontSize = fs; S["td"].leading = fs * 1.4
    data = [[Paragraph(str(x), S["th" if r == 0 else "td"]) for x in row]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    cm = [("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
          ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
          ("BACKGROUND", (0, 0), (-1, 0), head),
          ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
          ("BOX", (0, 0), (-1, -1), 0.5, LINE)]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            cm.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cm))
    return t


def box(lbl, txt, tone=ACC, bg=WASH):
    inner = [Paragraph(lbl, ParagraphStyle("bl", fontName="Cal-B", fontSize=8.2, leading=10.5,
                                           textColor=tone, spaceAfter=2)),
             Paragraph(txt, S["say"])]
    t = Table([[inner]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg),
                           ("LINEBEFORE", (0, 0), (0, -1), 2, tone),
                           ("TOPPADDING", (0, 0), (-1, -1), 5.5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    return t


def sl(no, title):
    t = Table([[Paragraph(no, S["no"]), Paragraph(title, S["h"])]],
              colWidths=[24 * mm, CW - 24 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                           ("LINEABOVE", (0, 0), (-1, 0), 0.9, ACC)]))
    return [Spacer(1, 6), t]


def part(n, title, sub):
    t = Table([[[Paragraph("SECTION %s" % n, S["psub"]), Paragraph(title, S["part"]),
                 Paragraph(sub, S["psub"])]]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACC2),
                           ("TOPPADDING", (0, 0), (-1, -1), 10),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    return [t, Spacer(1, 7)]


st = []

# ───────────────────────────── cover ────────────────────────────────────────
st += [Spacer(1, 30 * mm), P("Presentation content", "cov"), Spacer(1, 3 * mm),
       P("First review \u2014 nine sections, slide by slide", "covs"), Spacer(1, 6 * mm),
       HRFlowable(width="32%", thickness=0.8, color=LINE, hAlign="CENTER"),
       Spacer(1, 6 * mm),
       P("LeaseManager \u2014 office lease management platform", "covs"),
       P("Final year project \u00b7 ESPRIT \u00b7 Quicky Prime", "covs"),
       Spacer(1, 12 * mm)]
st += [tab([["Section", "Slides"],
            ["Cover + agenda", "2"],
            ["1 \u00b7 Host organisation", "2"],
            ["2 \u00b7 Problem statement", "3"],
            ["3 \u00b7 Study and critique of existing solutions", "3"],
            ["4 \u00b7 Proposed solution", "4"],
            ["5 \u00b7 Functional and non-functional requirements", "5"],
            ["6 \u00b7 Technologies used", "2"],
            ["7 \u00b7 Design", "3"],
            ["8 \u00b7 Progress", "3"],
            ["9 \u00b7 Conclusion and perspectives", "3"],
            ["Closing", "1"],
            ["<b>Total</b>", "<b>31</b>"]],
           [CW - 30 * mm, 30 * mm], fs=8.5)]
st += [Spacer(1, 7),
       box("How to use this document",
           "One block per slide. The title is to be reused as is, the content is to be "
           "pasted into Canva, and the <b>Layout</b> line says how to arrange it. The "
           "<b>Say this</b> note does <b>not</b> go on the slide \u2014 it belongs in "
           "your speaker notes."),
       Spacer(1, 5),
       box("Nine of those 31 slides are section dividers",
           "They take three seconds each and cost you nothing in time, but they are what "
           "makes a deck read as deliberate rather than assembled. Effective content: "
           "20 slides, about 18 minutes.", OK, OKW),
       Spacer(1, 5),
       box("Figures",
           "All taken from the database or from a test run on 3 October 2026. They are "
           "verifiable: an examiner may ask for the source.", OK, OKW),
       PageBreak()]

# ───────────────────────── Canva build sheet ────────────────────────────────
st += part("0", "Canva build sheet", "Read this before you place the first slide")

st += [P("<b>The template to start from</b>"),
       P("In Canva, open <b>Presentations</b> and search <font name='Mono'>dark blue "
         "minimalist thesis defense</font>. Pick a template whose title contains "
         "<b>Dark Blue</b> and <b>Minimalist</b> \u2014 for example <i>\u201cDark Blue "
         "and White Minimalist Simple Thesis Defense Presentation\u201d</i>. Two reasons: "
         "it already carries a dark divider layout and a light content layout, which is "
         "exactly the alternation this deck uses, and its near-black and blue palette is "
         "a two-click match for Quicky Prime's own branding."),
       Spacer(1, 3),
       P("<b>Avoid</b> the \u201cfuturistic / neon tech\u201d family. Glow effects and "
         "circuit-board backgrounds read as decoration, and a jury reads decoration as a "
         "thin argument underneath."),
       Spacer(1, 4),
       P("<b>Override the template's colours with these</b>"),
       tab([["Role", "Hex", "Used for"],
            ["Ground / dividers", "<font name='Mono'>#0C2340</font>",
             "Section divider slides, the two breather slides"],
            ["Accent", "<font name='Mono'>#1F6FEB</font>",
             "Numerals, rules, key figures, table headers"],
            ["Ink", "<font name='Mono'>#0B0F14</font>", "Body text on light slides"],
            ["Wash", "<font name='Mono'>#E8F0FE</font>", "Card and callout backgrounds"],
            ["Paper", "<font name='Mono'>#FFFFFF</font>", "Content slide background"]],
           [34 * mm, 28 * mm, CW - 62 * mm], fs=8.4),
       Spacer(1, 4),
       P("<b>Fonts</b> \u2014 headings <b>Poppins SemiBold</b>, body <b>Inter</b> or "
         "<b>Source Sans Pro</b>. Body never below 16 pt: at 14 pt the back row of the "
         "room stops reading and starts waiting."),
       Spacer(1, 4),
       box("The one rule that matters more than the template",
           "One idea per slide. Every slide in this document carries a single argument, "
           "and the Layout line tells you how to give that argument the whole frame. A "
           "beautiful template cannot rescue a slide with four arguments on it.",
           WARN, WARNW),
       PageBreak()]

# ═══════════ 1. HOST ORGANISATION ═══════════════════════════════════════════
st += part("1", "Host organisation", "2 slides \u00b7 keep this under two minutes")

st += sl("Slide 1.1", "Quicky Prime")
st += [P("<b>Content for the slide</b>"),
       tab([["", ""],
            ["Name", "<b>Quicky Prime</b>"],
            ["Positioning", "\u201cAI That Acts, Not Just Talks\u201d"],
            ["Sector", "IT system design services"],
            ["Locations", "Morlaix (France) and Sousse (Tunisia)"],
            ["Size", "A small team \u2014 2 to 10 people"],
            ["Also operates", "<b>Sawti</b> (\u0635\u0648\u062a\u064a), a showcase brand "
                              "of the same company"]],
           [34 * mm, CW - 34 * mm], fs=8.8),
       Spacer(1, 4),
       box("To verify before you present \u2014 do not invent any of it",
           "Year founded, the exact client sectors, and the headcount today. Everything "
           "above comes from the company's public LinkedIn page, which is enough for a "
           "slide but is not the company's own words. Ask your supervisor to read this "
           "slide once.", WARN, WARNW),
       Spacer(1, 3),
       P("<b>Layout</b> \u2014 logo top left, the table as five short lines, generous "
         "white space. No stock photography of an office."),
       box("Say this",
           "A small AI-focused firm working across France and Tunisia. Say it in two "
           "sentences and move on: this section is expected, but it earns no technical "
           "marks, and a jury that is still hearing about the host company at minute "
           "four starts to worry about the other eight sections.")]

st += sl("Slide 1.2", "The assignment")
st += [P("<b>Content for the slide</b>"),
       bul(["<b>Department and supervisor</b> \u2014 name and role "
            "<i>(fill this in; it is not in the code)</i>",
            "<b>Period</b> \u2014 dates of the internship",
            "<b>The brief</b> \u2014 design and build a platform that lets a property "
            "company lease office space to other companies, from the first public "
            "enquiry through to the collected rent",
            "<b>The constraint that shaped everything</b> \u2014 the platform had to "
            "host <b>several competing property companies on one installation</b>"]),
       box("Say this",
           "End on the last bullet and pause. It is the sentence that carries you into "
           "section 2, and the jury should hear it twice: once here, once in the problem "
           "statement.")]
st += [PageBreak()]

# ═══════════ 2. PROBLEM STATEMENT ═══════════════════════════════════════════
st += part("2", "Problem statement", "3 slides \u00b7 the section that sets up everything else")

st += sl("Slide 2.1", "The business: leasing offices in Doha")
st += [P("A property company owns office towers and leases workspace to other businesses: "
         "private offices, dedicated desks, meeting rooms, event spaces."),
       tab([["Actor", "What they do"],
            ["The landlord", "Owns the buildings. Lists, reviews, approves, invoices, "
                             "collects."],
            ["The renter", "Occupies the space. Books, signs, pays, reports faults."],
            ["Operations staff", "Reception (calls, viewings), technicians, finance."]],
           [32 * mm, CW - 32 * mm]),
       Spacer(1, 4),
       P("<b>Two rules specific to the Qatari market</b>"),
       bul(["A lease is concluded <b>in person</b>: confirmation call, site visit, paper "
            "file, and only then a signature",
            "Rent is <b>not paid online</b>: cash, bank transfer or cheque"]),
       Spacer(1, 2),
       P("<b>Layout</b> \u2014 three actor cards across the top, the two market rules as "
         "a highlighted strip underneath."),
       box("Say this",
           "The two market rules are not trivia. They are why no product on the market "
           "fits, and you will reuse them in section 3. Plant them here.")]
st += [PageBreak()]

st += sl("Slide 2.2", "What the current way of working costs")
st += [P("Today the work is done in spreadsheets, email and paper."),
       tab([["Weakness", "What it costs"],
            ["Availability is uncertain",
             "No single source of truth; two people promise the same room"],
            ["Manual collections",
             "Due dates tracked from memory; payment delays stretch out"],
            ["Faults leave no trace",
             "No resolution time, no cost, no history per space"],
            ["No audit trail",
             "Impossible to establish who approved what, and when \u2014 a real problem "
             "in a dispute"]],
           [44 * mm, CW - 44 * mm]),
       Spacer(1, 4),
       P("<b>Layout</b> \u2014 four numbered cards in a row, the way a process diagram "
         "reads. Number, short title, one sentence."),
       box("Say this",
           "Do not linger. This slide exists so the jury feels the cost before you state "
           "the problem on the next one.")]

st += sl("Slide 2.3", "The question this project answers")
st += [box("Put this sentence on the slide, and almost nothing else",
           "How do you build a <b>single platform</b> that serves <b>several competing "
           "property companies</b>, honours a commercial process conducted face to face, "
           "and guarantees that <b>no organisation ever sees another's data</b>?"),
       Spacer(1, 5),
       P("<b>Three difficulties it contains</b>"),
       bul(["<b>Isolation.</b> Two competitors on one installation: not a row, not a "
            "total, not a counter in common",
            "<b>Process.</b> Represent a face-to-face sequence that existing products "
            "ignore entirely",
            "<b>Model.</b> One record belongs to two organisations by two different paths"]),
       Spacer(1, 2),
       P("<b>Layout</b> \u2014 dark background <font name='Mono'>#0C2340</font>, the "
         "question large and centred, the three difficulties small beneath it."),
       box("Say this",
           "Deliver the question slowly, then stop talking for two seconds. This is the "
           "sentence the jury will measure the remaining eight sections against.")]
st += [PageBreak()]

# ═══════════ 3. EXISTING SOLUTIONS ══════════════════════════════════════════
st += part("3", "Study and critique of existing solutions",
           "3 slides \u00b7 this is where you prove you looked")

st += sl("Slide 3.1", "The platforms that already manage flexible workspace")
st += [tab([["Product", "What it does", "Limitation here"],
            ["<b>Nexudus</b><br/>UK \u00b7 coworking",
             "Member portal, bookings, recurring billing, white-label",
             "Built around <b>one operator</b>; assumes card payment"],
            ["<b>OfficeRnD Flex</b><br/>Bulgaria / UK",
             "Flex-space management, members, contracts, integrations",
             "Per-member pricing; a fully digital journey is assumed"],
            ["<b>Yardi Kube</b><br/>United States",
             "Coworking plus commercial property, accounting built in",
             "Enterprise weight and cost for a three-building portfolio"],
            ["<b>Optix</b><br/>Canada",
             "Mobile-first member app, bookings, payments",
             "Light on lease contracts; member experience, not landlord "
             "back-office"]],
           [34 * mm, 48 * mm, CW - 82 * mm], fs=8.2),
       Spacer(1, 4),
       box("Layout",
           "A four-row table is the right shape here \u2014 a jury expects a benchmark to "
           "look like a benchmark. Keep the product names bold and the limitation column "
           "the widest.", ACC, WASH),
       box("Say this",
           "Name the products out loud. A benchmark with no names reads as a benchmark "
           "you did not actually run.")]
st += [PageBreak()]

st += sl("Slide 3.2", "The four gaps they share")
st += [tab([["Gap", "Consequence for this project"],
            ["A single level of client",
             "They separate the operator from its members, but not <b>who owns the "
             "walls</b> from <b>who occupies them</b> " + AR + " competing landlords "
             "cannot be hosted together"],
            ["Online payment assumed",
             "Unsuited to a market that settles in cash, transfer or cheque"],
            ["Fully digital intake",
             "No confirmation call, no site visit, no paper file \u2014 the actual "
             "sequence here"],
            ["Per-user pricing",
             "Prohibitive for a company with a large operations staff who each touch the "
             "system a few times a week"]],
           [46 * mm, CW - 46 * mm], fs=8.5),
       Spacer(1, 4),
       box("Say this",
           "The first row is the decisive one \u2014 it is what justifies the project "
           "existing at all. Do not let it pass as one row among four: say it, then say "
           "why it cannot simply be configured around.", WARN, WARNW)]

st += sl("Slide 3.3", "What follows from that")
st += [box("Breather slide \u2014 dark background, one sentence",
           "<b>Two competing companies, one installation, zero shared data.</b><br/><br/>"
           "Not a row, not a total, not a counter. This requirement, rather than the "
           "feature list, is what shapes the architecture in the next section."),
       Spacer(1, 4),
       P("<b>Layout</b> \u2014 background <font name='Mono'>#0C2340</font>, white text, "
         "one sentence at large size. No bullets, no image, no logo."),
       box("Say this",
           "The hinge of the whole talk. Two seconds of silence before you click on.")]
st += [PageBreak()]

# ═══════════ 4. PROPOSED SOLUTION ═══════════════════════════════════════════
st += part("4", "Proposed solution", "4 slides \u00b7 your contribution beyond the brief")

st += sl("Slide 4.1", "A three-level tenancy model")
st += [P("The specification called for multi-tenancy at <b>one level</b>. The business "
         "turned out to require <b>two, nested</b>."),
       tab([["Level", "Actor", "What they can see"],
            ["1", "Platform owner",
             "Operates the service. The only role that reads across organisations."],
            ["2", "Property company (landlord)",
             "Buildings, floors, spaces. Lists, approves, invoices, collects. Its own "
             "portfolio only."],
            ["3", "Renter company",
             "Books, signs, pays, reports. Its own data, plus the public listings."]],
           [13 * mm, 42 * mm, CW - 55 * mm]),
       Spacer(1, 4),
       P("In the database this is one column: "
         "<font name='Mono'>tenants.organization_type \u2208 { CLIENT, RENTER }</font>"),
       Spacer(1, 2),
       P("<b>Layout</b> \u2014 three stacked bands, widest at the top, narrowing down. "
         "The nesting should be visible before anyone reads a word."),
       box("Say this",
           "Present this as analysis that reshaped the model, not as a deviation you were "
           "forced into. You read the brief, you found it modelled one level, and the "
           "business needed two.")]
st += [PageBreak()]

st += sl("Slide 4.2", "The central difficulty   \u2014 give this slide the most time")
st += [P("A booking, or a maintenance ticket, belongs to <b>two organisations</b> by "
         "<b>two different paths</b>."),
       tab([["THE RENTER", "THE LANDLORD"],
            ["<font name='Mono'>tenant_id</font> carried on the row itself<br/><br/>"
             "<i>\u201cI am the one who booked it\u201d</i>",
             "<font name='Mono'>space \u2192 floor \u2192 building.tenant_id</font>"
             "<br/><br/><i>\u201cthose are my walls\u201d</i>"]],
           [CW / 2, CW / 2], head=L3),
       Spacer(1, 4),
       box("The line that closes the slide",
           "Confusing these two paths is the origin of all <b>nine cross-tenant defects</b> "
           "found and fixed during development.", WARN, WARNW),
       Spacer(1, 3),
       P("<b>Layout</b> \u2014 one booking record in the centre, two arrows reaching it "
         "from opposite sides, each labelled with its path. This is the one slide worth "
         "drawing by hand in Canva rather than filling a template box."),
       box("Say this",
           "The most important slide in the presentation. Trace both arrows with your "
           "finger on the screen while you say them. If the jury understands only one "
           "slide today, make it this one.")]
st += [PageBreak()]

st += sl("Slide 4.3", "How the rule is enforced, on every single route")
st += [tab([["#", "Stage", "What it does"],
            ["1", "JwtAuthGuard", "Validates the token, populates the caller's identity"],
            ["2", "RolesGuard",
             "Checks <font name='Mono'>@Roles(...)</font> against the caller's role"],
            ["3", "ValidationPipe", "Rejects unexpected fields rather than ignoring them"],
            ["4", "Controller " + AR + " <font name='Mono'>*ForUser</font>",
             "Never the unscoped method"],
            ["5", "AccessPolicyService", "Turns the caller into a database filter"]],
           [8 * mm, 44 * mm, CW - 52 * mm]),
       Spacer(1, 4),
       P("<font name='Mono'>isCrossTenantReader()</font> returns true for the platform "
         "owner alone. Every other caller is narrowed to their own organisation before "
         "the query is built."),
       Spacer(1, 2),
       P("<b>Layout</b> \u2014 five stages as a horizontal chain of arrows, numbered."),
       box("Say this",
           "Five stages, one request. Understanding this chain is understanding the "
           "security of the whole back end \u2014 say that sentence, it gives the jury "
           "a handle.")]

st += sl("Slide 4.4", "Deployment architecture")
st += [Paragraph("Browser \u2192 nginx \u2500\u252c\u2192 React SPA (built)<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\u251c\u2192 NestJS API \u2192 "
                 "Prisma \u2192 PostgreSQL<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\u2514\u2192 Socket.IO "
                 "(live notifications)", S["mono"]),
       Spacer(1, 4),
       P("<b>Four containers \u00b7 one origin \u00b7 no CORS \u00b7 no hostname compiled "
         "into the bundle \u00b7 one command to start</b>"),
       P("Image: <font name='Mono'>docs/diagrams/09-deployment.png</font>"),
       box("Say this",
           "The point to land is <i>one command</i>. A jury hears \u201cit runs on my "
           "machine\u201d often; a reproducible stack is worth saying out loud.")]
st += [PageBreak()]

# ═══════════ 5. REQUIREMENTS ════════════════════════════════════════════════
st += part("5", "Functional and non-functional requirements",
           "5 slides \u00b7 the section that carries the mark")

st += sl("Slide 5.1", "Coverage of the specification")
st += [tab([["\u00a7", "Module", "State"],
            ["3.1", "Authentication &amp; accounts", "Complete"],
            ["3.2", "Space management", "Complete"],
            ["3.3", "Catalogue &amp; pricing", "Complete"],
            ["3.4", "Availability &amp; bookings", "Complete"],
            ["3.5", "Leases / contracts", "Complete"],
            ["3.6", "Invoicing &amp; payments", "Complete"],
            ["3.7", "Maintenance &amp; tickets", "Complete"],
            ["3.8", "Notifications", "Complete"],
            ["3.9", "Reporting &amp; dashboards", "Complete"],
            ["3.10", "Administration &amp; audit", "Complete"]],
           [13 * mm, CW - 45 * mm, 32 * mm], fs=8.4),
       Spacer(1, 4),
       P("<b>30 controllers \u00b7 218 routes \u00b7 25 data models</b>"),
       Spacer(1, 2),
       P("<b>Layout</b> \u2014 two columns of five rows, with a green tick against each. "
         "The three figures as large numerals along the bottom."),
       box("Say this",
           "Ten for ten. Say it once, do not read the rows aloud \u2014 the jury can read "
           "faster than you can speak.")]
st += [PageBreak()]

st += sl("Slide 5.2", "Functional requirements \u2014 the parts worth stopping on")
st += [P("<b>Bookings (\u00a73.4) \u2014 twelve states, not four</b>"),
       bul(["The specification implies submit " + AR + " approve " + AR + " occupy",
            "Reality inserts a whole phase: confirmation call " + AR + " site visit " +
            AR + " document upload " + AR + " only then a signature",
            "<b>Double-booking is prevented</b> by an overlap check before the write, not "
            "by a warning afterwards"]),
       P("<b>Pricing (\u00a73.3) \u2014 promotion codes unique per company</b>"),
       bul(["Two landlords can both run a code called <font name='Mono'>SUMMER25</font> "
            "without collision \u2014 a direct consequence of the three-level model"]),
       P("<b>Payments (\u00a73.6) \u2014 cash, bank transfer, cheque</b>"),
       bul(["Recorded by a named member of staff, with the audit trail that implies",
            "No online payment: a deliberate decision, covered on slide 5.4"]),
       P("<b>Maintenance (\u00a73.7)</b>"),
       bul(["Reporting is limited to spaces the reporter <b>actually occupies</b> \u2014 "
            "an isolation rule hiding inside a feature"]),
       box("Say this",
           "Pick the twelve-state booking and spend thirty seconds there. It is the "
           "clearest evidence that you modelled a real market rather than a generic one.")]
st += [PageBreak()]

st += sl("Slide 5.3", "Non-functional requirements")
st += [tab([["Requirement", "How it is met", "Evidence"],
            ["Authentication", "JWT with refresh, per-device sessions", "\u2014"],
            ["<b>Access control and isolation</b>",
             "<font name='Mono'>@Roles</font> on every route, plus AccessPolicyService",
             "<b>43 probes</b>"],
            ["Input validation, injection safety",
             "Unknown fields rejected; every query parameterised by the ORM",
             "Unknown field " + AR + " <b>400</b>"],
            ["Rate limiting", "Throttling on public endpoints", "\u2014"],
            ["Audit logging", "Append-only log: actor, IP, severity", "\u2014"],
            ["Performance", "Pagination, TTL cache, request de-duplication", "\u2014"],
            ["Reliability", "Runs with <b>no external keys at all</b>; mail degrades "
                            "through three tiers", "\u2014"],
            ["Maintainability", "Modular back end, CI/CD, Swagger", "<b>252 tests</b>"],
            ["Usability", "Responsive, light and dark themes, per-tab sessions", "\u2014"]],
           [38 * mm, CW - 68 * mm, 30 * mm], fs=8.2),
       box("Say this",
           "Two cells carry this slide: <b>43 probes</b> and <b>252 tests</b>. Everything "
           "else is a claim; those two are measurements.")]
st += [PageBreak()]

st += sl("Slide 5.4", "Where I deliberately departed from the specification")
st += [tab([["The specification says", "Decision", "Why"],
            ["Online payment (Stripe), marked <i>optional</i>", "Dropped",
             "The Qatari market settles in cash \u2014 a constraint given by the "
             "industrial supervisor"],
            ["Supabase for auth and storage",
             "Replaced with Passport-JWT, Prisma and Cloudinary",
             "Supabase's row-level security reasons about <b>one</b> tenant id; here one "
             "row belongs to two organisations by two paths"],
            ["BullMQ + Redis, marked <i>optional</i>", "Not adopted",
             "Three daily jobs " + AR + " the framework's own scheduler is enough, and "
             "one fewer moving part"],
            ["QR check-in, recurrence, SLA", "Not implemented",
             "All marked <i>optional</i> in the specification"]],
           [40 * mm, 38 * mm, CW - 78 * mm], fs=8.2),
       Spacer(1, 4),
       P("<b>Added beyond the specification:</b> three AI features \u00b7 a public "
         "space-finding assistant \u00b7 live notifications \u00b7 an automated isolation "
         "audit"),
       box("Say this",
           "The slide that decides your mark. It proves you read the specification and "
           "reasoned about it instead of following it blindly. <b>Rehearse the Supabase "
           "answer until it is one fluent sentence</b> \u2014 it is the question a "
           "technical examiner will ask.", WARN, WARNW)]
st += [PageBreak()]

st += sl("Slide 5.5", "Proving the isolation   \u2014 your strongest slide")
st += [P("Correct isolation does not merely hide rows. It <b>partitions</b> them."),
       tab([["Measure", "Msheireb", "West Bay", "Lusail", "Platform"],
            ["Revenue collected (QAR)", "5,300", "11,800", "10,100", "<b>27,200</b>"],
            ["Bookings", "6", "6", "6", "<b>18</b>"],
            ["Spaces", "24", "24", "24", "<b>72</b>"],
            ["Maintenance tickets", "18", "18", "18", "<b>54</b>"]],
           [40 * mm] + [(CW - 40 * mm) / 4] * 4, fs=8.8),
       Spacer(1, 4),
       box("The conclusion to put on the slide",
           "The three portfolios add up to <b>exactly</b> the platform total. If a row "
           "leaked into the wrong portfolio, or were counted twice, the sum would not "
           "close. Security becomes an arithmetic property anyone in this room can check.",
           OK, OKW),
       Spacer(1, 3),
       P("<b>Layout</b> \u2014 the table, then the total column emphasised in the accent "
         "blue. Consider animating the total column in last."),
       box("Say this",
           "Do the addition out loud on the first row: five thousand three hundred, plus "
           "eleven thousand eight hundred, plus ten thousand one hundred \u2014 "
           "twenty-seven thousand two hundred. It takes six seconds and it is the most "
           "convincing thing you will say all day.")]
st += [PageBreak()]

# ═══════════ 6. TECHNOLOGIES ════════════════════════════════════════════════
st += part("6", "Technologies used", "2 slides")

st += sl("Slide 6.1", "One TypeScript stack, end to end")
st += [tab([["Layer", "Technologies"],
            ["Server", "NestJS 11 \u00b7 Prisma 5 \u00b7 PostgreSQL 13 \u00b7 "
                       "Passport-JWT \u00b7 Socket.IO"],
            ["Client", "React 19 \u00b7 Vite 7 \u00b7 TypeScript \u00b7 Ant Design 6 "
                       "\u00b7 TanStack Query \u00b7 Recharts \u00b7 Leaflet"],
            ["Infrastructure", "Docker Compose \u00b7 nginx \u00b7 GitHub Actions"],
            ["External services", "Groq (LLM) \u00b7 Brevo (email) \u00b7 Cloudinary "
                                  "(files) \u00b7 Typeform (applications)"]],
           [32 * mm, CW - 32 * mm]),
       Spacer(1, 4),
       box("The argument, not the list",
           "One language on both sides of the wire. The types that describe a booking on "
           "the server are the same types the browser compiles against, which removes an "
           "entire category of error \u2014 the kind where each side believed something "
           "different about the same field."),
       Spacer(1, 3),
       P("<b>Layout</b> \u2014 four bands with logos. Logos are the one place in this "
         "deck where decoration genuinely helps.")]

st += sl("Slide 6.2", "Why these choices")
st += [tab([["Choice", "Reason"],
            ["NestJS", "Its guard mechanism suits declarative access control, route by "
                       "route \u2014 which is exactly the problem this project has"],
            ["Prisma", "Typed database access and migration tooling; queries are "
                       "parameterised, so injection is not reachable"],
            ["Ant Design", "Covers back-office components without bespoke development"],
            ["nginx in front", "Serves the built application and proxies the API on the "
                               "same origin: no CORS configuration at all"],
            ["Configurable LLM client",
             "The provider URL is a setting \u2014 changing provider is configuration, "
             "not a rewrite"]],
           [34 * mm, CW - 34 * mm]),
       box("Say this",
           "Only the first row needs saying aloud. A jury rewards a choice made for the "
           "problem at hand over a choice made because it is popular.")]
st += [PageBreak()]

# ═══════════ 7. DESIGN ══════════════════════════════════════════════════════
st += part("7", "Design", "3 slides \u00b7 two diagrams, no more")

st += sl("Slide 7.1", "Use case diagram")
st += [box("Image to insert",
           "<font name='Mono'>docs/diagrams/01-use-case-global.png</font> \u2014 portrait "
           "format. On a 16:9 slide, centre it under the title and leave the sides empty. "
           "Do not stretch it to fill the width.", ACC, WASH),
       Spacer(1, 4),
       P("<b>What it shows</b>"),
       bul(["<b>9 actors</b> across the three tenancy levels",
            "<b>10 use cases</b> grouped by domain",
            "Two <b>generalisation</b> relationships: the tenant admin inherits from the "
            "employee, the client admin from the manager"]),
       box("Say this",
           "Point at the receptionist. It is the actor most systems do not have, and it "
           "exists only because a lease here is concluded in person \u2014 which ties "
           "section 7 straight back to section 2.")]

st += sl("Slide 7.2", "Class diagram")
st += [box("Image to insert",
           "<font name='Mono'>docs/diagrams/02b-class-diagram-presentation.png</font> "
           "\u2014 the <b>landscape, reduced</b> version, built for projection: 10 "
           "classes, 3 attributes each. The full diagram "
           "(<font name='Mono'>02-class-diagram.png</font>, 17 classes) is unreadable on "
           "a screen; keep it for the written report.", ACC, WASH),
       Spacer(1, 4),
       P("<b>Point at exactly three things</b>"),
       bul(["The composition chain <b>Tenant " + AR + " Building " + AR + " Floor " +
            AR + " Space</b> \u2014 the landlord's path",
            "The <font name='Mono'>tenant_id</font> on <b>Booking</b> and "
            "<b>MaintenanceTicket</b> \u2014 the renter's path",
            "The note attached to Booking, which states the duality in one line"]),
       box("Say this",
           "This is slide 4.2 again, now in UML. Say so explicitly \u2014 \u201cthis is "
           "the same duality, drawn formally\u201d \u2014 so the jury sees the deck hang "
           "together.")]
st += [PageBreak()]

st += sl("Slide 7.3", "One sequence diagram \u2014 choose before the day")
st += [tab([["File", "What it shows", "Choose it if"],
            ["<font name='Mono'>04-sequence-authorisation.png</font>",
             "The five authorisation stages of one request, with the refusal branches",
             "The panel is technical \u2014 this is the core of the security model"],
            ["<font name='Mono'>06-sequence-booking.png</font>",
             "Public enquiry through to signed lease, with the role driving each step",
             "The panel is business-minded \u2014 this is the full operational journey"]],
           [50 * mm, (CW - 50 * mm) / 2, (CW - 50 * mm) / 2], fs=8.2),
       Spacer(1, 4),
       P("All nine diagrams are in <font name='Mono'>docs/diagrams/</font>, as PNG and as "
         "editable source."),
       box("Say this",
           "Do not project more than two diagrams in the whole talk. A jury disengages in "
           "front of a run of dense schematics, and one diagram explained well is worth "
           "more than four shown quickly.", WARN, WARNW)]
st += [PageBreak()]

# ═══════════ 8. PROGRESS ════════════════════════════════════════════════════
st += part("8", "Progress", "3 slides \u00b7 be straight about what is not done")

st += sl("Slide 8.1", "The project in figures")
st += [tab([["25", "30", "55", "9", "252", "43"],
            ["data<br/>models", "controllers", "pages", "roles", "tests",
             "audit<br/>probes"]],
           [CW / 6] * 6, fs=9),
       Spacer(1, 5),
       P("<b>Layout</b> \u2014 six tiles, the numeral very large in the accent blue, the "
         "label small beneath. This is the slide that conveys scale, so give the numbers "
         "room and resist adding a seventh."),
       Spacer(1, 3),
       P("<b>Overall state</b>"),
       bul(["Continuous integration green",
            "Type checking clean on both projects",
            "Full deployment from a single command"]),
       box("Say this",
           "Let the slide do the talking. Two sentences, then move on.")]

st += sl("Slide 8.2", "What is finished")
st += [P("<b>The complete business chain</b>"),
       bul(["Application " + AR + " booking " + AR + " lease " + AR + " invoice " + AR +
            " payment, end to end",
            "Maintenance, live notifications, audit trail",
            "Dashboards and analytics per role"]),
       P("<b>Isolation</b>"),
       bul(["All three levels in place and verified",
            "<b>9 defects found and fixed</b>",
            "Arithmetic consistency check (slide 5.5)"]),
       P("<b>Artificial intelligence \u2014 beyond the specification</b>"),
       bul(["Automatic ticket triage: category, priority, suggested technician",
            "A space-finding assistant for visitors, in plain language",
            "Reading of administrative documents (trade licence, commercial registration)"]),
       box("The principle to state out loud",
           "<b>The model proposes, it does not decide.</b> Any value outside the "
           "application's own list is discarded and a keyword classifier takes over. The "
           "suggested technician comes from ticket history, not from the model \u2014 a "
           "model asked to name a person invents people who do not work here.")]
st += [PageBreak()]

st += sl("Slide 8.3", "What is not done yet")
st += [tab([["Outstanding", "State", "Reason"],
            ["Document-reading interface", "Server only",
             "Extraction works; the drag-and-drop into the form remains to be built"],
            ["Scanned documents", "Limited",
             "The configured AI provider exposes no vision model"],
            ["External marketplaces", "Waiting",
             "Adapters written, credentials not yet supplied"],
            ["Google Business profile", "On hold",
             "Requires a verified account held by the property owner"],
            ["Production email", "Degraded mode",
             "Server address to be allow-listed with the provider; fallback active"],
            ["Mobile application", "Out of scope", "The web interface is responsive"]],
           [46 * mm, 26 * mm, CW - 72 * mm], fs=8.2),
       Spacer(1, 4),
       box("The line that turns this slide to your advantage",
           "None of these blocks a business journey: each has either a degraded mode or a "
           "manual equivalent already in place.", OK, OKW),
       box("Say this",
           "Do not rush or soften this slide. A clear-eyed progress report earns more "
           "credit than a list where everything is declared finished \u2014 and a jury "
           "that finds the gap you did not mention will go looking for others.",
           WARN, WARNW)]
st += [PageBreak()]

# ═══════════ 9. CONCLUSION ══════════════════════════════════════════════════
st += part("9", "Conclusion and perspectives", "3 slides")

st += sl("Slide 9.1", "The finding worth taking away")
st += [box("Put this on a dark slide, and nothing else",
           "<b>None of the nine defects came from a broken security function. Every one "
           "came from a call site that forgot to use it.</b><br/><br/>"
           "And four stayed invisible while the test data held a single landlord: with "
           "one, \u201cshow everything\u201d and \u201cshow my portfolio\u201d return the "
           "same rows.<br/><br/>" + AR +
           " <b>The shape of your test data is part of the security surface.</b>"),
       Spacer(1, 4),
       P("<b>Layout</b> \u2014 background <font name='Mono'>#0C2340</font>, white text, "
         "no image."),
       box("Say this",
           "The turning point of the defence. Deliver it slowly. This is an engineering "
           "result rather than a feature, and it is the moment a jury stops hearing a "
           "student describe a project and starts hearing an engineer describe a finding.")]

st += sl("Slide 9.2", "Assessment")
st += [bul(["A platform that works from anonymous visitor through to platform owner",
            "An isolation model that is <b>demonstrable</b>, not merely asserted",
            "AI that is useful and bounded: it proposes, it does not decide",
            "A deployment reproducible from one command"]),
       Spacer(1, 3),
       P("<b>Layout</b> \u2014 four short lines, generous spacing. No table.")]

st += sl("Slide 9.3", "Perspectives")
st += [bul(["Build the document upload interface, then move to a vision model for scans",
            "Extend the conversational assistant to the renter's own data, with a suite "
            "of injection tests to demonstrate its limits",
            "Replace the maintenance heuristic with a model trained on ticket history, "
            "measured against that heuristic as the baseline",
            "A mobile application for technicians working in the buildings"]),
       Spacer(1, 4),
       box("Say this",
           "Each perspective names how it would be judged, not just what would be built. "
           "That distinction is what separates a perspective from a wish list.")]

st += sl("Closing slide", "Thank you for your attention")
st += [P("Then a second line: <b>Questions</b>."),
       P("Footer, small: <i>LeaseManager \u2014 office lease management platform "
         "\u00b7 Quicky Prime \u00b7 ESPRIT 2026</i>")]

st += [Spacer(1, 9), HRFlowable(width="100%", thickness=0.4, color=LINE), Spacer(1, 4),
       Paragraph("Figures taken from the database and from a test run on 3 October 2026. "
                 "Images referenced are in <font name='Mono'>docs/diagrams/</font>. "
                 "Company details on slide 1.1 come from Quicky Prime's public LinkedIn "
                 "page and should be confirmed with your supervisor; the supervisor's "
                 "name and the internship dates are not in the code and must be filled "
                 "in by hand.",
                 ParagraphStyle("f", fontName="Cal-I", fontSize=8, leading=11,
                                textColor=INK3, alignment=TA_JUSTIFY))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Presentation_Content.pdf")
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=ML, rightMargin=MR,
                      topMargin=MT, bottomMargin=MB,
                      title="LeaseManager \u2014 presentation content")
doc.addPageTemplates([PageTemplate(id="a", frames=[Frame(ML, MB, CW, PH - MT - MB, id="f")],
                                   onPage=deco)])
doc.build(st)
print("PDF:", out)
