# -*- coding: utf-8 -*-
"""
Diaporama de la première restitution (PFE LeaseManager).

Format 16:9, une idée par diapositive, texte court destiné à être projeté.
Les commentaires destinés à l'orateur sont regroupés à la fin, repérés par
numéro de diapositive, pour être collés dans le volet « Commentaires » de
PowerPoint sans alourdir les pages projetées.
"""
import os
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Paragraph, Table, TableStyle, Frame

F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Cal", F + "calibri.ttf"))
pdfmetrics.registerFont(TTFont("Cal-B", F + "calibrib.ttf"))
pdfmetrics.registerFont(TTFont("Cal-I", F + "calibrii.ttf"))
pdfmetrics.registerFont(TTFont("Geo", F + "georgia.ttf"))
pdfmetrics.registerFont(TTFont("Geo-I", F + "georgiai.ttf"))
pdfmetrics.registerFontFamily("Cal", normal="Cal", bold="Cal-B", italic="Cal-I",
                              boldItalic="Cal-B")

# 16:9
PW, PH = 338.667 * mm, 190.5 * mm
M = 20 * mm
CW = PW - 2 * M

INK = colors.HexColor("#14181F")
INK2 = colors.HexColor("#46525B")
INK3 = colors.HexColor("#7C8992")
ACC = colors.HexColor("#0B5E64")
ACC2 = colors.HexColor("#084449")
WASH = colors.HexColor("#E7F2F2")
LINE = colors.HexColor("#CFDCDF")
SOFT = colors.HexColor("#F4F8F8")
L1 = colors.HexColor("#2D3A8C")
L1W = colors.HexColor("#E8EAF7")
L3 = colors.HexColor("#9A5B1E")
L3W = colors.HexColor("#F7EDE0")
OK = colors.HexColor("#1B7048")
OKW = colors.HexColor("#E4F1EA")
WARN = colors.HexColor("#8A5D00")
WARNW = colors.HexColor("#FAF2DE")

st = lambda n, **k: ParagraphStyle(n, **k)
S = {
    "eyebrow": st("e", fontName="Cal-B", fontSize=12, leading=14, textColor=ACC),
    "h": st("h", fontName="Cal-B", fontSize=30, leading=34, textColor=INK),
    "hs": st("hs", fontName="Cal-B", fontSize=25, leading=29, textColor=INK),
    "lead": st("l", fontName="Geo", fontSize=15, leading=22, textColor=INK2),
    "b": st("b", fontName="Cal", fontSize=15, leading=22, textColor=INK),
    "bs": st("bs", fontName="Cal", fontSize=13.5, leading=19.5, textColor=INK),
    "cardT": st("ct", fontName="Cal-B", fontSize=14, leading=17, textColor=ACC2),
    "cardB": st("cb", fontName="Cal", fontSize=12.5, leading=17.5, textColor=INK2),
    "th": st("th", fontName="Cal-B", fontSize=11.5, leading=14, textColor=colors.white),
    "td": st("td", fontName="Cal", fontSize=12, leading=16, textColor=INK),
    "big": st("bg", fontName="Cal-B", fontSize=40, leading=44, textColor=ACC2,
              alignment=TA_CENTER),
    "biglbl": st("bl", fontName="Cal", fontSize=10.5, leading=13, textColor=INK3,
                 alignment=TA_CENTER),
    "quote": st("q", fontName="Geo-I", fontSize=17, leading=26, textColor=INK),
    "ttl": st("t", fontName="Cal-B", fontSize=52, leading=57, textColor=INK,
              alignment=TA_CENTER),
    "sub": st("s", fontName="Geo-I", fontSize=17, leading=25, textColor=INK2,
              alignment=TA_CENTER),
    "cvs": st("cv", fontName="Cal", fontSize=13, leading=19, textColor=INK2,
              alignment=TA_CENTER),
    "note": st("n", fontName="Cal", fontSize=11.5, leading=16, textColor=INK2),
}

c = None
slide_no = 0
NOTES = []


def newpage():
    global slide_no
    if slide_no:
        c.showPage()
    slide_no += 1


