# -*- coding: utf-8 -*-
"""
Write latex-figures.tex: one LaTeX figure per rendered diagram (out/<name>.pdf),
with its English caption and a label fig:<name>. A drawing that only reads well
on a rotated page goes in a sidewaysfigure (package rotating).

    python tools/latex_figures.py          # after python tools/render.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from render import a4_fit, svg_size  # noqa: E402

CAPTIONS = {
    "uc-01-complete": "Global use case diagram of LeaseManager: every actor and its main use cases",
    "uc-02-visitor": "Use case diagram: the Visitor",
    "uc-03-platform-owner": "Use case diagram: the Platform Owner",
    "uc-04-landlord-staff": "Use case diagram: the property company (Company Administrator, Property Manager, "
                            "Receptionist, Finance Officer, Maintenance Technician)",
    "uc-05-tenant": "Use case diagram: the renter company (Tenant Administrator, Tenant Employee)",
    "uc-06-complete-detailed": "Detailed use case diagram: every use case of LeaseManager",
    "uc-07-landlord-tenant": "Use case diagram: Landlord Tenant (client, level 2) and its staff roles",
    "uc-08-renter-tenant": "Use case diagram: Renter Tenant (renter, level 3) and its employees",
    "class-00-complete": "Complete class diagram of the domain model: every entity with its attributes, "
                         "every association and every enumeration",
    "class-01-overview": "Domain model overview: packages, entities and package dependencies",
    "class-02-organisations-identity": "Class diagram of the Organisations and identity package",
    "class-03-property-portfolio": "Class diagram of the Property portfolio package",
    "class-04a-booking-applications": "Class diagram of the Applications and bookings package (1/2): "
                                      "booking applications",
    "class-04b-bookings": "Class diagram of the Applications and bookings package (2/2): bookings",
    "class-05a-contracts-invoices": "Class diagram of the Leases and billing package (1/2): lease contracts "
                                    "and invoices",
    "class-05b-payments": "Class diagram of the Leases and billing package (2/2): payments",
    "class-06a-maintenance": "Class diagram of the Operations and supervision package (1/2): maintenance "
                             "tickets",
    "class-06b-notifications-audit-reports": "Class diagram of the Operations and supervision package (2/2): "
                                             "notifications, audit logs and reports",
    "class-07a-enumerations-identity-bookings": "Enumerations (1/2): organisations, property portfolio, "
                                                "applications and bookings",
    "class-07b-enumerations-billing-operations": "Enumerations (2/2): leases and billing, operations and "
                                                 "supervision",
    "class-08a-services-identity": "Service layer (1/4): organisation, user and authentication services",
    "class-08b-services-portfolio-bookings": "Service layer (2/4): property portfolio, application and "
                                             "booking services",
    "class-08c-services-leases-billing": "Service layer (3/4): lease, billing and scheduled-job services",
    "class-08d-services-operations": "Service layer (4/4): maintenance, e-mail sequence, notification, audit "
                                     "and report services",
    "seq-01a-authentication-login": "Sequence diagram: authentication (1/2), login",
    "seq-01b-authentication-refresh-token": "Sequence diagram: authentication (2/2), access-token refresh",
    "seq-02a-booking-application-submit": "Sequence diagram: booking application (1/4), a visitor applies "
                                          "for a space",
    "seq-02b-booking-application-accept": "Sequence diagram: booking application (2/4), the property manager "
                                          "accepts the application",
    "seq-02c-booking-reception-intake": "Sequence diagram: booking application (3/4), phone call and site "
                                        "visit",
    "seq-02d-booking-documents-finalize": "Sequence diagram: booking application (4/4), supporting documents "
                                          "and finalization",
    "seq-03a-lease-contract-create": "Sequence diagram: lease contract (1/2), the property manager creates "
                                     "the contract",
    "seq-03b-lease-contract-sign": "Sequence diagram: lease contract (2/2), the tenant administrator signs "
                                   "the contract",
    "seq-04a-invoice-create-send": "Sequence diagram: invoice and payment (1/3), creating and sending an "
                                   "invoice",
    "seq-04b-payment-report": "Sequence diagram: invoice and payment (2/3), the tenant reports a payment",
    "seq-04c-payment-confirm": "Sequence diagram: invoice and payment (3/3), the finance officer confirms "
                               "the payment",
    "seq-05a-ai-maintenance-triage": "Sequence diagram: AI assistance (1/2), maintenance ticket triage",
    "seq-05b-ai-space-finder": "Sequence diagram: AI assistance (2/2), the public space finder",
    "stm-01-booking": "State machine diagram of a booking",
    "stm-02-maintenance-ticket": "State machine diagram of a maintenance ticket",
    "stm-03-invoice": "State machine diagram of an invoice",
    "stm-04-lease-contract-payment": "State machine diagrams of a lease contract and of a payment",
    "act-01a-lease-lifecycle-application": "Activity diagram: lease lifecycle (1/3), application and review",
    "act-01b-lease-lifecycle-reception": "Activity diagram: lease lifecycle (2/3), reception and "
                                         "finalization",
    "act-01c-lease-lifecycle-contract": "Activity diagram: lease lifecycle (3/3), lease contract and end of "
                                        "lease",
    "dep-01-architecture-deployment": "Deployment diagram of LeaseManager (Docker Compose)",
}

ORDER = ["uc", "class", "seq", "stm", "act", "dep"]

if __name__ == "__main__":
    names = sorted((os.path.splitext(f)[0] for f in os.listdir(ROOT) if f.endswith(".puml")),
                   key=lambda n: (ORDER.index(n.split("-")[0]), n))
    missing = [n for n in names if n not in CAPTIONS]
    if missing:
        sys.exit("no caption for: " + ", ".join(missing))
    out = ["% Generated by docs/diagrams/tools/latex_figures.py from docs/diagrams/out/*.pdf.",
           "% Preamble:",
           "%   \\usepackage{graphicx}",
           "%   \\usepackage{rotating}              % sidewaysfigure, for the landscape diagrams",
           "%   \\graphicspath{{diagrams/out/}}     % folder that holds the PDFs, relative to the .tex file",
           ""]
    for n in names:
        w, h = svg_size(os.path.join(ROOT, "out", n + ".svg"))
        orient, _, _ = a4_fit(w, h)
        if orient == "portrait":
            out += ["\\begin{figure}[p]", "  \\centering",
                    f"  \\includegraphics[width=\\textwidth,height=0.82\\textheight,keepaspectratio]{{{n}}}",
                    f"  \\caption{{{CAPTIONS[n]}.}}", f"  \\label{{fig:{n}}}", "\\end{figure}", ""]
        else:
            out += ["\\begin{sidewaysfigure}", "  \\centering",
                    f"  \\includegraphics[width=\\textheight,height=0.82\\textwidth,keepaspectratio]{{{n}}}",
                    f"  \\caption{{{CAPTIONS[n]}.}}", f"  \\label{{fig:{n}}}", "\\end{sidewaysfigure}", ""]
    with open(os.path.join(ROOT, "latex-figures.tex"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out))
    print(f"wrote latex-figures.tex ({len(names)} figures)")
