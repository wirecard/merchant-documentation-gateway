#!/bin/bash

# This script will build the Mermaid sources (ending in *.mmd BUT NOT *.orig.mmd) and copy
# them to the images folder.

set -euo pipefail

echo
echo "### Mermaid"
echo
for mmd in $(ls *.mmd | grep -v -E ".*.orig.mmd"); do
    echo "$mmd"
    mmdc -i "${mmd}" -o "${mmd%.mmd}.svg"
done


echo
echo "### SVG"
echo

# for API*svg
# pip3 install cairosvg
# port install cairo
#  if utf-8 error, set locale manually: LC_ALL=C cairosvg -h

# npm install svgexport

for svg in *.svg; do
    echo "${svg}"
    LC_ALL=C cairosvg "${svg}" -f png -o "${svg%.svg}.png" || echo "...failed"
done

for svg in API*.svg; do
    echo "${svg}"
    svgexport "${svg}" "${svg%.svg}.png" || echo "...failed"
done

mv *.svg *.png ../images/