def chrome(section=None):
    """Bandeau et pied de page communs."""
    c.setFillColor(colors.white)
    c.rect(0, 0, PW, PH, stroke=0, fill=1)
    # filet supérieur
    c.setFillColor(ACC)
    c.rect(0, PH - 4 * mm, PW, 4 * mm, stroke=0, fill=1)
    # pied
    c.setFont("Cal", 9)
    c.setFillColor(INK3)
    c.drawString(M, 9 * mm, "LeaseManager — Première restitution")
    c.drawRightString(PW - M, 9 * mm, str(slide_no))
    if section:
        c.setFont("Cal-B", 9)
        c.setFillColor(ACC)
        c.drawCentredString(PW / 2.0, 9 * mm, section)


def para(text, style, x, y, w, h=None):
    p = Paragraph(text, S[style])
    wd, ht = p.wrap(w, h or PH)
    p.drawOn(c, x, y - ht)
    return ht


def head(eyebrow, title, small=False):
    y = PH - 22 * mm
    if eyebrow:
        para(eyebrow.upper(), "eyebrow", M, y, CW)
        y -= 8 * mm
    ht = para(title, "hs" if small else "h", M, y, CW)
    y -= ht + 4 * mm
    c.setStrokeColor(ACC)
    c.setLineWidth(1.6)
    c.line(M, y, M + 46 * mm, y)
    return y - 10 * mm


def cards(items, y, cols=3, height=None, tone=ACC):
    """items = [(titre, [lignes])]"""
    gap = 6 * mm
    w = (CW - gap * (cols - 1)) / cols
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    for row in rows:
        maxh = 0
        for i, (t, lines) in enumerate(row):
            x = M + i * (w + gap)
            body = "<br/>".join("• " + l for l in lines) if isinstance(lines, list) else lines
            pt = Paragraph(t, S["cardT"])
            pb = Paragraph(body, S["cardB"])
            _, h1 = pt.wrap(w - 14 * mm, PH)
            _, h2 = pb.wrap(w - 14 * mm, PH)
            box = height or (h1 + h2 + 16 * mm)
            maxh = max(maxh, box)
        for i, (t, lines) in enumerate(row):
            x = M + i * (w + gap)
            c.setFillColor(SOFT)
            c.setStrokeColor(LINE)
            c.setLineWidth(0.7)
            c.rect(x, y - maxh, w, maxh, stroke=1, fill=1)
            c.setFillColor(tone)
            c.rect(x, y - maxh, 1.6 * mm, maxh, stroke=0, fill=1)
            yy = y - 7 * mm
            ht = para(t, "cardT", x + 7 * mm, yy, w - 14 * mm)
            yy -= ht + 3 * mm
            body = "<br/>".join("• " + l for l in lines) if isinstance(lines, list) else lines
            para(body, "cardB", x + 7 * mm, yy, w - 14 * mm)
        y -= maxh + gap
    return y


def tbl(rows, widths, y, fs=12):
    S["td"].fontSize = fs
    S["td"].leading = fs * 1.35
    data = [[Paragraph(str(x), S["th" if r == 0 else "td"]) for x in row]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths)
    cmds = [("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, 0), ACC2),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
            ("BOX", (0, 0), (-1, -1), 0.7, LINE)]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(cmds))
    w, h = t.wrap(CW, PH)
    t.drawOn(c, M, y - h)
    return y - h


def banner(text, y, tone=ACC, bg=WASH, style="quote"):
    p = Paragraph(text, S[style])
    w, h = p.wrap(CW - 22 * mm, PH)
    c.setFillColor(bg)
    c.setStrokeColor(bg)
    c.rect(M, y - h - 14 * mm, CW, h + 14 * mm, stroke=0, fill=1)
    c.setFillColor(tone)
    c.rect(M, y - h - 14 * mm, 2.2 * mm, h + 14 * mm, stroke=0, fill=1)
    p.drawOn(c, M + 12 * mm, y - h - 7 * mm)
    return y - h - 14 * mm


def note(n, txt):
    """n est passé explicitement pour rester lisible à la relecture."""
    NOTES.append((n, txt))


# ═══════════════════════════════════════════════════════════════════════════
out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "LeaseManager_Diaporama_Restitution1.pdf")
c = pdfcanvas.Canvas(out, pagesize=(PW, PH))
c.setTitle("LeaseManager — Première restitution")

# ── 1. titre ────────────────────────────────────────────────────────────────
newpage()
c.setFillColor(colors.white); c.rect(0, 0, PW, PH, stroke=0, fill=1)
c.setFillColor(ACC); c.rect(0, PH - 6 * mm, PW, 6 * mm, stroke=0, fill=1)
c.setFillColor(ACC); c.rect(0, 0, PW, 3 * mm, stroke=0, fill=1)
para("ESPRIT — École Supérieure Privée d'Ingénierie et de Technologies", "cvs",
     M, PH - 26 * mm, CW)
