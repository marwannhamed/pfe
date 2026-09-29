# -*- coding: utf-8 -*-
"""
Contenu de la présentation, mis en forme pour être recopié dans Canva.

Un bloc par diapositive : titre, contenu à coller, et le cas échéant une note
sur ce qu'il faut dire. A4 portrait, pensé pour être lu à côté de Canva.
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
                                ListFlowable, ListItem, KeepTogether)

F = "C:/Windows/Fonts/"
for n, f in [("Geo", "georgia.ttf"), ("Geo-B", "georgiab.ttf"), ("Geo-I", "georgiai.ttf"),
             ("Cal", "calibri.ttf"), ("Cal-B", "calibrib.ttf"), ("Cal-I", "calibrii.ttf"),
             ("Mono", "consola.ttf")]:
    try:
        pdfmetrics.registerFont(TTFont(n, F + f))
    except Exception:
        pdfmetrics.registerFont(TTFont(n, F + "calibri.ttf"))
pdfmetrics.registerFontFamily("Geo", normal="Geo", bold="Geo-B", italic="Geo-I",
                              boldItalic="Geo-B")
pdfmetrics.registerFontFamily("Cal", normal="Cal", bold="Cal-B", italic="Cal-I",
                              boldItalic="Cal-B")

INK, INK2, INK3 = colors.HexColor("#14181F"), colors.HexColor("#3A464F"), colors.HexColor("#6B7880")
ACC, ACC2 = colors.HexColor("#0B5E64"), colors.HexColor("#084449")
WASH, LINE, SOFT = colors.HexColor("#E7F2F2"), colors.HexColor("#C9D6D9"), colors.HexColor("#F3F7F8")
OK, OKW = colors.HexColor("#1B7048"), colors.HexColor("#E4F1EA")
WARN, WARNW = colors.HexColor("#8A5D00"), colors.HexColor("#FAF2DE")
L3, L3W = colors.HexColor("#9A5B1E"), colors.HexColor("#F7EDE0")

PW, PH = A4
ML = MR = 20 * mm
MT, MB = 20 * mm, 18 * mm
CW = PW - ML - MR

S = {
 "part": ParagraphStyle("part", fontName="Cal-B", fontSize=21, leading=25, textColor=colors.white),
 "partsub": ParagraphStyle("ps", fontName="Cal", fontSize=11, leading=14,
                           textColor=colors.HexColor("#BFE0E1")),
 "slideno": ParagraphStyle("sn", fontName="Cal-B", fontSize=9.5, leading=12, textColor=ACC),
 "h": ParagraphStyle("h", fontName="Cal-B", fontSize=14, leading=17.5, textColor=INK,
                     spaceAfter=2),
 "b": ParagraphStyle("b", fontName="Geo", fontSize=9.8, leading=14.5, textColor=INK,
                     alignment=TA_JUSTIFY, spaceAfter=4),
 "li": ParagraphStyle("li", fontName="Geo", fontSize=9.8, leading=14, textColor=INK,
                      alignment=TA_LEFT, spaceAfter=2),
 "th": ParagraphStyle("th", fontName="Cal-B", fontSize=8.4, leading=11, textColor=colors.white),
 "td": ParagraphStyle("td", fontName="Geo", fontSize=8.9, leading=12.4, textColor=INK),
 "say": ParagraphStyle("say", fontName="Geo-I", fontSize=9.2, leading=13.5, textColor=INK2,
                       alignment=TA_JUSTIFY),
 "saylbl": ParagraphStyle("sl", fontName="Cal-B", fontSize=8.4, leading=11, textColor=ACC),
 "mono": ParagraphStyle("m", fontName="Mono", fontSize=8.6, leading=12.6, textColor=ACC2),
 "cov": ParagraphStyle("cov", fontName="Cal-B", fontSize=30, leading=36, textColor=INK,
                       alignment=TA_CENTER),
 "covs": ParagraphStyle("cvs", fontName="Geo-I", fontSize=12.5, leading=18, textColor=INK2,
                        alignment=TA_CENTER),
}


def deco(cv, doc):
    cv.saveState()
    cv.setFont("Cal", 8)
    cv.setFillColor(INK3)
    cv.drawString(ML, MB - 8 * mm, "LeaseManager — Contenu de la présentation")
    cv.drawRightString(PW - MR, MB - 8 * mm, str(doc.page))
    cv.setStrokeColor(LINE); cv.setLineWidth(0.4)
    cv.line(ML, MB - 5 * mm, PW - MR, MB - 5 * mm)
    cv.restoreState()


def P(t, s="b"):
    return Paragraph(t, S[s])


def bul(items):
    return ListFlowable([ListItem(Paragraph(i, S["li"]), leftIndent=11, value="circle")
                         for i in items],
                        bulletType="bullet", bulletFontSize=4.5, bulletOffsetY=1.5,
                        leftIndent=11, spaceBefore=1, spaceAfter=5)


def tab(rows, widths, fs=8.9, headbg=ACC2):
    S["td"].fontSize = fs; S["td"].leading = fs * 1.4
    data = [[Paragraph(str(x), S["th" if r == 0 else "td"]) for x in row]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    cmds = [("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 0), (-1, 0), headbg),
            ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE)]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cmds))
    return t


def box(label, text, tone=ACC, bg=WASH):
    inner = [Paragraph(label, ParagraphStyle("bl", fontName="Cal-B", fontSize=8.4,
                                             leading=11, textColor=tone, spaceAfter=2)),
             Paragraph(text, S["say"])]
    t = Table([[inner]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg),
                           ("LINEBEFORE", (0, 0), (0, -1), 2, tone),
                           ("TOPPADDING", (0, 0), (-1, -1), 6),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 8)]))
    return t


def slide(no, titre):
    """En-tête d'un bloc-diapositive."""
    t = Table([[Paragraph(no, S["slideno"]), Paragraph(titre, S["h"])]],
              colWidths=[26 * mm, CW - 26 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                           ("LINEABOVE", (0, 0), (-1, 0), 0.9, ACC)]))
    return [Spacer(1, 7), t]


