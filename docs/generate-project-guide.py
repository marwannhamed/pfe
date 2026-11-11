# -*- coding: utf-8 -*-
"""
How LeaseManager works: the complete guide to the project, for Marwan.

Architecture, data model, security and isolation, every business flow, the
AI features, deployment, tests, a tour of the screens and the questions a
jury tends to ask. Every statement was checked against the code; diagrams
come from docs/diagrams, screens from docs/defense-screens. A4 portrait.

Run from the repository root:  python docs/generate-project-guide.py
"""
import os
import shutil
import tempfile
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, HRFlowable, ListFlowable, ListItem, Image,
                                KeepTogether, CondPageBreak)

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.path.join(HERE, "defense-screens")
# The UML figures come from the PlantUML set: docs/diagrams/*.puml, rendered in docs/diagrams/out.
DIAGRAMS = os.path.join(HERE, "diagrams", "out")
OUT = os.path.join(HERE, "LeaseManager_Project_Guide.pdf")
THUMBS = tempfile.mkdtemp(prefix="guide-img-")

F = "C:/Windows/Fonts/"
for n, f in [("Geo", "georgia.ttf"), ("Geo-B", "georgiab.ttf"), ("Geo-I", "georgiai.ttf"),
             ("Cal", "calibri.ttf"), ("Cal-B", "calibrib.ttf"), ("Cal-I", "calibrii.ttf"), ("Mono", "consola.ttf")]:
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
PURP, PURPW = colors.HexColor("#5B21B6"), colors.HexColor("#F3EEFF")

PW, PH = A4
ML = MR = 18 * mm
MT, MB = 18 * mm, 17 * mm
CW = PW - ML - MR
AR = "<font name='Mono'>\u2192</font>"   # Georgia has no U+2192 glyph


def C(t, size=8.4):
    """Inline code."""
    return "<font name='Mono' size='%s' color='#0C2340'>%s</font>" % (size, t)


S = {
    "part": ParagraphStyle("p", fontName="Cal-B", fontSize=21, leading=25, textColor=colors.white),
    "psub": ParagraphStyle("ps", fontName="Cal", fontSize=10.5, leading=13.5, textColor=colors.HexColor("#A9C6F5")),
    "h": ParagraphStyle("h", fontName="Cal-B", fontSize=13.5, leading=17, textColor=INK, spaceBefore=8, spaceAfter=4, keepWithNext=1),
    "h3": ParagraphStyle("h3", fontName="Cal-B", fontSize=11, leading=14, textColor=ACC2, spaceBefore=5, spaceAfter=2, keepWithNext=1),
    "b": ParagraphStyle("b", fontName="Geo", fontSize=9.5, leading=14.2, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=5),
    "li": ParagraphStyle("li", fontName="Geo", fontSize=9.4, leading=13.6, textColor=INK, alignment=TA_LEFT, spaceAfter=2),
    "th": ParagraphStyle("th", fontName="Cal-B", fontSize=8.3, leading=10.6, textColor=colors.white),
    "td": ParagraphStyle("td", fontName="Geo", fontSize=8.6, leading=12, textColor=INK),
    "say": ParagraphStyle("s", fontName="Geo-I", fontSize=9, leading=13.2, textColor=INK2, alignment=TA_JUSTIFY),
    "cap": ParagraphStyle("cap", fontName="Cal-I", fontSize=8.4, leading=10.8, textColor=INK3, alignment=TA_CENTER, spaceAfter=6),
    "cov": ParagraphStyle("c", fontName="Cal-B", fontSize=30, leading=36, textColor=INK, alignment=TA_CENTER),
    "covs": ParagraphStyle("cs", fontName="Geo-I", fontSize=12, leading=17, textColor=INK2, alignment=TA_CENTER),
    "toc": ParagraphStyle("toc", fontName="Cal", fontSize=11, leading=17, textColor=INK),
    "step": ParagraphStyle("st", fontName="Geo", fontSize=9.3, leading=13.4, textColor=INK, alignment=TA_LEFT),
    "num": ParagraphStyle("nm", fontName="Cal-B", fontSize=10, leading=13, textColor=colors.white, alignment=TA_CENTER),
    "q": ParagraphStyle("q", fontName="Cal-B", fontSize=10, leading=13.5, textColor=ACC2, spaceBefore=6, spaceAfter=2),
}


def deco(cv, doc):
    cv.saveState()
    cv.setFont("Cal", 7.8)
    cv.setFillColor(INK3)
    cv.drawString(ML, MB - 7.5 * mm, "How LeaseManager works \u2014 the complete guide")
    cv.drawRightString(PW - MR, MB - 7.5 * mm, str(doc.page))
    cv.setStrokeColor(LINE)
    cv.setLineWidth(0.4)
    cv.line(ML, MB - 5 * mm, PW - MR, MB - 5 * mm)
    cv.restoreState()


def P(t, s="b"):
    return Paragraph(t, S[s])


def H(t):
    return P(t, "h")


def H3(t):
    return P(t, "h3")


def bul(items):
    return ListFlowable([ListItem(Paragraph(i, S["li"]), leftIndent=11, value="circle") for i in items],
                        bulletType="bullet", bulletFontSize=4.5, bulletOffsetY=-3, leftIndent=11,
                        spaceBefore=1, spaceAfter=5)


def tab(rows, widths, fs=8.6, head=ACC2):
    S["td"].fontSize = fs
    S["td"].leading = fs * 1.4
    data = [[Paragraph(str(x), S["th" if r == 0 else "td"]) for x in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1, spaceBefore=2, spaceAfter=7)
    cm = [("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
          ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
          ("BACKGROUND", (0, 0), (-1, 0), head), ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
          ("BOX", (0, 0), (-1, -1), 0.5, LINE)]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            cm.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cm))
    return t


def box(lbl, txt, tone=ACC, bg=WASH):
    inner = [Paragraph(lbl, ParagraphStyle("bl", fontName="Cal-B", fontSize=8.4, leading=10.8, textColor=tone, spaceAfter=2))]
    inner += [Paragraph(x, S["say"]) for x in (txt if isinstance(txt, list) else [txt])]
    t = Table([[inner]], colWidths=[CW], hAlign="LEFT", spaceBefore=2, spaceAfter=6)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("LINEBEFORE", (0, 0), (0, -1), 2, tone),
                           ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    return t


def onesentence(txt):
    return [Spacer(1, 4), box("In one sentence \u2014 if you can say this, you can explain this part", txt, PURP, PURPW)]


def steps(items, colour=ACC):
    """Numbered steps: [(title, text), ...]"""
    rows = []
    for i, (title, text) in enumerate(items, 1):
        rows.append([Paragraph(str(i), S["num"]), Paragraph("<b>%s</b> \u2014 %s" % (title, text) if title else text, S["step"])])
    t = Table(rows, colWidths=[8 * mm, CW - 8 * mm], hAlign="LEFT", spaceBefore=2, spaceAfter=7)
    cm = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
          ("LEFTPADDING", (1, 0), (1, -1), 7), ("LEFTPADDING", (0, 0), (0, -1), 0), ("RIGHTPADDING", (0, 0), (0, -1), 0)]
    for i in range(len(rows)):
        cm.append(("BACKGROUND", (0, i), (0, i), colour))
        cm.append(("LINEBELOW", (1, i), (1, i), 0.3, LINE))
    t.setStyle(TableStyle(cm))
    return t


def flow(labels, colour=ACC2):
    """A left-to-right chain of boxes with arrows."""
    cells, widths = [], []
    n = len(labels)
    arrow_w = 5 * mm
    box_w = (CW - arrow_w * (n - 1)) / n
    for i, lab in enumerate(labels):
        cells.append(Paragraph("<font color='white'><b>%s</b></font>" % lab,
                               ParagraphStyle("fl", fontName="Cal", fontSize=8.4, leading=10.5, alignment=TA_CENTER)))
        widths.append(box_w)
        if i < n - 1:
            cells.append(Paragraph(AR, ParagraphStyle("fa", fontName="Mono", fontSize=11, leading=13, alignment=TA_CENTER, textColor=ACC)))
            widths.append(arrow_w)
    t = Table([cells], colWidths=widths, hAlign="LEFT")
    cm = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
          ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]
    for i in range(0, len(cells), 2):
        cm.append(("BACKGROUND", (i, 0), (i, 0), colour))
    t.setStyle(TableStyle(cm))
    return t


def _thumb(path, max_w=1500, crop=None):
    """JPEG copy of a screenshot, optionally cropped to (left, top, right, bottom) first."""
    name = os.path.splitext(os.path.basename(path))[0] + ("-crop" if crop else "")
    dst = os.path.join(THUMBS, name + ".jpg")
    if not os.path.exists(dst):
        im = PILImage.open(path).convert("RGB")
        if crop:
            im = im.crop(crop)
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), PILImage.LANCZOS)
        im.save(dst, "JPEG", quality=88)
    return dst