para("Projet de Fin d'Études &nbsp;·&nbsp; Première restitution", "cvs", M, PH - 36 * mm, CW)
para("LeaseManager", "ttl", M, PH - 62 * mm, CW)
para("Plateforme SaaS multi-organisations pour la gestion locative de bureaux",
     "sub", M, PH - 92 * mm, CW)
c.setStrokeColor(LINE); c.setLineWidth(0.8)
c.line(PW / 2 - 40 * mm, 62 * mm, PW / 2 + 40 * mm, 62 * mm)
para("Élaboré par&nbsp;: ………………………&nbsp;&nbsp;·&nbsp;&nbsp;Classe&nbsp;: ………………",
     "cvs", M, 54 * mm, CW)
para("Encadrant académique&nbsp;: ………………………&nbsp;&nbsp;·&nbsp;&nbsp;"
     "Encadrant professionnel&nbsp;: ………………………", "cvs", M, 44 * mm, CW)
para("Année universitaire 2026 – 2027", "cvs", M, 30 * mm, CW)

# ── 2. plan ─────────────────────────────────────────────────────────────────
newpage(); chrome()
y = head(None, "Plan de la présentation")
items = [
    ("1.  Cadre du projet", "Le domaine, les acteurs, les spécificités du marché"),
    ("2.  Critique de l'existant", "Pratiques actuelles et limites des progiciels"),
    ("3.  Solution proposée", "Le modèle de location à trois niveaux"),
    ("4.  Méthodologie", "Démarche itérative et dispositif de vérification"),
    ("5.  Besoins", "Fonctionnels et non fonctionnels"),
    ("6.  Technologies", "Choix techniques et architecture"),
    ("7.  Partie réalisée", "Ce qui fonctionne aujourd'hui"),
    ("8.  Partie restante", "Ce qui n'est pas fait, et pourquoi"),
    ("9.  Conclusion", "Enseignements et perspectives"),
]
rows = [[Paragraph("<b>%s</b>" % a, S["td"]), Paragraph(b, S["td"])] for a, b in items]
t = Table(rows, colWidths=[78 * mm, CW - 78 * mm])
t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                       ("TOPPADDING", (0, 0), (-1, -1), 6.5),
                       ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
                       ("LEFTPADDING", (0, 0), (-1, -1), 0),
                       ("LINEBELOW", (0, 0), (-1, -2), 0.35, LINE),
                       ("TEXTCOLOR", (1, 0), (1, -1), INK2)]))
w, h = t.wrap(CW, PH); t.drawOn(c, M, y - h)

# ── 3. cadre : le domaine ───────────────────────────────────────────────────
newpage(); chrome("1 · Cadre du projet")
y = head("1 · Cadre du projet", "Louer des bureaux, à Doha")
y = para("Une société immobilière détient des tours et loue des surfaces à d'autres "
         "entreprises.", "lead", M, y, CW) and y - 16 * mm
y = cards([
    ("Le bailleur", ["Bâtiments, étages, surfaces", "Publie et instruit",
                     "Facture et encaisse"]),
    ("Le locataire", ["Réserve des surfaces", "Signe un bail", "Signale les incidents"]),
    ("L'exploitation", ["Réception : appels, visites", "Techniciens : maintenance",
                        "Finance : encaissement"]),
], y, cols=3)
note(3, "Poser le décor en trente secondes. Insister sur le fait que trois métiers "
        "différents interviennent sur la même donnée, avec des droits différents.")

# ── 4. cadre : spécificités du marché ───────────────────────────────────────
newpage(); chrome("1 · Cadre du projet")
y = head("1 · Cadre du projet", "Deux règles du marché qatari")
y = cards([
    ("La location se conclut en personne",
     ["Appel téléphonique de confirmation", "Visite des lieux",
      "Dossier administratif papier", "Puis seulement la signature"]),
    ("Le loyer ne se paie pas en ligne",
     ["Espèces, virement ou chèque", "Aucune passerelle de paiement",
      "L'encaissement est <b>enregistré</b> par un agent"]),
], y, cols=2, height=52 * mm)
banner("Ces deux règles ne sont pas des détails&nbsp;: elles éliminent d'emblée "
       "la plupart des produits du marché.", y - 6 * mm)
