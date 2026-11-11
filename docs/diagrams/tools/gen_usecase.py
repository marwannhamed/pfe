# -*- coding: utf-8 -*-
"""
Generate the role-based use case diagrams from one use case model:

    uc-01-complete           every actor and every use case
    uc-02-visitor            the Visitor
    uc-03-platform-owner     the Platform Owner
    uc-04-landlord-staff     the property company: Company Administrator, Property Manager,
                             Finance Officer, Receptionist, Maintenance Technician
    uc-05-tenant             the renter company: Tenant Administrator, Tenant Employee

    python tools/gen_usecase.py          # then: python tools/render.py uc

Each actor-to-use-case link follows the @Roles of the routes the use case calls
(backend/src/**/*.controller.ts) and the pages each role can open
(frontend/src/permissions/can.ts, layouts/MainLayout.tsx).

Actor generalisation: the hollow triangle points to the parent actor. The hierarchy follows
the organisations: the Company Administrator owns the property company and the Property
Manager specialises him (Property Manager ──▷ Company Administrator); the Tenant
Administrator heads the renter company and the Tenant Employee specialises him
(Tenant Employee ──▷ Tenant Administrator). Each actor is linked to the use cases it
performs itself.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
NL = "\n"

ACTORS = {
    "SU": "Signed-in User",
    "VIS": "Visitor",
    "TE": "Tenant Employee",
    "TA": "Tenant Administrator",
    "PM": "Property Manager",
    "CA": "Company Administrator",
    "RC": "Receptionist",
    "FI": "Finance Officer",
    "MT": "Maintenance Technician",
    "PO": "Platform Owner",
}
# child -> parent (the hollow triangle points to the parent)
GENERALISATIONS = [("TE", "TA"), ("PM", "CA"),
                   ("TA", "SU"), ("CA", "SU"), ("RC", "SU"), ("FI", "SU"), ("MT", "SU"), ("PO", "SU")]

PACKAGES = {
    "ACC": "Account and notifications",
    "PUB": "Public catalogue",
    "TEN": "Tenant workspace",
    "TAD": "Tenant administration",
    "POR": "Property portfolio",
    "APP": "Applications and bookings",
    "LEA": "Leases and billing",
    "MAI": "Maintenance",
    "ANA": "Analytics and reporting",
    "ORG": "Company and staff",
    "PLA": "Platform administration",
}

# id: (label, package)
UC = {
    # account (every signed-in user)
    "ACC_auth": ("Authenticate", "ACC"),
    "ACC_reset": ("Reset a forgotten\npassword", "ACC"),
    "ACC_logout": ("Log out", "ACC"),
    "ACC_dash": ("Consult own dashboard", "ACC"),
    "ACC_search": ("Search the platform", "ACC"),
    "ACC_profile": ("Manage own profile", "ACC"),
    "ACC_pwd": ("Change password", "ACC"),
    "ACC_photo": ("Upload a profile photo", "ACC"),
    "ACC_sessions": ("Manage active sessions", "ACC"),
    "ACC_revoke": ("Revoke a session", "ACC"),
    "ACC_activity": ("Consult login activity", "ACC"),
    "ACC_notif": ("Consult notifications", "ACC"),
    "ACC_prefs": ("Set notification\npreferences", "ACC"),
    # visitor
    "PUB_map": ("Browse the public map", "PUB"),
    "PUB_details": ("Consult space details", "PUB"),
    "PUB_tour": ("Take the virtual tour", "PUB"),
    "PUB_ai": ("Search with the\nAI space finder", "PUB"),
    "PUB_pricing": ("Consult pricing\nand offers", "PUB"),
    "PUB_apply": ("Submit a booking\napplication", "PUB"),
    "PUB_addons": ("Choose add-on services", "PUB"),
    "PUB_company": ("Submit a company\napplication (Typeform)", "PUB"),
    "PUB_register": ("Register a\nrenter company", "PUB"),
    # tenant employee
    "TEN_floor": ("Browse the floor map", "TEN"),
    "TEN_book": ("Book a space", "TEN"),
    "TEN_check": ("Check availability\nand capacity", "TEN"),
    "TEN_order": ("Order add-on services", "TEN"),
    "TEN_mybookings": ("Follow own bookings", "TEN"),
    "TEN_cancel": ("Cancel a booking", "TEN"),
    "TEN_checkin": ("Check in and\ncheck out", "TEN"),
    "TEN_report": ("Report a maintenance\nproblem", "TEN"),
    "TEN_triage": ("Get an AI triage\nsuggestion", "TEN"),
    "TEN_tickets": ("Follow own\nmaintenance tickets", "TEN"),
    "TEN_cancelticket": ("Cancel a ticket", "TEN"),
    "TEN_assistant": ("Ask the AI\ntenant assistant", "TEN"),
    "TEN_support": ("Chat with support\n(Crisp)", "TEN"),
    # tenant administrator
    "TAD_team": ("Manage team members", "TAD"),
    "TAD_invite": ("Invite a team member", "TAD"),
    "TAD_remove": ("Remove a team member", "TAD"),
    "TAD_bookings": ("Consult the company's\nbookings", "TAD"),
    "TAD_contracts": ("Consult lease contracts", "TAD"),
    "TAD_sign": ("Sign a lease contract", "TAD"),
    "TAD_invoices": ("Consult invoices", "TAD"),
    "TAD_summary": ("Consult the financial\nsummary", "TAD"),
    "TAD_pay": ("Report a payment", "TAD"),
    "TAD_cheque": ("Attach a cheque scan", "TAD"),
    "TAD_export": ("Export the\ncompany's data", "TAD"),
    "TAD_reports": ("Consult BI reports\n(Power BI, Tableau)", "TAD"),
    "TAD_embeds": ("Configure the\nBI report embeds", "TAD"),
    # property portfolio
    "POR_buildings": ("Manage buildings", "POR"),
    "POR_floors": ("Manage floors", "POR"),
    "POR_plan": ("Upload a floor plan", "POR"),
    "POR_spaces": ("Manage spaces", "POR"),
    "POR_publish": ("Publish a space on\nthe public map", "POR"),
    "POR_position": ("Position a space\non the floor map", "POR"),
    "POR_photos": ("Upload space photos", "POR"),
    "POR_addons": ("Manage add-on services", "POR"),
    "POR_promo": ("Manage promotion codes", "POR"),
    # applications and bookings
    "APP_review": ("Review booking\napplications", "APP"),
    "APP_accept": ("Accept the application", "APP"),
    "APP_refuse": ("Refuse the application", "APP"),
    "APP_link": ("Send a company\napplication link", "APP"),
    "APP_companies": ("Review company\napplications", "APP"),
    "APP_approve": ("Approve the company\napplication", "APP"),
    "APP_reject": ("Reject the company\napplication", "APP"),
    "APP_requests": ("Process booking\nrequests", "APP"),
    "APP_bkapprove": ("Approve a booking", "APP"),
    "APP_bkreject": ("Reject a booking", "APP"),
    "APP_queues": ("Consult the\nreception queues", "APP"),
    "APP_intake": ("Conduct the\nin-person intake", "APP"),
    "APP_call": ("Confirm the phone call", "APP"),
    "APP_unreach": ("Mark the applicant\nunreachable", "APP"),
    "APP_visit": ("Mark the site\nvisit complete", "APP"),
    "APP_docs": ("Upload supporting\ndocuments", "APP"),
    "APP_finalize": ("Finalize a\nlease booking", "APP"),
    "APP_checkdoc": ("Check the signed\nlease document", "APP"),
    # leases and billing
    "LEA_manage": ("Manage lease\ncontracts", "LEA"),
    "LEA_create": ("Create a contract", "LEA"),
    "LEA_renew": ("Renew a contract", "LEA"),
    "LEA_terminate": ("Terminate a contract", "LEA"),
    "LEA_assistant": ("Ask the AI\nlease assistant", "LEA"),
    "LEA_renewals": ("Follow contract\nrenewals", "LEA"),
    "BIL_invoices": ("Manage invoices", "LEA"),
    "BIL_create": ("Create an invoice", "LEA"),
    "BIL_lines": ("Add invoice lines", "LEA"),
    "BIL_send": ("Send an invoice", "LEA"),
    "BIL_cancel": ("Cancel an invoice", "LEA"),
    "BIL_delete": ("Delete an invoice", "LEA"),
    "BIL_payments": ("Manage payments", "LEA"),
    "BIL_record": ("Record a payment", "LEA"),
    "BIL_confirm": ("Confirm a reported\npayment", "LEA"),
    "BIL_refund": ("Refund a payment", "LEA"),
    # maintenance
    "MAI_supervise": ("Supervise maintenance", "MAI"),
    "MAI_assign": ("Assign a technician", "MAI"),
    "MAI_handle": ("Handle maintenance\ntickets", "MAI"),
    "MAI_accept": ("Accept an\nunassigned ticket", "MAI"),
    "MAI_start": ("Start the work", "MAI"),
    "MAI_resolve": ("Resolve a ticket", "MAI"),
    "MAI_close": ("Close a ticket", "MAI"),
    "MAI_risk": ("Consult the\nrisk scoring", "MAI"),
    # analytics and reporting
    "ANA_analytics": ("Consult analytics", "ANA"),
    "ANA_heat": ("Consult the\noccupancy heatmap", "ANA"),
    "ANA_forecast": ("Consult the\nrevenue forecast", "ANA"),
    "ANA_export": ("Export data\n(CSV, Excel)", "ANA"),
    "ANA_reports": ("Consult BI reports\n(Power BI, Tableau)", "ANA"),
    "ANA_embeds": ("Configure the\nBI report embeds", "ANA"),
    # company and staff (property company)
    "ORG_view": ("Consult the\ncompany profile", "ORG"),
    "ORG_edit": ("Edit the\ncompany profile", "ORG"),
    "ORG_staff": ("Manage staff accounts", "ORG"),
    "ORG_invite": ("Invite a staff member", "ORG"),
    "ORG_delete": ("Delete a user account", "ORG"),
    # platform administration
    "PLA_orgs": ("Administer organisations", "PLA"),
    "PLA_provision": ("Provision a\nproperty company", "PLA"),
    "PLA_suspend": ("Suspend or reactivate\nan organisation", "PLA"),
    "PLA_users": ("Administer all\nuser accounts", "PLA"),
    "PLA_oversee": ("Oversee the operations\nof every organisation", "PLA"),
    "PLA_audit": ("Consult audit logs", "PLA"),
    "PLA_mail": ("Supervise e-mail\ndelivery", "PLA"),
    "PLA_health": ("Monitor the\nsystem health", "PLA"),
    "PLA_notify": ("Send a notification", "PLA"),
}

# actor -> use cases it is directly associated with (inherited ones are not repeated)
ASSOC = {
    "SU": ["ACC_auth", "ACC_logout", "ACC_dash", "ACC_search", "ACC_profile", "ACC_sessions", "ACC_notif"],
    "VIS": ["PUB_map", "PUB_ai", "PUB_pricing", "PUB_apply", "PUB_company", "PUB_register"],
    "TE": ["TEN_floor", "TEN_book", "TEN_mybookings", "TEN_checkin", "TEN_report", "TEN_tickets",
           "TEN_assistant", "TEN_support"],
    "TA": ["TAD_team", "TAD_bookings", "TAD_contracts", "TAD_sign", "TAD_invoices", "TAD_pay", "TAD_export",
           "TAD_reports", "TAD_embeds"],
    "PM": ["POR_buildings", "POR_floors", "POR_spaces", "POR_addons", "POR_promo",
           "APP_review", "APP_link", "APP_companies", "APP_requests", "APP_queues", "APP_intake", "APP_finalize",
           "LEA_manage", "BIL_invoices", "BIL_payments", "MAI_supervise", "MAI_risk",
           "ANA_analytics", "ANA_export", "ANA_reports", "ANA_embeds", "ORG_view", "ORG_staff"],
    "CA": ["ORG_edit", "ORG_delete", "BIL_delete"],
    "RC": ["APP_queues", "APP_intake", "TEN_checkin"],
    "FI": ["BIL_invoices", "BIL_payments", "BIL_delete", "LEA_renewals", "ANA_analytics", "ANA_export",
           "ANA_reports"],
    "MT": ["MAI_handle", "MAI_risk"],
    "PO": ["PLA_orgs", "PLA_users", "PLA_oversee", "APP_companies", "PLA_audit", "PLA_mail", "PLA_health",
           "PLA_notify", "ANA_analytics", "ANA_export", "ANA_reports", "ANA_embeds"],
}

# extending use case -> base use case
EXTEND = [
    ("ACC_reset", "ACC_auth"), ("ACC_pwd", "ACC_profile"), ("ACC_photo", "ACC_profile"),
    ("ACC_revoke", "ACC_sessions"), ("ACC_activity", "ACC_sessions"), ("ACC_prefs", "ACC_notif"),
    ("PUB_details", "PUB_map"), ("PUB_tour", "PUB_map"), ("PUB_addons", "PUB_apply"),
    ("TEN_order", "TEN_book"), ("TEN_cancel", "TEN_mybookings"), ("TEN_triage", "TEN_report"),
    ("TEN_cancelticket", "TEN_tickets"),
    ("TAD_invite", "TAD_team"), ("TAD_remove", "TAD_team"), ("TAD_summary", "TAD_invoices"),
    ("TAD_cheque", "TAD_pay"),
    ("POR_plan", "POR_floors"), ("POR_publish", "POR_spaces"), ("POR_position", "POR_spaces"),
    ("POR_photos", "POR_spaces"),
    ("APP_accept", "APP_review"), ("APP_refuse", "APP_review"), ("APP_approve", "APP_companies"),
    ("APP_reject", "APP_companies"), ("APP_bkapprove", "APP_requests"), ("APP_bkreject", "APP_requests"),
    ("APP_call", "APP_intake"), ("APP_unreach", "APP_intake"), ("APP_visit", "APP_intake"),
    ("APP_docs", "APP_intake"),
    ("LEA_create", "LEA_manage"), ("LEA_renew", "LEA_manage"), ("LEA_terminate", "LEA_manage"),
    ("LEA_assistant", "LEA_manage"),
    ("BIL_create", "BIL_invoices"), ("BIL_lines", "BIL_invoices"), ("BIL_send", "BIL_invoices"),
    ("BIL_cancel", "BIL_invoices"), ("BIL_record", "BIL_payments"), ("BIL_confirm", "BIL_payments"),
    ("BIL_refund", "BIL_payments"),
    ("MAI_assign", "MAI_supervise"), ("MAI_accept", "MAI_handle"), ("MAI_start", "MAI_handle"),
    ("MAI_resolve", "MAI_handle"), ("MAI_close", "MAI_handle"),
    ("ANA_heat", "ANA_analytics"), ("ANA_forecast", "ANA_analytics"),
    ("ORG_invite", "ORG_staff"),
    ("PLA_provision", "PLA_orgs"), ("PLA_suspend", "PLA_orgs"),
]
# base use case -> included use case
INCLUDE = [("TEN_book", "TEN_check"), ("APP_finalize", "APP_checkdoc")]

# ---------------------------------------------------------------- general model (slides)
# One use case per main feature, no «extend» sub-cases. Each use case is linked to one
# actor of a parent/child pair only: the Property Manager specialises the Company
# Administrator, and the Tenant Employee specialises the Tenant Administrator.
GENERAL_UC = {
    # account (every signed-in user)
    "A_auth": ("Authenticate", "ACC"),
    "A_profile": ("Manage own profile\nand sessions", "ACC"),
    "A_notif": ("Consult the dashboard\nand notifications", "ACC"),
    # visitor
    "V_map": ("Browse the public map\n(details, virtual tour)", "PUB"),
    "V_ai": ("Search with the\nAI space finder", "PUB"),
    "V_pricing": ("Consult pricing\nand offers", "PUB"),
    "V_apply": ("Submit a booking\napplication", "PUB"),
    "V_company": ("Submit a company\napplication (Typeform)", "PUB"),
    "V_register": ("Register a\nrenter company", "PUB"),
    # tenant administrator
    "TA_team": ("Manage team members", "TAD"),
    "TA_bookings": ("Consult the\ncompany's bookings", "TAD"),
    "TA_contracts": ("Consult and sign\nlease contracts", "TAD"),
    "TA_invoices": ("Consult invoices and\nreport payments", "TAD"),
    "TA_export": ("Export the\ncompany's data", "TAD"),
    "TA_bi": ("Consult and configure\nBI reports", "TAD"),
    # tenant employee
    "T_book": ("Book a space\n(floor map, add-on services)", "TEN"),
    "T_bookings": ("Follow and cancel\nown bookings", "TEN"),
    "T_checkin": ("Check in and check out", "TEN"),
    "T_report": ("Report a maintenance\nproblem (AI triage)", "TEN"),
    "T_tickets": ("Follow own\nmaintenance tickets", "TEN"),
    "T_help": ("Ask the AI assistant\nor chat with support", "TEN"),
    # property company
    "G_profile": ("Manage the\ncompany profile", "ORG"),
    "G_staff": ("Manage staff accounts", "ORG"),
    "G_portfolio": ("Manage the property portfolio\n(buildings, floors, spaces)", "POR"),
    "G_offers": ("Manage add-on services\nand promotion codes", "POR"),
    "G_applications": ("Process booking and\ncompany applications", "APP"),
    "G_intake": ("Conduct the\nin-person intake", "APP"),
    "G_checkin": ("Check tenants in and out", "APP"),
    "G_leases": ("Manage lease contracts", "LEA"),
    "G_billing": ("Manage invoices\nand payments", "LEA"),
    "G_renewals": ("Follow contract renewals", "LEA"),
    "G_analytics": ("Consult analytics\nand BI reports", "ANA"),
    "G_maint": ("Supervise maintenance", "MAI"),
    "G_tickets": ("Handle maintenance tickets", "MAI"),
    # platform owner
    "P_orgs": ("Administer organisations\n(provision, suspend)", "PLA"),
    "P_users": ("Administer all\nuser accounts", "PLA"),
    "P_oversee": ("Oversee the operations\nof every organisation", "PLA"),
    "P_audit": ("Consult audit logs", "PLA"),
    "P_mail": ("Supervise e-mail delivery", "PLA"),
    "P_health": ("Monitor the system health", "PLA"),
}
GENERAL_PACKAGES = {
    "ACC": "Account", "PUB": "Public catalogue", "TAD": "Tenant administration", "TEN": "Tenant workspace",
    "ORG": "Company and staff", "POR": "Property portfolio", "APP": "Applications and reception",
    "LEA": "Leases and billing", "ANA": "Analytics and reporting", "MAI": "Maintenance",
    "PLA": "Platform administration",
}
G_VISITOR = ["V_map", "V_ai", "V_pricing", "V_apply", "V_company", "V_register"]
G_TA = ["TA_team", "TA_bookings", "TA_contracts", "TA_invoices", "TA_export", "TA_bi"]
G_TE = ["T_book", "T_bookings", "T_checkin", "T_report", "T_tickets", "T_help"]
G_CA = ["G_profile", "G_staff"]
G_PM = ["G_portfolio", "G_offers", "G_applications", "G_intake", "G_leases", "G_billing", "G_analytics",
        "G_maint"]
G_FI = ["G_billing", "G_renewals", "G_analytics"]
G_MT = ["G_tickets"]
G_PO = ["P_orgs", "P_users", "P_oversee", "G_analytics", "P_audit", "P_mail", "P_health"]

AUTH_NOTE = "Every use case «include»s **Authenticate**."

VIEWS = {
    "uc-01-complete": {
        "title": "Global use case diagram — LeaseManager",
        "actors": ["SU", "VIS", "TA", "TE", "CA", "PM", "RC", "FI", "MT", "PO"],
        "assoc": {"SU": ["A_profile", "A_notif"], "VIS": G_VISITOR, "TA": G_TA, "TE": G_TE,
                  "CA": G_CA, "PM": G_PM, "RC": ["G_intake", "T_checkin"], "FI": G_FI, "MT": G_MT,
                  "PO": G_PO},
        "su_on_top": True,
        "auth_right": True,
        "settings": ["skinparam nodesep 12", "skinparam ranksep 150"],
    },
    "uc-02-visitor": {
        "title": "Use case diagram — Visitor",
        "actors": ["VIS"],
        "assoc": {"VIS": G_VISITOR},
        "note": "The Visitor has no account. After registering a renter company,\n"
                "or once an application is accepted, he signs in as a Tenant Administrator.",
        "settings": ["skinparam nodesep 14", "skinparam ranksep 120"],
    },
    "uc-03-platform-owner": {
        "title": "Use case diagram — Platform Owner",
        "actors": ["PO"],
        "assoc": {"PO": G_PO},
        "package_order": ["PLA", "ANA"],
        "auth_right": True,
        "settings": ["skinparam nodesep 14", "skinparam ranksep 120"],
    },
    "uc-04-landlord-staff": {
        "title": "Use case diagram — property company and its staff",
        "actors": ["CA", "PM", "RC", "FI", "MT"],
        "assoc": {"CA": G_CA, "PM": G_PM, "RC": ["G_intake", "G_checkin"], "FI": G_FI, "MT": G_MT},
        "auth_right": True,
        "settings": ["skinparam nodesep 14", "skinparam ranksep 120"],
    },
    "uc-05-tenant": {
        "title": "Use case diagram — renter company (tenant)",
        "actors": ["TA", "TE"],
        "assoc": {"TA": G_TA, "TE": G_TE},
        "auth_right": True,
        "settings": ["skinparam nodesep 14", "skinparam ranksep 120"],
    },
    # the detailed model, every use case and its «extend» sub-cases (report appendix)
    "uc-06-complete-detailed": {
        "title": "Detailed use case diagram — every use case of LeaseManager",
        "actors": ["SU", "VIS", "TA", "TE", "CA", "PM", "RC", "FI", "MT", "PO"],
        "detailed": True,
        "note": "Every use case of a signed-in actor «include»s\n"
                "**Authenticate**. The Visitor needs no account.",
        "settings": ["skinparam nodesep 8", "skinparam ranksep 200", "skinparam linetype polyline"],
    },
}
CAPTIONS = {
    "uc-01-complete": "Global use case diagram of LeaseManager: every actor and its main use cases",
    "uc-02-visitor": "Use case diagram: the Visitor",
    "uc-03-platform-owner": "Use case diagram: the Platform Owner",
    "uc-04-landlord-staff": "Use case diagram: the property company (Company Administrator, Property Manager, "
                            "Receptionist, Finance Officer, Maintenance Technician)",
    "uc-05-tenant": "Use case diagram: the renter company (Tenant Administrator, Tenant Employee)",
    "uc-06-complete-detailed": "Detailed use case diagram: every use case of LeaseManager",
}


def side_of(u, right):
    """'R' when every actor associated with the use case (or with its base) is on the right."""
    base = next((b for e, b in EXTEND if e == u), None) or next((b for b, i in INCLUDE if i == u), None) or u
    owners = [a for a, us in ASSOC.items() if base in us]
    return "R" if owners and all(a in right for a in owners) else "L"


def build(name, view):
    global UC, ASSOC, EXTEND, INCLUDE, PACKAGES
    if view.get("detailed"):
        return _build(name, view)
    saved = UC, ASSOC, EXTEND, INCLUDE, PACKAGES
    order = view.get("package_order") or list(GENERAL_PACKAGES)
    UC, ASSOC, EXTEND, INCLUDE, PACKAGES = GENERAL_UC, view["assoc"], [], [], {k: GENERAL_PACKAGES[k] for k in order}
    try:
        return _build(name, view)
    finally:
        UC, ASSOC, EXTEND, INCLUDE, PACKAGES = saved


def _build(name, view):
    actors = view["actors"]
    right = view.get("right", [])
    base = []
    for a in actors:
        for u in ASSOC[a]:
            if u not in base:
                base.append(u)
    shown = list(base)
    for e, b in EXTEND:
        if b in base and e not in shown:
            shown.append(e)
    for b, i in INCLUDE:
        if b in base and i not in shown:
            shown.append(i)
    side = {u: side_of(u, right) for u in shown}
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated by tools/gen_usecase.py from one use case model; edit the generator, not this file.",
           "left to right direction", "skinparam packageStyle rectangle", *view["settings"],
           f"title {view['title']}", ""]
    for a in actors:
        stereo = " <<abstract>>" if a == "SU" else ""
        out.append(f'actor "{ACTORS[a]}" as {a}{stereo}')
    out.append("")
    out.append('rectangle "LeaseManager" {')
    for p, plabel in PACKAGES.items():
        members = [u for u in shown if UC[u][1] == p]
        if not members:
            continue
        out.append(f'  package "{plabel}" {{')
        for u in members:
            label = UC[u][0].replace("\n", "\\n")
            out.append(f'    usecase "{label}" as {u}')
        out.append("  }")
    auth_from = []
    if view.get("auth_right"):
        # every use case of a signed-in actor «include»s Authenticate, drawn to its right
        auth_from = [u for u in shown if any(u in ASSOC[a] for a in actors if a != "VIS")]
        out.append('  usecase "Authenticate" as AUTH')
    out.append("}")
    out.append("")
    gens = [(c, p) for c, p in GENERALISATIONS if c in actors and p in actors]
    out.append("' actor columns, top to bottom; a specialised role sits below its parent")
    for col in ([a for a in actors if a not in right and a != "SU"], [a for a in right if a != "SU"]):
        linked = set()
        for c, p in gens:
            if p != "SU" and c in col and p in col:
                # the blank label only adds room between the two actors
                out.append(f'{p} <|- {c} : " "')
                linked.add((p, c))
        for x, y in zip(col, col[1:]):
            if (x, y) not in linked:
                out.append(f"{x} -[hidden]> {y}")
    if "SU" in actors and view.get("su_on_top"):
        out.append("' the abstract Signed-in User heads the actor column; its generalisations do not rank")
        first = next(a for a in actors if a != "SU")
        out.append(f"SU -[hidden]> {first}")
        for c, p in gens:
            if p == "SU":
                out.append(f"{c} -[norank]-|> SU")
    elif "SU" in actors:
        out.append("' every role specialises the abstract Signed-in User (its own column)")
        for c, p in gens:
            if p == "SU":
                if "SU" in right and c in right:
                    out.append(f"{c} --|> SU")
                elif "SU" in right:
                    out.append(f"{c} -[norank]-|> SU")
                else:
                    out.append(f"SU <|-- {c}")
    out.append("")
    for a in actors:
        for u in ASSOC[a]:
            if a == "SU" and view.get("su_on_top"):
                out.append(f"SU -- {u}")
            elif a == "SU":
                out.append(f"{u} --- SU" if "SU" in right else f"SU --- {u}")
            elif a in right:
                out.append(f"{u} -- {a}")
            else:
                out.append(f"{a} -- {u}")
    out.append("")
    for e, b in EXTEND:
        if e in shown and b in shown:
            out.append(f"{e} ..> {b} : <<extend>>" if side[b] == "R" else f"{b} <.. {e} : <<extend>>")
    for b, i in INCLUDE:
        if b in shown and i in shown:
            out.append(f"{i} <.. {b} : <<include>>" if side[b] == "R" else f"{b} ..> {i} : <<include>>")
    if right:
        # keep the right-hand use cases in their own columns, to the right of the left-hand ones
        lext = [u for u in shown if side[u] == "L" and (any(e == u for e, _ in EXTEND) or any(i == u for _, i in INCLUDE))]
        rext = [u for u in shown if side[u] == "R" and (any(e == u for e, _ in EXTEND) or any(i == u for _, i in INCLUDE))]
        for x, y in zip(lext[:4], rext[:4]):
            out.append(f"{x} -[hidden]- {y}")
    for u in auth_from:
        out.append(f"{u} ..> AUTH : <<include>>")
    if view.get("note"):
        out += ["", "note as N1", *["  " + l for l in view["note"].split("\n")], "end note"]
    out.append("@enduml")
    return NL.join(out) + NL


# drawn by hand in the uc-07 / uc-08 design; the generator leaves them alone
HAND_WRITTEN = {"uc-02-visitor", "uc-03-platform-owner", "uc-04-landlord-staff"}

if __name__ == "__main__":
    for name, view in VIEWS.items():
        if name in HAND_WRITTEN:
            continue
        with open(os.path.join(ROOT, name + ".puml"), "w", encoding="utf-8", newline=NL) as f:
            f.write(build(name, view))
        print("wrote", name)
