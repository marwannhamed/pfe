# -*- coding: utf-8 -*-
"""
Contenu complet de la présentation Canva — 9 sections imposées.

Un bloc par diapositive : titre à reprendre, contenu à coller, note orale
séparée. A4 portrait, conçu pour être lu à côté de Canva.
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
AR = "<font name='Mono'>\u2192</font>"          # flèche : Georgia ne l'a pas

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
    cv.drawString(ML, MB - 7.5 * mm, "LeaseManager — Contenu de la présentation")
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


def sl(no, titre):
    t = Table([[Paragraph(no, S["no"]), Paragraph(titre, S["h"])]],
              colWidths=[24 * mm, CW - 24 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                           ("LINEABOVE", (0, 0), (-1, 0), 0.9, ACC)]))
    return [Spacer(1, 6), t]


def part(n, titre, sous):
    t = Table([[[Paragraph("SECTION %s" % n, S["psub"]), Paragraph(titre, S["part"]),
                 Paragraph(sous, S["psub"])]]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACC2),
                           ("TOPPADDING", (0, 0), (-1, -1), 10),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 12)]))
    return [t, Spacer(1, 7)]


st = []

# ───────────────────────────── couverture ───────────────────────────────────
st += [Spacer(1, 34 * mm), P("Contenu de la présentation", "cov"), Spacer(1, 3 * mm),
       P("Les 9 sections, diapositive par diapositive", "covs"), Spacer(1, 7 * mm),
       HRFlowable(width="32%", thickness=0.8, color=LINE, hAlign="CENTER"),
       Spacer(1, 7 * mm), P("LeaseManager — Projet de Fin d'Études", "covs"),
       Spacer(1, 18 * mm)]
st += [tab([["Section", "Diapositives"],
            ["1 · Organisme d'accueil", "2"], ["2 · Problématique", "2"],
            ["3 · Étude et critique de l'existant", "3"], ["4 · Solution proposée", "4"],
            ["5 · Besoins fonctionnels et non fonctionnels", "6"],
            ["6 · Technologies utilisées", "2"], ["7 · Conception", "3"],
            ["8 · Avancement", "3"], ["9 · Conclusion et perspectives", "2"],
            ["<b>Total</b>", "<b>27</b>"]],
           [CW - 34 * mm, 34 * mm])]
st += [Spacer(1, 7),
       box("Comment lire ce document",
           "Un bloc par diapositive. Le titre est à reprendre tel quel, le contenu est à "
           "coller dans Canva. La mention «&nbsp;À dire&nbsp;» ne va <b>pas</b> sur la "
           "diapositive&nbsp;: elle va dans vos notes d'orateur."),
       Spacer(1, 5),
       box("Chiffres", "Tous relevés en base ou par exécution des tests le 29 septembre "
                       "2026. Vérifiables&nbsp;: un jury peut demander la source.", OK, OKW),
       PageBreak()]

# ═══════════ 1. ORGANISME D'ACCUEIL ═════════════════════════════════════════
st += part("1", "Organisme d'accueil", "2 diapositives")

st += sl("Diapo 1.1", "Présentation de l'entreprise")
st += [box("À compléter — je ne dispose pas de ces informations",
           "Reprenez la plaquette de l'entreprise ou son site. Ne pas inventer&nbsp;: "
           "un encadrant professionnel présent dans la salle le verrait.", WARN, WARNW),
       Spacer(1, 4),
       P("<b>Structure de la diapositive</b>"),
       bul(["<b>Raison sociale</b> et logo",
            "<b>Secteur d'activité</b> et date de création",
            "<b>Effectif</b> et implantation géographique",
            "<b>Métier principal</b> en une phrase",
            "<b>Positionnement</b>&nbsp;: quels clients, quels marchés"])]

st += sl("Diapo 1.2", "Contexte du stage")
st += [P("<b>Structure de la diapositive</b>"),
       bul(["<b>Service d'accueil</b> et sa mission",
            "<b>Encadrant professionnel</b>&nbsp;: nom et fonction",
            "<b>Durée</b> du stage et période",
            "<b>Mission confiée</b>&nbsp;: concevoir et réaliser une plateforme de "
            "gestion locative de bureaux multi-organisations"]),
       box("À dire", "Enchaîner rapidement. Cette section est attendue mais ne rapporte "
                     "pas de points techniques&nbsp;: deux minutes suffisent. "
                     "Terminez par la mission, qui amène la problématique.")]
st += [PageBreak()]

# ═══════════ 2. PROBLÉMATIQUE ═══════════════════════════════════════════════
st += part("2", "Problématique", "2 diapositives")

st += sl("Diapo 2.1", "Le métier : louer des bureaux à Doha")
st += [P("Une société immobilière détient des tours de bureaux et loue des surfaces à "
         "d'autres entreprises&nbsp;: bureaux privatifs, postes dédiés, salles de "
         "réunion, espaces événementiels."),
       P("<b>Trois familles d'acteurs interviennent sur la même donnée</b>"),
       tab([["Acteur", "Ce qu'il fait"],
            ["Le bailleur", "Détient les murs. Publie, instruit, approuve, facture, encaisse."],
            ["Le locataire", "Occupe les surfaces. Réserve, signe, règle, signale les pannes."],
            ["L'exploitation", "Réception (appels, visites), techniciens, service financier."]],
           [34 * mm, CW - 34 * mm]),
       Spacer(1, 4),
       P("<b>Deux règles propres au marché qatari</b>"),
       bul(["La location se conclut <b>en personne</b>&nbsp;: appel de confirmation, "
            "visite des lieux, dossier administratif, puis signature",
            "Le loyer ne se paie <b>pas en ligne</b>&nbsp;: espèces, virement ou chèque"])]

st += sl("Diapo 2.2", "La question posée")
st += [box("Formulation de la problématique",
           "Comment concevoir une plateforme unique qui serve <b>plusieurs sociétés "
           "immobilières concurrentes</b>, respecte un processus commercial "
           "présentiel, et garantisse qu'aucune organisation ne perçoive la moindre "
           "donnée d'une autre&nbsp;?"),
       Spacer(1, 5),
       P("<b>Trois difficultés à lever</b>"),
       bul(["<b>Cloisonnement.</b> Deux concurrents sur une même installation&nbsp;: ni "
            "une ligne, ni un total, ni un compteur en commun",
            "<b>Processus.</b> Représenter une séquence présentielle que les produits "
            "existants ignorent",
            "<b>Modèle.</b> Une même donnée appartient à deux organisations selon deux "
            "chemins différents"]),
       box("À dire", "Énoncer la problématique lentement, puis marquer un temps. C'est la "
                     "phrase que le jury notera pour juger la cohérence de tout le reste.")]
st += [PageBreak()]

# ═══════════ 3. ÉTUDE ET CRITIQUE DE L'EXISTANT ═════════════════════════════
st += part("3", "Étude et critique de l'existant", "3 diapositives")

st += sl("Diapo 3.1", "Les pratiques actuelles : tableur et courriel")
st += [tab([["Faiblesse", "Conséquence"],
            ["Disponibilité incertaine",
             "Aucune source unique&nbsp;; les conflits de réservation se découvrent trop tard"],
            ["Recouvrement manuel",
             "Échéances suivies de mémoire&nbsp;; délais d'encaissement allongés"],
            ["Incidents non tracés",
             "Ni délai de traitement, ni coût, ni historique par surface"],
            ["Absence de traçabilité",
             "Impossible d'établir qui a approuvé quoi, et quand&nbsp;; difficulté en "
             "cas de litige"]],
           [42 * mm, CW - 42 * mm])]

st += sl("Diapo 3.2", "Les progiciels du marché")
st += [P("Quatre inadéquations au besoin exprimé."),
       tab([["Limite", "Conséquence"],
            ["Un seul niveau de client",
             "Ne distingue pas qui loue les murs de qui les occupe " + AR +
             " impossible d'héberger plusieurs bailleurs concurrents"],
            ["Paiement en ligne imposé", "Inadapté à un marché au comptant"],
            ["Parcours entièrement dématérialisé",
             "Ignore l'appel de confirmation, la visite et le dossier papier"],
            ["Tarification à l'utilisateur",
             "Coût dissuasif pour une société dont le personnel d'exploitation est nombreux"]],
           [50 * mm, CW - 50 * mm]),
       box("À dire", "La première ligne est l'argument décisif&nbsp;: c'est elle qui "
                     "justifie que le projet existe. Ne pas la traiter comme une ligne "
                     "parmi d'autres.")]
st += [PageBreak()]

st += sl("Diapo 3.3", "Synthèse : le verrou technique")
st += [box("Diapositive de respiration — fond foncé, texte court",
           "<b>Deux sociétés concurrentes, une seule installation, zéro donnée en commun.</b>"
           "<br/><br/>Ni une ligne, ni un total, ni un compteur. Cette exigence, davantage "
           "que la liste des fonctionnalités, structure toute l'architecture qui suit."),
       Spacer(1, 5),
       P("Dans Canva&nbsp;: fond <font name='Mono'>#084449</font>, texte blanc, une seule "
         "phrase en très gros corps. Pas de puces, pas d'illustration."),
       box("À dire", "Charnière entre le problème et la solution. Marquer un arrêt de "
                     "deux secondes avant d'enchaîner.")]
st += [PageBreak()]

# ═══════════ 4. SOLUTION PROPOSÉE ═══════════════════════════════════════════
st += part("4", "Solution proposée", "4 diapositives")

st += sl("Diapo 4.1", "Un modèle de location à trois niveaux")
st += [P("Le cahier des charges prévoyait une gestion multi-tenant à <b>un seul "
         "niveau</b>. Le terrain en impose <b>deux, imbriqués</b>."),
       tab([["Niveau", "Acteur", "Périmètre de visibilité"],
            ["1", "Propriétaire de la plateforme",
             "Exploite le service. Seul rôle lisant au travers des organisations."],
            ["2", "Société immobilière (bailleur)",
             "Bâtiments, étages, surfaces. Publie, approuve, facture, encaisse. "
             "Son portefeuille uniquement."],
            ["3", "Société locataire (preneur)",
             "Réserve, signe, règle, signale. Ses données, plus la vitrine publique."]],
           [15 * mm, 46 * mm, CW - 61 * mm]),
       Spacer(1, 4),
       P("Implémentation&nbsp;: <font name='Mono'>tenants.organization_type</font> ∈ "
         "{ <font name='Mono'>CLIENT</font>, <font name='Mono'>RENTER</font> }"),
       box("À dire", "C'est l'apport du projet par rapport à la spécification. "
                     "Le présenter comme une analyse qui a fait évoluer le modèle, pas "
                     "comme un écart subi.")]

st += sl("Diapo 4.2", "La difficulté centrale   (diapositive à faire en grand)")
st += [P("Une réservation, ou un ticket, appartient à <b>deux organisations</b> par "
         "<b>deux chemins différents</b>."),
       tab([["LE LOCATAIRE", "LE BAILLEUR"],
            ["<font name='Mono'>tenant_id</font> porté sur la ligne<br/>"
             "<i>«&nbsp;c'est moi qui ai réservé&nbsp;»</i>",
             "<font name='Mono'>space " + "\u2192" + " floor " + "\u2192" +
             " building.tenant_id</font><br/><i>«&nbsp;ce sont mes murs&nbsp;»</i>"]],
           [CW / 2, CW / 2], head=L3),
       Spacer(1, 4),
       box("Conclusion de la diapositive",
           "Confondre ces deux chemins est à l'origine des <b>9 défauts de cloisonnement</b> "
           "détectés et corrigés pendant le développement.", WARN, WARNW),
       box("À dire", "La diapositive la plus importante de la présentation. Suivre les "
                     "deux flèches à voix haute.")]
st += [PageBreak()]

st += sl("Diapo 4.3", "Comment la règle est appliquée, route par route")
st += [tab([["#", "Étape", "Rôle"],
            ["1", "JwtAuthGuard", "Vérifie le jeton, peuple l'identité de l'appelant"],
            ["2", "RolesGuard", "Compare <font name='Mono'>@Roles(...)</font> au rôle réel"],
            ["3", "ValidationPipe", "Rejette les champs inattendus, ne les ignore pas"],
            ["4", "Contrôleur " + AR + " <font name='Mono'>*ForUser</font>",
             "Jamais la méthode non restreinte"],
            ["5", "AccessPolicyService", "Transforme l'appelant en filtre Prisma"]],
           [8 * mm, 44 * mm, CW - 52 * mm]),
       Spacer(1, 4),
       P("<font name='Mono'>isCrossTenantReader()</font> n'est vrai que pour le "
         "propriétaire de la plateforme.")]

st += sl("Diapo 4.4", "Architecture de déploiement")
st += [Paragraph("Navigateur " + "\u2192" + " nginx &nbsp;┬" + "\u2192" +
                 " SPA React (compilée)<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└" + "\u2192" +
                 " API NestJS " + "\u2192" + " Prisma " + "\u2192" + " PostgreSQL<br/>"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                 "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└" + "\u2192" +
                 " Socket.IO (notifications)", S["mono"]),
       Spacer(1, 4),
       P("<b>4 conteneurs</b> · une seule origine · aucun CORS · aucun nom d'hôte "
         "compilé dans le bundle"),
       P("Illustration&nbsp;: <font name='Mono'>docs/diagrams/09-deployment.png</font>")]
st += [PageBreak()]

# ═══════════ 5. BESOINS ═════════════════════════════════════════════════════
st += part("5", "Besoins fonctionnels et non fonctionnels", "6 diapositives")

st += sl("Diapo 5.1", "Couverture du cahier des charges")
st += [tab([["§ CDC", "Module", "État"],
            ["3.1", "Authentification &amp; comptes", "Complet"],
            ["3.2", "Gestion des espaces", "Complet"],
            ["3.3", "Catalogue &amp; tarification", "Complet"],
            ["3.4", "Disponibilité &amp; réservations", "Complet"],
            ["3.5", "Baux / contrats", "Complet"],
            ["3.6", "Facturation &amp; paiements", "Complet"],
            ["3.7", "Maintenance &amp; tickets", "Complet"],
            ["3.8", "Notifications", "Complet"],
            ["3.9", "Reporting &amp; dashboard", "Complet"],
            ["3.10", "Administration &amp; audit", "Complet"]],
           [15 * mm, CW - 45 * mm, 30 * mm], fs=8.4),
       Spacer(1, 4),
       P("<b>30 contrôleurs · 218 routes · 25 modèles de données</b>")]
st += [PageBreak()]

st += sl("Diapo 5.2", "Besoins fonctionnels (1/2)")
st += [P("<b>§3.1 — Authentification &amp; comptes</b>"),
       bul(["Connexion e-mail / mot de passe, jeton JWT + rafraîchissement",
            "Sessions multiples par appareil",
            "RBAC&nbsp;: <b>9 rôles</b> — le CDC en prévoyait 6",
            "Réinitialisation de mot de passe par courriel"]),
       P("<b>§3.2 — Gestion des espaces</b>"),
       bul(["Bâtiments " + AR + " Étages " + AR + " Surfaces (7 types)",
            "Caractéristiques, équipements, photos, positionnement sur plan",
            "5 statuts&nbsp;: disponible, occupé, réservé, maintenance, hors service"]),
       P("<b>§3.3 — Catalogue &amp; tarification</b>"),
       bul(["Trois grilles&nbsp;: horaire, journalière, mensuelle",
            "Services additionnels avec cycle de facturation",
            "<b>Codes promotionnels uniques par société</b>&nbsp;: deux bailleurs peuvent "
            "lancer le même code sans collision"]),
       P("<b>§3.4 — Disponibilité &amp; réservations</b>"),
       bul(["Calendrier par site, étage et type de surface",
            "<b>Prévention du double booking</b>&nbsp;: contrôle de chevauchement avant écriture",
            "Check-in / check-out",
            "<b>12 états</b>, dont une phase absente du CDC&nbsp;: confirmation "
            "téléphonique " + AR + " visite " + AR + " dépôt de pièces"])]
st += [PageBreak()]

st += sl("Diapo 5.3", "Besoins fonctionnels (2/2)")
st += [P("<b>§3.5 — Baux / contrats</b>"),
       bul(["Création depuis une réservation confirmée",
            "Dépôt de garantie&nbsp;: constitution et remboursement",
            "<b>Renouvellement</b> et <b>résiliation</b>",
            "Rappels d'échéance automatiques à 60 / 30 / 7 jours"]),
       P("<b>§3.6 — Facturation &amp; paiements</b>"),
       bul(["Factures détaillées en lignes, TVA paramétrable",
            "Règlements&nbsp;: <b>espèces · virement · chèque</b>",
            "Relances automatiques à J+1 / J+7 / J+14",
            "Export PDF et CSV/XLSX"]),
       P("<b>§3.7 — Maintenance &amp; tickets</b>"),
       bul(["Signalement limité aux surfaces <b>réellement occupées</b> par le déclarant",
            "7 catégories, 5 priorités, affectation à un technicien",
            "Coût de résolution enregistré"]),
       P("<b>§3.8 et §3.9 — Notifications et pilotage</b>"),
       bul(["Notifications in-app <b>temps réel</b> (WebSocket) et par courriel",
            "Taux d'occupation, revenus par site, impayés, délai moyen de résolution",
            "Prévision de revenus, carte de chaleur d'occupation"])]
st += [PageBreak()]

st += sl("Diapo 5.4", "Les écarts assumés au cahier des charges")
st += [tab([["Point du CDC", "Décision", "Justification"],
            ["Paiement en ligne (Stripe), <i>optionnel</i>", "Écarté",
             "Marché qatari au comptant — contrainte de l'encadrant professionnel"],
            ["Supabase (Auth + Storage)", "Remplacé par Passport-JWT + Prisma + Cloudinary",
             "Supabase ne modélise qu'<b>un</b> niveau de tenant&nbsp;; le cloisonnement "
             "à trois niveaux exige la maîtrise de la construction des requêtes"],
            ["BullMQ + Redis, <i>optionnel</i>", "Non retenu",
             "3 tâches quotidiennes seulement " + AR + " "
             "<font name='Mono'>@nestjs/schedule</font> suffit"],
            ["QR code, récurrence, SLA", "Non traités", "Marqués <i>optionnel</i> au CDC"]],
           [38 * mm, 38 * mm, CW - 76 * mm], fs=8.3),
       Spacer(1, 4),
       P("<b>Ajouts hors CDC&nbsp;:</b> 3 fonctions d'IA · assistant de recherche pour le "
         "visiteur · notifications temps réel · audit d'isolation automatisé"),
       box("À dire", "Diapositive décisive pour la note&nbsp;: elle prouve que le cahier "
                     "des charges a été lu et arbitré, au lieu d'être suivi aveuglément. "
                     "Préparez la question sur Supabase.", WARN, WARNW)]
st += [PageBreak()]

st += sl("Diapo 5.5", "Besoins non fonctionnels")
st += [tab([["Exigence CDC", "Mise en œuvre", "Preuve"],
            ["Auth JWT + refresh", "Passport-JWT, sessions par appareil", "—"],
            ["<b>RBAC + isolation tenant</b>",
             "<font name='Mono'>@Roles</font> sur chaque route + AccessPolicyService",
             "<b>43 sondes</b>"],
            ["Validation, anti-injection",
             "whitelist + forbidNonWhitelisted&nbsp;; requêtes paramétrées par Prisma",
             "Champs inconnus <b>rejetés</b>"],
            ["Rate limit", "ThrottlerGuard sur les points publics", "—"],
            ["Journalisation", "audit_logs en ajout seul (acteur, IP, sévérité)", "—"],
            ["Performance", "Pagination, cache TTL, déduplication des requêtes", "—"],
            ["Fiabilité", "Fonctionne <b>sans aucune clé externe</b>&nbsp;; "
                          "courriel en 3 niveaux", "—"],
            ["Maintenabilité", "Modules NestJS, <b>252 tests</b>, CI/CD, Swagger", "—"],
            ["UX", "Adaptatif, thèmes clair/sombre, sessions par onglet", "—"]],
           [36 * mm, CW - 68 * mm, 32 * mm], fs=8.2)]
st += [PageBreak()]

st += sl("Diapo 5.6", "La preuve du cloisonnement   (diapositive forte)")
st += [P("Un cloisonnement correct <b>partitionne</b> les données."),
       tab([["Indicateur", "Msheireb", "West Bay", "Lusail", "Plateforme"],
            ["CA encaissé (QAR)", "5 300", "11 800", "10 100", "<b>27 200</b>"],
            ["Réservations", "6", "6", "6", "<b>18</b>"],
            ["Surfaces", "24", "24", "24", "<b>72</b>"],
            ["Tickets", "18", "18", "18", "<b>54</b>"]],
           [38 * mm] + [(CW - 38 * mm) / 4] * 4, fs=8.8),
       Spacer(1, 4),
       box("Conclusion",
           "Les trois portefeuilles redonnent <b>exactement</b> le total. Si une ligne "
           "fuyait, ou était comptée deux fois, la somme ne tomberait pas juste. "
           "La sécurité devient une propriété arithmétique vérifiable.", OK, OKW),
       box("À dire", "L'argument le plus convaincant pour un jury technique. Faire "
                     "l'addition à voix haute sur la première ligne.")]
st += [PageBreak()]

# ═══════════ 6. TECHNOLOGIES ════════════════════════════════════════════════
st += part("6", "Technologies utilisées", "2 diapositives")

st += sl("Diapo 6.1", "Une chaîne TypeScript de bout en bout")
st += [tab([["Couche", "Technologies"],
            ["Serveur", "NestJS 11 · Prisma 5 · PostgreSQL 13 · Passport-JWT · Socket.IO"],
            ["Client", "React 19 · Vite 7 · TypeScript · Ant Design 6 · TanStack Query · "
                       "Recharts · Leaflet"],
            ["Infrastructure", "Docker Compose · nginx · GitHub Actions"],
            ["Services externes", "Groq (LLM) · Brevo (courriel) · Cloudinary (fichiers) · "
                                  "Typeform (candidatures)"]],
           [34 * mm, CW - 34 * mm]),
       Spacer(1, 4),
       box("Argument", "Un seul langage des deux côtés&nbsp;: les types sont partagés "
                       "entre serveur et client, ce qui supprime une classe entière "
                       "d'erreurs d'interprétation.")]

st += sl("Diapo 6.2", "Pourquoi ces choix")
st += [tab([["Choix", "Motif"],
            ["NestJS", "Organisation modulaire et mécanisme de gardes, qui se prête à un "
                       "contrôle d'accès déclaratif route par route"],
            ["Prisma", "Accès typé à la base et outillage de migration&nbsp;; les requêtes "
                       "sont paramétrées, donc insensibles à l'injection"],
            ["Ant Design", "Couvre les composants d'un back-office sans développement "
                           "spécifique"],
            ["nginx en frontal", "Sert l'application compilée et relaie l'API sur la "
                                 "même origine&nbsp;: aucune configuration CORS"],
            ["Client LLM configurable",
             "L'adresse du fournisseur est un paramètre&nbsp;: en changer relève de la "
             "configuration, pas d'une réécriture"]],
           [36 * mm, CW - 36 * mm])]
st += [PageBreak()]

# ═══════════ 7. CONCEPTION ══════════════════════════════════════════════════
st += part("7", "Conception", "3 diapositives")

st += sl("Diapo 7.1", "Diagramme de cas d'utilisation")
st += [box("Image à insérer",
           "<font name='Mono'>docs/diagrams/01-use-case-global.png</font><br/>"
           "Format portrait (ratio 0,73). Sur une diapositive 16:9, la placer centrée "
           "avec le titre au-dessus&nbsp;; ne pas l'étirer."),
       Spacer(1, 4),
       P("<b>Ce que montre le diagramme</b>"),
       bul(["<b>9 acteurs</b> répartis sur les trois niveaux de location",
            "<b>10 cas d'utilisation</b> regroupés par domaine",
            "Deux relations de <b>généralisation</b>&nbsp;: l'admin locataire hérite de "
            "l'employé, l'admin société hérite du responsable"]),
       box("À dire", "Pointer le réceptionniste&nbsp;: c'est le rôle que la plupart des "
                     "systèmes n'ont pas, et il existe uniquement parce que la location "
                     "se conclut en personne.")]

st += sl("Diapo 7.2", "Diagramme de classes")
st += [box("Image à insérer",
           "<font name='Mono'>docs/diagrams/02b-class-diagram-presentation.png</font><br/>"
           "Version <b>paysage allégée</b> (ratio 1,96), conçue pour la projection&nbsp;: "
           "10 classes, 3 attributs chacune. Le diagramme complet "
           "(<font name='Mono'>02-class-diagram.png</font>, 17 classes) est illisible "
           "projeté&nbsp;; gardez-le pour le rapport écrit."),
       Spacer(1, 4),
       P("<b>Ce qu'il faut faire remarquer</b>"),
       bul(["La chaîne de composition <b>Tenant " + AR + " Building " + AR + " Floor "
            + AR + " Space</b>&nbsp;: c'est le chemin du bailleur",
            "L'attribut <font name='Mono'>tenant_id</font> sur <b>Booking</b> et "
            "<b>MaintenanceTicket</b>&nbsp;: c'est le chemin du locataire",
            "La note portée sur Booking, qui énonce la dualité"])]
st += [PageBreak()]

st += sl("Diapo 7.3", "Diagramme de séquence  (au choix)")
st += [P("Une seule séquence suffit. Deux candidates, selon ce que vous voulez démontrer."),
       tab([["Fichier", "Ce qu'il montre", "Quand la choisir"],
            ["<font name='Mono'>04-sequence-authorisation.png</font>",
             "Les 5 étapes d'autorisation d'une requête, avec les branches de refus",
             "Si le jury est technique&nbsp;: c'est le cœur de la sécurité"],
            ["<font name='Mono'>06-sequence-booking.png</font>",
             "De la demande publique au bail signé, avec les rôles",
             "Si le jury est fonctionnel&nbsp;: c'est le parcours métier complet"]],
           [56 * mm, (CW - 56 * mm) / 2, (CW - 56 * mm) / 2], fs=8.3),
       Spacer(1, 4),
       P("Les neuf diagrammes sont dans <font name='Mono'>docs/diagrams/</font>, au "
         "format PNG et en source PlantUML."),
       box("À dire", "Ne pas projeter plus de deux diagrammes. Un jury décroche devant "
                     "une succession de schémas denses&nbsp;; mieux vaut en commenter un "
                     "seul correctement.")]
st += [PageBreak()]

# ═══════════ 8. AVANCEMENT ══════════════════════════════════════════════════
st += part("8", "Avancement", "3 diapositives")

st += sl("Diapo 8.1", "Les chiffres du projet")
st += [tab([["25", "30", "55", "9", "252", "43"],
            ["modèles", "contrôleurs", "pages", "rôles", "tests", "sondes d'audit"]],
           [CW / 6] * 6, fs=9),
       Spacer(1, 5),
       P("Dans Canva&nbsp;: six tuiles alignées, le nombre en très gros corps et le "
         "libellé en dessous. C'est la diapositive qui donne l'échelle du travail."),
       Spacer(1, 3),
       P("<b>État général</b>"),
       bul(["Intégration continue au vert",
            "Vérification des types sans erreur sur les deux projets",
            "Déploiement complet par une commande"])]

st += sl("Diapo 8.2", "Partie déjà réalisée")
st += [P("<b>Chaîne métier complète</b>"),
       bul(["Candidature " + AR + " réservation " + AR + " bail " + AR + " facture " +
            AR + " encaissement",
            "Maintenance, notifications temps réel, journal d'audit",
            "Tableaux de bord et analyses par rôle"]),
       P("<b>Cloisonnement</b>"),
       bul(["Les trois niveaux en place et vérifiés",
            "<b>9 défauts détectés et corrigés</b>",
            "Contrôle de cohérence arithmétique (diapositive 5.6)"]),
       P("<b>Intelligence artificielle</b> — hors cahier des charges"),
       bul(["Classement automatique des tickets&nbsp;: catégorie, priorité, technicien suggéré",
            "Assistant de recherche pour le visiteur, en langage naturel",
            "Lecture de documents administratifs (licence, registre)"]),
       box("Principe retenu pour l'IA",
           "<b>Le modèle propose, il ne décide pas.</b> Toute valeur hors nomenclature "
           "est écartée et un classement par mots-clés prend le relais. Le technicien "
           "suggéré vient de l'historique, pas du modèle.")]
st += [PageBreak()]

st += sl("Diapo 8.3", "Partie non encore réalisée")
st += [tab([["Point restant", "État", "Motif"],
            ["Interface de lecture des documents", "Serveur seul",
             "L'extraction fonctionne&nbsp;; le dépôt dans le formulaire reste à construire"],
            ["Documents numérisés", "Limité",
             "Le fournisseur LLM configuré n'expose aucun modèle de vision"],
            ["Places de marché externes", "En attente",
             "Adaptateurs écrits, identifiants non fournis"],
            ["Fiche Google Business", "Suspendu", "Compte vérifié requis côté propriétaire"],
            ["Courriel en production", "Mode dégradé",
             "Adresse IP à autoriser chez le prestataire&nbsp;; relais SMTP actif"],
            ["Application mobile", "Hors périmètre", "L'interface web est adaptative"]],
           [50 * mm, 26 * mm, CW - 76 * mm], fs=8.3),
       Spacer(1, 4),
       box("Conclusion", "Aucun de ces points ne bloque un parcours métier&nbsp;: chacun "
                         "dispose d'un mode dégradé ou d'un équivalent manuel.", WARN, WARNW),
       box("À dire", "Ne pas minimiser. Un état d'avancement lucide vaut mieux qu'une "
                     "liste où tout serait annoncé terminé.")]
st += [PageBreak()]

# ═══════════ 9. CONCLUSION ══════════════════════════════════════════════════
st += part("9", "Conclusion et perspectives", "2 diapositives")

st += sl("Diapo 9.1", "L'enseignement principal   (diapositive de fond foncé)")
st += [box("Texte de la diapositive",
           "<b>Aucun des neuf défauts ne venait d'une fonction de sécurité erronée. "
           "Tous venaient d'un point d'appel qui l'oubliait.</b><br/><br/>"
           "Et quatre sont restés invisibles tant que le jeu de données ne comportait "
           "qu'un seul bailleur&nbsp;: avec un seul, «&nbsp;tout afficher&nbsp;» et "
           "«&nbsp;afficher mon portefeuille&nbsp;» donnent le même résultat.<br/><br/>"
           "" + AR + " <b>La forme des données d'essai fait partie de la surface de "
           "sécurité.</b>"),
       Spacer(1, 4),
       P("Dans Canva&nbsp;: fond <font name='Mono'>#084449</font>, texte blanc, aucune "
         "illustration."),
       box("À dire", "Le point de bascule de la soutenance. Énoncer lentement. C'est un "
                     "résultat d'ingénierie, pas une liste de fonctionnalités.")]

st += sl("Diapo 9.2", "Bilan et perspectives")
st += [P("<b>Bilan</b>"),
       bul(["Plateforme opérationnelle du visiteur anonyme au propriétaire",
            "Modèle de cloisonnement <b>démontrable</b>, pas seulement affirmé",
            "IA utile et encadrée&nbsp;: elle propose, elle ne décide pas",
            "Déploiement reproductible en une commande"]),
       P("<b>Perspectives</b>"),
       bul(["Interface de dépôt des documents, puis modèle de vision pour les scans",
            "Assistant conversationnel étendu aux données du locataire, avec une série "
            "d'essais d'injection pour en démontrer les limites",
            "Modèle de maintenance prédictive entraîné, comparé à l'heuristique actuelle "
            "prise comme référence",
            "Application mobile pour les techniciens en intervention"]),
       Spacer(1, 4),
       P("<b>Diapositive finale&nbsp;:</b> «&nbsp;Merci de votre attention&nbsp;» "
         "puis «&nbsp;Questions&nbsp;».")]

st += [Spacer(1, 9), HRFlowable(width="100%", thickness=0.4, color=LINE), Spacer(1, 4),
       Paragraph("Chiffres relevés en base et par exécution des tests le 29 septembre "
                 "2026. Les images citées se trouvent dans "
                 "<font name='Mono'>docs/diagrams/</font>. La section 1 (organisme "
                 "d'accueil) est laissée en gabarit&nbsp;: ces informations ne figurent "
                 "pas dans le code.",
                 ParagraphStyle("f", fontName="Cal-I", fontSize=8, leading=11,
                                textColor=INK3, alignment=TA_JUSTIFY))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Contenu_Presentation.pdf")
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=ML, rightMargin=MR,
                      topMargin=MT, bottomMargin=MB,
                      title="LeaseManager — Contenu de la présentation")
doc.addPageTemplates([PageTemplate(id="a", frames=[Frame(ML, MB, CW, PH - MT - MB, id="f")],
                                   onPage=deco)])
doc.build(st)
print("PDF :", out)
