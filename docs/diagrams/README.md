# LeaseManager — UML diagrams

42 PlantUML diagrams for the final-year report, drawn from the code. They use the
entities of `backend/prisma/schema.prisma`, the values of `backend/src/constants/enums.ts`,
the controllers and services of `backend/src`, and the React pages of `frontend/src`.
Every diagram is one `.puml` file in this folder. `out/` holds each rendering as a
vector PDF (for `\includegraphics`), an SVG, and a 200 dpi PNG (for slides).

## Render

```bash
python tools/gen_class.py       # class diagrams, regenerated from schema.prisma and the services
python tools/gen_usecase.py     # the five use case diagrams, from one use case model
python tools/render.py          # every diagram → out/*.svg, out/*.png, out/*.pdf + A4 report
python tools/render.py seq uc   # only the files whose name starts with seq or uc
python tools/latex_figures.py   # latex-figures.tex: one figure per diagram, English captions
```

You need Java and Graphviz. `plantuml.jar` 1.2024.7 is in this folder. The PDF step uses
`rsvg-convert` when it is installed, otherwise headless Chrome or Edge. `render.py` stops
on the first PlantUML error. For each diagram it reports the size of the 13 pt body text
once the drawing is fitted to an A4 text block of 16 × 24 cm.

## Style

`tools/style-header.puml` is the common style header. `render.py` stamps it, identical,
at the top of every file through `tools/stamp_header.py`. To change the style, edit that
file and render again. The style follows the usual UML style guides (Ambler, *The
Elements of UML 2.0 Style*): few crossing lines, specialised actors and classes below
their parent, included and extending use cases to the right of the base use case, start
of every flow at the top left.

- Arial 13, navy ink `#1F3A5F`, slate lines, no shadows, rounded corners.
- One light fill per element family: use cases, actions, states and participants in
  blue; enumerations in amber; «service» classes in green; «repository» and the database
  in purple; notes and legends in pale yellow.
- A class of another package is drawn by name only, with a dashed grey frame.
- Sequence diagrams group their lifelines in three boxes: front end (React), back end
  (NestJS) and data (PostgreSQL), plus an external box for the LLM provider.
- Line routing: splines everywhere, except `class-03` and `class-05a` (orthogonal),
  where they give fewer crossings.

## Diagrams