def figure(path, width, caption=None, max_h=None, raw=False):
    """raw keeps the original PNG: diagrams carry fine text that JPEG would blur."""
    src = path if raw else _thumb(path)
    w, h = PILImage.open(src).size
    height = width * h / w
    if max_h and height > max_h:
        width, height = max_h * w / h, max_h
    im = Image(src, width=width, height=height)
    im.hAlign = "CENTER"
    out = [Spacer(1, 3), im]
    if caption:
        out.append(Paragraph(caption, S["cap"]))
    return [KeepTogether(out)]


def diagram(name, width=CW * 0.9, caption=None, max_h=150 * mm):
    return figure(os.path.join(DIAGRAMS, name), width, caption, max_h, raw=True)


def screen(name, width=CW, caption=None, max_h=None):
    return figure(os.path.join(SCREENS, name), width, caption, max_h)


def part(n, title, sub):
    rows = [Paragraph("PART %s" % n, S["psub"]), Paragraph(title, S["part"]), Paragraph(sub, S["psub"])]
    t = Table([[rows]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACC2),
                           ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    return [t, Spacer(1, 6)]


st = []

# ═════════════════════════════════ COVER ════════════════════════════════════
st += [Spacer(1, 26 * mm), P("How LeaseManager works", "cov"), Spacer(1, 4 * mm),
       P("The complete guide to your project: architecture, data, security, every business flow, the AI, "
         "deployment and tests \u2014 and the questions a jury is likely to ask", "covs"),
       Spacer(1, 7 * mm), HRFlowable(width="32%", thickness=0.8, color=LINE, hAlign="CENTER"), Spacer(1, 7 * mm),
       P("LeaseManager \u2014 office lease management platform", "covs"),
       P("Final year project \u00b7 ESPRIT \u00d7 Quicky Prime \u00b7 Marwan Hamed", "covs"),
       Spacer(1, 16 * mm),
       box("How to read this guide",
           ["Parts 1 to 4 are the foundations: what the platform is, how it is built, how its data is shaped and "
            "how it keeps organisations apart. Read them first; everything else rests on them.",
            "Parts 5 and 6 walk through every feature as it actually runs, step by step. Part 7 is how the "
            "project is started, tested and deployed. Part 8 is a tour of the screens. Part 9 prepares the defense: "
            "the questions a jury tends to ask, with answers grounded in the code. Part 10 is a glossary.",
            "Each part ends with an <b>In one sentence</b> box. If you can say those sentences in your own words, "
            "you can explain the whole project."]),
       Spacer(1, 5),
       box("Accuracy", "Every statement was checked against the code on 28 October 2026 \u2014 file names are "
           "given in " + C("monospace") + " so you can open them. Counts that depend on the date (bookings, "
           "invoices) come from the demo data and move a little each day.", OK, OKW),
       PageBreak()]

# ═════════════════════════════════ CONTENTS ═════════════════════════════════
st += [P("Contents", "h")]
for n, t, s in [("1", "The big picture", "what it is, who uses it, the business chain, the demo world"),
                ("2", "Architecture", "the four containers, the life of a request, back end, front end"),
                ("3", "The data model", "25 tables, the two owners of a record, every status"),
                ("4", "Security and isolation", "sign-in, the five checks, keeping competitors apart, the proof"),
                ("5", "The business flows", "visitor, onboarding, the in-person intake, bookings, leases, billing, maintenance"),
                ("6", "The AI features", "maintenance triage, the space finder, document reading, two help assistants"),
                ("7", "Running, testing, deploying", "Docker, nginx, the demo data, tests, CI, commands"),
                ("8", "A tour of the screens", "what each role sees"),
                ("9", "Questions for the defense", "likely questions, with answers"),
                ("10", "Glossary", "the words used in this guide")]:
    st.append(P("<b>%s \u00b7 %s</b> \u2014 <font color='#6B7683'>%s</font>" % (n, t, s), "toc"))
st += [Spacer(1, 10), H("The project in numbers"),
       tab([["", "Figure"],
            ["Organisation", "3 levels of organisation, 9 roles"],
            ["Database", "PostgreSQL 13.5 \u00b7 25 tables \u00b7 36 migrations"],
            ["Back end", "NestJS 11 \u00b7 37 modules \u00b7 30 controllers \u00b7 221 route handlers, all in Swagger"],
            ["Front end", "React 19 + Vite 7 \u00b7 55 page components \u00b7 79 routes (redirects included)"],
            ["Scheduled jobs", "3 \u2014 reminders at 08:00, onboarding emails at 09:00, marketplace listing sync every 15 minutes"],
            ["AI", "1 configurable client \u00b7 5 uses: triage, space finder, document reading, 2 help assistants"],
            ["Demo data", "40 organisations \u00b7 93 users \u00b7 7 buildings \u00b7 123 spaces \u00b7 six months of activity"],
            ["Tests", "281 back-end and 16 front-end unit tests \u00b7 42 live access probes \u00b7 CI on every push"],
            ["Deployment", "4 containers (web, api, postgres, adminer), one command, one origin"]],
           [34 * mm, CW - 34 * mm], fs=8.8),
       PageBreak()]

# ═════════════════════════════════ PART 1 ═══════════════════════════════════
st += part("1", "The big picture", "What LeaseManager is, who uses it, and the chain it automates")
st += [H("1.1 What it is"),
       P("LeaseManager is a web platform for leasing office space in Qatar. <b>Property companies</b> (the "
         "landlords) list offices, desks and meeting rooms in their buildings. <b>Companies looking for space</b> "
         "(the renters) find them on a public map, apply, visit, sign a lease, book rooms, pay rent and report "
         "problems. Everything happens in one application, and amounts are in Qatari riyals (QAR)."),
       P("The difficulty \u2014 and the core of the project \u2014 is that <b>several competing property companies "
         "share one installation</b>. Each must see its own buildings, renters, invoices and tickets, and never a "
         "single row, total or counter belonging to a competitor. A renter company is itself an organisation, with "
         "its own administrator and employees. That makes three levels of organisation, nested."),
       H("1.2 Three levels, nine roles"),
       tab([["Level", "Role in the code", "In the demo", "What they do", "Home page"],
            ["1 \u00b7 Platform", "SUPER_ADMIN", "Youssef Mansour", "Runs the platform; the <b>only</b> role that reads across organisations", C("/admin/dashboard", 7.4)],
            ["2 \u00b7 Landlord", "CLIENT_ADMIN", "Khalid Al-Mansouri", "Owns the company workspace: team, company profile, and everything a manager does", C("/admin/site-dashboard", 7.4)],
            ["2 \u00b7 Landlord", "MANAGER", "Fatima Al-Kuwari", "Buildings, spaces, applications, bookings, contracts, maintenance", C("/admin/site-dashboard", 7.4)],
            ["2 \u00b7 Landlord", "FINANCE", "Omar Haddad", "Invoices, payments to confirm, revenue, exports", C("/admin/finance-dashboard", 7.4)],
            ["2 \u00b7 Landlord", "RECEPTIONIST", "Maria Santos", "Confirmation calls, visits, documents", C("/admin/reception", 7.4)],
            ["2 \u00b7 Landlord", "MAINTENANCE", "Rajesh Nair", "Takes, works and resolves maintenance tickets", C("/admin/maintenance-dashboard", 7.4)],
            ["3 \u00b7 Renter", "TENANT_ADMIN", "Noor Al-Hajri (Acme Corp)", "The renter company's admin: bookings, contracts, billing, team", C("/portal/dashboard", 7.4)],
            ["3 \u00b7 Renter", "TENANT_EMPLOYEE", "Karim Saad (Acme Corp)", "Books rooms, reports problems; sees only their own bookings", C("/portal/dashboard", 7.4)],
            ["\u2014", "GUEST", "any visitor", "Public map, AI space finder, application form \u2014 no account", C("/map", 7.4)]],
           [21 * mm, 35 * mm, 28 * mm, CW - 21 * mm - 35 * mm - 28 * mm - 45 * mm, 45 * mm], fs=8.2),
       P("In the code an organisation is called a <b>tenant</b> (software meaning: one customer of the platform). "
         "The field " + C("tenants.organization_type") + " tells them apart: " + C("CLIENT") + " is a property "
         "company, " + C("RENTER") + " is a renter company. The roles are in " + C("backend/src/constants/enums.ts") + "."),
       H("1.3 The chain the platform automates"),
       flow(["Public map", "Application", "Intake: call, visit, documents", "Lease", "Invoice", "Payment"]),
       Spacer(1, 4),
       bul(["<b>Public map</b> \u2014 a visitor browses published spaces, or asks the AI space finder in plain words.",
            "<b>Application</b> \u2014 the visitor applies for a space; the property manager accepts or refuses.",
            "<b>Intake</b> \u2014 the in-person part of the market: reception calls the applicant, a visit happens, "
            "documents are collected, and the manager finalizes. Each step is a booking state.",
            "<b>Lease</b> \u2014 a contract with a monthly rent; the space becomes reserved, then occupied.",
            "<b>Invoice</b> and <b>payment</b> \u2014 monthly rent and one-off charges in QAR; payments by cash, bank "
            "transfer or cheque, confirmed by finance.",
            "Alongside: <b>maintenance</b> (tickets with AI triage), <b>live notifications</b>, the <b>audit log</b> "
            "and <b>analytics</b> for every role."]),
       H("1.4 The demo world"),
       P("The command " + C("npm run db:seed:full") + " (in " + C("backend/") + ") wipes the database and builds a "
         "realistic Doha in about ten seconds:"),
       tab([["", "Content"],
            ["Property companies", "<b>Msheireb Properties</b> (3 buildings, 52 spaces) \u00b7 <b>West Bay Offices</b> (2 buildings, 32 spaces) \u00b7 <b>Lusail Business Hub</b> (2 buildings, 39 spaces) \u2014 123 spaces in 7 buildings, with real coordinates"],
            ["Renter companies", "20 (Acme Corp, Qatar Fintech, Doha Design Studio\u2026), each with an admin and employees; plus applicants in the intake pipeline and prospects"],
            ["Activity", "About 680 bookings, 490 invoices, 440 payments, 102 maintenance tickets, 450 notifications, 800 audit entries \u2014 six months of history, with dates relative to the day you seed"],
            ["Accounts", "93 users, all with the password " + C("Password123!") + " \u2014 e.g. " + C("manager@msheireb.test") + ", " + C("tenant.admin@acme-corp.test")]],
           [34 * mm, CW - 34 * mm], fs=8.4)]
st += onesentence("LeaseManager lets several competing property companies lease office space to other companies on "
                  "one platform \u2014 from the public map to the collected rent \u2014 while keeping every "
                  "organisation's data strictly its own.")
st += [PageBreak()]

# ═════════════════════════════════ PART 2 ═══════════════════════════════════
st += part("2", "Architecture", "Four containers, one origin, a NestJS API and a React application")
st += [H("2.1 The four containers"),
       P("The whole platform starts with one command, " + C("docker compose up -d") + ", from the repository root "
         "(" + C("docker-compose.yaml") + "). It runs four containers:"),
       tab([["Container", "Technology", "Address on your machine", "Role"],
            ["web", "nginx 1.27 + the React build", C("http://localhost:5173"), "Serves the application and forwards API calls to the api container"],
            ["api", "NestJS 11 on Node 20", C("http://localhost:6001"), "All business rules: REST API, WebSocket gateway, scheduled jobs; Swagger at " + C("/api")],
            ["postgres", "PostgreSQL 13.5", C("localhost:5433"), "The data: 25 tables, created by 36 Prisma migrations"],
            ["adminer", "Adminer", C("http://localhost:8081"), "A database viewer, for development only"]],
           [20 * mm, 40 * mm, 42 * mm, CW - 102 * mm], fs=8.3)]
st += diagram("dep-01-architecture-deployment.png", CW, "Deployment diagram (docs/diagrams/out/dep-01-architecture-deployment.png)", max_h=118 * mm)
st += [H3("One origin"),
       P("The browser only ever talks to " + C("localhost:5173") + ". nginx (" + C("frontend/nginx.conf") + ") "
         "looks at each path: API prefixes such as " + C("/auth") + ", " + C("/bookings") + " or " + C("/billing") +
         " go to the api container; everything else is the React application. Because the page and the API share "
         "one origin, there is no CORS to configure and no server address is baked into the JavaScript bundle. One "
         "special case: " + C("/spaces") + " is both an API path and a public page, so nginx sends a browser "
         "<i>page load</i> (it asks for HTML) to the application and an API call (it asks for JSON) to the API."),
       H("2.2 The life of one request"),
       P("Follow one request: Fatima, the Msheireb property manager, opens the bookings list.")]
st += [steps([
    ("The page asks", "React calls " + C("bookingApi.getAll()") + " (" + C("frontend/src/api/services.ts") + "). The axios "
     "client adds the header " + C("Authorization: Bearer &lt;access token&gt;") + ", read from the browser tab's sessionStorage."),
    ("nginx forwards", C("GET /bookings") + " matches an API prefix, so nginx passes it to " + C("api:6001") + "."),
    ("Middleware", "compression, security headers (Helmet), the CORS check, and the rate limiter when it is enabled (" + C("backend/src/main.ts") + ")."),
    ("Who are you?", C("JwtAuthGuard") + " checks the token's signature and expiry; " + C("JwtStrategy.validate") + " loads the user. A bad or expired token gets 401."),
    ("Are you allowed here?", C("RolesGuard") + " compares the user's role with the route's " + C("@Roles(...)") + " list. Not on it: 403."),
    ("Is the input valid?", "the global " + C("ValidationPipe") + " checks the query and body against the DTO class; any unknown field is rejected with 400."),
    ("What may you see?", "the controller calls " + C("findAllForUser(user, \u2026)") + " in the service, which builds the database filter from the user: a landlord gets the bookings in its buildings, a renter its own, an employee only the ones they made."),
    ("The database", "Prisma turns the filter into a parameterised SQL query for PostgreSQL."),
    ("The answer", C("ResponseInterceptor") + " wraps the result as " + C("{ success, data, \u2026 }") + " and strips any password hash or session token; " + C("PerformanceInterceptor") + " logs the timing; errors go through " + C("HttpExceptionFilter") + " so they all have the same JSON shape."),
    ("Back in the browser", "the client unwraps " + C("data") + ", " + C("mapBookings") + " normalises the field names, TanStack Query caches the list, React renders it."),
])]
st += [Spacer(1, 3),
       P("If the access token has expired, the API answers 401; the client then calls " + C("POST /auth/refresh-token") +
         " <b>once</b> (parallel requests wait for the same refresh) and replays the request with the new token "
         "(" + C("frontend/src/api/client.ts") + ").")]
st += diagram("seq-01b-authentication-refresh-token.png", CW, "Sequence diagram — access-token refresh (docs/diagrams/out/seq-01b-authentication-refresh-token.png)", max_h=105 * mm)
st += [H("2.3 The back end: NestJS modules"),
       P("NestJS organises code in <b>modules</b>. Each feature module has a <b>controller</b> (the HTTP routes, with "
         "decorators for guards and roles), a <b>service</b> (the business rules) and <b>DTOs</b> (classes that describe "
         "and validate the input). Services reach the database through the shared " + C("PrismaService") + ". The "
         "project has 30 controllers exposing about 220 routes, all documented in Swagger."),
       tab([["Area", "Modules (folders in backend/src)", "What they cover"],
            ["Identity and access", "auth, user, tenant, security, common", "Sign-in, sessions, roles, organisations; the guards, the access policy, interceptors and filters live in " + C("common")],
            ["Portfolio", "building, floor, space, addon-service, promotion-code", "Buildings, floors, spaces and their map; extras; discount codes"],
            ["Commercial", "booking-application, booking, lease-contract, billing, forms", "Applications, the booking workflow, contracts, invoices and payments; company applications from Typeform"],
            ["Operations", "maintenance, notification, websocket, audit, mail, brevo, email-sequence, upload", "Tickets, live notifications, the audit log, email delivery, files"],
            ["Insight", "analytics, report, export, search", "Dashboards and trends, saved reports, CSV/Excel exports, global search"],
            ["AI", "ai", "The LLM client, maintenance triage, the space finder, document reading"],
            ["Platform", "prisma, config, logging, performance, monitoring, cache, tasks, marketplace, crisp", "Database access, configuration, logs, timing, caching, scheduled jobs, listing sync, chat widget"]],
           [27 * mm, 58 * mm, CW - 85 * mm], fs=8.2),
       H("2.4 The front end: React"),
       bul(["<b>Stack</b> \u2014 React 19, Vite 7 and TypeScript; Ant Design 6 for components, Recharts for charts, Leaflet for maps.",
            "<b>Routing</b> (" + C("frontend/src/App.tsx") + ") \u2014 public pages (" + C("/") + ", " + C("/map") + ", " + C("/login") + ", " + C("/apply/:spaceId") + "\u2026), "
            "the renter portal under " + C("/portal/*") + " and the staff back office under " + C("/admin/*") + ". Each page is wrapped in a " + C("RoleRoute") +
            " listing the roles allowed in; anyone else is sent to their own home page.",
            "<b>Layout</b> (" + C("layouts/MainLayout.tsx") + ") \u2014 the sidebar menu is built per role, so nobody is offered a page they cannot open.",
            "<b>Talking to the API</b> \u2014 " + C("api/services.ts") + " groups the calls by domain (" + C("bookingApi") + ", " + C("billingApi") + "\u2026); "
            + C("api/client.ts") + " adds the token, unwraps responses and refreshes the session; identical requests already in flight are shared, not repeated.",
            "<b>Data on screen</b> \u2014 TanStack Query fetches, caches and refreshes server data; it does not retry a refused (4xx) request.",
            "<b>State</b> \u2014 Zustand stores: " + C("authStore") + " (the user and tokens, in <b>sessionStorage</b>, so each browser tab holds its own session) and " + C("themeStore") + " (light or dark).",
            "<b>Real time</b> \u2014 the notification bell keeps a Socket.IO connection to " + C("/notifications") + "."])]
st += onesentence("One command starts four containers; nginx serves the React application and forwards API paths to "
                  "NestJS on the same origin, where every request passes the token check, the role check, input "
                  "validation and a role-based data filter before Prisma touches PostgreSQL.")
st += [PageBreak()]

# ═════════════════════════════════ PART 3 ═══════════════════════════════════
st += part("3", "The data model", "25 tables, one schema file, and the idea that one record has two owners")
st += [P("The whole database is described in one file, " + C("backend/prisma/schema.prisma") + ". Prisma "
         "generates a typed client from it, and 36 migrations in " + C("prisma/migrations/") + " create the 25 tables."),
       H("3.1 The 25 tables, by area"),
       tab([["Area", "Tables", "What they hold"],
            ["Organisations and people", "Tenant, User, UserSession, TenantApplication, TenantOnboardingSequence",
             "An organisation (landlord or renter) and its users; one session row per signed-in device; companies applying to rent; their welcome emails"],
            ["Portfolio", "Building, Floor, Space, SpaceFeature, AddOnService, SpaceAddOnService",
             "The landlord's property: a building has floors, a floor has spaces (type, status, prices, map position, published or not); the extras a space offers"],
            ["Commercial", "BookingApplication, BookingApplicationAddOn, Booking, BookingAddOn, BookingDocument, LeaseContract, Invoice, InvoiceLine, Payment, PromotionCode",
             "Applications from the map; bookings with their extras and scanned documents; leases; invoices with their lines; payments; discount codes"],
            ["Operations and insight", "MaintenanceTicket, Notification, AuditLog, Report",
             "Tickets; notifications shown in the bell; the record of every privileged action; saved reports"]],
           [32 * mm, 56 * mm, CW - 88 * mm], fs=8.3),
       H("3.2 One record, two owners"),
       P("This is the single most important idea in the project. A booking belongs to <b>two</b> organisations, by "
         "two different paths:"),
       bul(["<b>The renter</b> owns it through " + C("booking.tenant_id") + " \u2014 \u201cI am the one who booked it.\u201d",
            "<b>The landlord</b> owns it through " + C("booking " + "\u2192" + " space " + "\u2192" + " floor " + "\u2192" + " building.tenant_id") + " \u2014 \u201cthose are my walls.\u201d"]),
       P("The same is true of maintenance tickets, invoices (reached by the landlord through their bookings) and "
         "lease contracts (reached through invoice " + AR + " booking " + AR + " space " + AR + " building). Every "
         "query that serves a landlord must follow the building path; every query that serves a renter follows "
         + C("tenant_id") + ". Mixing the two up is the easiest mistake to make and the hardest to see: with only one "
         "landlord in the data, \u201cshow everything\u201d and \u201cshow my portfolio\u201d return the same rows.")]
st += diagram("class-01-overview.png", CW, "Domain model overview — packages and entities (docs/diagrams/out/class-01-overview.png)", max_h=125 * mm)
st += [H("3.3 Every status, in one table"),
       tab([["Thing", "Values", "Notes"],
            ["Space status", "AVAILABLE \u00b7 OCCUPIED \u00b7 RESERVED \u00b7 MAINTENANCE \u00b7 OUT_OF_SERVICE", "Only AVAILABLE and published spaces reach the public map"],
            ["Space type", "DEDICATED_OFFICE \u00b7 FLEXIBLE_DESK \u00b7 HOT_DESK \u00b7 MEETING_ROOM \u00b7 CONFERENCE_ROOM \u00b7 PHONE_BOOTH \u00b7 EVENT_SPACE", "Offices and desks are leased by the month; rooms and halls are booked by the hour or day"],
            ["Booking (12)", "DRAFT \u00b7 PENDING_APPROVAL \u00b7 PENDING_PHONE_CONFIRMATION \u00b7 AWAITING_PHYSICAL_VISIT \u00b7 DOCUMENTS_PENDING_UPLOAD \u00b7 ACTIVE \u00b7 CONFIRMED \u00b7 CHECKED_IN \u00b7 COMPLETED \u00b7 CANCELLED \u00b7 REFUSED \u00b7 NO_SHOW", "Three of them exist only for the in-person intake (part 5.3)"],
            ["Booking application", "PENDING \u00b7 ACCEPTED \u00b7 REFUSED", ""],
            ["Lease contract", "DRAFT \u00b7 ACTIVE \u00b7 RENEWED \u00b7 EXPIRED \u00b7 TERMINATED", ""],
            ["Invoice", "DRAFT \u00b7 ISSUED \u00b7 SENT \u00b7 PARTIALLY_PAID \u00b7 PAID \u00b7 OVERDUE \u00b7 CANCELLED", "Types: MONTHLY_RENT, ONE_TIME_CHARGE, DEPOSIT, PENALTY, CREDIT"],
            ["Payment", "PENDING \u00b7 COMPLETED \u00b7 FAILED \u00b7 REFUNDED", "Methods: CASH, BANK_TRANSFER, CHECK (and card or online values for payments taken elsewhere)"],
            ["Maintenance ticket", "OPEN \u00b7 ASSIGNED \u00b7 IN_PROGRESS \u00b7 RESOLVED \u00b7 CLOSED \u00b7 CANCELLED", "Priority LOW to EMERGENCY; category PLUMBING, ELECTRICAL, HVAC, CLEANING, FURNITURE, IT_EQUIPMENT, OTHER"],
            ["Organisation", "TRIAL \u00b7 ACTIVE \u00b7 SUSPENDED \u00b7 CLOSED \u00b7 PENDING", "A renter starts in TRIAL when its application is approved"]],
           [30 * mm, 80 * mm, CW - 110 * mm], fs=8.0)]
st += onesentence("Twenty-five tables in one Prisma schema; a booking, a ticket, an invoice or a lease belongs to the "
                  "renter through its tenant_id and to the landlord through the building it sits in \u2014 and every "
                  "query must choose the right path.")
st += [PageBreak()]

# ═════════════════════════════════ PART 4 ═══════════════════════════════════
st += part("4", "Security and isolation", "How a user is recognised, what they may do, and how competitors stay apart")
st += [H("4.1 Signing in and staying signed in"),
       steps([
           ("Login", C("POST /auth/login") + " with email and password. The password is checked with bcrypt against the stored hash (" + C("auth.service.ts") + "). An unknown email and a wrong password get the same 401 answer, so the form cannot reveal which addresses have an account; a wrong password is written to the audit log as a warning."),
           ("A session", "a row is created in " + C("user_sessions") + " \u2014 one per signed-in device \u2014 and two tokens are signed: an <b>access token</b> (JWT, valid " + C("JWT_EXP_IN") + " = 1 day here) and a <b>refresh token</b> (7 days)."),
           ("Every request", "the access token travels in the " + C("Authorization") + " header; the server verifies it and loads the user."),
           ("Refresh", C("POST /auth/refresh-token") + " checks the refresh token against its session row, then issues a new pair and <b>rotates</b> the stored token, so an old refresh token cannot be replayed."),
           ("Logout", "deletes the session row; " + C("/auth/sessions") + " lets a user see and revoke their other devices."),
           ("New accounts", "nobody is ever shown a temporary password: a new admin or employee gets an email link to set their own (" + C("requestPasswordReset") + ")."),
       ]),
       P("In the browser the tokens live in <b>sessionStorage</b>, which belongs to one tab. That is why you can be "
         "Fatima in one tab and Noor in another at the same time, and why closing the tab signs you out."),
       H("4.2 The five checks on every request"),
       tab([["#", "Check", "Where", "Stops"],
            ["1", "Token", C("JwtAuthGuard") + " + " + C("JwtStrategy"), "Anyone not signed in (401)"],
            ["2", "Role", C("RolesGuard") + " + " + C("@Roles(...)") + " on the route", "A signed-in user calling a route their role may not use (403)"],
            ["3", "Input", "global " + C("ValidationPipe") + " (whitelist, forbid unknown fields)", "Malformed input and extra fields such as a forged " + C("role") + " (400)"],
            ["4", "Ownership", "the service's " + C("\u2026ForUser") + " methods", "Reading or changing a record of another organisation (403 or 404)"],
            ["5", "Data filter", C("AccessPolicyService") + " and per-service filters", "Lists and totals that would include other organisations' rows"]],
           [7 * mm, 26 * mm, 62 * mm, CW - 95 * mm], fs=8.4),
       P("Check 5 is where isolation really lives. For every list, the service turns the user into a Prisma " + C("where") +
         ". " + C("isCrossTenantReader") + " is true for the platform owner only; for everyone else the filter "
         "names their organisation \u2014 through " + C("tenant_id") + " for a renter, through the building for a landlord:"),
       tab([["List", "Landlord staff see\u2026", "Renter sees\u2026"],
            ["Spaces", "spaces whose floor's building is theirs", "available spaces (any landlord) \u2014 that is how they book"],
            ["Bookings", "bookings on spaces in their buildings", "their organisation's bookings; an employee only their own"],
            ["Invoices", "invoices linked to bookings in their buildings", "their own invoices"],
            ["Contracts", "contracts whose invoices reach their buildings", "their own contracts"],
            ["Tickets", "tickets on spaces in their buildings", "their own tickets"],
            ["Analytics", "the same building paths, for every chart and total", "their own figures"]],
           [22 * mm, 70 * mm, CW - 92 * mm], fs=8.3),
       H("4.3 The other protections"),
       bul(["<b>Security headers</b> (Helmet) and a <b>CORS</b> allow-list (" + C("main.ts") + ").",
            "<b>Rate limiting</b> — a global limit per IP address (on in production; in development only with " + C("RATE_LIMIT_ENABLED=true") + "), plus tighter limits on single routes with " + C("@RateLimit") + ", always on: 5 guest applications per minute per IP, 30 to 50 searches per minute.",
            "<b>No secrets in responses</b> \u2014 the response interceptor removes password hashes and refresh tokens from every user object it sends (" + C("common/interceptors/response.interceptor.ts") + ").",
            "<b>Injection</b> \u2014 every query goes through Prisma, which parameterises it.",
            "<b>Live notifications</b> \u2014 the Socket.IO gateway verifies the token on connection and only lets a client into its own user, organisation and role rooms (" + C("websocket/notifications.gateway.ts") + ").",
            "<b>Webhooks</b> \u2014 a Typeform submission is accepted only with a valid signature.",
            "<b>Audit log</b> \u2014 privileged actions are recorded with the actor, organisation, IP address and a severity (INFO to CRITICAL).",
            "<b>Uploads</b> \u2014 ownership is checked before a file is written (" + C("upload.controller.ts") + "); files go to Cloudinary when it is configured, otherwise (or if Cloudinary fails) to local storage. A document sent to the AI reader is held in memory for the request only and never stored."]),
       H("4.4 How the isolation is proved"),
       bul(["<b>The access audit</b> \u2014 " + C("npm run audit:access") + " (in " + C("backend/") + ") signs in as real users of competing companies and fires <b>42 probes</b> in 7 groups at the running server: reads limited to your own organisation, forged organisation ids refused, out-of-reach records, writes against another organisation, each landlord seeing only its own portfolio, the public space finder unable to reach past the map, and self-promotion to platform owner refused. All 42 pass.",
            "<b>The arithmetic check</b> \u2014 each landlord's totals (spaces 52 + 32 + 39, tickets 48 + 30 + 24, revenue) add up <i>exactly</i> to the platform's totals. If anything leaked or was counted twice, the sum would not close.",
            "<b>Unit tests</b> \u2014 the filters themselves are tested (" + C("access-policy.service.spec.ts") + ", " + C("analytics.service.spec.ts") + ", " + C("export.service.spec.ts") + "\u2026)."]),
       box("The lesson of the project",
           "None of the cross-tenant defects found during development came from a broken security function. Every "
           "one came from a call site that forgot to use it \u2014 and several stayed invisible while the test data "
           "held a single landlord. The shape of the test data is part of the security surface.", WARN, WARNW)]
st += onesentence("Every request is checked five times \u2014 token, role, input, ownership and a data filter built "
                  "from the user \u2014 and the isolation is proved by 42 live probes and by totals that add up "
                  "exactly across the three competing landlords.")
st += [PageBreak()]

# ═════════════════════════════════ PART 5 ═══════════════════════════════════
st += part("5", "The business flows", "Every feature as it actually runs, step by step")
st += [H("5.1 A visitor finds a space"),
       steps([
           ("The map", C("/map") + " loads " + C("GET /spaces/public/map") + ": only spaces that are published, available and placed on the map. No account is needed. Clicking a pin opens the space: photos, monthly rent in QAR, features, transport notes."),
           ("Or ask", "the <b>space finder</b> (" + C("POST /public/space-finder") + ") takes a request in plain words, such as \u201can office in Msheireb for 8 people\u201d, and answers with real listings (part 6.2)."),
           ("Apply", C("/apply/:spaceId") + " sends " + C("POST /booking-applications/guest") + ": who is applying (a person or a company), contact details, start date, duration, headcount, optional add-ons. The application is stored as PENDING and the landlord's managers are notified."),
       ])]
st += screen("01-public-map.png", CW * 0.9, "The public map with a space open")
st += [H("5.2 A company joins the platform"),
       P("Companies can also apply through a <b>Typeform</b> questionnaire. Typeform calls " + C("POST /webhooks/typeform") +
         "; the request is accepted only with a valid signature."),
       steps([
           ("Arrive", "the submission creates the company as a RENTER organisation in <b>PENDING</b> status, and a <b>tenant application</b> addressed to the property company it applied to (" + C("forms/typeform-webhook.service.ts") + ")."),
           ("Review", "that company's manager sees it under Tenant Applications, and approves it or rejects it (with an optional reason)."),
           ("Approve", "one database transaction moves the organisation to <b>TRIAL</b>, marks the application APPROVED and creates the company's TENANT_ADMIN user, whose stored password is a random hash nobody knows (" + C("forms/tenant-application.service.ts") + ")."),
           ("First sign-in", "the new admin receives an email link to choose a password \u2014 no temporary password is ever shown or sent."),
       ]),
       H("5.3 The in-person intake: from application to lease"),
       P("This is the part of the market that existing products ignore: in Qatar a lease is concluded face to face. "
         "The platform turns each step into a booking state, and has a receptionist role to carry it."),
       steps([
           ("Accept", "the manager accepts a booking application (" + C("PATCH /booking-applications/:id/accept") + "). In one transaction the platform creates the applicant's organisation and account if needed, creates a booking in <b>PENDING_PHONE_CONFIRMATION</b>, assigns a receptionist of that landlord, and marks the space <b>RESERVED</b>. Refusing instead records a reason."),
           ("Call", "reception calls the applicant. Reached: " + C("phone-confirmed") + " " + AR + " <b>AWAITING_PHYSICAL_VISIT</b>, and the applicant is emailed visit instructions. Unreachable: the booking becomes <b>REFUSED</b> and the space AVAILABLE again."),
           ("Visit", "after the visit, " + C("mark-documents-pending") + " " + AR + " <b>DOCUMENTS_PENDING_UPLOAD</b>."),
           ("Documents", "reception or a manager attaches the scans to the booking, at most 5: copy of the commercial registration (CR), copy of the Qatar ID (QID), trade licence, proof of payment — and the <b>signed lease</b>, which is mandatory."),
           ("Finalize", "the manager finalizes (" + C("PATCH /bookings/:id/finalize") + "): the booking becomes <b>ACTIVE</b>, the space RESERVED and unpublished, and the renter is emailed."),
       ])]
st += diagram("stm-01-booking.png", CW, "State machine diagram — Booking (docs/diagrams/out/stm-01-booking.png)", max_h=150 * mm)
st += [H("5.4 Booking a room"),
       P("Renters book meeting rooms, conference rooms, desks and event halls themselves \u2014 from the Floor Map, "
         "the calendar or the bookings page."),
       steps([
           ("Create", C("POST /bookings") + ": the server checks the space exists, the head count fits its capacity, and the time slot does not overlap another booking (" + C("checkAvailability") + ") <b>before</b> writing. A renter's booking starts in <b>PENDING_APPROVAL</b>; staff bookings are confirmed directly unless the space requires approval."),
           ("Approve", "the landlord's manager approves (" + C("PATCH /bookings/:id/approve") + ") " + AR + " <b>CONFIRMED</b>: the renter is emailed and notified, and an invoice is issued automatically. Rejecting records a reason."),
           ("Use", "check-in " + AR + " <b>CHECKED_IN</b>, check-out " + AR + " <b>COMPLETED</b>. A booking can also be cancelled. Every booking blocks its slot except cancelled, refused and no-show ones."),
       ]),
       H("5.5 Leases"),
       P("A lease contract (" + C("lease-contract") + " module) has a number such as " + C("CT-202510-92650B86") + ", dates and a "
         "monthly rent. It moves from <b>DRAFT</b> to <b>ACTIVE</b>, and ends as <b>EXPIRED</b>, <b>TERMINATED</b> or "
         "<b>RENEWED</b>. A contract can be generated from a confirmed booking; signing a DRAFT makes it ACTIVE. When a "
         "company signs its <b>first</b> lease, an onboarding email sequence starts, and a job at 09:00 each morning "
         "sends the next email (" + C("email-sequence") + "). Every morning at 08:00 another job (" + C("tasks/scheduled.service.ts") +
         ") marks leases past their end date EXPIRED and reminds renters of leases ending in 60, 30 and 7 days; the renewals page lists them for staff."),
       H("5.6 Billing and payments"),
       bul(["<b>Invoices</b> have lines, a total in QAR and a type: monthly rent, one-off charge (rooms, events, extras), deposit, penalty or credit. Promotion codes give a percentage or a fixed discount; codes are unique per landlord, so two landlords can both run SUMMER25.",
            "<b>No payment gateway.</b> In this market rent is paid by cash, bank transfer or cheque, so the platform <i>records</i> payments rather than processing them.",
            "<b>A renter reports a payment</b> " + AR + " it is stored as <b>PENDING</b> (a cheque can carry a scanned copy).",
            "<b>Finance confirms it</b> (" + C("PATCH /billing/payments/:id/confirm") + ") " + AR + " <b>COMPLETED</b>, with the name of who confirmed. The invoice then updates itself: fully covered becomes <b>PAID</b>, partly covered <b>PARTIALLY_PAID</b>.",
            "<b>Overdue</b> \u2014 at 08:00 each morning the job marks unpaid invoices past their due date <b>OVERDUE</b>, then emails reminders 1, 7 and 14 days after the due date.",
            "<b>Refunds</b> mark a payment REFUNDED and keep the history."]),
       H("5.7 Maintenance"),
       steps([
           ("Report", C("POST /maintenance") + ". A renter can only report on spaces it has booked or leased \u2014 an isolation rule hidden inside a feature."),
           ("Triage", "while the report is typed, the AI suggests a category, a priority and a technician (part 6.1)."),
           ("Assign or accept", "a manager assigns a technician (" + AR + " ASSIGNED), or a technician takes a ticket from the open queue with <b>Accept</b>; once taken, another technician cannot claim it."),
           ("Work", "start " + AR + " <b>IN_PROGRESS</b>, resolve (with an optional cost) " + AR + " <b>RESOLVED</b>, close " + AR + " <b>CLOSED</b>. Each change notifies the people concerned."),
       ]),
       H("5.8 Notifications"),
       P("A notification is first saved in the database, then pushed live over Socket.IO to the namespace "
         + C("/notifications") + ". When the bell connects, the gateway verifies the token and places the client in "
         "three rooms: its user, its organisation and its role, so a message can target one person, a company or "
         "every manager. Emails go out through Brevo, or SMTP, or are logged to the console when neither is "
         "configured \u2014 the platform never fails because email is down."),
       H("5.9 Dashboards, analytics and exports"),
       bul(["<b>One dashboard per role</b>: platform owner, property manager, finance, technician, reception, renter.",
            "<b>Analytics</b> (" + C("analytics.service.ts") + "): revenue trend, bookings by status, top spaces, revenue by renter, all scoped as in part 4.",
            "<b>Revenue forecast</b>: for each of the next 12 months, the rent of the active and renewed leases running that month and the rent that expires that month; plus the leases ending within 120 days.",
            "<b>Occupancy heatmap</b>: for each space of a building, the share of bookable hours (08:00\u201322:00 Doha time, every day) that was booked (" + C("utils/working-hours.ts") + ").",
            "<b>Predictive maintenance</b>: a risk score from 0 to 100 for each open ticket \u2014 20 to start, +12 for each other ticket on the same space in the last 120 days (at most +40), +25 if urgent or emergency, +15 above 4,000 usage hours, +5 per year of equipment age (at most +25). 70 and above is <i>high</i>, 45 and above <i>watch</i>. A transparent rule, not a trained model.",
            "<b>Exports</b>: bookings, invoices, payments, tickets, spaces and organisations as CSV or Excel, limited to the caller's scope.",
            "<b>Audit log</b> and <b>global search</b> for the platform owner and staff."])]
st += onesentence("A visitor finds a space and applies; the manager accepts; reception calls and receives the visit; "
                  "the signed lease is uploaded and the booking becomes active; then rent is invoiced in QAR, the "
                  "renter reports a payment, finance confirms it, and maintenance runs alongside with AI triage.")
st += [PageBreak()]

# ═════════════════════════════════ PART 6 ═══════════════════════════════════
st += part("6", "The AI features", "The model proposes; the application decides")
st += [P("All AI calls go through one client, " + C("ai/openai.service.ts") + ". It speaks the OpenAI API, so the "
         "provider is a setting: " + C("OPENAI_BASE_URL") + " points at <b>Groq</b> and " + C("OPENAI_MODEL") + " is "
         + C("openai/gpt-oss-120b") + ". Changing provider is configuration, not code."),
       P("Without an API key, nothing in the business stops: triage falls back to its keyword classifier, the space "
         "finder still searches (using the district named in the visitor's own words) and answers with a fixed "
         "sentence, document reading returns no fields, and the two help assistants say they are unavailable."),
       H("6.1 Maintenance triage"),
       steps([
           ("Classify", "the title and description go to the model, which must answer with a category and a priority (" + C("maintenance-triage.service.ts") + ")."),
           ("Validate", "if either value is not in the application's own list, the whole answer is discarded and a <b>keyword classifier</b> decides instead. The suggestion shows its source: \u201cAI\u201d or \u201ckeyword match\u201d."),
           ("Name a technician \u2014 without the model", "for staff who can assign, the technician comes from ticket history: among the landlord's active technicians, score = 10 \u00d7 tickets they resolved in that category \u2212 6 \u00d7 tickets they have open; a tie goes to the lighter load. The reason is shown, e.g. \u201cRajesh Nair \u2014 9 electrical tickets resolved, 2 open now\u201d."),
           ("Similar fixes", "the three most recent resolved or closed tickets of the same category in the landlord's buildings are listed for reference."),
           ("Apply", "the manager applies the suggestion or ignores it; submitting a ticket never depends on the model."),
       ])]
_tri = _thumb(os.path.join(SCREENS, "08-ai-ticket-triage.png"), max_w=1200, crop=(812, 152, 1588, 1284))
_tw, _th = PILImage.open(_tri).size
_tri_w = 80 * mm
_note = ParagraphStyle("tn", fontName="Geo", fontSize=8.9, leading=12.6, textColor=INK, spaceAfter=6)
_noteh = ParagraphStyle("tnh", fontName="Cal-B", fontSize=9.5, leading=12, textColor=ACC2, spaceAfter=4)
_tri_notes = [
    Paragraph("Reading the suggestion", _noteh),
    Paragraph("<b>Suggested \u00b7 AI</b> \u2014 where the answer came from. It reads \u201ckeyword match\u201d when the "
              "model was not used or its answer was refused.", _note),
    Paragraph("<b>Electrical \u00b7 Emergency</b> \u2014 category and priority, proposed by the model and accepted "
              "because both are in the application's own lists. <b>Apply</b> copies them into the form.", _note),
    Paragraph("<b>Rajesh Nair \u2014 9 electrical tickets resolved, 2 open now</b> \u2014 the technician, chosen from "
              "ticket history by the score above, never by the model. <b>Assign to them</b> uses it.", _note),
    Paragraph("<b>3 similar fixes in your buildings</b> \u2014 past tickets of the same kind, from this landlord's "
              "buildings only.", _note),
    Spacer(1, 4),
    Paragraph("Why the technician is not the model's choice: a model asked to name a person invents people who do "
              "not work here, and a manager has to be able to defend the choice. \u201c9 tickets resolved, 2 open\u201d "
              "is a reason.", S["say"]),
]
_tri_img = Table([[Image(_tri, width=_tri_w, height=_tri_w * _th / _tw)]], colWidths=[_tri_w],
                 style=[("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0)])
_tri_tab = Table([[_tri_img, _tri_notes]],
                 colWidths=[_tri_w + 6 * mm, CW - _tri_w - 6 * mm], hAlign="LEFT", spaceBefore=4, spaceAfter=4)
_tri_tab.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                              ("RIGHTPADDING", (0, 0), (0, 0), 6 * mm), ("RIGHTPADDING", (1, 0), (1, 0), 0),
                              ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
st += [KeepTogether([_tri_tab, Paragraph("Triage of a new ticket, as the Msheireb manager sees it", S["cap"])]),
       H("6.2 The space finder"),
       P("A public, unauthenticated chat on the map (" + C("ai/space-finder.service.ts") + "). It works in three stages, and the middle one is the point:"),
       steps([
           ("Understand", "the model turns the conversation into criteria: space type, head count, monthly budget, area (a city, district or building such as Msheireb) and up to four keywords such as \u201cparking\u201d. A type that does not exist or a number that is not a positive figure is dropped; if the model names no area, the visitor's own words are searched for known districts."),
           ("Search \u2014 without the model", "a plain Prisma query, always limited to the public filter (published, available, on the map), applies the criteria. If nothing matches, it drops the budget and size; if still nothing, the area too \u2014 and the reply says so."),
           ("Reply", "the model writes at most three sentences about the rows the query returned. Its instructions forbid mentioning any other space, price or feature."),
       ]),
       P("This is what makes it safe to expose: a visitor can write instructions aimed at the model and make it "
         "<i>say</i> anything, but cannot make it <i>read</i> anything beyond the public listings, because the model "
         "never selects data. The access audit tries four prompt-injection attacks; all fail."),
       H("6.3 Reading documents"),
       P(C("POST /ai/documents/extract") + " reads an uploaded PDF — a trade licence, a commercial registration, a "
         "Qatar ID or a cheque — and returns the fields a manager would otherwise retype, with a confidence and "
         "the list of fields it could not find. The text is taken from the PDF locally (" + C("pdf-parse") + "), and "
         "only that text goes to the model. A scan or a phone photo has no text layer, so it is reported as unreadable "
         "rather than guessed; reading it would need a vision model. The server side is done; no screen calls it yet."),
       H("6.4 Two help assistants"),
       bul(["<b>Lease questions</b> — a card under the contracts list for staff (" + C("POST /ai/lease-assistant") + "): plain-language answers about leases, told never to invent legal facts and to recommend checking with counsel.",
            "<b>Renter help</b> — a chat button on every page of the renter portal (" + C("POST /ai/tenant-assistant") + "): how to book, pay, report a problem; for anything about policy it sends the renter to their property manager.",
            "Both are general help. The model receives the conversation and the user's role — never a row from the "
            "database — so there is nothing it could leak."]),
       box("The principle, in the project's words",
           "The model proposes, it does not decide. Any value outside the application's own lists is discarded and a "
           "rule takes over; people are chosen from history, not by the model; and the model only ever sees data the "
           "query already returned.")]
st += onesentence("One configurable AI client serves ticket triage, the public space finder, document reading and "
                  "two help assistants; the model only proposes \u2014 its answers are checked against the "
                  "application's lists, people are chosen from history, and it never selects data itself.")
st += [PageBreak()]

# ═════════════════════════════════ PART 7 ═══════════════════════════════════
st += part("7", "Running, testing, deploying", "Commands, configuration, the demo data, tests and CI")
st += [H("7.1 Starting the platform"),
       tab([["Task", "Command (PowerShell, from the repository root)"],
            ["Start everything", C("docker compose up -d") + "  \u2014 add " + C("--build") + " after changing code"],
            ["Status", C("docker compose ps") + "  \u2014 api, postgres and web should all say \u201chealthy\u201d"],
            ["Fresh demo data", C("cd backend") + " then " + C("npm run db:seed:full") + "  (about 10 s)"],
            ["API logs", C("docker compose logs api --tail 50")],
            ["Access audit", C("cd backend") + " then " + C("npm run audit:access") + "  (42 probes against the running server)"],
            ["Tests", C("cd backend; npx jest") + "  and  " + C("cd frontend; npx vitest run")],
            ["Dev servers instead", C("docker compose stop api web") + ", then " + C("npm run start:dev") + " in " + C("backend/") + " (port 6001) and " + C("npm run dev") + " in " + C("frontend/") + " (port 5173; Vite forwards the API paths to 6001)"]],
           [34 * mm, CW - 34 * mm], fs=8.4),
       Spacer(1, 4),
       tab([["Address", "What it is"],
            [C("http://localhost:5173"), "The application (public home page)"],
            [C("http://localhost:5173/map"), "Public map, no account"],
            [C("http://localhost:5173/login"), "Sign-in \u2014 every demo account uses " + C("Password123!")],
            [C("http://localhost:5173/api"), "Swagger: every API route, with a \u201cTry it out\u201d button"],
            [C("http://localhost:6001/health"), "API health check"],
            [C("http://localhost:8081"), "Adminer \u2014 server " + C("postgres") + ", database " + C("lease_management")]],
           [52 * mm, CW - 52 * mm], fs=8.4),
       H("7.2 How the containers are put together"),
       bul(["<b>api</b> is built from " + C("backend/Dockerfile.dev") + ": it installs dependencies, generates the Prisma client, then at start-up applies pending migrations (" + C("prisma migrate deploy") + "), seeds only if the database is empty, and runs NestJS in watch mode. The source folder is mounted, so code changes reload.",
            "<b>web</b> is built in two stages from " + C("frontend/Dockerfile") + ": a Node stage runs " + C("npm run build") + " (type check + Vite), then an nginx stage serves the result with " + C("frontend/nginx.conf") + ".",
            "<b>postgres</b> keeps its data in a named volume, so it survives restarts.",
            "Configuration comes from " + C("backend/.env") + ": database URL, JWT secrets and lifetimes, AI provider and model, Brevo/SMTP, Cloudinary, Typeform secret, rate limiting. Secrets never go in the code."]),
       H("7.3 The demo data generator"),
       P(C("backend/prisma/seed-full.ts") + " builds the whole demo world described in part 1.4. Two design choices "
         "make it reliable: it is <b>deterministic</b> (a seeded random generator, so the same names and numbers come "
         "back every time) and its dates are <b>relative to today</b> (so \u201cthis week\u201d, due dates and expiring "
         "leases always make sense). Certain scenes are pinned for the demo: Acme's Conference 7 request waiting for "
         "approval, Wakra Coffee Roasters waiting for a call, Rumaila Consulting Group ready to finalize, Brightpath's "
         "QAR 29,600 cheque waiting for finance, the emergency leak in the Zubarah Room."),
       H("7.4 Tests and continuous integration"),
       tab([["Kind", "Tool", "Count", "What it covers"],
            ["Server unit tests", "Jest", "281 in 23 suites", "Access policy, analytics scoping, bookings, billing, contracts, exports, AI (classifier, space finder), auth, interceptors\u2026"],
            ["Client unit tests", "Vitest", "16", "The API client (unwrapping, token refresh) and the month bucketing behind the charts"],
            ["Live access audit", "Node script", "42 probes", "Cross-organisation reads and writes, forged ids, space finder injection, privilege escalation"],
            ["Type checking", "TypeScript", "both projects", "Clean; part of the web build"]],
           [30 * mm, 22 * mm, 26 * mm, CW - 78 * mm], fs=8.3),
       P("<b>GitHub Actions</b> (" + C(".github/workflows/ci.yml") + ") runs on every push to main and every pull "
         "request: back end \u2014 lint, tests with coverage, build; front end \u2014 lint, type check, tests with "
         "coverage, build; plus a dependency security audit.")]
st += onesentence("Docker Compose starts the stack with one command; a deterministic seed builds a realistic demo "
                  "dated relative to today; 297 unit tests, 42 live access probes and a CI pipeline on every push "
                  "keep it honest.")
st += [PageBreak()]

# ═════════════════════════════════ PART 8 ═══════════════════════════════════
st += part("8", "A tour of the screens", "What each role sees \u2014 captured from the running application")
TOUR = [
    ("02-ai-space-finder.png", "<b>Visitor</b> \u2014 the space finder answering \u201can office in Msheireb for 8 people\u201d with real listings."),
    ("04-owner-dashboard.png", "<b>Platform owner</b> \u2014 every organisation: 123 spaces, 22 active organisations, renewals."),
    ("05-manager-dashboard.png", "<b>Property manager</b> \u2014 the same screens, scoped to Msheireb: 52 spaces, occupancy per building."),
    ("06-booking-applications.png", "<b>Property manager</b> \u2014 applications from the public map, to accept or refuse."),
    ("07-reception-pipeline.png", "<b>Reception</b> \u2014 who to call, who is awaiting a visit, whose documents are missing."),
    ("09-isolation-msheireb.png", "<b>Msheireb's manager</b> \u2014 48 maintenance tickets\u2026"),
    ("10-isolation-west-bay.png", "<b>West Bay's manager</b> \u2014 \u2026and on the same screen, 30 different ones. No overlap."),
    ("11-finance-payments.png", "<b>Finance</b> \u2014 payments by method, to confirm; amounts in QAR."),
    ("12-renter-portal.png", "<b>Renter admin</b> \u2014 Acme Corp's own portal: bookings, lease, invoices, team."),
    ("17-employee-floor-map.png", "<b>Renter employee</b> \u2014 the floor map: available rooms with capacity, price and \u201cTap to book\u201d."),
    ("15-occupancy-heatmap.png", "<b>Analytics</b> \u2014 the occupancy heatmap of Barahat Tower."),
    ("16-audit-logs.png", "<b>Audit trail</b> \u2014 who did what, from which organisation and IP address."),
]
w = (CW - 6 * mm) / 2
rows, row = [], []
for name, cap in TOUR:
    src = _thumb(os.path.join(SCREENS, name))
    iw, ih = PILImage.open(src).size
    im = Image(src, width=w, height=w * ih / iw)
    row.append([im, Spacer(1, 2), Paragraph(cap, ParagraphStyle("tc", fontName="Cal", fontSize=8.4, leading=11, textColor=INK2))])
    if len(row) == 2:
        rows.append(row)
        row = []
g = Table(rows, colWidths=[w + 3 * mm, w + 3 * mm], hAlign="LEFT")
g.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                       ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
st += [g, PageBreak()]

# ═════════════════════════════════ PART 9 ═══════════════════════════════════
st += part("9", "Questions for the defense", "What a jury tends to ask, and answers grounded in the code")
QA = [
    ("What stops one company from seeing another's data?",
     "Five checks on every request: the token (JwtAuthGuard), the role (RolesGuard and @Roles), input validation "
     "that rejects unknown fields, an ownership check in the service, and a data filter built from the user by the "
     "access policy. Only the platform owner reads across organisations. A landlord reaches records through its "
     "buildings, a renter through tenant_id."),
    ("How do you know the isolation works?",
     "By measurement. npm run audit:access fires 42 probes at the running server as users of competing companies; "
     "all pass. And each landlord's totals add up exactly to the platform totals \u2014 52 + 32 + 39 spaces, 48 + 30 "
     "+ 24 tickets \u2014 so nothing leaks and nothing is counted twice. 297 unit tests cover the filters themselves."),
    ("Why one shared database rather than one database per company?",
     "Row-level isolation keeps one schema, one migration chain and one deployment, and the platform owner can "
     "still report across companies. The cost is discipline: every query must carry the right filter \u2014 which is "
     "exactly why the filters are centralised in the access policy and proved by the audit."),
    ("What was the hardest bug?",
     "One comparison that was wrong in both directions: the ticket detail check compared tenant_id, which on a "
     "ticket is the renter's organisation. It refused staff every ticket in their own buildings while allowing a "
     "rival's. The fix was to follow the building path."),
    ("Why NestJS and Prisma?",
     "NestJS guards and decorators make access control declarative, route by route \u2014 the problem this project "
     "has. Prisma gives typed queries and migrations, and parameterises every query, so SQL injection is not reachable."),
    ("How do sessions work, and why sessionStorage?",
     "A login creates a session row and two tokens: an access token for requests and a refresh token that is "
     "rotated on every refresh. sessionStorage is per tab: you can hold a manager and a renter in two tabs, and "
     "closing the tab ends the session."),
    ("Is the AI reliable?",
     "It is not trusted. Any value outside the application's own lists discards the answer and a keyword classifier "
     "takes over; the technician comes from ticket history, never from the model; the space finder's model never "
     "selects data, so prompt injection cannot reach anything beyond the public listings. Without an API key "
     "the business still runs: tickets are classified by keywords and the space finder still searches."),
    ("Why no online payment?",
     "It is a requirement taken from the market: rent here is paid by cheque or bank transfer, so the platform "
     "records payments and finance confirms them, with the name of who confirmed. A payment gateway would add cost "
     "and solve a problem this market does not have."),
    ("Why a receptionist role?",
     "Because a lease is concluded in person: a confirmation call, then a site visit, then documents. The role "
     "exists to carry those steps, and each step is a booking state."),
    ("How is double booking prevented?",
     "An overlap check runs before the booking is written, and the head count is checked against the room's "
     "capacity. A slot that overlaps a live booking is refused, not warned about afterwards."),
    ("Why Scrum?",
     "Because the requirements moved: the specification asked for one level of multi-tenancy and the business "
     "needed two. Short sprints with a working increment reviewed by the company let that be discovered early."),
    ("How would it scale?",
     "Sessions are database rows, not server memory, so a second API container can run behind nginx. Three things "
     "would then move to a shared store such as Redis: the rate-limit counters, the small search cache, and the "
     "Socket.IO rooms (an adapter, so a notification reaches a browser connected to the other container). With the "
     "demo volume pages load in under two seconds, helped by the client sharing identical requests in flight. For "
     "real volume, the next steps are server-side pagination on the large lists (bookings, invoices, which are "
     "loaded whole today) and indexes on the foreign keys the access filters follow \u2014 PostgreSQL does not "
     "create those automatically."),
    ("What is not finished?",
     "The document upload interface (the server side works), scanned documents (they need a vision model), the "
     "external marketplace adapters (vendor APIs pending), the Google Business profile (needs the owner's verified "
     "account), production email (Brevo needs the server's address allow-listed; a fallback is active), and a "
     "mobile app (out of scope; the site is responsive). None of these blocks a business journey."),
    ("What would you do next?",
     "The document intake interface with a vision model; extending the assistant to the renter's own data with a "
     "full prompt-injection test suite; replacing the triage heuristic with a model trained on ticket history, "
     "measured against the heuristic; and a mobile app for technicians."),
]
for q, a in QA:
    st += [KeepTogether([P(q, "q"), P(a, "b")])]
st += [PageBreak()]

# ═════════════════════════════════ PART 10 ══════════════════════════════════
st += part("10", "Glossary", "The words used in this guide")
GL = [
    ("Access token / refresh token", "Two signed JWTs. The access token proves who you are on each request; the refresh token gets a new pair when it expires."),
    ("AccessPolicyService", "The class in common/services that turns a user into database filters for spaces, floors, buildings and bookings."),
    ("Booking application", "A request for a space, sent from the public map; accepted or refused by the manager."),
    ("CLIENT / RENTER", "The two kinds of organisation: a property company (landlord) or a company renting space."),
    ("Controller / service / DTO", "NestJS building blocks: routes, business rules, validated input."),
    ("Cross-tenant", "Crossing from one organisation's data into another's \u2014 what isolation prevents."),
    ("Guard", "A NestJS class that decides whether a request may reach a route (JwtAuthGuard, RolesGuard)."),
    ("Interceptor", "A NestJS class that wraps every response (ResponseInterceptor) or measures it (PerformanceInterceptor)."),
    ("Intake", "The in-person sequence before a lease: call, visit, documents, finalize."),
    ("JWT", "JSON Web Token: a signed piece of text carrying the user id and session id."),
    ("Migration", "A versioned SQL change to the database schema, applied in order by Prisma."),
    ("Multi-tenancy", "Many customer organisations served by one installation, each seeing only its own data."),
    ("nginx", "The web server in front: serves the React files and forwards API paths to NestJS."),
    ("Prisma", "The database toolkit: schema, typed client, migrations."),
    ("QAR", "Qatari riyal, the currency of every amount."),
    ("Seed", "The script that fills the database with demo data (npm run db:seed:full)."),
    ("Socket.IO", "The WebSocket library that pushes notifications to the browser live."),
    ("Swagger", "The interactive API documentation at /api."),
    ("Tenant", "In the code: one customer organisation of the platform (landlord or renter). In everyday English: a renter."),
    ("TanStack Query", "The React library that fetches, caches and refreshes server data."),
    ("Zustand", "A small React state library; holds the signed-in user and the theme."),
]
st += [tab([["Term", "Meaning"]] + [[a, b] for a, b in GL], [46 * mm, CW - 46 * mm], fs=8.5)]


def build():
    doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB,
                          title="How LeaseManager works \u2014 the complete guide", author="Marwan Hamed",
                          subject="Architecture, data, security, business flows, AI, deployment and defense questions")
    frame = Frame(ML, MB, CW, PH - MT - MB, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=deco)])
    # A section heading needs room for its first lines: with less than this
    # left on the page, it starts the next one instead of sitting alone.
    story = []
    for f in st:
        if isinstance(f, Paragraph) and f.style.name in ("h", "h3"):
            story.append(CondPageBreak((40 if f.style.name == "h" else 28) * mm))
        story.append(f)
    try:
        doc.build(story)
    finally:
        shutil.rmtree(THUMBS, ignore_errors=True)
    print("written", OUT)


if __name__ == "__main__":
    build()