def partbar(num, titre, sous):
    t = Table([[[Paragraph("PARTIE %s" % num, S["partsub"]),
                 Paragraph(titre, S["part"]),
                 Paragraph(sous, S["partsub"])]]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ACC2),
                           ("TOPPADDING", (0, 0), (-1, -1), 11),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                           ("LEFTPADDING", (0, 0), (-1, -1), 13),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 13)]))
    return [t, Spacer(1, 8)]


st = []

# ── couverture ──────────────────────────────────────────────────────────────
st += [Spacer(1, 40 * mm),
       P("Contenu de la présentation", "cov"),
       Spacer(1, 4 * mm),
       P("Solution proposée &nbsp;·&nbsp; Besoins fonctionnels &nbsp;·&nbsp; "
         "Besoins non fonctionnels", "covs"),
       Spacer(1, 8 * mm),
       HRFlowable(width="34%", thickness=0.8, color=LINE, hAlign="CENTER"),
       Spacer(1, 8 * mm),
       P("LeaseManager — Projet de Fin d'Études", "covs"),
       Spacer(1, 26 * mm)]
st += [box("Comment utiliser ce document",
           "Un bloc par diapositive. Le titre est à reprendre tel quel, le contenu est "
           "à coller dans Canva, et la mention « À dire » n'apparaît pas sur la "
           "diapositive&nbsp;: elle va dans vos notes. Les tableaux sont déjà calibrés "
           "pour une diapositive 16:9&nbsp;; n'en retirez pas de lignes sans raison, "
           "ce sont eux qui portent la démonstration.")]
st += [Spacer(1, 6),
       box("Chiffres",
           "Tous les chiffres cités ont été relevés en base ou par exécution des tests "
           "le 29 septembre 2026. Ils sont vérifiables&nbsp;; un jury peut demander la "
           "source.", OK, OKW)]
st += [PageBreak()]

# ═══════════════ PARTIE A — SOLUTION PROPOSÉE ═══════════════════════════════
st += partbar("A", "Solution proposée", "5 diapositives")

