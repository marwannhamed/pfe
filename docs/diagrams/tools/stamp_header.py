# -*- coding: utf-8 -*-
"""
Write the common style header (tools/style-header.puml) at the top of every
diagram in docs/diagrams/*.puml, right after its @startuml line, replacing any
previous copy. Run it after editing the header:

    python tools/stamp_header.py
"""
import glob
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
END = "' ======================== end of style header ========================="


def stamp(path, header):
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    first, _, body = text.partition("\n")
    assert first.startswith("@startuml"), path
    if END in body:                                  # drop the previous copy
        body = body[body.index(END) + len(END):]
    body = body.replace("'@@STYLE@@", "", 1).lstrip("\n")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(first + "\n" + header + "\n\n" + body)


if __name__ == "__main__":
    header = open(os.path.join(HERE, "style-header.puml"), encoding="utf-8").read().replace("\r\n", "\n").rstrip("\n")
    assert header.endswith(END)
    files = sorted(glob.glob(os.path.join(ROOT, "*.puml")))
    for p in files:
        stamp(p, header)
    print(f"header stamped on {len(files)} diagram(s)")
