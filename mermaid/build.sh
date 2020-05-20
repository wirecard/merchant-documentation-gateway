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
    mmdc -i "${mmd}" -o "${mmd%.mmd}.png"
done

mv *.svg *.png ../images/
