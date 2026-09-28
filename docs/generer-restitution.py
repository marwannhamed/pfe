# -*- coding: utf-8 -*-
"""
Génère le document de support de la première restitution (PFE LeaseManager).

Mise en page A4, Georgia pour le texte courant, Calibri pour les titres et les
éléments tabulaires. Texte justifié, pagination, sommaire.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem, HRFlowable,
)

F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Georgia", F + "georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", F + "georgiab.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", F + "georgiai.ttf"))
pdfmetrics.registerFont(TTFont("Calibri", F + "calibri.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Bold", F + "calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Calibri-Italic", F + "calibrii.ttf"))
pdfmetrics.registerFontFamily("Georgia", normal="Georgia", bold="Georgia-Bold",
                              italic="Georgia-Italic", boldItalic="Georgia-Bold")
pdfmetrics.registerFontFamily("Calibri", normal="Calibri", bold="Calibri-Bold",
                              italic="Calibri-Italic", boldItalic="Calibri-Bold")

INK   = colors.HexColor("#14181F")
INK2  = colors.HexColor("#3A464F")
INK3  = colors.HexColor("#6B7880")
ACC   = colors.HexColor("#0B5E64")
ACC2  = colors.HexColor("#084449")
WASH  = colors.HexColor("#EAF3F3")
LINE  = colors.HexColor("#C9D6D9")
SOFT  = colors.HexColor("#F2F6F7")
WARN  = colors.HexColor("#8A5D00")
WARNW = colors.HexColor("#FAF2DE")

S = {}
S["body"] = ParagraphStyle("body", fontName="Georgia", fontSize=10.2, leading=15.6,
                           alignment=TA_JUSTIFY, textColor=INK, spaceAfter=7)
S["bodyf"] = ParagraphStyle("bodyf", parent=S["body"], firstLineIndent=0)
S["h1"] = ParagraphStyle("h1", fontName="Calibri-Bold", fontSize=17, leading=21,
                         textColor=ACC2, spaceBefore=4, spaceAfter=3)
S["h1n"] = ParagraphStyle("h1n", fontName="Calibri-Bold", fontSize=9.5, leading=12,
                          textColor=ACC, spaceAfter=2)
S["h2"] = ParagraphStyle("h2", fontName="Calibri-Bold", fontSize=12, leading=15,
                         textColor=INK, spaceBefore=11, spaceAfter=4)
S["h3"] = ParagraphStyle("h3", fontName="Georgia-Bold", fontSize=10.4, leading=14,
                         textColor=INK, spaceBefore=8, spaceAfter=3)
S["li"] = ParagraphStyle("li", parent=S["body"], spaceAfter=3, alignment=TA_LEFT)
S["cap"] = ParagraphStyle("cap", fontName="Calibri-Italic", fontSize=8.6, leading=11.5,
                          textColor=INK3, spaceBefore=3, spaceAfter=9)
S["note"] = ParagraphStyle("note", fontName="Georgia", fontSize=9.4, leading=14,
                           textColor=INK2, alignment=TA_JUSTIFY)
S["tb"] = ParagraphStyle("tb", fontName="Georgia", fontSize=9.1, leading=12.6, textColor=INK)
S["th"] = ParagraphStyle("th", fontName="Calibri-Bold", fontSize=8.6, leading=11,
                         textColor=colors.white)
S["speak"] = ParagraphStyle("speak", fontName="Georgia-Italic", fontSize=9.4, leading=14,
                            textColor=INK2, alignment=TA_JUSTIFY, leftIndent=8)

# page de garde
S["cvSchool"] = ParagraphStyle("cvSchool", fontName="Calibri-Bold", fontSize=12.5,
                               leading=16, alignment=TA_CENTER, textColor=INK2)
S["cvSub"] = ParagraphStyle("cvSub", fontName="Calibri", fontSize=10.5, leading=14,
                            alignment=TA_CENTER, textColor=INK3)
S["cvKind"] = ParagraphStyle("cvKind", fontName="Calibri-Bold", fontSize=11, leading=14,
                             alignment=TA_CENTER, textColor=ACC, spaceAfter=4)
S["cvTitle"] = ParagraphStyle("cvTitle", fontName="Calibri-Bold", fontSize=27, leading=32,
                              alignment=TA_CENTER, textColor=INK)
S["cvLead"] = ParagraphStyle("cvLead", fontName="Georgia-Italic", fontSize=11.5, leading=17,
                             alignment=TA_CENTER, textColor=INK2)
S["cvField"] = ParagraphStyle("cvField", fontName="Calibri", fontSize=10.4, leading=15,
                              alignment=TA_CENTER, textColor=INK)

PW, PH = A4
ML = MR = 24 * mm
MT = 22 * mm
MB = 20 * mm


def decorate(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFont("Calibri", 8.2)
        canvas.setFillColor(INK3)
        canvas.drawString(ML, MB - 9 * mm, "LeaseManager — Première restitution")
        canvas.drawRightString(PW - MR, MB - 9 * mm, str(doc.page - 1))
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(ML, MB - 6 * mm, PW - MR, MB - 6 * mm)
    canvas.restoreState()


def p(t, st="body"):
    return Paragraph(t, S[st])


def bullets(items, style="li"):
    return ListFlowable(
        [ListItem(Paragraph(i, S[style]), leftIndent=13, value="circle") for i in items],
        bulletType="bullet", bulletFontSize=5, bulletOffsetY=1.5,
        leftIndent=13, spaceBefore=1, spaceAfter=6,
    )


def table(rows, widths, header=True, zebra=True):
    data = []
    for r_i, row in enumerate(rows):
        style = "th" if (header and r_i == 0) else "tb"
        data.append([Paragraph(str(c), S[style]) for c in row])
    t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ]
    if header:
        cmds.append(("BACKGROUND", (0, 0), (-1, 0), ACC2))
    if zebra:
        for i in range(1 if header else 0, len(rows)):
            if (i % 2) == (0 if header else 1):
                cmds.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, text, tone="acc"):
    bg = WASH if tone == "acc" else WARNW
    bar = ACC if tone == "acc" else WARN
    inner = [Paragraph("<b>%s</b>" % title,
                       ParagraphStyle("ct", fontName="Calibri-Bold", fontSize=9.2,
                                      leading=12, textColor=bar, spaceAfter=3)),
             Paragraph(text, S["note"])]
    t = Table([[inner]], colWidths=[PW - ML - MR], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, bar),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def section(num, title):
    return [
        Spacer(1, 2),
        Paragraph("SECTION %s" % num, S["h1n"]),
        Paragraph(title, S["h1"]),
        HRFlowable(width="100%", thickness=1.1, color=ACC, spaceBefore=3, spaceAfter=9),
    ]


def speaker(text):
    return [Spacer(1, 3), callout("À dire à l'oral", text, "acc"), Spacer(1, 4)]


CW = PW - ML - MR
story = []

# ─────────────────────────────── page de garde ──────────────────────────────
story += [
    Spacer(1, 12 * mm),
    p("Ministère de l'Enseignement Supérieur et de la Recherche Scientifique", "cvSchool"),
    p("École Supérieure Privée d'Ingénierie et de Technologies", "cvSchool"),
    p("ESPRIT", "cvSub"),
    Spacer(1, 26 * mm),
    p("Projet de Fin d'Études &mdash; Première restitution", "cvKind"),
    Spacer(1, 3 * mm),
    p("LeaseManager", "cvTitle"),
    Spacer(1, 5 * mm),
    p("Plateforme SaaS multi-organisations pour la gestion<br/>locative de bureaux", "cvLead"),
    Spacer(1, 24 * mm),
    HRFlowable(width="38%", thickness=0.9, color=LINE, hAlign="CENTER"),
    Spacer(1, 10 * mm),
]

cover = [
    ["Élaboré par", "……………………………………"],
    ["Classe", "……………………………………"],
    ["Encadrant académique", "……………………………………"],
    ["Encadrant professionnel", "……………………………………"],
    ["Organisme d'accueil", "……………………………………"],
    ["Période de stage", "……………………………………"],
]
ct = Table([[Paragraph("<b>%s</b>" % a, S["cvField"]), Paragraph(b, S["cvField"])]
            for a, b in cover], colWidths=[52 * mm, 62 * mm], hAlign="CENTER")
ct.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ("ALIGN", (0, 0), (0, -1), "RIGHT"),
]))
story += [ct, Spacer(1, 20 * mm),
          p("Année universitaire 2026 – 2027", "cvSub"),
          PageBreak()]

# ──────────────────────────────── sommaire ──────────────────────────────────
story += [Paragraph("Sommaire", S["h1"]),
          HRFlowable(width="100%", thickness=1.1, color=ACC, spaceBefore=3, spaceAfter=10)]

toc_rows = [
    ["Introduction", "3"],
    ["1. Présentation du cadre du projet", "3"],
    ["2. Critique de l'existant", "4"],
    ["3. Solution proposée", "5"],
    ["4. Méthodologie de travail", "6"],
    ["5. Besoins fonctionnels et non fonctionnels", "7"],
    ["6. Technologies utilisées", "9"],
    ["7. Partie déjà réalisée", "10"],
    ["8. Partie non encore réalisée", "12"],
    ["9. Conclusion et perspectives", "13"],
    ["Annexe A. Plan de diaporama proposé", "14"],
]
tt = Table([[Paragraph(a, S["tb"]), Paragraph(b, S["tb"])] for a, b in toc_rows],
           colWidths=[CW - 18 * mm, 18 * mm], hAlign="LEFT")
tt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ("TOPPADDING", (0, 0), (-1, -1), 4.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
]))
story += [tt, Spacer(1, 14)]

story += [callout(
    "Objet de ce document",
    "Ce support rassemble la matière de la première restitution : le contenu de chaque "
    "point attendu, les chiffres qui l'appuient et, pour chaque section, ce qu'il "
    "convient de développer oralement. L'annexe A propose un découpage en diapositives "
    "prêt à être transposé dans un diaporama. Tous les chiffres cités proviennent du "
    "code source à la date indiquée en pied de page, et non d'une estimation.", "acc")]
story += [PageBreak()]

# ────────────────────────────── introduction ────────────────────────────────
story += [Paragraph("Introduction", S["h1"]),
          HRFlowable(width="100%", thickness=1.1, color=ACC, spaceBefore=3, spaceAfter=9)]
story += [p(
    "La gestion locative de bureaux met en relation trois catégories d'acteurs qui ne "
    "partagent ni les mêmes besoins ni les mêmes droits : celui qui exploite la "
    "plateforme, celui qui détient les murs, et celui qui occupe les lieux. La plupart "
    "des progiciels du marché ne reconnaissent qu'une seule notion de client et "
    "n'expriment donc pas cette imbrication. Le présent projet part de ce constat."),
    p(
    "LeaseManager est une plateforme en mode SaaS qui couvre le cycle complet de la "
    "location de bureaux, depuis la demande d'un visiteur anonyme jusqu'au bail signé, "
    "à la facture mensuelle et au ticket de maintenance. Sa particularité tient à ce "
    "qu'un déploiement unique sert plusieurs sociétés immobilières concurrentes, sans "
    "qu'aucune ne puisse percevoir la moindre donnée d'une autre."),
    p(
    "Ce document rend compte de l'état d'avancement à mi-parcours. Il présente le cadre "
    "du projet, les limites de l'existant, la solution retenue et la démarche suivie, "
    "puis distingue ce qui est livré de ce qui reste à produire.")]

# ─────────────────────────── 1. cadre du projet ─────────────────────────────
story += section("1", "Présentation du cadre du projet")
story += [
    Paragraph("1.1  Le domaine d'application", S["h2"]),
    p("Une société immobilière détient un ou plusieurs immeubles de bureaux et met à "
      "disposition d'entreprises tierces des surfaces de travail de natures diverses : "
      "bureaux privatifs, postes dédiés, postes partagés, salles de réunion, salles de "
      "conférence, cabines téléphoniques et espaces événementiels. Chaque surface est "
      "caractérisée par une capacité, une superficie, un tarif et un état d'occupation."),
    p("L'exploitation quotidienne mobilise plusieurs métiers. La réception qualifie les "
      "demandes entrantes et organise les visites. Le responsable de site approuve les "
      "réservations et établit les baux. Le service financier émet les factures et "
      "enregistre les règlements. Les techniciens traitent les incidents signalés par "
      "les occupants."),

    Paragraph("1.2  Une pratique commerciale spécifique", S["h2"]),
    p("Le marché visé est celui du Qatar, dont deux caractéristiques ont orienté la "
      "conception de façon déterminante."),
    p("La location commerciale s'y conclut en présence des parties. Une demande ne devient "
      "pas un contrat par un simple clic : elle donne lieu à un appel téléphonique de "
      "confirmation, puis à une visite des lieux, puis à la remise d'un dossier "
      "administratif, et seulement ensuite à une signature. Un système qui ignorerait "
      "cette séquence serait inutilisable en pratique."),
    p("Le règlement des loyers s'effectue en espèces, par virement bancaire ou par chèque. "
      "Le paiement en ligne n'est pas d'usage. Cette contrainte, confirmée par "
      "l'encadrement, a conduit à écarter toute passerelle de paiement et à concevoir "
      "l'encaissement comme un acte d'enregistrement réalisé par un agent financier."),

    Paragraph("1.3  Objectif du projet", S["h2"]),
    p("Concevoir et réaliser une plateforme qui rassemble l'ensemble de ces activités, "
      "qui respecte les pratiques du marché visé, et qui puisse être exploitée par "
      "plusieurs sociétés immobilières indépendantes depuis une installation unique."),
]
story += speaker(
    "Insister sur le fait que le sujet n'est pas un simple logiciel de réservation. La "
    "difficulté tient à la coexistence de plusieurs sociétés concurrentes sur une même "
    "installation, et au respect d'un processus commercial présentiel que les produits "
    "existants ne savent pas représenter.")
story += [PageBreak()]

# ────────────────────────── 2. critique de l'existant ───────────────────────
story += section("2", "Critique de l'existant")
story += [
    Paragraph("2.1  Les pratiques observées", S["h2"]),
    p("En l'absence d'outil dédié, la gestion repose sur des tableurs et des échanges de "
      "courriels. Ce mode de fonctionnement présente quatre faiblesses structurelles."),
    bullets([
        "<b>Disponibilité incertaine.</b> L'état réel d'occupation n'est connu d'aucune "
        "source unique. Deux réservations concurrentes sur une même surface ne sont "
        "détectées qu'au moment du conflit.",
        "<b>Recouvrement manuel.</b> Les échéances sont suivies de mémoire. Les relances "
        "dépendent de la vigilance d'une personne, ce qui allonge les délais "
        "d'encaissement.",
        "<b>Incidents non tracés.</b> Une demande de maintenance transmise oralement ou "
        "par courriel ne laisse pas de trace exploitable : ni délai de traitement, ni "
        "coût, ni historique par surface.",
        "<b>Absence de traçabilité.</b> Rien ne permet d'établir qui a approuvé quoi, "
        "ni à quelle date, ce qui pose une difficulté en cas de litige.",
    ]),

    Paragraph("2.2  Les limites des solutions du marché", S["h2"]),
    p("L'examen des progiciels de gestion locative disponibles fait apparaître quatre "
      "inadéquations au besoin exprimé."),
]
story += [table([
    ["Limite constatée", "Conséquence pour le besoin exprimé"],
    ["Un seul niveau de client",
     "Le modèle ne distingue pas la société qui loue des murs de celle qui les occupe. "
     "Il devient impossible d'héberger plusieurs bailleurs concurrents sans risque de "
     "recoupement."],
    ["Paiement en ligne imposé",
     "Inadapté à un marché où le loyer se règle au comptant, par virement ou par chèque."],
    ["Processus d'entrée entièrement dématérialisé",
     "Ne représente ni l'appel de confirmation, ni la visite, ni le dépôt du dossier "
     "administratif, qui sont pourtant obligatoires dans la pratique locale."],
    ["Tarification à l'utilisateur",
     "Le coût devient dissuasif pour une société de taille moyenne dont le personnel "
     "d'exploitation est nombreux."],
], [48 * mm, CW - 48 * mm])]
story += [Spacer(1, 6)]
story += [callout(
    "Le verrou technique retenu",
    "Deux sociétés immobilières concurrentes utilisent la même installation. Aucune ne "
    "doit percevoir la moindre trace de l'autre : ni une ligne de données, ni un total "
    "agrégé, ni un compteur. Cette exigence, davantage que la liste des fonctionnalités, "
    "structure l'ensemble de l'architecture décrite plus loin.", "acc")]
story += speaker(
    "C'est la section qui justifie l'existence du projet. Ne pas se contenter de "
    "critiquer le tableur, qui est une cible facile : la critique décisive porte sur les "
    "progiciels du marché, dont le modèle de données ne sait pas représenter deux "
    "niveaux de client imbriqués.")
story += [PageBreak()]

# ───────────────────────────── 3. solution ──────────────────────────────────
story += section("3", "Solution proposée")
story += [
    p("La réponse apportée repose sur un modèle de location à trois niveaux. Une "
      "organisation est représentée par un enregistrement unique dont un attribut précise "
      "la nature : société immobilière ou société locataire. La plateforme surplombe ces "
      "deux catégories."),
]
story += [table([
    ["Niveau", "Acteur", "Périmètre de visibilité"],
    ["1", "Propriétaire de la plateforme",
     "Exploite le service. Seul rôle autorisé à lire au travers des organisations. Un "
     "compte unique dans le jeu de démonstration."],
    ["2", "Société immobilière (bailleur)",
     "Détient bâtiments, étages et surfaces. Publie les annonces, instruit les "
     "candidatures, approuve les réservations, facture, encaisse, affecte les "
     "techniciens. Ne voit que son propre portefeuille."],
    ["3", "Société locataire (preneur)",
     "Occupe les surfaces. Réserve, signe les baux, règle les factures, signale les "
     "incidents, gère ses propres salariés. Ne voit que ses données, ainsi que la "
     "vitrine publique des surfaces disponibles."],
], [14 * mm, 44 * mm, CW - 58 * mm])]
story += [Spacer(1, 8),
    Paragraph("3.1  La difficulté centrale du modèle", S["h2"]),
    p("Une réservation, comme un ticket de maintenance, porte l'identifiant de "
      "l'organisation <b>locataire</b> : c'est elle qui a réservé la surface ou signalé "
      "l'incident. Le bailleur, lui, atteint cette même ligne par un tout autre chemin, "
      "en remontant la surface concernée vers l'étage puis vers le bâtiment dont il est "
      "propriétaire."),
    p("Deux organisations distinctes détiennent donc deux aspects différents d'une seule "
      "et même ligne. Cette dualité est la source de la quasi-totalité des défauts de "
      "cloisonnement rencontrés au cours du développement, et la raison pour laquelle "
      "chaque requête de lecture doit expliciter selon quel chemin elle restreint son "
      "résultat."),
    Spacer(1, 4),
    callout(
        "Formulation de la règle",
        "Le propriétaire de la plateforme lit sans restriction. Le locataire lit les "
        "lignes portant son identifiant. Le bailleur lit les lignes dont la surface "
        "appartient à l'un de ses bâtiments. Toute requête qui ne relève d'aucun de ces "
        "trois cas est refusée.", "acc"),
]
story += speaker(
    "Développer la dualité expliquée en 3.1 : c'est l'idée la plus originale du projet et "
    "celle qu'un jury retiendra. Un schéma au tableau suffit : une même ligne, deux "
    "flèches d'origines différentes.")
story += [PageBreak()]

# ──────────────────────────── 4. méthodologie ───────────────────────────────
story += section("4", "Méthodologie de travail")
story += [
    Paragraph("4.1  Organisation du développement", S["h2"]),
    p("Le développement a suivi une démarche itérative et incrémentale. Chaque itération "
      "porte sur un ensemble fonctionnel autonome, et se termine par une version "
      "exécutable de l'application. Une itération comporte quatre temps : analyse du "
      "besoin, conception, réalisation, puis vérification sur l'application en "
      "fonctionnement et non sur les seuls tests unitaires."),
    p("Ce dernier point mérite d'être souligné. Les tests unitaires valident les fonctions "
      "chargées de restreindre les requêtes, mais ils ne disent rien du point d'appel qui "
      "omet de les invoquer. Or c'est précisément cette omission qui s'est révélée être "
      "la cause de tous les défauts de cloisonnement détectés."),

    Paragraph("4.2  Le dispositif de vérification", S["h2"]),
    p("Un programme d'audit indépendant a donc été écrit. Il s'authentifie sur le serveur "
      "en fonctionnement avec le compte le moins privilégié, puis exécute trente-sept "
      "sondes : lecture des listes exposées, tentatives de lecture d'une autre "
      "organisation, tentatives d'écriture sur des enregistrements appartenant à un tiers, "
      "et tentative d'élévation de privilège. Il ne crée aucune donnée, ce qui permet de "
      "le rejouer à volonté."),
    p("Ce dispositif a mis au jour neuf défauts qu'aucun test unitaire n'aurait signalés."),

    Paragraph("4.3  Outils de travail", S["h2"]),
]
story += [table([
    ["Outil", "Usage"],
    ["Git et GitHub", "Gestion de version, une branche par lot fonctionnel, historique "
                      "documenté justifiant chaque correction."],
    ["GitHub Actions", "Intégration continue : analyse statique, tests et compilation à "
                       "chaque envoi, sur les deux projets."],
    ["Docker Compose", "Environnement d'exécution identique pour tous les postes, "
                       "démarrage de la plateforme complète en une commande."],
    ["Swagger", "Documentation de l'interface de programmation, générée à partir du code "
                "et donc toujours à jour."],
    ["PlantUML", "Production des diagrammes de conception à partir de descriptions "
                 "textuelles versionnées avec le code."],
], [34 * mm, CW - 34 * mm])]
story += speaker(
    "Si le jury demande un cadre méthodologique nommé, expliquer que la démarche est "
    "itérative et incrémentale, et que la particularité du projet réside dans le "
    "dispositif de vérification décrit en 4.2, qui va au-delà des tests unitaires "
    "habituels.")
story += [PageBreak()]

# ───────────────────── 5. besoins fonctionnels / non fonct. ─────────────────
story += section("5", "Besoins fonctionnels et non fonctionnels")
story += [Paragraph("5.1  Besoins fonctionnels", S["h2"]),
          p("Les besoins ont été regroupés par domaine métier. Chaque domaine correspond "
            "à un module applicatif distinct.")]
story += [table([
    ["Domaine", "Besoins exprimés"],
    ["Vitrine publique",
     "Consulter la carte des surfaces disponibles ; consulter une fiche détaillée ; "
     "interroger un assistant de recherche en langage naturel ; déposer une demande de "
     "location sans disposer d'un compte."],
    ["Intégration d'un locataire",
     "Émettre un lien de candidature ; recevoir un dossier déposé depuis un formulaire "
     "externe ; instruire la candidature ; créer l'organisation et son compte "
     "administrateur."],
    ["Réservation",
     "Déposer une demande ; confirmer par téléphone ; enregistrer la visite ; déposer les "
     "pièces justificatives ; approuver ou refuser ; produire le bail."],
    ["Contractualisation",
     "Établir et signer les baux ; suivre les échéances ; gérer les renouvellements et "
     "les dépôts de garantie."],
    ["Facturation",
     "Émettre des factures détaillées en lignes ; enregistrer les règlements en espèces, "
     "par virement ou par chèque ; appliquer des codes promotionnels ; relancer les "
     "impayés."],
    ["Maintenance",
     "Signaler un incident sur une surface effectivement occupée ; classer la demande ; "
     "l'affecter à un technicien ; enregistrer la résolution et son coût."],
    ["Pilotage",
     "Consulter des tableaux de bord adaptés au rôle ; suivre le taux d'occupation ; "
     "établir une prévision de revenus ; exporter les données."],
    ["Traçabilité",
     "Consigner les actions sensibles dans un journal horodaté ; notifier les "
     "utilisateurs concernés en temps réel."],
], [36 * mm, CW - 36 * mm])]
story += [PageBreak()]

story += [Paragraph("5.2  Besoins non fonctionnels", S["h2"]),
          p("Quatre exigences transverses ont été retenues. La première est la plus "
            "contraignante et conditionne la conception générale.")]
story += [
    Paragraph("Cloisonnement et sécurité", S["h3"]),
    bullets([
        "L'isolation entre organisations doit être <b>vérifiable</b>, et non simplement "
        "affirmée. Elle fait l'objet d'un audit rejouable.",
        "L'authentification repose sur un jeton signé ; les mots de passe sont conservés "
        "sous forme d'empreinte calculée avec un algorithme à coût paramétrable.",
        "L'autorisation est déclarée route par route. Les champs non attendus dans une "
        "requête sont rejetés, et non ignorés, afin qu'aucun client ne puisse imposer un "
        "rôle ou une organisation.",
        "Les actions sensibles alimentent un journal d'audit en ajout seul.",
    ]),
    Paragraph("Fiabilité", S["h3"]),
    bullets([
        "L'application doit démarrer et fonctionner <b>sans aucune clé de service "
        "externe</b>. Chaque intégration dispose d'un mode dégradé.",
        "L'indisponibilité d'un service tiers ne doit jamais faire échouer une écriture "
        "déjà acceptée.",
        "Les évolutions du schéma de données sont décrites par des migrations rejouables "
        "depuis une base vide.",
    ]),
    Paragraph("Exploitabilité", S["h3"]),
    bullets([
        "L'installation complète doit être obtenue par une commande unique.",
        "Toute modification envoyée sur le dépôt déclenche une vérification automatique.",
    ]),
    Paragraph("Ergonomie", S["h3"]),
    bullets([
        "L'interface s'adapte aux écrans réduits et propose un thème clair et un thème "
        "sombre.",
        "La navigation est filtrée selon le rôle, sans que cela se substitue au contrôle "
        "effectué par le serveur.",
    ]),
]
story += [PageBreak()]

# ─────────────────────────── 6. technologies ────────────────────────────────
story += section("6", "Technologies utilisées")
story += [p("Le choix d'un langage unique pour les deux projets, côté serveur comme côté "
            "client, a permis de partager les définitions de types et de réduire les "
            "écarts d'interprétation entre les deux parties de l'application.")]
story += [table([
    ["Couche", "Technologies", "Justification du choix"],
    ["Serveur",
     "NestJS 11, Prisma 5, PostgreSQL 13, Passport-JWT, Socket.IO",
     "NestJS impose une organisation modulaire et un mécanisme de gardes qui se prête "
     "à un contrôle d'accès déclaratif. Prisma fournit un accès typé à la base et un "
     "outillage de migration."],
    ["Client",
     "React 19, Vite 7, TypeScript, Ant Design 6, TanStack Query, Zustand, Recharts, "
     "Leaflet",
     "Ant Design couvre les composants d'un back-office sans développement spécifique. "
     "TanStack Query gère le cache des données distantes et leur invalidation."],
    ["Infrastructure",
     "Docker Compose, nginx, GitHub Actions",
     "Quatre conteneurs décrits dans un seul fichier. nginx sert l'application compilée "
     "et relaie l'interface de programmation sur la même origine, ce qui supprime toute "
     "configuration de partage entre origines."],
    ["Services externes",
     "Groq, Brevo, Cloudinary, Typeform",
     "Respectivement : modèle de langage, courrier transactionnel, stockage de fichiers, "
     "collecte des candidatures. Chacun dispose d'un mode dégradé."],
], [24 * mm, 46 * mm, CW - 70 * mm])]
story += [Spacer(1, 7), callout(
    "Choix d'architecture à souligner",
    "Le client du modèle de langage respecte une interface normalisée et son adresse est "
    "paramétrable. Changer de fournisseur, ou passer à un modèle capable de lire des "
    "images, relève de la configuration et non d'une réécriture.", "acc")]
story += [PageBreak()]

# ───────────────────────── 7. partie réalisée ───────────────────────────────
story += section("7", "Partie déjà réalisée")
story += [p("L'application est fonctionnelle de bout en bout. Les chiffres ci-dessous "
            "décrivent le périmètre livré à ce jour.")]

met = [["25", "modèles de données"], ["30", "contrôleurs"], ["55", "pages d'interface"],
       ["9", "rôles utilisateurs"], ["252", "tests automatisés"], ["37", "sondes d'audit"]]
mt = Table([[Paragraph("<b>%s</b>" % a,
                       ParagraphStyle("m", fontName="Calibri-Bold", fontSize=16,
                                      leading=19, textColor=ACC2, alignment=TA_CENTER)),
             ] for a, b in met[:3]] , colWidths=[(CW) / 3.0] * 1)
grid = Table([[Paragraph("<b>%s</b>" % a, ParagraphStyle("mv", fontName="Calibri-Bold",
                                                         fontSize=17, leading=20,
                                                         textColor=ACC2, alignment=TA_CENTER))
               for a, b in met],
              [Paragraph(b, ParagraphStyle("ml", fontName="Calibri", fontSize=8.2,
                                           leading=10.5, textColor=INK3,
                                           alignment=TA_CENTER)) for a, b in met]],
             colWidths=[CW / 6.0] * 6, hAlign="LEFT")
grid.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("BACKGROUND", (0, 0), (-1, -1), SOFT),
    ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
    ("TOPPADDING", (0, 1), (-1, 1), 0), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
story += [grid, Spacer(1, 11)]

story += [
    Paragraph("7.1  Chaîne métier complète", S["h2"]),
    p("Le parcours entier est opérationnel : un visiteur anonyme consulte la carte, "
      "dépose une candidature, voit son organisation créée après instruction, réserve une "
      "surface, franchit les étapes de confirmation téléphonique et de visite, dépose ses "
      "pièces, obtient un bail, reçoit une facture et voit son règlement enregistré. Les "
      "incidents qu'il signale sont classés, affectés et résolus."),

    Paragraph("7.2  Cloisonnement des données", S["h2"]),
    p("Les trois niveaux sont en place et vérifiés. Neuf défauts d'isolation ont été "
      "détectés et corrigés au cours du développement. Le contrôle de cohérence retenu "
      "est le suivant : les chiffres de chaque bailleur, additionnés, doivent redonner "
      "exactement ceux de la plateforme. Un cloisonnement correct partitionne les "
      "données ; si une ligne fuyait ou était comptée deux fois, la somme ne tomberait "
      "pas juste. Cette égalité est vérifiée sur le chiffre d'affaires, les réservations, "
      "les surfaces et les tickets."),

    Paragraph("7.3  Fonctions faisant appel à l'intelligence artificielle", S["h2"]),
    p("Trois fonctions ont été réalisées. Elles partagent un principe commun : le modèle "
      "de langage propose, il ne décide pas."),
    bullets([
        "<b>Classement des tickets de maintenance.</b> À la saisie, la catégorie et la "
        "priorité sont déduites du texte libre. Le technicien suggéré, en revanche, est "
        "déterminé par une requête sur l'historique, et non par le modèle : nombre "
        "d'interventions résolues dans la catégorie, pondéré par la charge en cours. Un "
        "modèle interrogé sur un nom propose des personnes qui n'existent pas, et le "
        "responsable doit pouvoir justifier son affectation.",
        "<b>Assistant de recherche pour le visiteur.</b> Une demande formulée librement "
        "est traduite en critères, puis une requête ordinaire sélectionne les surfaces "
        "correspondantes parmi les seules annonces publiées. Le modèle rédige ensuite un "
        "commentaire sur les résultats obtenus ; il ne choisit aucune surface et n'en voit "
        "aucune que la requête n'ait retournée.",
        "<b>Lecture de documents administratifs.</b> Une licence commerciale ou un "
        "registre déposé au format PDF est analysé pour en extraire les champs qu'un "
        "gestionnaire saisirait autrement à la main.",
    ]),
    Spacer(1, 2),
    callout(
        "Principe de conception retenu pour l'IA",
        "Toute valeur produite par le modèle et qui ne figure pas dans la nomenclature de "
        "l'application est écartée, et un classement par mots-clés prend le relais. Il en "
        "va de même si la clé d'accès est absente ou le service indisponible. La création "
        "d'un ticket ne dépend donc jamais de la disponibilité d'un prestataire.", "acc"),

    Paragraph("7.4  Qualité et exploitation", S["h2"]),
    p("La plateforme complète démarre par une commande unique et comprend quatre "
      "conteneurs. L'intégration continue est au vert et la vérification des types ne "
      "signale aucune erreur sur les deux projets. Un jeu de données de démonstration "
      "reconstruit une situation réaliste comportant trois sociétés immobilières "
      "concurrentes, six sociétés locataires et des enregistrements dans les vingt-cinq "
      "modèles."),
]
story += speaker(
    "Le contrôle de cohérence décrit en 7.2 est l'argument le plus convaincant pour un "
    "jury technique : il transforme une affirmation de sécurité en une propriété "
    "arithmétique vérifiable. Le préparer sur une diapositive avec les quatre totaux.")
story += [PageBreak()]

# ────────────────────── 8. partie non encore réalisée ───────────────────────
story += section("8", "Partie non encore réalisée")
story += [p("Les points suivants restent à traiter. Aucun ne bloque un parcours métier : "
            "chacun dispose soit d'un mode dégradé, soit d'un équivalent manuel déjà en "
            "place.")]
story += [table([
    ["Point restant", "État", "Motif"],
    ["Interface de lecture des documents", "Serveur seul",
     "L'extraction des champs fonctionne et est testée. Le dépôt de fichier dans le "
     "formulaire et la reprise des valeurs restent à construire."],
    ["Lecture des documents numérisés", "Limitée",
     "Le fournisseur de modèle actuellement configuré n'expose aucun modèle capable de "
     "lire une image. Seuls les documents comportant une couche de texte sont exploités. "
     "Le passage à un fournisseur adapté est une modification de configuration."],
    ["Diffusion sur les places de marché", "En attente",
     "Les adaptateurs sont écrits mais les identifiants d'accès n'ont pas été fournis."],
    ["Fiche d'établissement Google", "Suspendu",
     "Nécessite un compte vérifié détenu par le propriétaire des établissements."],
    ["Envoi de courriels en production", "Mode dégradé",
     "L'adresse du serveur doit être autorisée chez le prestataire. Le relais de "
     "substitution assure le service dans l'intervalle."],
    ["Application mobile", "Hors périmètre",
     "L'interface web est adaptative. Une application native constituerait une suite du "
     "projet et non un manque."],
], [42 * mm, 24 * mm, CW - 66 * mm])]
story += speaker(
    "Présenter cette section sans la minimiser. Un jury accorde davantage de crédit à un "
    "état d'avancement lucide qu'à une liste exhaustive de fonctionnalités annoncées "
    "comme terminées. Préciser pour chaque point ce qui manque exactement.")
story += [PageBreak()]

# ───────────────────── 9. conclusion et perspectives ────────────────────────
story += section("9", "Conclusion et perspectives")
story += [
    Paragraph("9.1  Bilan à mi-parcours", S["h2"]),
    p("La plateforme couvre aujourd'hui l'ensemble du cycle de la location de bureaux et "
      "fonctionne pour les neuf rôles prévus, du visiteur anonyme au propriétaire de la "
      "plateforme. Le modèle de location à trois niveaux, qui constituait le principal "
      "risque technique, est en place et son respect est vérifié par un dispositif "
      "automatisé plutôt qu'affirmé."),

    Paragraph("9.2  Enseignement principal", S["h2"]),
    p("Aucun des neuf défauts de cloisonnement détectés ne provenait d'une fonction de "
      "sécurité erronée. Tous provenaient d'un point d'appel qui omettait de l'invoquer : "
      "un cas non traité, un filtre calculé puis ignoré, une déclaration d'autorisation "
      "absente sur une route qui s'en trouvait ouverte à tout compte authentifié."),
    p("Quatre de ces défauts sont demeurés invisibles tant que le jeu de données ne "
      "comportait qu'une seule société immobilière. Avec un seul bailleur, « tout "
      "afficher » et « afficher mon portefeuille » produisent le même résultat. La "
      "reconstruction du jeu de données autour de trois sociétés concurrentes les a "
      "révélés le jour même. La forme des données d'essai fait donc partie intégrante de "
      "la surface de sécurité, au même titre que le code."),

    Paragraph("9.3  Perspectives", S["h2"]),
    bullets([
        "Construire l'interface de dépôt des documents, puis basculer vers un modèle "
        "capable de lire les pièces numérisées.",
        "Étendre l'assistant conversationnel aux données propres du locataire, en "
        "l'adossant à la couche de requêtes restreintes existante et en l'accompagnant "
        "d'une série d'essais d'injection destinés à démontrer qu'il ne franchit pas la "
        "frontière entre organisations.",
        "Substituer au score heuristique de maintenance prédictive un modèle entraîné sur "
        "l'historique des incidents, et mesurer son apport par rapport à l'heuristique "
        "prise comme référence.",
        "Réaliser une application mobile destinée aux techniciens en intervention.",
    ]),
]
story += [PageBreak()]

# ──────────────────────── annexe : plan de diaporama ────────────────────────
story += [Paragraph("Annexe A. Plan de diaporama proposé", S["h1"]),
          HRFlowable(width="100%", thickness=1.1, color=ACC, spaceBefore=3, spaceAfter=9),
          p("Découpage en quinze diapositives pour une présentation de vingt minutes. La "
            "colonne de droite indique la source à reprendre dans le présent document.")]
story += [table([
    ["N°", "Diapositive", "Contenu à reprendre"],
    ["1", "Page de titre", "Page de garde"],
    ["2", "Plan de la présentation", "Sommaire"],
    ["3", "Cadre du projet : le domaine", "Section 1.1"],
    ["4", "Cadre du projet : les spécificités du marché", "Section 1.2"],
    ["5", "Critique de l'existant : les pratiques", "Section 2.1"],
    ["6", "Critique de l'existant : les progiciels", "Tableau de la section 2.2"],
    ["7", "Solution : le modèle à trois niveaux", "Tableau de la section 3"],
    ["8", "Solution : la difficulté centrale", "Section 3.1 et son encadré"],
    ["9", "Méthodologie et vérification", "Sections 4.1 et 4.2"],
    ["10", "Besoins fonctionnels", "Tableau de la section 5.1"],
    ["11", "Besoins non fonctionnels", "Section 5.2"],
    ["12", "Architecture et technologies", "Tableau de la section 6"],
    ["13", "Réalisé : chiffres et chaîne métier", "Sections 7.1 à 7.3"],
    ["14", "Reste à faire", "Tableau de la section 8"],
    ["15", "Conclusion et perspectives", "Sections 9.2 et 9.3"],
], [10 * mm, 62 * mm, CW - 72 * mm])]
story += [Spacer(1, 10), callout(
    "Recommandations de forme",
    "Une idée par diapositive et six lignes au maximum. Les tableaux du présent document "
    "sont trop denses pour être projetés tels quels : n'en retenir que les deux ou trois "
    "lignes qui portent l'argument. Prévoir les diagrammes produits avec PlantUML en "
    "appui des diapositives 7, 8 et 12. Conserver les chiffres, qui sont vérifiables, et "
    "éviter les formulations générales qui ne le sont pas.", "acc")]

story += [Spacer(1, 12), HRFlowable(width="100%", thickness=0.5, color=LINE),
          Spacer(1, 6),
          Paragraph(
              "Les chiffres cités dans ce document sont relevés du code source du projet "
              "à la date du 28 septembre 2026. La page de garde comporte six champs à "
              "renseigner, laissés vierges à dessein.",
              ParagraphStyle("fin", fontName="Calibri-Italic", fontSize=8.6, leading=12,
                             textColor=INK3, alignment=TA_JUSTIFY))]

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Premiere_Restitution.pdf")
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=ML, rightMargin=MR,
                      topMargin=MT, bottomMargin=MB,
                      title="LeaseManager — Première restitution",
                      author="PFE", subject="Projet de Fin d'Études")
frame = Frame(ML, MB, PW - ML - MR, PH - MT - MB, id="f", showBoundary=0)
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=decorate)])
doc.build(story)
print("PDF écrit :", out)