note(4, "C'est ici que le sujet devient spécifique. La contrainte du paiement comptant "
        "vient de l'encadrement professionnel : la citer comme telle.")

# ── 5. critique : pratiques ─────────────────────────────────────────────────
newpage(); chrome("2 · Critique de l'existant")
y = head("2 · Critique de l'existant", "Aujourd'hui : tableur et courriel")
y = cards([
    ("Disponibilité incertaine", ["Aucune source unique", "Conflits détectés trop tard"]),
    ("Recouvrement manuel", ["Échéances suivies de mémoire", "Délais d'encaissement longs"]),
    ("Incidents non tracés", ["Ni délai, ni coût", "Aucun historique par surface"]),
    ("Aucune traçabilité", ["Qui a approuvé quoi ?", "Difficulté en cas de litige"]),
], y, cols=4, height=42 * mm, tone=WARN)
note(5, "Aller vite : c'est la partie attendue. L'argument fort est la diapositive "
        "suivante.")

# ── 6. critique : progiciels ────────────────────────────────────────────────
newpage(); chrome("2 · Critique de l'existant")
y = head("2 · Critique de l'existant", "Pourquoi les progiciels ne conviennent pas")
y = tbl([
    ["Limite", "Conséquence"],
    ["Un seul niveau de client",
     "Ne distingue pas qui loue les murs de qui les occupe → impossible d'héberger "
     "plusieurs bailleurs concurrents"],
    ["Paiement en ligne imposé", "Inadapté à un marché au comptant"],
    ["Parcours 100 % dématérialisé", "Ignore l'appel, la visite et le dossier papier"],
    ["Tarification à l'utilisateur", "Coût dissuasif pour une société de taille moyenne"],
], [72 * mm, CW - 72 * mm], y, fs=13)
note(6, "La première ligne est la plus importante : c'est elle qui justifie l'existence "
        "du projet. Ne pas la traiter comme une ligne parmi d'autres.")

# ── 7. le verrou ────────────────────────────────────────────────────────────
newpage(); chrome("2 · Critique de l'existant")
c.setFillColor(ACC2); c.rect(0, 0, PW, PH, stroke=0, fill=1)
S["quote"].textColor = colors.white
S["eyebrow"].textColor = colors.HexColor("#8FD3D6")
para("LE VERROU TECHNIQUE", "eyebrow", M, PH - 40 * mm, CW)
S["ttl"].textColor = colors.white
S["ttl"].fontSize = 34; S["ttl"].leading = 44; S["ttl"].alignment = TA_LEFT
para("Deux sociétés concurrentes,<br/>une seule installation,<br/>"
     "zéro donnée en commun.", "ttl", M, PH - 56 * mm, CW)
S["sub"].textColor = colors.HexColor("#BFE0E1"); S["sub"].alignment = TA_LEFT
para("Ni une ligne, ni un total, ni un compteur. Cette exigence structure toute "
     "l'architecture.", "sub", M, 52 * mm, CW - 60 * mm)
S["quote"].textColor = INK; S["ttl"].textColor = INK
S["ttl"].fontSize = 52; S["ttl"].leading = 57; S["ttl"].alignment = TA_CENTER
S["sub"].textColor = INK2; S["sub"].alignment = TA_CENTER
S["eyebrow"].textColor = ACC
note(7, "Diapositive de respiration. Marquer un temps d'arrêt : c'est la charnière "
        "entre le problème et la solution.")

# ── 8. solution : trois niveaux ─────────────────────────────────────────────
newpage(); chrome("3 · Solution proposée")
y = head("3 · Solution proposée", "Un modèle de location à trois niveaux")
lv = [("NIVEAU 1", "Propriétaire de la plateforme",
       "Exploite le service. Seul rôle qui lit au travers des organisations.", L1, L1W, 0),
      ("NIVEAU 2", "Société immobilière — le bailleur",
       "Détient bâtiments et surfaces. Publie, approuve, facture, encaisse. "
       "Voit son portefeuille.", ACC, WASH, 14),
      ("NIVEAU 3", "Société locataire — le preneur",
       "Occupe les surfaces. Réserve, signe, règle, signale. Voit ses données.",
       L3, L3W, 28)]
