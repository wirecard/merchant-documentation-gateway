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
for svg in *.svg; do
    echo "${svg}"
    convert -density 1200 -resize 600x600 "${svg}" "${svg%.svg}.png" || echo "...failed"
done

mv *.svg *.png ../images/