st += slide("Diapo A1", "Un besoin que le cahier des charges sous-estimait")
st += [P("Le CDC prévoit une «&nbsp;gestion multi-tenant (plusieurs entreprises "
         "clientes)&nbsp;»&nbsp;: <b>un seul niveau</b> de client."),
       P("Le terrain en impose <b>deux, imbriqués</b>&nbsp;:"),
       bul(["la société qui <b>détient</b> les murs",
            "la société qui <b>occupe</b> les surfaces"]),
       P("→ Deux sociétés immobilières <b>concurrentes</b> sur une même installation, "
         "sans aucune donnée commune."),
       box("À dire", "C'est l'apport principal du projet par rapport à la spécification "
                     "initiale. Ne pas le présenter comme un écart subi, mais comme une "
                     "analyse qui a fait évoluer le modèle.")]

st += slide("Diapo A2", "Le modèle de location à trois niveaux")
st += [tab([["Niveau", "Acteur", "Périmètre"],
            ["1", "Propriétaire de la plateforme",
             "Exploite le service. Seul rôle lisant au travers des organisations."],
            ["2", "Société immobilière (bailleur)",
             "Bâtiments, étages, surfaces. Publie, approuve, facture, encaisse."],
            ["3", "Société locataire (preneur)",
             "Réserve, signe, règle, signale. Ses données uniquement."]],
           [16 * mm, 48 * mm, CW - 64 * mm]),
       Spacer(1, 5),
       P("Implémentation&nbsp;: <font name='Mono'>tenants.organization_type</font> "
         "∈ { <font name='Mono'>CLIENT</font>, <font name='Mono'>RENTER</font> }")]

st += slide("Diapo A3", "La difficulté centrale  (à faire en grand format)")
st += [P("Une réservation (ou un ticket) appartient à <b>deux organisations</b> par "
         "<b>deux chemins différents</b>.")]
st += [tab([["LOCATAIRE", "BAILLEUR"],
            ["<font name='Mono'>tenant_id</font> porté sur la ligne<br/>"
             "<i>«&nbsp;c'est moi qui ai réservé&nbsp;»</i>",
             "<font name='Mono'>space → floor → building.tenant_id</font><br/>"
             "<i>«&nbsp;ce sont mes murs&nbsp;»</i>"]],
           [CW / 2, CW / 2], headbg=L3)]
st += [Spacer(1, 5),
       box("Conclusion de la diapositive",
           "Confondre ces deux chemins est à l'origine des <b>9 défauts de "
           "cloisonnement</b> corrigés pendant le développement.", WARN, WARNW),
       Spacer(1, 4),
       box("À dire", "C'est la diapositive la plus importante de toute la présentation. "
                     "Suivre les deux flèches à voix haute. Si le jury ne retient qu'une "
                     "chose, c'est celle-là.")]
st += [PageBreak()]

st += slide("Diapo A4", "Comment la règle est appliquée, route par route")
st += [P("Cinq étapes sur <b>chaque</b> appel authentifié&nbsp;:"),
       tab([["#", "Étape", "Rôle"],
            ["1", "JwtAuthGuard", "Vérifie le jeton, peuple l'identité de l'appelant"],
            ["2", "RolesGuard", "Compare <font name='Mono'>@Roles(...)</font> au rôle réel"],
            ["3", "ValidationPipe", "Rejette les champs inattendus "
                                    "(<font name='Mono'>forbidNonWhitelisted</font>)"],
            ["4", "Contrôleur <font name='Mono'>→</font> <font name='Mono'>*ForUser</font>",
             "Jamais la méthode non restreinte"],
            ["5", "AccessPolicyService", "Transforme l'appelant en filtre Prisma"]],
           [9 * mm, 46 * mm, CW - 55 * mm]),
       Spacer(1, 5),
       P("<font name='Mono'>isCrossTenantReader()</font> n'est vrai que pour le "
         "propriétaire de la plateforme.")]