for lab, nom, desc, tone, bg, ind in lv:
    x = M + ind * mm
    w = CW - ind * mm
    h = 26 * mm
    c.setFillColor(bg); c.setStrokeColor(LINE); c.setLineWidth(0.7)
    c.rect(x, y - h, w, h, stroke=1, fill=1)
    c.setFillColor(tone); c.rect(x, y - h, 2.2 * mm, h, stroke=0, fill=1)
    c.setFont("Cal-B", 10); c.setFillColor(tone)
    c.drawString(x + 8 * mm, y - 9 * mm, lab)
    c.setFont("Cal-B", 15); c.setFillColor(INK)
    c.drawString(x + 34 * mm, y - 9.5 * mm, nom)
    para(desc, "cardB", x + 34 * mm, y - 13 * mm, w - 42 * mm)
    y -= h + 5 * mm
note(8, "Trois niveaux, pas deux : c'est la différence avec un SaaS classique. "
        "Le décalage visuel des blocs suggère l'imbrication.")

# ── 9. la dualité ───────────────────────────────────────────────────────────
newpage(); chrome("3 · Solution proposée")
y = head("3 · Solution proposée", "La difficulté centrale")
para("Une même ligne appartient à deux organisations, selon deux chemins différents.",
     "lead", M, y, CW)
y -= 15 * mm

bx, bw, bh = PW / 2 - 42 * mm, 84 * mm, 22 * mm
c.setFillColor(WASH); c.setStrokeColor(ACC); c.setLineWidth(1.2)
c.rect(bx, y - bh, bw, bh, stroke=1, fill=1)
c.setFont("Cal-B", 15); c.setFillColor(INK)
c.drawCentredString(PW / 2, y - 10 * mm, "Une réservation")
c.setFont("Cal", 11); c.setFillColor(INK2)
c.drawCentredString(PW / 2, y - 16.5 * mm, "ou un ticket de maintenance")

ly = y - bh - 14 * mm
c.setFillColor(L3W); c.setStrokeColor(L3); c.setLineWidth(0.9)
c.rect(M + 10 * mm, ly - 30 * mm, 118 * mm, 30 * mm, stroke=1, fill=1)
c.setFont("Cal-B", 12.5); c.setFillColor(L3)
c.drawString(M + 18 * mm, ly - 10 * mm, "Le LOCATAIRE")
c.setFont("Cal", 11.5); c.setFillColor(INK2)
c.drawString(M + 18 * mm, ly - 17 * mm, "par tenant_id porté sur la ligne")
c.setFont("Cal-I", 10.5); c.setFillColor(INK3)
c.drawString(M + 18 * mm, ly - 24 * mm, "« c'est moi qui ai réservé »")

rx = PW - M - 128 * mm
c.setFillColor(WASH); c.setStrokeColor(ACC); c.setLineWidth(0.9)
c.rect(rx, ly - 30 * mm, 118 * mm, 30 * mm, stroke=1, fill=1)
c.setFont("Cal-B", 12.5); c.setFillColor(ACC)
c.drawString(rx + 8 * mm, ly - 10 * mm, "Le BAILLEUR")
c.setFont("Cal", 11.5); c.setFillColor(INK2)
c.drawString(rx + 8 * mm, ly - 17 * mm, "par surface → étage → bâtiment")
c.setFont("Cal-I", 10.5); c.setFillColor(INK3)
c.drawString(rx + 8 * mm, ly - 24 * mm, "« ce sont mes murs »")

c.setStrokeColor(L3); c.setLineWidth(1.4)
c.line(M + 69 * mm, ly, PW / 2 - 14 * mm, y - bh)
c.setStrokeColor(ACC)
c.line(rx + 59 * mm, ly, PW / 2 + 14 * mm, y - bh)

banner("Confondre ces deux chemins est à l'origine des neuf défauts de cloisonnement "
       "corrigés pendant le développement.", ly - 34 * mm, tone=WARN, bg=WARNW)
note(9, "La diapositive la plus importante de la présentation. Prendre le temps de "
        "suivre les deux flèches à voix haute. Si le jury ne retient qu'une chose, "
        "c'est celle-ci.")

# ── 10. méthodologie ────────────────────────────────────────────────────────
newpage(); chrome("4 · Méthodologie")
y = head("4 · Méthodologie de travail", "Itérative, et vérifiée sur l'application réelle")
y = cards([
    ("Démarche", ["Itérations fonctionnelles autonomes",
                  "Analyse → conception → réalisation → vérification",
                  "Chaque itération produit une version exécutable"]),
    ("Outils", ["Git / GitHub — une branche par lot",
                "GitHub Actions — vérification à chaque envoi",
                "Docker Compose — environnement identique",
                "PlantUML — diagrammes versionnés"]),
], y, cols=2, height=48 * mm)
banner("Les tests unitaires valident les fonctions de sécurité. Ils ne disent rien du "
       "point d'appel qui <b>oublie</b> de les utiliser.", y - 6 * mm)
