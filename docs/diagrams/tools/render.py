# -*- coding: utf-8 -*-
"""
Render every diagram of docs/diagrams/*.puml:

  1. stamp the common style header (tools/style-header.puml) on every file;
  2. PlantUML -> out/<name>.svg (vector) and out/<name>.png (200 dpi, for slides);
  3. SVG -> out/<name>.pdf (vector, for \\includegraphics) with rsvg-convert, or
     headless Chrome / Edge when rsvg-convert is not installed;
  4. report how each drawing fits the A4 text block (16 x 24 cm, either
     orientation): the scale and the resulting size of the 13 pt body text.

    python tools/render.py              # everything
    python tools/render.py uc-01 seq    # only the files whose name starts with one of these

Needs Java and Graphviz; plantuml.jar (1.2024.7) sits in this folder.

Fonts: the diagrams use Arial. On Linux, where Java does not find Arial, the files are
rendered with Liberation Sans, which has exactly the same metrics, and the SVG asks
for "Arial, Liberation Sans, Helvetica, sans-serif".
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out")
JAR = os.path.join(ROOT, "plantuml.jar")
A4_W, A4_H = 16 / 2.54 * 72, 24 / 2.54 * 72          # text block, points
BROWSERS = [r"C:/Program Files/Google/Chrome/Application/chrome.exe",
            r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
            "google-chrome", "chromium", "chromium-browser"]
FONT_STACK = "Arial, Liberation Sans, Helvetica, sans-serif"


def java_has_arial():
    if os.name == "nt":
        return True
    r = subprocess.run(["fc-list", ":family=Arial"], capture_output=True, text=True)
    return bool(r.stdout.strip())


def plantuml(files, fmt, extra=()):
    r = subprocess.run(["java", "-Djava.awt.headless=true", "-Dfile.encoding=UTF-8",
                        "-DPLANTUML_LIMIT_SIZE=32768", "-jar", JAR, "-charset", "UTF-8",
                        f"-t{fmt}", "-nometadata", "-failfast2", *extra, "-o", OUT, *files],
                       capture_output=True)
    log = (r.stdout + r.stderr).decode("utf-8", "replace")
    if r.returncode != 0 or "Error line" in log or "Some diagram description contains errors" in log:
        print(log)
        sys.exit(f"PlantUML reported an error ({fmt})")


def svg_size(path):
    head = open(path, encoding="utf-8").read(3000)
    w = float(re.search(r'width="([\d.]+)px"', head).group(1))
    h = float(re.search(r'height="([\d.]+)px"', head).group(1))
    return w, h


def fix_svg_fonts(path):
    text = open(path, encoding="utf-8").read()
    text = re.sub(r'font-family="(?:Liberation Sans|Arial)"', f'font-family="{FONT_STACK}"', text)
    open(path, "w", encoding="utf-8").write(text)


def to_pdf(svg, pdf):
    if shutil.which("rsvg-convert"):
        subprocess.run(["rsvg-convert", "-f", "pdf", "-o", pdf, svg], check=True)
        return
    browser = next((b for b in BROWSERS if os.path.exists(b) or shutil.which(b)), None)
    if browser is None:
        print("  no rsvg-convert, Chrome or Edge: PDF skipped")
        return
    w, h = svg_size(svg)
    html = os.path.splitext(pdf)[0] + ".print.html"
    with open(html, "w", encoding="utf-8") as f:
        f.write(f'<!doctype html><html><head><meta charset="utf-8"><style>'
                f'@page{{size:{w:.0f}px {h:.0f}px;margin:0}}html,body{{margin:0;padding:0}}'
                f'img{{display:block;width:{w:.0f}px;height:{h:.0f}px}}</style></head>'
                f'<body><img src="{os.path.basename(svg)}"></body></html>')
    subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf}", "file:///" + html.replace("\\", "/")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(html)


def a4_fit(w, h):
    """Portrait unless only the landscape page keeps the 13 pt text at 7 pt or more."""
    portrait = min(A4_W / w, A4_H / h, 1)
    landscape = min(A4_H / w, A4_W / h, 1)
    if 13 * portrait >= 7 or portrait >= landscape:
        return "portrait", portrait, 13 * portrait
    return "landscape", landscape, 13 * landscape


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    subprocess.run([sys.executable, os.path.join(HERE, "stamp_header.py")], check=True)
    wanted = sys.argv[1:]
    files = [f for f in sorted(glob.glob(os.path.join(ROOT, "*.puml")))
             if not wanted or any(os.path.basename(f).startswith(w) for w in wanted)]
    src = files
    tmp = None
    if not java_has_arial():                       # same metrics, Linux only
        tmp = tempfile.mkdtemp()
        src = []
        for f in files:
            t = os.path.join(tmp, os.path.basename(f))
            text = open(f, encoding="utf-8").read()
            open(t, "w", encoding="utf-8").write(
                text.replace("skinparam defaultFontName Arial", "skinparam defaultFontName Liberation Sans"))
            src.append(t)
    plantuml(src, "svg")
    plantuml(src, "png", ["-Sdpi=200"])
    if tmp:
        shutil.rmtree(tmp)
    print(f"{'diagram':42s} {'size (px)':>12s}  {'A4':9s} {'scale':>5s}  {'text':>6s}")
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        svg = os.path.join(OUT, name + ".svg")
        fix_svg_fonts(svg)
        to_pdf(svg, os.path.join(OUT, name + ".pdf"))
        w, h = svg_size(svg)
        orient, scale, pt = a4_fit(w, h)
        flag = "" if pt >= 6.5 else "   <-- small on A4"
        print(f"{name:42s} {w:5.0f}x{h:<6.0f}  {orient:9s} {scale:5.2f}  {pt:4.1f}pt{flag}")