st += slide("Diapo A5", "Architecture de déploiement")
st += [Paragraph(
    "Navigateur → nginx ─┬→ SPA React (compilée)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└→ API NestJS → Prisma → PostgreSQL<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└→ Socket.IO (notifications)",
    S["mono"]),
    Spacer(1, 5),
    P("<b>4 conteneurs</b> &nbsp;·&nbsp; une seule origine &nbsp;·&nbsp; aucun CORS "
      "&nbsp;·&nbsp; aucun nom d'hôte compilé dans le bundle")]

# ═══════════════ PARTIE B — BESOINS FONCTIONNELS ════════════════════════════
st += partbar("B", "Besoins fonctionnels", "5 diapositives")

st += slide("Diapo B1", "Couverture du cahier des charges")
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
           [16 * mm, CW - 48 * mm, 32 * mm], fs=8.6),
       Spacer(1, 5),
       P("<b>30 contrôleurs &nbsp;·&nbsp; 218 routes &nbsp;·&nbsp; 25 modèles de "
         "données</b>")]
st += [PageBreak()]

st += slide("Diapo B2", "Authentification, espaces, tarification")
st += [P("<b>§3.1 — Authentification &amp; comptes</b>"),
       bul(["Connexion e-mail / mot de passe, jeton JWT + rafraîchissement",
            "Sessions multiples par appareil (<font name='Mono'>user_sessions</font>)",
            "RBAC&nbsp;: <b>9 rôles</b> — le CDC en prévoyait 6",
            "Réinitialisation de mot de passe par courriel"]),
       P("<b>§3.2 — Gestion des espaces</b>"),
       bul(["Bâtiments → Étages → Surfaces (7 types)",
            "Caractéristiques, équipements, photos, plan avec positionnement",
            "Statuts&nbsp;: disponible · occupé · réservé · maintenance · hors service"]),
       P("<b>§3.3 — Catalogue &amp; tarification</b>"),
       bul(["Trois grilles&nbsp;: horaire, journalière, mensuelle",
            "Services additionnels avec cycle de facturation",
            "<b>Codes promotionnels uniques par société</b> — deux bailleurs peuvent "
            "lancer le même code sans collision"])]

st += slide("Diapo B3", "Réservations et contrats")
st += [P("<b>§3.4 — Disponibilité &amp; réservations</b>"),
       bul(["Calendrier par site / étage / type",
            "<b>Prévention du double booking</b> — contrôle de chevauchement avant écriture",
            "Check-in / check-out",
            "<b>12 états</b>, dont une phase absente du CDC&nbsp;: confirmation "
            "téléphonique → visite → dépôt de pièces"]),
       P("<b>§3.5 — Baux / contrats</b>"),
       bul(["Création depuis une réservation confirmée",
            "Dépôt de garantie&nbsp;: constitution et remboursement",
            "<b>Renouvellement</b> et <b>résiliation</b>",
            "États&nbsp;: brouillon · actif · renouvelé · expiré · résilié",
            "Rappels d'échéance automatiques à 60 / 30 / 7 jours"]),
       box("À dire", "La phase présentielle (appel, visite, dossier) n'était pas au CDC. "
                     "Elle vient du marché qatari, et c'est elle qui justifie l'existence "
                     "du rôle de réceptionniste.")]
st += [PageBreak()]

st += slide("Diapo B4", "Facturation, maintenance, pilotage")
st += [P("<b>§3.6 — Facturation &amp; paiements</b>"),
       bul(["Factures détaillées en lignes, TVA paramétrable",
            "États&nbsp;: brouillon · émise · payée · en retard · annulée",
            "Règlements&nbsp;: <b>espèces · virement · chèque</b>",
            "Relances automatiques à J+1 / J+7 / J+14",
            "Export PDF et CSV/XLSX"]),
       P("<b>§3.7 — Maintenance &amp; tickets</b>"),
       bul(["Signalement limité aux surfaces <b>réellement occupées</b> par le déclarant",
            "7 catégories, 5 priorités, affectation à un technicien",
            "Flux&nbsp;: ouvert → affecté → en cours → résolu → fermé",
            "Coût de résolution enregistré"]),
       P("<b>§3.9 — Reporting</b>"),
       bul(["Taux d'occupation · revenus par site · impayés · délai moyen de résolution",
            "Prévision de revenus · carte de chaleur d'occupation"])]