note(10, "Amener la diapositive suivante : c'est ce constat qui a rendu nécessaire "
         "l'audit indépendant.")

# ── 11. vérification ────────────────────────────────────────────────────────
newpage(); chrome("4 · Méthodologie")
y = head("4 · Méthodologie de travail", "Un audit exécuté contre le serveur en marche")
met = [("43", "sondes HTTP"), ("9", "défauts détectés"), ("0", "donnée créée")]
w = (CW - 12 * mm) / 3
for i, (v, l) in enumerate(met):
    x = M + i * (w + 6 * mm)
    c.setFillColor(SOFT); c.setStrokeColor(LINE); c.setLineWidth(0.7)
    c.rect(x, y - 34 * mm, w, 34 * mm, stroke=1, fill=1)
    para(v, "big", x, y - 9 * mm, w)
    para(l, "biglbl", x, y - 24 * mm, w)
y -= 44 * mm
y = cards([
    ("Ce que l'audit tente",
     ["Lire les listes exposées", "Lire les données d'une autre organisation",
      "Écrire sur les enregistrements d'un tiers", "S'attribuer un rôle supérieur"]),
    ("Pourquoi il est rejouable",
     ["Il ne crée aucune donnée", "Il s'exécute en une commande",
      "Il est lancé à chaque itération"]),
], y, cols=2, height=40 * mm, tone=OK)
note(11, "Chiffre à retenir : neuf défauts qu'aucun test unitaire n'aurait signalés. "
         "C'est l'apport méthodologique du projet.")

# ── 12. besoins fonctionnels ────────────────────────────────────────────────
newpage(); chrome("5 · Besoins")
y = head("5 · Besoins fonctionnels", "Huit domaines métier")
y = tbl([
    ["Domaine", "Besoins"],
    ["Vitrine publique", "Carte des surfaces · fiche détaillée · assistant de recherche · candidature"],
    ["Intégration locataire", "Lien de candidature · dossier externe · instruction · création du compte"],
    ["Réservation", "Demande · confirmation téléphonique · visite · pièces · approbation"],
    ["Contractualisation", "Baux · échéances · renouvellements · dépôts de garantie"],
    ["Facturation", "Factures et lignes · espèces, virement, chèque · codes promo · relances"],
    ["Maintenance", "Signalement · classement · affectation · résolution et coût"],
    ["Pilotage", "Tableaux de bord par rôle · occupation · prévision · exports"],
    ["Traçabilité", "Journal d'audit horodaté · notifications temps réel"],
], [52 * mm, CW - 52 * mm], y, fs=11.5)

# ── 13. besoins non fonctionnels ────────────────────────────────────────────
newpage(); chrome("5 · Besoins")
y = head("5 · Besoins non fonctionnels", "Quatre exigences transverses")
y = cards([
    ("Cloisonnement", ["Isolation <b>vérifiable</b>, pas seulement affirmée",
                       "Autorisation déclarée route par route",
                       "Champs inattendus rejetés",
                       "Journal d'audit en ajout seul"]),
    ("Fiabilité", ["Fonctionne <b>sans aucune clé</b> externe",
                   "Une panne tierce ne fait jamais échouer une écriture",
                   "Migrations rejouables"]),
    ("Exploitabilité", ["Installation en une commande",
                        "Vérification automatique à chaque envoi"]),
    ("Ergonomie", ["Interface adaptative", "Thème clair et sombre",
                   "Navigation filtrée par rôle"]),
], y, cols=4, height=56 * mm)

# ── 14. technologies ────────────────────────────────────────────────────────
newpage(); chrome("6 · Technologies")
y = head("6 · Technologies utilisées", "Une chaîne TypeScript de bout en bout")
y = cards([
    ("Serveur", ["NestJS 11", "Prisma 5", "PostgreSQL 13", "Passport-JWT", "Socket.IO"]),
    ("Client", ["React 19 · Vite 7", "TypeScript", "Ant Design 6", "TanStack Query",
                "Recharts · Leaflet"]),
    ("Infrastructure", ["Docker Compose", "nginx", "GitHub Actions"]),
    ("Services", ["Groq — modèle de langage", "Brevo — courriel",
                  "Cloudinary — fichiers", "Typeform — candidatures"]),
], y, cols=4, height=52 * mm)
banner("Un seul langage des deux côtés&nbsp;: les types sont partagés, les écarts "
       "d'interprétation disparaissent.", y - 6 * mm)

