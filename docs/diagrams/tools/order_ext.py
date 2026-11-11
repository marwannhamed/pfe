"""
Put sibling use cases (e.g. the extensions of one base) in a wanted
top-to-bottom order.

Graphviz decides the vertical order inside a column; that order belongs to the
node slot, not to the text shown in it. So, for each group: render, read the y
of every member in the SVG, give the slot at rank k the label wanted at rank k,
and rename aliases everywhere so each relation still reaches the same slot.
The Graphviz input is unchanged apart from label sizes; repeat until stable.

    python order_ext.py plantuml.jar file.puml "A1,A2,A3" "B1,B2" ...
Each group lists aliases in the wanted order. Members of a group must have the
same relations (same base, same relation type).
"""
import os, re, subprocess, sys
JAR, path = sys.argv[1], sys.argv[2]
groups = [g.split(",") for g in sys.argv[3:]]
NL = chr(10)
DECL = re.compile(r'usecase "([^"]*)" as (\w+)')

def render():
    out = os.path.join(os.path.dirname(os.path.abspath(path)), "_order_tmp")
    os.makedirs(out, exist_ok=True)
    hdr = open(os.path.join(os.path.dirname(os.path.abspath(JAR)), "tools", "style-header.puml"), encoding="utf-8").read()
    src = open(path, encoding="utf-8").read().replace("'@@STYLE@@", hdr, 1)
    src = re.sub(r"^@startuml.*$", "@startuml t", src, count=1, flags=re.M)
    open(os.path.join(out, "t.puml"), "w", encoding="utf-8").write(src)
    subprocess.run(["java", "-Dfile.encoding=UTF-8", "-jar", JAR, "-charset", "UTF-8", "-tsvg", "-o", out,
                    os.path.join(out, "t.puml")], check=True, capture_output=True)
    return open(os.path.join(out, "t.svg"), encoding="utf-8").read()

def ypos(svg, label):
    first = label.split(chr(92) + "n")[0].replace("&", "&amp;").replace("'", "&#39;").replace('"', "&quot;")
    m = re.search(r'<text[^>]*\by="([\d.]+)"[^>]*>' + re.escape(first) + "</text>", svg)
    if not m:
        sys.exit("label not found in SVG: " + first)
    return float(m.group(1))

for it in range(8):
    svg = render()
    text = open(path, encoding="utf-8").read()
    label = {m.group(2): m.group(1) for m in DECL.finditer(text)}
    perm = {}                                  # current alias -> wanted alias of that slot
    for g in groups:
        slots = sorted(g, key=lambda a: ypos(svg, label[a]))
        for k, slot in enumerate(slots):
            if slot != g[k]:
                perm[slot] = g[k]
    if not perm:
        print("order OK after", it, "re-render(s)")
        break
    lines = text.split(NL)
    for i, l in enumerate(lines):
        m = DECL.search(l)
        if m and m.group(2) in perm:
            new = perm[m.group(2)]
            lines[i] = l[:m.start()] + 'usecase "' + label[new] + '" as @@' + new + "@@" + l[m.end():]
        elif not m:
            lines[i] = re.sub(r"\b(" + "|".join(map(re.escape, perm)) + r")\b",
                              lambda mm: "@@" + perm[mm.group(1)] + "@@", l)
    text = NL.join(lines)
    text = re.sub(r"@@(\w+)@@", r"\1", text)
    open(path, "w", encoding="utf-8", newline=NL).write(text)
else:
    sys.exit("order not stable after 8 renders")