st += slide("Diapo B5", "Les écarts assumés au cahier des charges")
st += [tab([["Point du CDC", "Décision", "Justification"],
            ["Paiement en ligne (Stripe), <i>optionnel</i>", "Écarté",
             "Marché qatari au comptant — contrainte de l'encadrant professionnel"],
            ["Supabase (Auth + Storage)",
             "Remplacé par Passport-JWT + Prisma + Cloudinary",
             "Supabase ne modélise qu'<b>un</b> niveau de tenant&nbsp;; le cloisonnement "
             "à trois niveaux exige la maîtrise des requêtes"],
            ["BullMQ + Redis, <i>optionnel</i>", "Non retenu",
             "3 tâches quotidiennes seulement <font name='Mono'>→</font> <font name='Mono'>@nestjs/schedule</font> "
             "suffit, une dépendance en moins"],
            ["QR code, récurrence, SLA", "Non traités", "Marqués <i>optionnel</i> au CDC"]],
           [40 * mm, 40 * mm, CW - 80 * mm], fs=8.4),
       Spacer(1, 5),
       P("<b>Ajouts hors CDC&nbsp;:</b> 3 fonctions d'IA · assistant de recherche pour "
         "le visiteur · notifications temps réel par WebSocket · audit d'isolation "
         "automatisé"),
       box("À dire", "Diapositive décisive pour la note&nbsp;: elle prouve que le CDC a "
                     "été lu et arbitré, au lieu d'être suivi aveuglément.", WARN, WARNW)]
st += [PageBreak()]

# ═══════════════ PARTIE C — BESOINS NON FONCTIONNELS ════════════════════════
st += partbar("C", "Besoins non fonctionnels", "4 diapositives")

st += slide("Diapo C1", "Sécurité  (§4.2 du CDC)")
st += [tab([["Exigence CDC", "Mise en œuvre", "Preuve"],
            ["Auth JWT + refresh", "Passport-JWT, sessions par appareil", "—"],
            ["<b>RBAC strict + isolation tenant</b>",
             "<font name='Mono'>@Roles</font> sur chaque route + AccessPolicyService",
             "<b>43 sondes d'audit</b>"],
            ["Validation input, anti-injection",
             "whitelist + forbidNonWhitelisted&nbsp;; Prisma paramètre les requêtes",
             "Champs inconnus <b>rejetés</b>"],
            ["Rate limit", "ThrottlerGuard sur les points publics", "—"],
            ["Journalisation", "audit_logs en ajout seul (acteur, IP, sévérité)", "—"],
            ["TLS en transit", "nginx en frontal", "—"]],
           [42 * mm, CW - 76 * mm, 34 * mm], fs=8.4),
       Spacer(1, 5),
       box("Résultat mesuré",
           "<b>9 défauts de cloisonnement détectés et corrigés</b> au cours du "
           "développement, dont 4 invisibles tant que le jeu de données ne comportait "
           "qu'un seul bailleur.", WARN, WARNW)]

st += slide("Diapo C2", "La preuve du cloisonnement  (diapositive forte)")
st += [P("Un cloisonnement correct <b>partitionne</b> les données."),
       tab([["Indicateur", "Msheireb", "West Bay", "Lusail", "Plateforme"],
            ["CA encaissé (QAR)", "5 300", "11 800", "10 100", "<b>27 200</b>"],
            ["Réservations", "6", "6", "6", "<b>18</b>"],
            ["Surfaces", "24", "24", "24", "<b>72</b>"],
            ["Tickets", "18", "18", "18", "<b>54</b>"]],
           [40 * mm] + [(CW - 40 * mm) / 4] * 4, fs=9),
       Spacer(1, 5),
       box("Conclusion",
           "Les trois portefeuilles redonnent <b>exactement</b> le total de la "
           "plateforme. Si une ligne fuyait, ou était comptée deux fois, la somme ne "
           "tomberait pas juste. La sécurité devient une propriété arithmétique "
           "vérifiable.", OK, OKW)]