# ── 15. réalisé : chiffres ──────────────────────────────────────────────────
newpage(); chrome("7 · Partie réalisée")
y = head("7 · Partie déjà réalisée", "L'application fonctionne de bout en bout")
met = [("25", "modèles"), ("30", "contrôleurs"), ("55", "pages"),
       ("9", "rôles"), ("252", "tests"), ("43", "sondes")]
w = (CW - 5 * 5 * mm) / 6
for i, (v, l) in enumerate(met):
    x = M + i * (w + 5 * mm)
    c.setFillColor(SOFT); c.setStrokeColor(LINE); c.setLineWidth(0.7)
    c.rect(x, y - 32 * mm, w, 32 * mm, stroke=1, fill=1)
    para(v, "big", x, y - 8 * mm, w)
    para(l, "biglbl", x, y - 23 * mm, w)
y -= 42 * mm
y = cards([
    ("Chaîne métier complète",
     ["Candidature → réservation → bail", "→ facture → encaissement",
      "Maintenance, notifications temps réel", "Journal d'audit"]),
    ("Cloisonnement vérifié",
     ["Les trois niveaux en place", "<b>9 défauts</b> détectés et corrigés",
      "Contrôle de cohérence arithmétique"]),
], y, cols=2, height=40 * mm, tone=OK)

# ── 16. la preuve arithmétique ──────────────────────────────────────────────
newpage(); chrome("7 · Partie réalisée")
y = head("7 · Partie déjà réalisée", "Comment prouver le cloisonnement")
para("Un cloisonnement correct <b>partitionne</b> les données. Si une ligne fuyait, ou "
     "était comptée deux fois, la somme ne tomberait pas juste.", "lead", M, y, CW)
y -= 22 * mm
y = tbl([
    ["Indicateur", "Msheireb", "West Bay", "Lusail", "Plateforme"],
    ["Chiffre d'affaires encaissé", "5 300", "11 800", "10 100", "27 200"],
    ["Réservations", "6", "6", "6", "18"],
    ["Surfaces", "24", "24", "24", "72"],
    ["Tickets de maintenance", "18", "18", "18", "54"],
], [56 * mm, (CW - 56 * mm) / 4] * 1 + [(CW - 56 * mm) / 4] * 3, y, fs=13)
banner("Les trois portefeuilles additionnés redonnent exactement le total de la "
       "plateforme. La sécurité devient une propriété <b>arithmétique vérifiable</b>.",
       y - 8 * mm, tone=OK, bg=OKW)
note(16, "L'argument le plus convaincant pour un jury technique. Faire l'addition à voix "
         "haute sur une ligne.")

# ── 17. IA ──────────────────────────────────────────────────────────────────
newpage(); chrome("7 · Partie réalisée")
y = head("7 · Partie déjà réalisée", "Trois fonctions d'intelligence artificielle")
y = cards([
    ("Classement des tickets",
     ["Catégorie et priorité déduites du texte",
      "Technicien suggéré par <b>l'historique</b>, pas par le modèle"]),
    ("Assistant de recherche",
     ["Le visiteur décrit son besoin",
      "Traduit en critères, puis requête ordinaire",
      "Le modèle commente, il ne choisit pas"]),
    ("Lecture de documents",
     ["Licence, registre, chèque",
      "Extraction des champs à ressaisir",
      "PDF avec couche texte"]),
], y, cols=3, height=46 * mm)
banner("Principe retenu&nbsp;: <b>le modèle propose, il ne décide pas.</b> Toute valeur "
       "hors nomenclature est écartée et un classement par mots-clés prend le relais.",
       y - 6 * mm)
note(17, "Si on demande « et si l'IA se trompe ? » : répondre par le repli. La création "
         "d'un ticket ne dépend jamais d'un prestataire externe.")

