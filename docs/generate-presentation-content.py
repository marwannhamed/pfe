# -*- coding: utf-8 -*-
"""
Presentation content — the nine required sections, slide by slide.

One block per slide: the title to reuse, the content to paste into Canva, and
the speaker note kept separate. A4 portrait, meant to be read beside Canva.
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

INK, INK2, INK3 = colors.HexColor("#14181F"), colors.HexColor("#3A464F"), colors.HexColor("#6B7880")
ACC, ACC2 = colors.HexColor("#0B5E64"), colors.HexColor("#084449")
WASH, LINE, SOFT = colors.HexColor("#E7F2F2"), colors.HexColor("#C9D6D9"), colors.HexColor("#F3F7F8")
OK, OKW = colors.HexColor("#1B7048"), colors.HexColor("#E4F1EA")
WARN, WARNW = colors.HexColor("#8A5D00"), colors.HexColor("#FAF2DE")
L3 = colors.HexColor("#9A5B1E")

PW, PH = A4
ML = MR = 19 * mm
MT, MB = 19 * mm, 17 * mm
CW = PW - ML - MR
AR = "<font name='Mono'>\u2192</font>"   # Georgia has no U+2192 glyph

S = {
 "part": ParagraphStyle("p", fontName="Cal-B", fontSize=20, leading=24, textColor=colors.white),
 "psub": ParagraphStyle("ps", fontName="Cal", fontSize=10.5, leading=13.5,
                        textColor=colors.HexColor("#BFE0E1")),
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
 "cov": ParagraphStyle("c", fontName="Cal-B", fontSize=28, leading=34, textColor=INK,
                       alignment=TA_CENTER),
 "covs": ParagraphStyle("cs", fontName="Geo-I", fontSize=12, leading=17, textColor=INK2,
                        alignment=TA_CENTER),
}


def deco(cv, doc):
    cv.saveState()
    cv.setFont("Cal", 7.8); cv.setFillColor(INK3)
    cv.drawString(ML, MB - 7.5 * mm, "LeaseManager — Presentation content")
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
st += [Spacer(1, 34 * mm), P("Presentation content", "cov"), Spacer(1, 3 * mm),
       P("The nine required sections, slide by slide", "covs"), Spacer(1, 7 * mm),
       HRFlowable(width="32%", thickness=0.8, color=LINE, hAlign="CENTER"),
       Spacer(1, 7 * mm), P("LeaseManager — Final Year Project", "covs"),
       Spacer(1, 18 * mm)]
st += [tab([["Section", "Slides"],
            ["1 · Host organisation", "2"], ["2 · Problem statement", "2"],
            ["3 · Study and critique of existing solutions", "3"],
            ["4 · Proposed solution", "4"],
            ["5 · Functional and non-functional requirements", "6"],
            ["6 · Technologies used", "2"], ["7 · Design", "3"],
            ["8 · Progress", "3"], ["9 · Conclusion and perspectives", "2"],
            ["<b>Total</b>", "<b>27</b>"]],
           [CW - 30 * mm, 30 * mm])]
st += [Spacer(1, 7),
       box("How to use this document",
           "One block per slide. The title is to be reused as is, the content is to be "
           "pasted into Canva. The <b>Say this</b> note does <b>not</b> go on the slide — "
           "it belongs in your speaker notes."),
       Spacer(1, 5),
       box("Figures", "All taken from the database or from a test run on 3 October 2026. "
                      "They are verifiable: an examiner may ask for the source.", OK, OKW),
       PageBreak()]

# ═══════════ 1. HOST ORGANISATION ═══════════════════════════════════════════
st += part("1", "Host organisation", "2 slides")

st += sl("Slide 1.1", "The company")
st += [box("To be completed — this information is not in the code",
           "Take it from the company profile or its website. Do not invent anything: "
           "your industrial supervisor will be in the room.", WARN, WARNW),
       Spacer(1, 4),
       P("<b>Slide structure</b>"),
       bul(["<b>Company name</b> and logo",
            "<b>Sector</b> and year founded",
            "<b>Headcount</b> and locations",
            "<b>Core business</b> in one sentence",
            "<b>Market position</b>: which clients, which markets"])]

st += sl("Slide 1.2", "Internship context")
st += [P("<b>Slide structure</b>"),
       bul(["<b>Host department</b> and its remit",
            "<b>Industrial supervisor</b>: name and role",
            "<b>Duration</b> and dates of the internship",
            "<b>Assignment</b>: design and build a multi-organisation platform for "
            "office lease management"]),
       box("Say this", "Move through this quickly. The section is expected but earns no "
                       "technical marks: two minutes is enough. End on the assignment, "
                       "which leads into the problem statement.")]
st += [PageBreak()]

# ═══════════ 2. PROBLEM STATEMENT ═══════════════════════════════════════════
st += part("2", "Problem statement", "2 slides")

st += sl("Slide 2.1", "The business: leasing offices in Doha")
st += [P("A property company owns office towers and leases workspace to other "
         "businesses: private offices, dedicated desks, meeting rooms, event spaces."),
       P("<b>Three groups of actors work on the same data</b>"),
       tab([["Actor", "What they do"],
            ["The landlord", "Owns the buildings. Lists, reviews, approves, invoices, collects."],
            ["The renter", "Occupies the space. Books, signs, pays, reports faults."],
            ["Operations staff", "Reception (calls, viewings), technicians, finance."]],
           [32 * mm, CW - 32 * mm]),
       Spacer(1, 4),
       P("<b>Two rules specific to the Qatari market</b>"),
       bul(["A lease is concluded <b>in person</b>: confirmation call, site visit, "
            "paper file, and only then a signature",
            "Rent is <b>not paid online</b>: cash, bank transfer or cheque"])]

st += sl("Slide 2.2", "The question this project answers")
st += [box("Problem statement",
           "How do you build a single platform that serves <b>several competing property "
           "companies</b>, honours a face-to-face commercial process, and guarantees that "
           "no organisation ever sees another's data?"),
       Spacer(1, 5),
       P("<b>Three difficulties to resolve</b>"),
       bul(["<b>Isolation.</b> Two competitors on one installation: not a row, not a "
            "total, not a counter in common",
            "<b>Process.</b> Represent a face-to-face sequence that existing products ignore",
            "<b>Model.</b> One record belongs to two organisations by two different paths"]),
       box("Say this", "Deliver the problem statement slowly, then pause. It is the "
                       "sentence the examiners will use to judge whether everything that "
                       "follows holds together.")]
st += [PageBreak()]

# ═══════════ 3. EXISTING SOLUTIONS ══════════════════════════════════════════
st += part("3", "Study and critique of existing solutions", "3 slides")

st += sl("Slide 3.1", "Current practice: spreadsheets and email")
st += [tab([["Weakness", "Consequence"],
            ["Availability is uncertain",
             "No single source of truth; booking conflicts surface too late"],
            ["Manual collections",
             "Due dates tracked from memory; payment delays stretch out"],
            ["Faults leave no trace",
             "No resolution time, no cost, no history per space"],
            ["No audit trail",
             "Impossible to establish who approved what, and when; a problem in a dispute"]],
           [42 * mm, CW - 42 * mm])]

st += sl("Slide 3.2", "Commercial products on the market")
st += [P("Four mismatches against the requirement."),
       tab([["Limitation", "Consequence"],
            ["A single level of client",
             "Does not separate who owns the walls from who occupies them " + AR +
             " several competing landlords cannot be hosted together"],
            ["Online payment assumed", "Unsuited to a cash market"],
            ["Fully digital intake",
             "Ignores the confirmation call, the site visit and the paper file"],
            ["Per-user pricing",
             "Prohibitive for a company with a large operations staff"]],
           [46 * mm, CW - 46 * mm]),
       box("Say this", "The first row is the decisive argument: it is what justifies the "
                       "project existing at all. Do not treat it as one row among four.")]
st += [PageBreak()]

st += sl("Slide 3.3", "Summary: the technical constraint")
st += [box("Breather slide — dark background, very short text",
           "<b>Two competing companies, one installation, zero shared data.</b><br/><br/>"
           "Not a row, not a total, not a counter. This requirement, rather than the "
           "feature list, is what shapes the whole architecture that follows."),
       Spacer(1, 5),
       P("In Canva: background <font name='Mono'>#084449</font>, white text, one sentence "
         "at large size. No bullets, no illustration."),
       box("Say this", "The hinge between the problem and the solution. Pause for two "
                       "seconds before moving on.")]
st += [PageBreak()]

# ═══════════ 4. PROPOSED SOLUTION ═══════════════════════════════════════════
st += part("4", "Proposed solution", "4 slides")

st += sl("Slide 4.1", "A three-level tenancy model")
st += [P("The specification called for multi-tenancy at <b>one level</b>. The business "
         "requires <b>two, nested</b>."),
       tab([["Level", "Actor", "What they can see"],
            ["1", "Platform owner",
             "Operates the service. The only role that reads across organisations."],
            ["2", "Property company (landlord)",
             "Buildings, floors, spaces. Lists, approves, invoices, collects. Its own "
             "portfolio only."],
            ["3", "Renter company (tenant)",
             "Books, signs, pays, reports. Its own data, plus the public listings."]],
           [13 * mm, 44 * mm, CW - 57 * mm]),
       Spacer(1, 4),
       P("Implementation: <font name='Mono'>tenants.organization_type</font> ∈ "
         "{ <font name='Mono'>CLIENT</font>, <font name='Mono'>RENTER</font> }"),
       box("Say this", "This is the project's contribution beyond the specification. "
                       "Present it as analysis that reshaped the model — not as a deviation you "
                       "were forced into.")]

st += sl("Slide 4.2", "The central difficulty   (make this slide large)")
st += [P("A booking, or a maintenance ticket, belongs to <b>two organisations</b> by "
         "<b>two different paths</b>."),
       tab([["THE RENTER", "THE LANDLORD"],
            ["<font name='Mono'>tenant_id</font> carried on the row<br/>"
             "<i>“I am the one who booked it”</i>",
             "<font name='Mono'>space \u2192 floor \u2192 building.tenant_id</font><br/>"
             "<i>“those are my walls”</i>"]],
           [CW / 2, CW / 2], head=L3),
       Spacer(1, 4),
       box("Closing line for the slide",
           "Confusing these two paths is the origin of all <b>9 cross-tenant defects</b> "
           "found and fixed during development.", WARN, WARNW),
       box("Say this", "The most important slide in the presentation. Trace both arrows "
                       "out loud.")]
st += [PageBreak()]

st += sl("Slide 4.3", "How the rule is enforced, route by route")
st += [tab([["#", "Stage", "Role"],
            ["1", "JwtAuthGuard", "Validates the token, populates the caller's identity"],
            ["2", "RolesGuard", "Checks <font name='Mono'>@Roles(...)</font> against the "
                                "caller's role"],
            ["3", "ValidationPipe", "Rejects unexpected fields rather than ignoring them"],
            ["4", "Controller " + AR + " <font name='Mono'>*ForUser</font>",
             "Never the unscoped method"],
            ["5", "AccessPolicyService", "Turns the caller into a Prisma filter"]],
           [8 * mm, 42 * mm, CW - 50 * mm]),
       Spacer(1, 4),
       P("<font name='Mono'>isCrossTenantReader()</font> is true for the platform owner "
         "alone.")]

st += sl("Slide 4.4", "Deployment architecture")
st += [Paragraph("Browser \u2192 nginx &nbsp;┬\u2192 React SPA (built)<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└\u2192 NestJS API \u2192 Prisma \u2192 "
                 "PostgreSQL<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└\u2192 Socket.IO "
                 "(notifications)", S["mono"]),
       Spacer(1, 4),
       P("<b>4 containers</b> · one origin · no CORS · no hostname compiled into the bundle"),
       P("Illustration: <font name='Mono'>docs/diagrams/09-deployment.png</font>")]
st += [PageBreak()]

# ═══════════ 5. REQUIREMENTS ════════════════════════════════════════════════
st += part("5", "Functional and non-functional requirements", "6 slides")

st += sl("Slide 5.1", "Coverage of the specification")
st += [tab([["§ Spec", "Module", "Status"],
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
           [15 * mm, CW - 45 * mm, 30 * mm], fs=8.4),
       Spacer(1, 4),
       P("<b>30 controllers · 218 routes · 25 data models</b>")]
st += [PageBreak()]

st += sl("Slide 5.2", "Functional requirements (1 of 2)")
st += [P("<b>§3.1 — Authentication &amp; accounts</b>"),
       bul(["Email and password sign-in, JWT with refresh",
            "Multiple concurrent sessions per device",
            "Role-based access control: <b>9 roles</b> — the specification listed 6",
            "Password reset by email"]),
       P("<b>§3.2 — Space management</b>"),
       bul(["Buildings " + AR + " Floors " + AR + " Spaces (7 types)",
            "Features, equipment, photographs, position on a floor plan",
            "5 statuses: available, occupied, reserved, maintenance, out of service"]),
       P("<b>§3.3 — Catalogue &amp; pricing</b>"),
       bul(["Three rate cards: hourly, daily, monthly",
            "Add-on services with their own billing cycle",
            "<b>Promotion codes unique per company</b>: two landlords can both run the "
            "same code without collision"]),
       P("<b>§3.4 — Availability &amp; bookings</b>"),
       bul(["Calendar by site, floor and space type",
            "<b>Double-booking prevention</b>: overlap check before the write",
            "Check-in and check-out",
            "<b>12 states</b>, including a phase absent from the specification: "
            "confirmation call " + AR + " site visit " + AR + " document upload"])]
st += [PageBreak()]

st += sl("Slide 5.3", "Functional requirements (2 of 2)")
st += [P("<b>§3.5 — Leases / contracts</b>"),
       bul(["Generated from a confirmed booking",
            "Security deposit: lodging and refund",
            "<b>Renewal</b> and <b>termination</b>",
            "Automatic expiry reminders at 60 / 30 / 7 days"]),
       P("<b>§3.6 — Invoicing &amp; payments</b>"),
       bul(["Itemised invoices, configurable tax rate",
            "Settlement: <b>cash · bank transfer · cheque</b>",
            "Automatic reminders at day 1 / 7 / 14 past due",
            "Export to PDF and CSV/XLSX"]),
       P("<b>§3.7 — Maintenance &amp; tickets</b>"),
       bul(["Reporting limited to spaces the reporter <b>actually occupies</b>",
            "7 categories, 5 priorities, assignment to a technician",
            "Resolution cost recorded"]),
       P("<b>§3.8 and §3.9 — Notifications and reporting</b>"),
       bul(["In-app notifications delivered <b>live</b> over a websocket, plus email",
            "Occupancy rate, revenue per site, arrears, mean time to resolution",
            "Revenue forecast, occupancy heat map"])]
st += [PageBreak()]

st += sl("Slide 5.4", "Deliberate departures from the specification")
st += [tab([["Specification", "Decision", "Justification"],
            ["Online payment (Stripe), <i>optional</i>", "Dropped",
             "Qatari market settles in cash — a constraint given by the industrial supervisor"],
            ["Supabase (Auth + Storage)", "Replaced with Passport-JWT + Prisma + Cloudinary",
             "Supabase models <b>one</b> level of tenant; three-level isolation requires "
             "control over how each query is built"],
            ["BullMQ + Redis, <i>optional</i>", "Not adopted",
             "Only 3 daily jobs " + AR + " <font name='Mono'>@nestjs/schedule</font> "
             "is sufficient, one dependency fewer"],
            ["QR code, recurrence, SLA", "Not implemented",
             "Marked <i>optional</i> in the specification"]],
           [38 * mm, 38 * mm, CW - 76 * mm], fs=8.3),
       Spacer(1, 4),
       P("<b>Added beyond the specification:</b> 3 AI features · a public space-finding "
         "assistant · live notifications · an automated isolation audit"),
       box("Say this", "The slide that decides your mark: it proves the specification was "
                       "read and reasoned about rather than followed blindly. Prepare the "
                       "Supabase question.", WARN, WARNW)]
st += [PageBreak()]

st += sl("Slide 5.5", "Non-functional requirements")
st += [tab([["Requirement", "Implementation", "Evidence"],
            ["JWT auth + refresh", "Passport-JWT, per-device sessions", "—"],
            ["<b>RBAC + tenant isolation</b>",
             "<font name='Mono'>@Roles</font> on every route + AccessPolicyService",
             "<b>43 probes</b>"],
            ["Input validation, injection safety",
             "whitelist + forbidNonWhitelisted; Prisma parameterises every query",
             "Unknown fields <b>rejected</b>"],
            ["Rate limiting", "ThrottlerGuard on public endpoints", "—"],
            ["Audit logging", "append-only audit_logs (actor, IP, severity)", "—"],
            ["Performance", "Pagination, TTL cache, request de-duplication", "—"],
            ["Reliability", "Runs with <b>no external keys at all</b>; mail degrades "
                            "through 3 tiers", "—"],
            ["Maintainability", "NestJS modules, <b>252 tests</b>, CI/CD, Swagger", "—"],
            ["Usability", "Responsive, light and dark themes, per-tab sessions", "—"]],
           [36 * mm, CW - 66 * mm, 30 * mm], fs=8.2)]
st += [PageBreak()]

st += sl("Slide 5.6", "Proving the isolation   (strong slide)")
st += [P("Correct isolation <b>partitions</b> the data."),
       tab([["Measure", "Msheireb", "West Bay", "Lusail", "Platform"],
            ["Revenue collected (QAR)", "5,300", "11,800", "10,100", "<b>27,200</b>"],
            ["Bookings", "6", "6", "6", "<b>18</b>"],
            ["Spaces", "24", "24", "24", "<b>72</b>"],
            ["Maintenance tickets", "18", "18", "18", "<b>54</b>"]],
           [40 * mm] + [(CW - 40 * mm) / 4] * 4, fs=8.8),
       Spacer(1, 4),
       box("Conclusion",
           "The three portfolios add up to <b>exactly</b> the platform total. If a row "
           "leaked, or were counted twice, the sum would not close. Security becomes an "
           "arithmetic property anyone can check.", OK, OKW),
       box("Say this", "The most convincing argument for a technical panel. Do the "
                       "addition out loud on the first row.")]
st += [PageBreak()]

# ═══════════ 6. TECHNOLOGIES ════════════════════════════════════════════════
st += part("6", "Technologies used", "2 slides")

st += sl("Slide 6.1", "One TypeScript stack, end to end")
st += [tab([["Layer", "Technologies"],
            ["Server", "NestJS 11 · Prisma 5 · PostgreSQL 13 · Passport-JWT · Socket.IO"],
            ["Client", "React 19 · Vite 7 · TypeScript · Ant Design 6 · TanStack Query · "
                       "Recharts · Leaflet"],
            ["Infrastructure", "Docker Compose · nginx · GitHub Actions"],
            ["External services", "Groq (LLM) · Brevo (email) · Cloudinary (files) · "
                                  "Typeform (applications)"]],
           [32 * mm, CW - 32 * mm]),
       Spacer(1, 4),
       box("The argument", "One language on both sides: types are shared between server "
                           "and client, which removes an entire class of interpretation "
                           "errors.")]

st += sl("Slide 6.2", "Why these choices")
st += [tab([["Choice", "Reason"],
            ["NestJS", "Modular structure and a guard mechanism that suits declarative "
                       "access control, route by route"],
            ["Prisma", "Typed database access and migration tooling; queries are "
                       "parameterised, so injection is not reachable"],
            ["Ant Design", "Covers back-office components without bespoke development"],
            ["nginx in front", "Serves the built application and proxies the API on the "
                               "same origin: no CORS configuration at all"],
            ["Configurable LLM client",
             "The provider URL is a setting: changing provider is configuration, not a "
             "rewrite"]],
           [34 * mm, CW - 34 * mm])]
st += [PageBreak()]

# ═══════════ 7. DESIGN ══════════════════════════════════════════════════════
st += part("7", "Design", "3 slides")

st += sl("Slide 7.1", "Use case diagram")
st += [box("Image to insert",
           "<font name='Mono'>docs/diagrams/01-use-case-global.png</font><br/>"
           "Portrait format (ratio 0.73). On a 16:9 slide, centre it under the title; "
           "do not stretch it."),
       Spacer(1, 4),
       P("<b>What the diagram shows</b>"),
       bul(["<b>9 actors</b> across the three tenancy levels",
            "<b>10 use cases</b> grouped by domain",
            "Two <b>generalisation</b> relationships: the tenant admin inherits from the "
            "employee, the client admin from the manager"]),
       box("Say this", "Point at the receptionist: it is the role most systems do not "
                       "have, and it exists only because a lease is concluded in person.")]

st += sl("Slide 7.2", "Class diagram")
st += [box("Image to insert",
           "<font name='Mono'>docs/diagrams/02b-class-diagram-presentation.png</font><br/>"
           "A <b>landscape, reduced</b> version (ratio 1.96) built for projection: 10 "
           "classes, 3 attributes each. The full diagram "
           "(<font name='Mono'>02-class-diagram.png</font>, 17 classes) is unreadable on "
           "a screen; keep it for the written report."),
       Spacer(1, 4),
       P("<b>What to point out</b>"),
       bul(["The composition chain <b>Tenant " + AR + " Building " + AR + " Floor " + AR +
            " Space</b>: this is the landlord's path",
            "The <font name='Mono'>tenant_id</font> attribute on <b>Booking</b> and "
            "<b>MaintenanceTicket</b>: this is the renter's path",
            "The note attached to Booking, which states the duality"])]
st += [PageBreak()]

st += sl("Slide 7.3", "Sequence diagram  (pick one)")
st += [P("One sequence is enough. Two candidates, depending on what you want to prove."),
       tab([["File", "What it shows", "When to pick it"],
            ["<font name='Mono'>04-sequence-authorisation.png</font>",
             "The 5 authorisation stages of one request, with the refusal branches",
             "For a technical panel: this is the core of the security model"],
            ["<font name='Mono'>06-sequence-booking.png</font>",
             "From public enquiry to signed lease, with the role driving each step",
             "For a business-minded panel: the full operational journey"]],
           [54 * mm, (CW - 54 * mm) / 2, (CW - 54 * mm) / 2], fs=8.3),
       Spacer(1, 4),
       P("All nine diagrams are in <font name='Mono'>docs/diagrams/</font>, as PNG and as "
         "PlantUML source."),
       box("Say this", "Do not project more than two diagrams. A panel disengages in "
                       "front of a run of dense schematics; one well-explained diagram is "
                       "worth more.")]
st += [PageBreak()]

# ═══════════ 8. PROGRESS ════════════════════════════════════════════════════
st += part("8", "Progress", "3 slides")

st += sl("Slide 8.1", "The project in figures")
st += [tab([["25", "30", "55", "9", "252", "43"],
            ["data models", "controllers", "pages", "roles", "tests", "audit probes"]],
           [CW / 6] * 6, fs=9),
       Spacer(1, 5),
       P("In Canva: six aligned tiles, the number very large with the label beneath. "
         "This is the slide that conveys the scale of the work."),
       Spacer(1, 3),
       P("<b>Overall state</b>"),
       bul(["Continuous integration green",
            "Type checking clean on both projects",
            "Full deployment from a single command"])]

st += sl("Slide 8.2", "Work completed")
st += [P("<b>Complete business chain</b>"),
       bul(["Application " + AR + " booking " + AR + " lease " + AR + " invoice " + AR +
            " payment",
            "Maintenance, live notifications, audit trail",
            "Dashboards and analytics per role"]),
       P("<b>Isolation</b>"),
       bul(["All three levels in place and verified",
            "<b>9 defects found and fixed</b>",
            "Arithmetic consistency check (slide 5.6)"]),
       P("<b>Artificial intelligence</b> — beyond the specification"),
       bul(["Automatic ticket triage: category, priority, suggested technician",
            "A space-finding assistant for visitors, in plain language",
            "Reading of administrative documents (trade licence, commercial registration)"]),
       box("The principle adopted for AI",
           "<b>The model proposes, it does not decide.</b> Any value outside the "
           "application's own enumeration is discarded and a keyword classifier takes "
           "over. The suggested technician comes from ticket history, not from the model.")]
st += [PageBreak()]

st += sl("Slide 8.3", "Work not yet done")
st += [tab([["Outstanding item", "State", "Reason"],
            ["Document-reading interface", "Server only",
             "Extraction works; the drag-and-drop into the form remains to be built"],
            ["Scanned documents", "Limited",
             "The configured LLM provider exposes no vision model"],
            ["External marketplaces", "Waiting",
             "Adapters written, credentials not supplied"],
            ["Google Business profile", "On hold", "Requires a verified account held by "
                                                   "the property owner"],
            ["Production email", "Degraded mode",
             "Server IP to be allow-listed with the provider; SMTP fallback active"],
            ["Mobile application", "Out of scope", "The web interface is responsive"]],
           [48 * mm, 26 * mm, CW - 74 * mm], fs=8.3),
       Spacer(1, 4),
       box("Conclusion", "None of these blocks a business journey: each has either a "
                         "degraded mode or a manual equivalent already in place.",
           WARN, WARNW),
       box("Say this", "Do not play this down. A clear-eyed progress report carries more "
                       "weight than a list where everything is declared finished.")]
st += [PageBreak()]

# ═══════════ 9. CONCLUSION ══════════════════════════════════════════════════
st += part("9", "Conclusion and perspectives", "2 slides")

st += sl("Slide 9.1", "The main finding   (dark background slide)")
st += [box("Slide text",
           "<b>None of the nine defects came from a broken security function. Every one "
           "came from a call site that forgot to use it.</b><br/><br/>"
           "And four stayed invisible while the dataset held a single landlord: with one, "
           "“show everything” and “show my portfolio” return the same rows.<br/><br/>"
           "" + AR + " <b>The shape of your test data is part of the security surface.</b>"),
       Spacer(1, 4),
       P("In Canva: background <font name='Mono'>#084449</font>, white text, no illustration."),
       box("Say this", "The turning point of the defence. Deliver it slowly. This is an "
                       "engineering result, not a feature list.")]

st += sl("Slide 9.2", "Assessment and perspectives")
st += [P("<b>Assessment</b>"),
       bul(["A platform that works from anonymous visitor to platform owner",
            "An isolation model that is <b>demonstrable</b>, not merely asserted",
            "AI that is useful and bounded: it proposes, it does not decide",
            "A deployment reproducible from one command"]),
       P("<b>Perspectives</b>"),
       bul(["Build the document upload interface, then move to a vision model for scans",
            "Extend the conversational assistant to the renter's own data, with a suite "
            "of injection tests to demonstrate its limits",
            "Replace the maintenance heuristic with a model trained on ticket history, "
            "measured against that heuristic as the baseline",
            "A mobile application for technicians in the field"]),
       Spacer(1, 4),
       P("<b>Final slide:</b> “Thank you for your attention”, then “Questions”.")]

st += [Spacer(1, 9), HRFlowable(width="100%", thickness=0.4, color=LINE), Spacer(1, 4),
       Paragraph("Figures taken from the database and from a test run on 3 October 2026. "
                 "The images referenced are in <font name='Mono'>docs/diagrams/</font>. "
                 "Section 1 is left as a template: the host organisation and supervisor "
                 "names appear nowhere in the code.",
                 ParagraphStyle("f", fontName="Cal-I", fontSize=8, leading=11,
                                textColor=INK3, alignment=TA_JUSTIFY))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Presentation_Content.pdf")
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=ML, rightMargin=MR,
                      topMargin=MT, bottomMargin=MB,
                      title="LeaseManager — Presentation content")
doc.addPageTemplates([PageTemplate(id="a", frames=[Frame(ML, MB, CW, PH - MT - MB, id="f")],
                                   onPage=deco)])
doc.build(st)
print("PDF:", out)