st += [PageBreak()]

st += slide("Diapo C3", "Performance, fiabilité, qualité")
st += [P("<b>§4.1 Performance</b>"),
       bul(["Pagination systématique sur les listes",
            "Cache TTL sur les agrégats analytiques",
            "Déduplication des requêtes concurrentes côté client",
            "Intercepteur de mesure&nbsp;: toute requête lente est journalisée"]),
       P("<b>§4.3 Fiabilité</b>"),
       bul(["<b>Dégradation maîtrisée</b>&nbsp;: l'application fonctionne <b>sans aucune "
            "clé externe</b>",
            "Courriel en trois niveaux&nbsp;: Brevo → SMTP → journal console",
            "Une panne tierce ne fait <b>jamais</b> échouer une écriture déjà acceptée",
            "35 migrations rejouables depuis une base vide"]),
       P("<b>§4.4 Maintenabilité</b>"),
       bul(["Architecture modulaire NestJS · <b>252 tests</b> · CI/CD GitHub Actions",
            "Documentation Swagger générée du code",
            "Typage strict de bout en bout, 0 erreur"])]

st += slide("Diapo C4", "Exploitabilité et expérience utilisateur")
st += [P("<b>§4.5 Scalabilité</b> — index sur les colonnes de cloisonnement&nbsp;; "
         "tâches lourdes hors requête HTTP"),
       P("<b>§4.6 UX/UI</b>"),
       bul(["Interface adaptative, thèmes clair et sombre",
            "Navigation filtrée par rôle <i>(le serveur recontrôle&nbsp;; l'UI n'est "
            "qu'une commodité)</i>",
            "Sessions <b>par onglet</b>&nbsp;: deux rôles ouverts côte à côte sans "
            "déconnexion"]),
       P("<b>§4.7 Conformité</b> — journal d'audit horodaté, rétention des factures"),
       Spacer(1, 3),
       box("Déploiement",
           "<font name='Mono'>docker compose up -d --build</font> → 4 conteneurs, "
           "démarrage ordonné par sondes de santé.")]
st += [PageBreak()]

# ═══════════════ ANNEXE — CANVA ═════════════════════════════════════════════
st += partbar("D", "Mise en forme dans Canva", "Recherche, palette, réglages")

st += slide("D1", "Ce qu'il faut chercher dans Canva")
st += [P("Je n'ai pas accès au catalogue Canva depuis cet environnement&nbsp;: je ne "
         "peux donc pas garantir le nom exact d'un modèle, et les noms changent. "
         "Voici plutôt les termes de recherche qui remontent la bonne famille, et les "
         "critères à vérifier."),
       P("<b>Termes de recherche, par ordre d'efficacité</b>"),
       bul(["<font name='Mono'>Minimalist Professional Presentation</font>",
            "<font name='Mono'>Corporate Tech Presentation</font>",
            "<font name='Mono'>SaaS Product Presentation</font>",
            "<font name='Mono'>Consulting Report Presentation</font>",
            "<font name='Mono'>Thesis Defense Presentation</font> — plus scolaire, "
            "utile si votre département l'attend"]),
       P("<b>Critères à vérifier avant de choisir</b>"),
       bul(["Format <b>16:9</b> (Présentation), pas 4:3 ni A4",
            "Des <b>mises en page avec tableaux</b>&nbsp;: votre contenu en comporte "
            "cinq, c'est le critère décisif",
            "Fond <b>clair</b>&nbsp;: plus sûr qu'un fond sombre sous un "
            "vidéoprojecteur de salle",
            "Une police <b>sans empattement</b> qui gère les accents français — "
            "vérifier «&nbsp;é è à ç&nbsp;» avant de s'engager",
            "Peu d'illustrations décoratives&nbsp;: votre matière est dense, les images "
            "de stock vous feront perdre de la place"]),
       box("À éviter",
           "Les modèles « créatifs » à formes colorées, dégradés et grandes photos. Ils "
           "sont conçus pour trois lignes de texte par diapositive et ne supporteront "
           "pas vos tableaux.", WARN, WARNW)]