# ── 18. non réalisé ─────────────────────────────────────────────────────────
newpage(); chrome("8 · Partie restante")
y = head("8 · Partie non encore réalisée", "Ce qui reste, et pourquoi")
y = tbl([
    ["Point restant", "État", "Motif"],
    ["Interface de lecture des documents", "Serveur seul",
     "L'extraction fonctionne ; le dépôt dans le formulaire reste à construire"],
    ["Documents numérisés", "Limité",
     "Le fournisseur configuré n'expose aucun modèle de vision"],
    ["Places de marché externes", "En attente", "Adaptateurs écrits, identifiants non fournis"],
    ["Fiche Google Business", "Suspendu", "Compte vérifié requis côté propriétaire"],
    ["Courriel en production", "Mode dégradé", "Adresse IP à autoriser ; relais actif"],
    ["Application mobile", "Hors périmètre", "L'interface web est adaptative"],
], [62 * mm, 30 * mm, CW - 92 * mm], y, fs=11.5)
banner("Aucun de ces points ne bloque un parcours métier&nbsp;: chacun dispose d'un "
       "mode dégradé ou d'un équivalent manuel.", y - 6 * mm, tone=WARN, bg=WARNW)
note(18, "Ne pas minimiser. Un état d'avancement lucide vaut mieux qu'une liste où tout "
         "serait terminé.")

# ── 19. enseignement ────────────────────────────────────────────────────────
newpage(); chrome("9 · Conclusion")
c.setFillColor(ACC2); c.rect(0, 0, PW, PH, stroke=0, fill=1)
S["eyebrow"].textColor = colors.HexColor("#8FD3D6")
para("ENSEIGNEMENT PRINCIPAL", "eyebrow", M, PH - 34 * mm, CW)
S["ttl"].textColor = colors.white; S["ttl"].fontSize = 30
S["ttl"].leading = 40; S["ttl"].alignment = TA_LEFT
para("Aucun des neuf défauts ne venait d'une fonction<br/>de sécurité erronée.<br/>"
     "Tous venaient d'un appel qui l'oubliait.", "ttl", M, PH - 48 * mm, CW)
S["sub"].textColor = colors.HexColor("#BFE0E1"); S["sub"].alignment = TA_LEFT
para("Et quatre sont restés invisibles tant que le jeu de données ne comportait qu'un "
     "seul bailleur. Avec un seul, « tout afficher » et « afficher mon portefeuille » "
     "donnent le même résultat.", "sub", M, 66 * mm, CW - 70 * mm)
S["sub"].fontSize = 19
para("→ La forme des données d'essai fait partie de la surface de sécurité.",
     "sub", M, 36 * mm, CW - 40 * mm)
S["sub"].fontSize = 17
S["ttl"].textColor = INK; S["ttl"].fontSize = 52; S["ttl"].leading = 57
S["ttl"].alignment = TA_CENTER
S["sub"].textColor = INK2; S["sub"].alignment = TA_CENTER
S["eyebrow"].textColor = ACC
note(19, "Le point de bascule de la soutenance. Énoncer lentement. C'est un résultat "
         "d'ingénierie, pas une liste de fonctionnalités.")

# ── 20. perspectives ────────────────────────────────────────────────────────
newpage(); chrome("9 · Conclusion")
y = head("9 · Conclusion et perspectives", "La suite du travail")
y = cards([
    ("Court terme", ["Interface de dépôt des documents",
                     "Modèle de vision pour les pièces numérisées"]),
    ("Moyen terme", ["Assistant étendu aux données du locataire",
                     "Série d'essais d'injection pour en démontrer les limites"]),
    ("Plus loin", ["Modèle de maintenance prédictive entraîné",
                   "comparé à l'heuristique de référence",
                   "Application mobile pour les techniciens"]),
], y, cols=3, height=46 * mm)
y -= 4 * mm
banner("Le modèle à trois niveaux, principal risque technique du projet, est en place "
       "et son respect est <b>vérifié</b> plutôt qu'affirmé.", y, tone=OK, bg=OKW)

# ── 21. merci ───────────────────────────────────────────────────────────────
newpage(); chrome()
para("Merci de votre attention", "ttl", M, PH / 2 + 14 * mm, CW)
para("Questions", "sub", M, PH / 2 - 8 * mm, CW)

# ── notes de l'orateur ──────────────────────────────────────────────────────
newpage(); chrome()
y = head(None, "Commentaires de l'orateur")
para("À coller dans le volet « Commentaires » de PowerPoint, diapositive par "
     "diapositive.", "lead", M, y, CW)
y -= 18 * mm
rows = [["N°", "Commentaire"]] + [[str(n), t] for n, t in NOTES]
tbl(rows, [14 * mm, CW - 14 * mm], y, fs=11.5)

c.save()
print("Diaporama écrit :", out, "—", slide_no, "diapositives")