| File | Caption | A4 page | Text on A4 |
|---|---|---|---|
| `uc-01-complete` | Global use case diagram of LeaseManager: every actor and its main use cases | portrait | 2.6 pt |
| `uc-02-visitor` | Use case diagram: the Visitor | portrait | 7.4 pt |
| `uc-03-platform-owner` | Use case diagram: the Platform Owner | portrait | 9.1 pt |
| `uc-04-landlord-staff` | Use case diagram: the property company (Company Administrator, Property Manager, Receptionist, Finance Officer, Maintenance Technician) | portrait | 6.5 pt |
| `uc-05-tenant` | Use case diagram: the renter company (Tenant Administrator, Tenant Employee) | portrait | 8.1 pt |
| `uc-06-complete-detailed` | Detailed use case diagram: every use case of LeaseManager | portrait | 1.7 pt |
| `class-00-complete` | Complete class diagram of the domain model: every entity with its attributes, every association and every enumeration | portrait | 1.9 pt |
| `class-01-overview` | Domain model overview: packages, entities and package dependencies | portrait | 7.3 pt |
| `class-02-organisations-identity` | Class diagram of the Organisations and identity package | portrait | 7.9 pt |
| `class-03-property-portfolio` | Class diagram of the Property portfolio package | portrait | 6.6 pt |
| `class-04a-booking-applications` | Class diagram of the Applications and bookings package (1/2): booking applications | portrait | 8.2 pt |
| `class-04b-bookings` | Class diagram of the Applications and bookings package (2/2): bookings | portrait | 7.8 pt |
| `class-05a-contracts-invoices` | Class diagram of the Leases and billing package (1/2): lease contracts and invoices | portrait | 7.5 pt |
| `class-05b-payments` | Class diagram of the Leases and billing package (2/2): payments | portrait | 10.7 pt |
| `class-06a-maintenance` | Class diagram of the Operations and supervision package (1/2): maintenance tickets | portrait | 8.9 pt |
| `class-06b-notifications-audit-reports` | Class diagram of the Operations and supervision package (2/2): notifications, audit logs and reports | portrait | 7.5 pt |
| `class-07a-enumerations-identity-bookings` | Enumerations (1/2): organisations, property portfolio, applications and bookings | portrait | 7.7 pt |
| `class-07b-enumerations-billing-operations` | Enumerations (2/2): leases and billing, operations and supervision | portrait | 6.8 pt |
| `class-08a-services-identity` | Service layer (1/4): organisation, user and authentication services | portrait | 7.5 pt |
| `class-08b-services-portfolio-bookings` | Service layer (2/4): property portfolio, application and booking services | portrait | 6.5 pt |
| `class-08c-services-leases-billing` | Service layer (3/4): lease, billing and scheduled-job services | portrait | 9.0 pt |
| `class-08d-services-operations` | Service layer (4/4): maintenance, e-mail sequence, notification, audit and report services | portrait | 8.1 pt |
| `seq-01a-authentication-login` | Sequence diagram: authentication (1/2), login | landscape | 6.2 pt |
| `seq-01b-authentication-refresh-token` | Sequence diagram: authentication (2/2), access-token refresh | landscape | 6.1 pt |
| `seq-02a-booking-application-submit` | Sequence diagram: booking application (1/4), a visitor applies for a space | landscape | 6.1 pt |
| `seq-02b-booking-application-accept` | Sequence diagram: booking application (2/4), the property manager accepts the application | landscape | 6.0 pt |
| `seq-02c-booking-reception-intake` | Sequence diagram: booking application (3/4), phone call and site visit | landscape | 6.1 pt |
| `seq-02d-booking-documents-finalize` | Sequence diagram: booking application (4/4), supporting documents and finalization | landscape | 6.2 pt |
| `seq-03a-lease-contract-create` | Sequence diagram: lease contract (1/2), the property manager creates the contract | landscape | 8.7 pt |
| `seq-03b-lease-contract-sign` | Sequence diagram: lease contract (2/2), the tenant administrator signs the contract | landscape | 6.6 pt |
| `seq-04a-invoice-create-send` | Sequence diagram: invoice and payment (1/3), creating and sending an invoice | landscape | 6.1 pt |
| `seq-04b-payment-report` | Sequence diagram: invoice and payment (2/3), the tenant reports a payment | landscape | 6.5 pt |
| `seq-04c-payment-confirm` | Sequence diagram: invoice and payment (3/3), the finance officer confirms the payment | landscape | 6.8 pt |
| `seq-05a-ai-maintenance-triage` | Sequence diagram: AI assistance (1/2), maintenance ticket triage | landscape | 4.5 pt |
| `seq-05b-ai-space-finder` | Sequence diagram: AI assistance (2/2), the public space finder | landscape | 4.8 pt |
| `stm-01-booking` | State machine diagram of a booking | landscape | 6.1 pt |
| `stm-02-maintenance-ticket` | State machine diagram of a maintenance ticket | landscape | 7.5 pt |
| `stm-03-invoice` | State machine diagram of an invoice | portrait | 8.3 pt |
| `stm-04-lease-contract-payment` | State machine diagrams of a lease contract and of a payment | portrait | 7.6 pt |
| `act-01a-lease-lifecycle-application` | Activity diagram: lease lifecycle (1/3), application and review | portrait | 8.2 pt |
| `act-01b-lease-lifecycle-reception` | Activity diagram: lease lifecycle (2/3), reception and finalization | portrait | 7.7 pt |
| `act-01c-lease-lifecycle-contract` | Activity diagram: lease lifecycle (3/3), lease contract and end of lease | portrait | 8.2 pt |
| `dep-01-architecture-deployment` | Deployment diagram of LeaseManager (Docker Compose) | portrait | 7.0 pt |

Flows too large for one A4 page are split into parts: (1/2), (2/2) and so on. The
sequence diagrams and the larger state diagrams take a landscape page (`sidewaysfigure`
in `latex-figures.tex`). The two AI sequence diagrams are the densest: print them on a
full landscape page, or use the PNG on a slide.

## Modelling conventions

**Actors.** These are the platform roles:

| Actor | Role in the code |
|---|---|
| Visitor | no account |
| Platform Owner | `SUPER_ADMIN` |
| Company Administrator | `CLIENT_ADMIN`, owner of the property company |
| Property Manager | `MANAGER`, a specialisation of Company Administrator |
| Finance Officer | `FINANCE` |
| Receptionist | `RECEPTIONIST` |
| Maintenance Technician | `MAINTENANCE` |
| Tenant Administrator | `TENANT_ADMIN`, head of the renter company |
| Tenant Employee | `TENANT_EMPLOYEE`, a specialisation of Tenant Administrator |

Each actor-to-use-case link matches the `@Roles` of the routes the use case calls and the
pages the role can open (`frontend/src/permissions/can.ts`). The use case diagrams are
generated by `tools/gen_usecase.py`, so they cannot contradict each other:

