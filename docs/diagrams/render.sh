#!/usr/bin/env bash
#
# Render every .puml in this folder to SVG and PNG.
#
#   ./render.sh          both formats, into ./out
#   ./render.sh svg      vector only — what you want for LaTeX or Word
#   ./render.sh png      raster only — 200 dpi, for slides
#
# Needs Java. Graphviz is strongly recommended (see README); without it,
# uncomment the smetana pragma in _theme.puml.
#
set -euo pipefail
cd "$(dirname "$0")"

FORMAT="${1:-both}"
OUT="out"
JAR="plantuml.jar"
VERSION="1.2024.7"

# PlantUML clamps output at 4096 px unless told otherwise, which silently
# truncates the class diagram rather than failing. This is the fix.
LIMIT=16384

if [ ! -f "$JAR" ]; then
  echo "plantuml.jar not found — downloading v$VERSION …"
  curl -fsSL -o "$JAR" \
    "https://github.com/plantuml/plantuml/releases/download/v${VERSION}/plantuml-${VERSION}.jar"
  echo "  saved $(du -h "$JAR" | cut -f1)"
fi

mkdir -p "$OUT"

run() {
  local fmt="$1"
  echo "→ $fmt"
  java -Dfile.encoding=UTF-8 \
       -DPLANTUML_LIMIT_SIZE=$LIMIT \
       -jar "$JAR" \
       -charset UTF-8 \
       -t"$fmt" \
       -o "$(pwd)/$OUT" \
       -nometadata \
       ./*.puml
}

case "$FORMAT" in
  svg)  run svg ;;
  png)  run png ;;
  both) run svg; run png ;;
  *)    echo "usage: $0 [svg|png|both]" >&2; exit 1 ;;
esac

echo
echo "Written to $OUT/:"
ls -1 "$OUT" | sed 's/^/  /'
echo
echo "For the report: use the SVG. It stays sharp at any size in Word"
echo "(Insert > Pictures) and in LaTeX via \\includegraphics."
