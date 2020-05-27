#!/bin/bash

set -euo pipefail

# Must be placed inside $PROJECT_ROOT/mermaid/ and will copy the converted images to
# $PROJECT_ROOT/images/

echo
echo "### Mermaid"
echo
for mmd in $(ls *.mmd | grep -v -E ".*.orig.mmd"); do
  echo "$mmd"
  mmdc -i "${mmd}" -o "${mmd%.mmd}.svg"
  mmdc -i "${mmd}" -o "${mmd%.mmd}.png"
done

mv *.svg *.png ../images/