st += [PageBreak()]

st += slide("D2", "Palette à appliquer  (cohérence avec le rapport et les diagrammes)")
st += [P("Dans Canva&nbsp;: <i>Styles → Couleurs → + Nouvelle palette</i>, puis saisir "
         "ces six codes. Vos diagrammes PlantUML et votre rapport utilisent déjà "
         "exactement ces valeurs&nbsp;; l'ensemble forme alors une seule identité."),
       tab([["Usage", "Code", "Où l'employer"],
            ["Accent principal", "<font name='Mono'>#0B5E64</font>",
             "Titres de section, filets, en-têtes de tableau"],
            ["Accent foncé", "<font name='Mono'>#084449</font>",
             "Fond des diapositives de respiration (A3, C2)"],
            ["Fond clair", "<font name='Mono'>#E7F2F2</font>",
             "Encadrés, lignes alternées des tableaux"],
            ["Texte", "<font name='Mono'>#14181F</font>", "Corps de texte"],
            ["Texte secondaire", "<font name='Mono'>#3A464F</font>",
             "Sous-titres, légendes"],
            ["Alerte / écart", "<font name='Mono'>#8A5D00</font>",
             "Diapositive B5 et encadrés d'avertissement"]],
           [34 * mm, 26 * mm, CW - 60 * mm], fs=8.6),
       Spacer(1, 6),
       P("<b>Typographie</b>"),
       bul(["Titres&nbsp;: une grotesque lisible — <i>Archivo</i>, <i>Barlow</i>, "
            "<i>Source Sans Pro</i> ou <i>Poppins</i> conviennent et sont dans Canva",
            "Corps&nbsp;: la même famille en graisse normale, 18&nbsp;pt minimum",
            "Chiffres des tableaux&nbsp;: activer les <b>chiffres tabulaires</b> si la "
            "police le permet, pour que les colonnes s'alignent"])]

st += slide("D3", "Réglages et ordre de travail")
st += [bul(["Créer le document en <b>Présentation (16:9)</b>",
            "Construire d'abord les <b>trois diapositives fortes</b>&nbsp;: A3, B5 et "
            "C2. Ce sont elles qui portent la note&nbsp;; le reste s'aligne dessus",
            "Une idée par diapositive, <b>six lignes maximum</b>",
            "Ne pas réduire les tableaux&nbsp;: ce sont des preuves, pas des "
            "illustrations",
            "Insérer les diagrammes depuis <font name='Mono'>docs/diagrams/</font> "
            "(fichiers PNG) en appui des diapositives A2, A4 et A5",
            "Exporter en <b>PDF Standard</b> pour l'impression, et garder le lien Canva "
            "pour la projection"]),
       Spacer(1, 4),
       box("Vérification finale",
           "Projeter une diapositive et reculer de cinq mètres. Si une ligne n'est pas "
           "lisible, elle ne doit pas être sur la diapositive&nbsp;: elle va dans vos "
           "notes.", OK, OKW)]

st += [Spacer(1, 10), HRFlowable(width="100%", thickness=0.4, color=LINE), Spacer(1, 5),
       Paragraph("Chiffres relevés du code et de la base le 29 septembre 2026. "
                 "Les noms de modèles Canva ne sont pas garantis&nbsp;: le catalogue "
                 "n'est pas consultable depuis l'environnement de génération.",
                 ParagraphStyle("fin", fontName="Cal-I", fontSize=8.2, leading=11.5,
                                textColor=INK3, alignment=TA_JUSTIFY))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Contenu_Presentation.pdf")
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=ML, rightMargin=MR,
                      topMargin=MT, bottomMargin=MB,
                      title="LeaseManager — Contenu de la présentation")
doc.addPageTemplates([PageTemplate(id="a",
                                   frames=[Frame(ML, MB, CW, PH - MT - MB, id="f")],
                                   onPage=deco)])
doc.build(st)
print("PDF :", out)