- `uc-01` to `uc-05` are the presentation diagrams: one use case per main feature, no
  «extend» sub-cases. `uc-01` shows every actor; `uc-02` to `uc-05` show one group each
  (Visitor; Platform Owner; property company and its staff; renter company).
- `uc-06-complete-detailed` shows every use case with its «extend» sub-cases, for the
  report appendix.
- Within a parent/child pair of actors, a use case is linked to one of the two only.

**Actor generalisation.** The hollow triangle points to the parent actor. The hierarchy
follows the two organisations:

- **Property Manager ──▷ Company Administrator.** The Company Administrator owns the
  property company; the Property Manager specialises him.
- **Tenant Employee ──▷ Tenant Administrator.** The Tenant Administrator heads the renter
  company; the Tenant Employee specialises him.
- In `uc-01`, the Company Administrator, the Tenant Administrator and the other staff roles
  specialise the abstract **Signed-in User**, which carries the account use cases
  (authenticate, profile, sessions, notifications, dashboard, search).

Each actor is linked to the use cases it performs itself.

**Authenticate.** In `uc-01` and `uc-03` to `uc-05`, *Authenticate* is a use case drawn on
the right of the system, and every use case of a signed-in actor «include»s it (dashed
arrow towards *Authenticate*). The Visitor's use cases need no account. The detailed
appendix diagram `uc-06` states the same rule in a note.

**Reports.** *Consult BI reports* is the owner-reports page: Power BI and Tableau
dashboards embedded per organisation (`reporting_embeds`). The `/reports` API exists in
the back end but no page calls it, so it is not drawn as a use case.

**Class diagrams.** These are generated, never hand-edited. `class-00-complete` holds
every entity (25) with its attributes, every association (54) and every enumeration
(31: the 30 enumerations of `enums.ts`, plus `ApplicantType`). Lines are orthogonal; each
package keeps its frame and its own header colour, and the enumerations sit in one frame
below the entities. The other class diagrams show the same model one package at a time.

- **Attributes.** They keep their Prisma types. Optional fields are marked `[0..1]`;
  `{id}`, `{unique}` and `{updatedAt}` are shown as constraints.
- **Foreign keys.** They are not listed as attributes; they appear as the associations
  they implement.
- **Enumerations.** Fields whose values are the constants of `enums.ts` are typed with
  that enumeration. The values are stored as `String`, and the enumeration diagrams list
  them. `ApplicantType` is the DTO literal type `'INDIVIDUAL' | 'COMPANY'`.
- **Composition.** It marks whole–part relations whose parts are deleted with the whole:
  Tenant ◆ Building ◆ Floor ◆ Space ◆ SpaceFeature, Invoice ◆ InvoiceLine and similar.
  Aggregation marks LeaseContract ◇ Invoice, since invoices survive their contract
  (`onDelete: SetNull`).
- **Join models.** `SpaceAddOnService`, `BookingAddOn` and `BookingApplicationAddOn` each
  have their own `id`. Each is drawn as a class composed by its owner and linked to
  `AddOnService`. A part has only one composite owner.
- **Role names.** These are the real Prisma relation fields: `reviewedBy`, `recordedBy`,
  `assignee`, `tenantCompany` and so on.
- **Cross-package classes.** A class from another package is shown by name only. The
  package frame is laid out but not drawn, and the package is named in the title.
- **Entities.** They have no methods, because they are Prisma models. The key methods
  are on the «service» classes of `class-08*`. Their signatures are read from the source
  files, and the dependencies drawn are the constructor-injected ones. `PrismaService`,
  which extends `PrismaClient`, is the «repository».

**Sequence diagrams.** They follow the real layers: React page «boundary» → NestJS
controller «control» → «service» → `PrismaService` «repository» → PostgreSQL. Messages
use the real routes and method names. An open arrowhead marks a call that is not
awaited, for example an e-mail.

**State machine diagrams.** Transitions carry the real service methods
(`confirmPhoneCall()`, `sendInvoice()`, `markExpiredContracts()` and so on), with their
guard in brackets and their effect after a slash.

**AI sequence diagrams.** `seq-05a` (maintenance triage) and `seq-05b` (public space
finder) show where the language model is called and where it is not: the model only
proposes a category, criteria or a short reply; data is always selected by a database
query.

**Left out on purpose.** Contract items and security deposits are not modelled:
`LeaseContractService.addItem` and `createDeposit` are stubs, and there is no model in
the schema. `PATCH /bookings/:id/generate-contract` is not shown either: no page calls
it, and it writes a `lease_contract_id` field that `Booking` does not have.
