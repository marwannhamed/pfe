# -*- coding: utf-8 -*-
"""
Generate the entity class diagrams (class-0*.puml) from backend/prisma/schema.prisma.

Every attribute, its type, optionality and {id}/{unique} marker is read from the
schema, so the diagrams cannot drift from the code. Foreign-key columns are not
listed as attributes: they appear as the associations they implement. String
columns whose values are the constants of backend/src/constants/enums.ts are
typed with the matching enumeration (ENUM_OF below).

    python tools/gen_class.py          # then: python tools/render.py class
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SCHEMA = os.path.join(ROOT, "..", "..", "backend", "prisma", "schema.prisma")
NL = "\n"

# String column -> enumeration of backend/src/constants/enums.ts (ApplicantType: DTO literal type)
ENUM_OF = {
    ("Tenant", "status"): "TenantStatus",
    ("Tenant", "organization_type"): "OrganizationType",
    ("TenantApplication", "status"): "TenantApplicationStatus",
    ("User", "role"): "UserRole",
    ("User", "status"): "UserStatus",
    ("Space", "type"): "SpaceType",
    ("Space", "status"): "SpaceStatus",
    ("AddOnService", "billing_cycle"): "BillingCycle",
    ("BookingApplication", "applicant_type"): "ApplicantType",
    ("BookingApplication", "status"): "BookingApplicationStatus",
    ("Booking", "status"): "BookingStatus",
    ("BookingDocument", "document_type"): "BookingDocumentType",
    ("LeaseContract", "status"): "ContractStatus",
    ("Invoice", "type"): "InvoiceType",
    ("Invoice", "status"): "InvoiceStatus",
    ("PromotionCode", "type"): "DiscountType",
    ("Payment", "method"): "PaymentMethod",
    ("Payment", "status"): "PaymentStatus",
    ("MaintenanceTicket", "category"): "TicketCategory",
    ("MaintenanceTicket", "priority"): "TicketPriority",
    ("MaintenanceTicket", "status"): "TicketStatus",
    ("Notification", "type"): "NotificationType",
    ("Notification", "channel"): "NotificationChannel",
    ("Notification", "priority"): "NotificationPriority",
    ("Report", "type"): "ReportType",
    ("Report", "format"): "ReportFormat",
    ("AuditLog", "action"): "AuditAction",
    ("AuditLog", "severity"): "AuditSeverity",
}

PACKAGES = [
    ("Organisations and identity", ["Tenant", "User", "UserSession", "TenantApplication", "TenantOnboardingSequence"]),
    ("Property portfolio", ["Building", "Floor", "Space", "SpaceFeature", "AddOnService", "SpaceAddOnService"]),
    ("Applications and bookings", ["BookingApplication", "BookingApplicationAddOn", "Booking", "BookingAddOn",
                                   "BookingDocument"]),
    ("Leases and billing", ["LeaseContract", "Invoice", "InvoiceLine", "Payment", "PromotionCode"]),
    ("Operations and supervision", ["MaintenanceTicket", "Notification", "AuditLog", "Report"]),
]
PACKAGE_OF = {m: p for p, ms in PACKAGES for m in ms}

# Associations, one per Prisma relation:
#   id: (end A, mult A, kind, end B, mult B, label, role at A, role at B)
# kind "*--" composition (the part is deleted with its whole), "o--" aggregation, "--" association.
# A label "name >" / "< name" reads from A to B / from B to A. Role names are the Prisma
# relation fields: at the ends where that reads cleanly, otherwise (User, which plays
# several roles towards the same class) as the name of the association.
ASSOC = {
    # organisations and identity
    "tenant-users": ("Tenant", "1", "*--", "User", "0..*", "employs >", "", ""),
    "company-members": ("Tenant", "0..1", "--", "User", "0..*", "", "tenantCompany", "tenantCompanyUsers"),
    "reception-staff": ("User", "0..1", "--", "User", "0..*", "", "managedBy", "receptionStaff"),
    "user-sessions": ("User", "1", "*--", "UserSession", "0..*", "opens >", "", ""),
    "tenant-onboarding": ("Tenant", "1", "*--", "TenantOnboardingSequence", "0..1", "follows >", "", ""),
    "landlord-applications": ("Tenant", "1", "*--", "TenantApplication", "0..*", "receives >", "landlord_tenant", ""),
    "applicant-tenant": ("Tenant", "0..1", "--", "TenantApplication", "0..1", "< creates", "applicant_tenant", ""),
    "space-tenant-applications": ("Space", "0..1", "--", "TenantApplication", "0..*", "< targets", "", ""),
    # property portfolio
    "tenant-buildings": ("Tenant", "1", "*--", "Building", "0..*", "owns >", "", ""),
    "building-floors": ("Building", "1", "*--", "Floor", "0..*", "contains >", "", ""),
    "floor-spaces": ("Floor", "1", "*--", "Space", "0..*", "contains >", "", ""),
    "space-features": ("Space", "1", "*--", "SpaceFeature", "0..*", "has >", "", ""),
    "tenant-addons": ("Tenant", "1", "*--", "AddOnService", "0..*", "offers >", "", ""),
    # join models (each has its own id): composed by their main owner, linked to the add-on.
    # A part has a single composite owner, so the link to AddOnService is a plain association.
    "space-addon-links": ("Space", "1", "*--", "SpaceAddOnService", "0..*", "", "", "availableAddOns"),
    "addon-space-links": ("AddOnService", "1", "--", "SpaceAddOnService", "0..*", "", "", "spaceLinks"),
    # applications and bookings
    "space-applications": ("Space", "1", "--", "BookingApplication", "0..*", "< applies for", "", ""),
    "application-user": ("User", "0..1", "--", "BookingApplication", "0..*", "user", "", ""),
    "application-reviewer": ("User", "0..1", "--", "BookingApplication", "0..*", "reviewedBy", "", ""),
    "application-addon-links": ("BookingApplication", "1", "*--", "BookingApplicationAddOn", "0..*", "", "", "addOns"),
    "addon-application-links": ("AddOnService", "1", "--", "BookingApplicationAddOn", "0..*", "", "", "applicationAddOns"),
    "application-booking": ("BookingApplication", "0..1", "--", "Booking", "0..1", "leads to >", "", ""),
    "tenant-bookings": ("Tenant", "1", "--", "Booking", "0..*", "holds >", "", ""),
    "booking-user": ("User", "1", "--", "Booking", "0..*", "user", "", ""),
    "booking-receptionist": ("User", "0..1", "--", "Booking", "0..*", "receptionist", "", ""),
    "space-bookings": ("Space", "1", "--", "Booking", "0..*", "< reserves", "", ""),
    "booking-addon-links": ("Booking", "1", "*--", "BookingAddOn", "0..*", "", "", "addOns"),
    "addon-booking-links": ("AddOnService", "1", "--", "BookingAddOn", "0..*", "", "", "bookingAddOns"),
    "booking-documents": ("Booking", "1", "*--", "BookingDocument", "0..5", "stores >", "", ""),
    "document-uploader": ("User", "1", "--", "BookingDocument", "0..*", "uploadedBy", "", ""),
    "invoice-bookings": ("Invoice", "0..1", "--", "Booking", "0..*", "bills >", "", ""),
    "payment-bookings": ("Payment", "0..*", "--", "Booking", "0..*", "pays >", "", ""),
    # leases and billing
    "tenant-contracts": ("Tenant", "1", "--", "LeaseContract", "0..*", "signs >", "", ""),
    "user-contracts": ("User", "0..1", "--", "LeaseContract", "0..*", "manages >", "", ""),
    "contract-invoices": ("LeaseContract", "0..1", "o--", "Invoice", "0..*", "groups >", "", ""),
    "tenant-invoices": ("Tenant", "1", "--", "Invoice", "0..*", "< is addressed to", "", ""),
    "user-invoices": ("User", "0..1", "--", "Invoice", "0..*", "user", "", ""),
    "invoice-lines": ("Invoice", "1", "*--", "InvoiceLine", "0..*", "", "", "lines"),
    "promotion-invoices": ("PromotionCode", "0..1", "--", "Invoice", "0..*", "discounts >", "", ""),
    "tenant-promotions": ("Tenant", "1", "*--", "PromotionCode", "0..*", "runs >", "", ""),
    "invoice-payments": ("Invoice", "0..1", "--", "Payment", "0..*", "< settles", "", ""),
    "tenant-payments": ("Tenant", "1", "--", "Payment", "0..*", "makes >", "", ""),
    "payment-user": ("User", "0..1", "--", "Payment", "0..*", "user", "", ""),
    "payment-recorder": ("User", "0..1", "--", "Payment", "0..*", "recordedBy", "", ""),
    # operations and supervision
    "tenant-tickets": ("Tenant", "1", "--", "MaintenanceTicket", "0..*", "raises >", "", ""),
    "space-tickets": ("Space", "0..1", "--", "MaintenanceTicket", "0..*", "< concerns", "", ""),
    "booking-tickets": ("Booking", "0..1", "--", "MaintenanceTicket", "0..*", "< relates to", "", ""),
    "ticket-reporter": ("User", "0..1", "--", "MaintenanceTicket", "0..*", "user", "", ""),
    "ticket-creator": ("User", "0..1", "--", "MaintenanceTicket", "0..*", "createdBy", "", ""),
    "ticket-assignee": ("User", "0..1", "--", "MaintenanceTicket", "0..*", "assignee", "", ""),
    "tenant-notifications": ("Tenant", "1", "*--", "Notification", "0..*", "", "", ""),
    "user-notifications": ("User", "0..1", "--", "Notification", "0..*", "receives >", "", ""),
    "tenant-audit": ("Tenant", "1", "*--", "AuditLog", "0..*", "", "", ""),
    "user-audit": ("User", "0..1", "--", "AuditLog", "0..*", "performs >", "", ""),
    "user-reports": ("User", "1", "*--", "Report", "0..*", "generates >", "", ""),
}


def parse_schema(path):
    """Return {model: [field dicts]} in schema order."""
    models, cur = {}, None
    for raw in open(path, encoding="utf-8").read().replace("\r\n", NL).split(NL):
        line = raw.rstrip()
        if "//" in line and not line.strip().startswith("///"):
            line = line[:line.index("//")].rstrip()
        m = re.match(r"^model (\w+) \{", line)
        if m:
            cur = models.setdefault(m.group(1), [])
            continue
        if line.startswith("}"):
            cur = None
            continue
        f = re.match(r"^\s+(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$", line)
        if cur is None or not f:
            continue
        name, typ, lst, opt, attrs = f.groups()
        cur.append({"name": name, "type": typ, "list": bool(lst), "optional": bool(opt), "attrs": attrs})
    return models


MODELS = parse_schema(SCHEMA)


def attribute_lines(model):
    fields = MODELS[model]
    fk = set()
    for f in fields:
        r = re.search(r"@relation\([^)]*fields:\s*\[([^\]]*)\]", f["attrs"])
        if r:
            fk.update(x.strip() for x in r.group(1).split(","))
    out = []
    for f in fields:
        if f["type"] in MODELS or f["name"] in fk:
            continue                                     # relation fields and foreign keys
        typ = ENUM_OF.get((model, f["name"]), f["type"]) + ("[]" if f["list"] else "")
        mods = [m for m, k in (("id", "@id"), ("unique", "@unique"), ("updatedAt", "@updatedAt")) if k in f["attrs"]]
        mult = " [0..1]" if f["optional"] else ""
        out.append(f"{f['name']} : {typ}{mult}" + (" {" + ", ".join(mods) + "}" if mods else ""))
    return out


def end_label(mult, role):
    return f'"{role}\\n{mult}"' if role else f'"{mult}"'


def build(name, spec):
    focus, refs = spec["focus"], spec.get("refs", [])
    shown = set(focus) | set(refs)
    arrows = spec.get("arrows", {})
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated from backend/prisma/schema.prisma by tools/gen_class.py; edit the generator, not this file.",
           "hide circle", "hide empty members"]
    out += [f"skinparam linetype {os.environ.get('LT') or spec.get('linetype', 'splines')}",
            "' One package per diagram: its frame is kept for the layout but not drawn, so no",
            "' multiplicity sits on a frame border. The package is named in the title.",
            "skinparam PackageBorderColor transparent",
            "skinparam PackageBackgroundColor transparent",
            "skinparam PackageFontColor transparent"]
    out += spec.get("settings", [])
    out += [f"title {spec['title']}", ""]
    pkg = PACKAGE_OF[focus[0]]
    out.append(f'package "{pkg}" {{')
    for m in focus:
        out.append(f"  class {m} <<entity>> {{")
        out += ["    " + a for a in attribute_lines(m)]
        out.append("  }")
    out.append("}")
    for m in refs:
        # a class of another package: name only, dashed grey frame
        out.append(f"class {m} <<entity>> #F6F8FB;line:8FA7C2;line.dashed")
    out.append("")
    for aid, (a, ma, kind, b, mb, label, ra, rb) in ASSOC.items():
        if not (a in shown and b in shown and (a in focus or b in focus)) or aid in spec.get("skip", []):
            continue
        arrow = arrows.get(aid, kind)
        if arrow.startswith("rev:"):
            # Write B first (it changes the layout, not the meaning): the arrow after "rev:" is
            # used as written (e.g. "--*" keeps the diamond on A) and the reading direction flips.
            lab = (label[2:] + " >") if label.startswith("< ") else (("< " + label[:-2]) if label.endswith(" >") else label)
            out.append(f"{b} {end_label(mb, rb)} {arrow[4:]} {end_label(ma, ra)} {a}" + (f" : {lab}" if lab else ""))
            continue
        out.append(f"{a} {end_label(ma, ra)} {arrow} {end_label(mb, rb)} {b}" + (f" : {label}" if label else ""))
    out += spec.get("extra", [])
    if refs:
        out += ["", "legend bottom right", "Classes shown by name only belong to other packages",
                "and are detailed in their own diagram.", "endlegend"]
    out.append("@enduml")
    return NL.join(out) + NL


SPECS = {
    "class-02-organisations-identity": {
        "title": "Class diagram — package Organisations and identity",
        "focus": ["Tenant", "User", "UserSession", "TenantApplication", "TenantOnboardingSequence"],
        "refs": ["Space"],
        "arrows": {"tenant-onboarding": "*-right-", "space-tenant-applications": "rev:--"},
        "settings": ["skinparam nodesep 60", "skinparam ranksep 55"],
    },
    "class-03-property-portfolio": {
        "title": "Class diagram — package Property portfolio",
        "focus": ["Building", "Floor", "Space", "SpaceFeature", "AddOnService", "SpaceAddOnService"],
        "refs": ["Tenant"],
        "arrows": {"building-floors": "*-right-", "space-features": "*-left-"},
        "settings": ["skinparam nodesep 50", "skinparam ranksep 50"],
        "linetype": "ortho",
    },
    "class-04a-booking-applications": {
        "title": "Class diagram — package Applications and bookings (1/2): booking applications",
        "focus": ["BookingApplication", "BookingApplicationAddOn"],
        "refs": ["Booking", "Space", "User", "AddOnService"],
        "settings": ["skinparam nodesep 45", "skinparam ranksep 55"],
    },
    "class-04b-bookings": {
        "title": "Class diagram — package Applications and bookings (2/2): bookings",
        "focus": ["Booking", "BookingAddOn", "BookingDocument"],
        "refs": ["AddOnService", "BookingApplication", "Space", "Tenant", "Invoice", "Payment", "User"],
        "arrows": {"addon-booking-links": "rev:--"},
        "settings": ["skinparam nodesep 28", "skinparam ranksep 55"],
    },
    "class-05a-contracts-invoices": {
        "title": "Class diagram — package Leases and billing (1/2): contracts and invoices",
        "focus": ["LeaseContract", "Invoice", "InvoiceLine", "PromotionCode"],
        "refs": ["Tenant", "User", "Booking"],
        "settings": ["skinparam nodesep 45", "skinparam ranksep 55"],
        "linetype": "ortho",
    },
    "class-05b-payments": {
        "title": "Class diagram — package Leases and billing (2/2): payments",
        "focus": ["Payment"],
        "refs": ["Tenant", "Invoice", "User", "Booking"],
        "settings": ["skinparam nodesep 45", "skinparam ranksep 55"],
    },
    "class-06a-maintenance": {
        "title": "Class diagram — package Operations and supervision (1/2): maintenance",
        "focus": ["MaintenanceTicket"],
        "refs": ["Tenant", "Space", "Booking", "User"],
        "settings": ["skinparam nodesep 45", "skinparam ranksep 55"],
    },
    "class-06b-notifications-audit-reports": {
        "title": "Class diagram — package Operations and supervision (2/2): notifications, audit, reports",
        "focus": ["Notification", "AuditLog", "Report"],
        "refs": ["Tenant", "User"],
        "settings": ["skinparam nodesep 45", "skinparam ranksep 55"],
        "extra": ["Notification -[hidden]down- AuditLog"],
    },
}

# --------------------------------------------------------------------------- overview
PKG_ALIAS = {"Organisations and identity": "OI", "Property portfolio": "PP", "Applications and bookings": "AB",
             "Leases and billing": "LB", "Operations and supervision": "OS"}
# Package dependencies: from the package that holds the foreign keys to the package it references.
PKG_DEPS = [
    ("AB", "PP", "Space, AddOnService"),
    ("AB", "OI", "Tenant, User"),
    ("AB", "LB", "Invoice, Payment"),
    ("LB", "OI", "Tenant, User"),
    ("PP", "OI", "Tenant"),
    ("OI", "PP", "Space"),
    ("OS", "OI", "Tenant, User"),
    ("OS", "PP", "Space"),
    ("OS", "AB", "Booking"),
]


def build_overview(name):
    """UML package diagram: one package symbol per package listing its entities, and the
    dependencies between packages (a package edge, unlike a frame edge, keeps its label
    next to its line)."""
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated from backend/prisma/schema.prisma by tools/gen_class.py; edit the generator, not this file.",
           f"skinparam linetype {os.environ.get('LT') or 'splines'}", "skinparam nodesep 50", "skinparam ranksep 70",
           "title Domain model overview — packages, entities and dependencies", ""]
    for pkg, models in PACKAGES:
        out += [f"folder {PKG_ALIAS[pkg]} [", f"**{pkg}**", "----", *models, "]"]
    out.append("")
    for a, b, label in PKG_DEPS:
        out.append(f"{a} ..> {b} : {label}")
    out += ["", "legend bottom right",
            "Package symbols list the entities of each package. A dependency goes from",
            "the package holding the foreign key to the package it references; the label",
            "lists the referenced entities. Attributes and associations: one diagram per package.",
            "endlegend", "@enduml"]
    return NL.join(out) + NL


# ------------------------------------------------------------------------ enumerations
ENUMS_TS = os.path.join(ROOT, "..", "..", "backend", "src", "constants", "enums.ts")
ENUM_NAME = {   # constant of enums.ts -> enumeration name used in the diagrams
    "SITE_STATUS": "SiteStatus", "CONTRACT_ITEM_TYPE": "ContractItemType",
    "DEPOSIT_REFUND_STATUS": "DepositRefundStatus",
    "TENANT_STATUS": "TenantStatus", "TENANT_APPLICATION_STATUS": "TenantApplicationStatus",
    "USER_ROLE": "UserRole", "ORGANIZATION_TYPE": "OrganizationType", "USER_STATUS": "UserStatus",
    "SPACE_TYPE": "SpaceType", "SPACE_STATUS": "SpaceStatus",
    "BOOKING_APPLICATION_STATUS": "BookingApplicationStatus", "BOOKING_STATUS": "BookingStatus",
    "BOOKING_DOCUMENT_TYPE": "BookingDocumentType", "CONTRACT_STATUS": "ContractStatus",
    "INVOICE_STATUS": "InvoiceStatus", "PAYMENT_STATUS": "PaymentStatus",
    "NOTIFICATION_TYPE": "NotificationType", "NOTIFICATION_CHANNEL": "NotificationChannel",
    "NOTIFICATION_PRIORITY": "NotificationPriority", "AUDIT_ACTION": "AuditAction",
    "AUDIT_SEVERITY": "AuditSeverity", "TICKET_CATEGORY": "TicketCategory", "TICKET_PRIORITY": "TicketPriority",
    "TICKET_STATUS": "TicketStatus", "BILLING_CYCLE": "BillingCycle", "DISCOUNT_TYPE": "DiscountType",
    "REPORT_TYPE": "ReportType", "REPORT_FORMAT": "ReportFormat", "INVOICE_TYPE": "InvoiceType",
    "PAYMENT_METHOD": "PaymentMethod",
}


def parse_enums():
    src = open(ENUMS_TS, encoding="utf-8").read().replace("\r\n", NL)
    enums = {}
    for m in re.finditer(r"export const (\w+) = \{(.*?)\} as const;", src, re.S):
        if m.group(1) not in ENUM_NAME:
            continue
        values, deprecated = [], False
        for line in m.group(2).split(NL):
            if "@deprecated" in line:
                deprecated = True
                continue
            v = re.match(r"\s*\w+:\s*'([^']*)'", line)
            if v:
                values.append(v.group(1) + (" «deprecated»" if deprecated else ""))
                deprecated = False
        enums[ENUM_NAME[m.group(1)]] = values
    # applicant_type is validated by the DTO literal type 'INDIVIDUAL' | 'COMPANY', not by enums.ts
    enums["ApplicantType"] = ["INDIVIDUAL", "COMPANY"]
    return enums


ENUM_SPECS = {
    "class-07a-enumerations-identity-bookings": (
        "Enumerations (1/2) — organisations, portfolio, applications and bookings",
        [("Organisations and identity", ["OrganizationType", "TenantStatus", "TenantApplicationStatus", "UserRole",
                                         "UserStatus"]),
         ("Property portfolio", ["SpaceType", "SpaceStatus", "BillingCycle"]),
         ("Applications and bookings", ["ApplicantType", "BookingApplicationStatus", "BookingStatus",
                                        "BookingDocumentType"])]),
    "class-07b-enumerations-billing-operations": (
        "Enumerations (2/2) — leases and billing, operations and supervision",
        [("Leases and billing", ["ContractStatus", "InvoiceType", "InvoiceStatus", "DiscountType", "PaymentMethod",
                                 "PaymentStatus"]),
         ("Operations and supervision", ["TicketCategory", "TicketPriority", "TicketStatus", "NotificationType",
                                         "NotificationChannel", "NotificationPriority", "AuditAction",
                                         "AuditSeverity", "ReportType", "ReportFormat"])]),
}


def build_enums(name, title, groups, columns=4):
    enums = parse_enums()
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated from backend/src/constants/enums.ts by tools/gen_class.py; edit the generator, not this file.",
           "hide circle", "hide empty methods", "skinparam nodesep 25", "skinparam ranksep 30",
           f"title {title}", ""]
    for pkg, names in groups:
        out.append(f'package "{pkg}" {{')
        for n in names:
            out.append(f"  enum {n} <<enumeration>> {{")
            out += ["    " + v for v in enums[n]]
            out.append("  }")
        out.append("}")
    out.append("")
    # grid: at most `columns` enumerations per row; packages follow each other downwards
    previous_row = None
    for pkg, names in groups:
        rows = [names[i:i + columns] for i in range(0, len(names), columns)]
        for row in rows:
            if previous_row:
                out.append(f"{previous_row[0]} -[hidden]down- {row[0]}")
            for left, right in zip(row, row[1:]):
                out.append(f"{left} -[hidden]right- {right}")
            previous_row = row
    out += ["", "legend bottom right",
            "Stored as String columns; the values are the constants of",
            "backend/src/constants/enums.ts (ApplicantType: DTO literal type).", "endlegend", "@enduml"]
    return NL.join(out) + NL


# ----------------------------------------------------------------------- service layer
SRC = os.path.join(ROOT, "..", "..", "backend", "src")
# service class: (source file, key public methods). Signatures are read from the source.
SERVICES = {
    "AuthService": ("auth/auth.service.ts", ["login", "refreshToken", "logout", "register", "registerTenant",
                                             "requestPasswordReset", "resetPassword", "listSessions",
                                             "revokeSession", "getLoginActivity", "generateTokens"]),
    "UserService": ("user/user.service.ts", ["createForUser", "inviteForUser", "findAllForUser", "updateForUser",
                                             "removeForUser", "changePassword"]),
    "TenantService": ("tenant/tenant.service.ts", ["provisionClient", "findAllForUser", "suspend", "activate",
                                                   "getMyOrganization", "updateMyOrganization"]),
    "TenantApplicationService": ("forms/tenant-application.service.ts", ["listPending", "approve", "reject"]),
    "FormService": ("forms/form.service.ts", ["createTypeformInquiry"]),
    "TypeformWebhookService": ("forms/typeform-webhook.service.ts", ["verifySignature", "handlePayload"]),
    "BuildingService": ("building/building.service.ts", ["createForUser", "findAllForUser", "updateForUser",
                                                         "removeForUser"]),
    "FloorService": ("floor/floor.service.ts", ["createForUser", "findAllForUser", "ensureDefaultForBuilding",
                                                "updateForUser", "removeForUser"]),
    "SpaceService": ("space/space.service.ts", ["findPublishedForMap", "create", "update", "remove", "isAvailable",
                                                "updateStatus", "updateMapPosition", "clearMapPosition"]),
    "AddonServiceService": ("addon-service/addon-service.service.ts", ["create", "findActive", "update", "activate",
                                                                      "deactivate", "getUsageStats"]),
    "BookingApplicationService": ("booking-application/booking-application.service.ts",
                                  ["createGuest", "create", "findAllForUser", "accept", "refuse"]),
    "BookingService": ("booking/booking.service.ts", ["create", "approve", "reject", "cancel", "checkIn", "checkOut",
                                                      "confirmPhoneCall", "markPhoneUnreachable",
                                                      "markDocumentsPending", "addDocument", "finalizeBooking",
                                                      "getWorkflowQueues"]),
    "LeaseContractService": ("lease-contract/lease-contract.service.ts",
                             ["create", "signForUser", "renewForUser", "terminateForUser",
                              "getExpiringContractsForUser", "markExpiredContracts", "sendExpiryReminders"]),
    "BillingService": ("billing/billing.service.ts", ["createInvoice", "generateInvoiceFromBooking", "sendInvoice",
                                                      "cancelInvoice", "addInvoiceLine", "createPayment",
                                                      "confirmPayment", "refundPayment", "uploadChequeDocument",
                                                      "getOverdueInvoices", "sendOverdueReminders",
                                                      "getFinancialSummary"]),
    "PromotionCodeService": ("promotion-code/promotion-code.service.ts", ["create", "findAll", "update", "remove",
                                                                         "validate", "apply"]),
    "MaintenanceService": ("maintenance/maintenance.service.ts", ["createForUser", "assign", "accept",
                                                                  "startProgress", "resolve", "close", "cancel"]),
    "NotificationService": ("notification/notification.service.ts", ["create", "findAll", "markAsRead",
                                                                     "markAllAsRead", "getUnreadCount",
                                                                     "updatePreferences"]),
    "AuditService": ("audit/audit.service.ts", ["log", "findAll", "getStats"]),
    "ReportService": ("report/report.service.ts", ["getTemplates", "generateAndSave", "findAllForUser",
                                                   "getDownloadPayloadForUser"]),
    "EmailSequenceService": ("email-sequence/email-sequence.service.ts",
                             ["startOnboardingAfterFirstLeaseSigned", "processOnboardingDrip",
                              "sendInvoiceGenerated", "sendOverdueReminder"]),
    "ScheduledService": ("tasks/scheduled.service.ts", ["runDailyReminders"]),
    "UploadService": ("upload/upload.service.ts", ["uploadSpacePhotos", "uploadFloorPlan", "uploadBookingDocument",
                                                   "uploadPaymentCheque", "uploadUserAvatar"]),
}
CRON = {("ScheduledService", "runDailyReminders"): "0 8 * * *",
        ("EmailSequenceService", "processOnboardingDrip"): "0 9 * * *"}
# Constructor-injected dependencies (NestJS), as declared in each service's constructor.
INJECTS = {
    "AuthService": ["PrismaService", "JwtService", "MailService", "AuditService", "NotificationService"],
    "UserService": ["PrismaService", "MailService", "AuthService"],
    "TenantService": ["PrismaService", "MailService"],
    "TenantApplicationService": ["PrismaService", "AuthService"],
    "FormService": ["PrismaService"],
    "TypeformWebhookService": ["PrismaService", "MailService", "NotificationService"],
    "BuildingService": ["PrismaService", "AccessPolicyService"],
    "FloorService": ["PrismaService", "AccessPolicyService"],
    "SpaceService": ["PrismaService", "AccessPolicyService"],
    "AddonServiceService": ["PrismaService"],
    "PromotionCodeService": ["PrismaService"],
    "BookingApplicationService": ["PrismaService", "MailService", "NotificationService", "AuthService",
                                  "BillingService"],
    "BookingService": ["PrismaService", "MailService", "NotificationService", "AuditService", "BillingService",
                       "LeaseContractService", "AccessPolicyService", "UploadService"],
    "LeaseContractService": ["PrismaService", "MailService", "EmailSequenceService"],
    "BillingService": ["PrismaService", "MailService", "EmailSequenceService", "UploadService"],
    "MaintenanceService": ["PrismaService", "MailService", "EmailSequenceService"],
    "NotificationService": ["PrismaService", "NotificationsGateway"],
    "AuditService": ["PrismaService"],
    "ReportService": ["PrismaService"],
    "EmailSequenceService": ["PrismaService", "BrevoService"],
    "ScheduledService": ["LeaseContractService", "BillingService"],
}
STEREO = {"PrismaService": "repository", "NotificationsGateway": "gateway", "JwtService": "library"}


def signature(cls, method):
    path, _ = SERVICES[cls]
    src = open(os.path.join(SRC, path), encoding="utf-8").read()
    m = re.search(r"^  (?:async\s+)?" + method + r"\s*\(", src, re.M)
    if not m:
        sys.exit(f"{cls}.{method} not found in {path}")
    depth, i = 1, m.end()
    while depth:                                         # the parameter list may span lines
        depth += {"(": 1, ")": -1}.get(src[i], 0)
        i += 1
    params = re.sub(r"\s+", " ", src[m.end():i - 1])
    names, depth, cur = [], 0, ""
    for ch in params + ",":
        if ch in "<({[":
            depth += 1
        elif ch in ">)}]":
            depth -= 1
        if ch == "," and depth == 0:
            p = cur.strip()
            if p:
                names.append(re.split(r"[?:=]", p.replace("readonly ", ""), 1)[0].strip())
            cur = ""
        else:
            cur += ch
    tail = f"  «cron {CRON[(cls, method)]}»" if (cls, method) in CRON else ""
    return f"+ {method}({', '.join(names)}){tail}"


SERVICE_SPECS = {
    "class-08a-services-identity": (
        "Service layer (1/4) — organisations, users and authentication",
        ["AuthService", "UserService", "TenantService", "TenantApplicationService", "FormService",
         "TypeformWebhookService"], "Identity services"),
    "class-08b-services-portfolio-bookings": (
        "Service layer (2/4) — property portfolio, applications and bookings",
        ["BuildingService", "FloorService", "SpaceService", "AddonServiceService", "BookingService",
         "BookingApplicationService"], "Portfolio and booking services"),
    "class-08c-services-leases-billing": (
        "Service layer (3/4) — leases, billing and scheduled jobs",
        ["ScheduledService", "LeaseContractService", "BillingService", "PromotionCodeService"],
        "Lease and billing services"),
    "class-08d-services-operations": (
        "Service layer (4/4) — maintenance, e-mail sequences, notifications, audit, reports",
        ["MaintenanceService", "EmailSequenceService", "NotificationService", "AuditService", "ReportService"],
        "Operations services"),
}


def build_services(name, title, services, frame, settings=(), extra=()):
    """Services that inject PrismaService sit in one package frame with a single dependency
    from the frame to PrismaService (UML: a package dependency applies to every element in it)."""
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated by tools/gen_class.py: signatures are read from backend/src; edit the generator.",
           "hide circle", "hide empty members", f"skinparam linetype {os.environ.get('LT') or 'splines'}",
           "left to right direction", "skinparam nodesep 18", "skinparam ranksep 70", *settings,
           f"title {title}", ""]
    with_prisma = [c for c in services if "PrismaService" in INJECTS.get(c, [])]
    others = [c for c in services if c not in with_prisma]

    def block(cls, indent):
        lines = [f"{indent}class {cls} <<service>> {{"]
        lines += [indent + "  " + signature(cls, mth) for mth in SERVICES[cls][1]]
        return lines + [indent + "}"]
    out.append(f'package "{frame}" as SVC {{')
    for cls in with_prisma:
        out += block(cls, "  ")
    out.append("}")
    for cls in others:
        out += block(cls, "")
    refs = []
    for cls in services:
        for dep in INJECTS.get(cls, []):
            if dep not in services and dep not in refs:
                refs.append(dep)
    for r in refs:
        out.append(f"class {r} <<{STEREO.get(r, 'service')}>>")
    out += ["", "SVC ..> PrismaService"]
    for cls in services:
        for dep in INJECTS.get(cls, []):
            if dep == "PrismaService" and cls in with_prisma:
                continue
            # a dependency between two services of this diagram does not decide the layout:
            # every service stays in the left column, the services it uses on the right.
            out.append(f"{cls} .[norank].> {dep}" if dep in services else f"{cls} ..> {dep}")
    out += list(extra)
    out += ["", "legend bottom right",
            "Dashed arrows: «use» dependencies injected through the constructor (NestJS).",
            f"The dependency from the frame applies to every service in it.",
            "Classes shown by name only are detailed in another service-layer diagram.",
            "PrismaService extends PrismaClient: the repository over the PostgreSQL database.",
            "endlegend", "@enduml"]
    return NL.join(out) + NL


PKG_COLOUR = {   # header colour of each package in the complete diagram (legend below)
    "Organisations and identity": "#DCE8F5",
    "Property portfolio": "#DDEFE2",
    "Applications and bookings": "#FBE3D3",
    "Leases and billing": "#ECE5F6",
    "Operations and supervision": "#E3F1F4",
}


def build_complete(name="class-00-complete", columns=int(os.environ.get("COLS", "11"))):
    """Every entity with its attributes, every association, and every enumeration.

    Orthogonal lines; every package keeps its frame and its own header colour (legend);
    the enumerations sit in one frame below the entities, in a grid, with no line through
    it. Association verbs are left to the per-package diagrams; ends keep their
    multiplicity and role name (a role name at the Tenant or User end becomes the
    association name, because those two classes carry most of the lines).
    """
    enums = parse_enums()
    lt = os.environ.get("LT") or "ortho"
    frames = os.environ.get("FRAMES", "1") == "1"
    verbs = os.environ.get("VERBS") == "1"
    out = [f"@startuml {name}", "'@@STYLE@@",
           "' Generated from backend/prisma/schema.prisma and backend/src/constants/enums.ts by",
           "' tools/gen_class.py; edit the generator, not this file.",
           "hide circle", "hide empty members", "hide <<entity>> stereotype",
           f"skinparam linetype {lt}",
           f"skinparam nodesep {os.environ.get('NS', '70')}", f"skinparam ranksep {os.environ.get('RS', '90')}",
           "skinparam ArrowFontSize 11"]
    for k, (pkg, _) in enumerate(PACKAGES):
        out.append(f"skinparam ClassHeaderBackgroundColor<<P{k}>> {PKG_COLOUR[pkg]}")
    out += ["hide <<P0>> stereotype", "hide <<P1>> stereotype", "hide <<P2>> stereotype",
            "hide <<P3>> stereotype", "hide <<P4>> stereotype",
            "title Complete class diagram — LeaseManager domain model: 25 entities, 31 enumerations", ""]
    for k, (pkg, models) in enumerate(PACKAGES):
        if frames:
            out.append(f'package "{pkg}" {{')
        for m in models:
            out.append(f"  class {m} <<P{k}>> {{")
            out += ["    " + a for a in attribute_lines(m)]
            out.append("  }")
        if frames:
            out.append("}")
    out.append("")
    for aid, (a, ma, kind, b, mb, label, ra, rb) in ASSOC.items():
        lab = label if (verbs or (label and not label.endswith(">") and not label.startswith("<"))) else ""
        if ra and a in ("Tenant", "User") and not lab:
            # a role name at the crowded hub end reads better as the association name
            lab, ra = ra, ""
        out.append(f"{a} {end_label(ma, ra)} {kind} {end_label(mb, rb)} {b}" + (f" : {lab}" if lab else ""))
    out.append("")
    groups = [g for spec in ENUM_SPECS.values() for g in spec[1]]
    # declared in enums.ts but typing no column: Building.status keeps a plain String, and
    # contract items and deposits are service stubs with no model in the schema
    groups.append(("Not bound to a column", ["SiteStatus", "ContractItemType", "DepositRefundStatus"]))
    out.append('package "Enumerations (backend/src/constants/enums.ts)" as ENUMS {')
    for pkg, names in groups:
        for n in names:
            out.append(f"  enum {n} <<enumeration>> {{")
            out += ["    " + v for v in enums[n]]
            out.append("  }")
    out.append("}")
    names = [n for _, ns in groups for n in ns]
    rows = [names[i:i + columns] for i in range(0, len(names), columns)]
    for anchor in os.environ.get("ENUM_ANCHOR", "InvoiceLine,BookingDocument,AuditLog").split(","):
        out.append(f"{anchor} -[hidden]down- {rows[0][0]}")
    for r1, r2 in zip(rows, rows[1:]):
        out.append(f"{r1[0]} -[hidden]down- {r2[0]}")
    for row in rows:
        for x, y in zip(row, row[1:]):
            out.append(f"{x} -[hidden]right- {y}")
    legend = ["", "legend bottom right", "|= Header colour |= Package |"]
    for pkg, _ in PACKAGES:
        legend.append(f"|<back:{PKG_COLOUR[pkg]}>          </back>| {pkg} |")
    legend += ["Foreign keys are drawn as the associations they implement, with the multiplicity at each",
               "end and the Prisma relation field as role name. Filled diamond: composition (the part is",
               "deleted with the whole); hollow diamond: aggregation. Enumeration-typed attributes are",
               "stored as String columns; ApplicantType is the DTO literal type of applicant_type.",
               "SiteStatus, ContractItemType and DepositRefundStatus are declared in enums.ts but type no column.",
               "endlegend", "@enduml"]
    out += legend
    return NL.join(out) + NL


def outputs():
    yield "class-00-complete", build_complete()
    yield "class-01-overview", build_overview("class-01-overview")
    for name, spec in SPECS.items():
        yield name, build(name, spec)
    for name, (title, groups) in ENUM_SPECS.items():
        yield name, build_enums(name, title, groups)
    for name, (title, services, frame) in SERVICE_SPECS.items():
        yield name, build_services(name, title, services, frame)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else ROOT
    only = sys.argv[2:] if len(sys.argv) > 2 else None
    for name, text in outputs():
        if only and not any(name.startswith(o) for o in only):
            continue
        with open(os.path.join(target, name + ".puml"), "w", encoding="utf-8", newline=NL) as f:
            f.write(text)
        print("wrote", name)
