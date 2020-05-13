#!/bin/bash

# This script will build the Mermaid sources (ending in *.mmd BUT NOT *.orig.mmd) and copy
# them to the images folder.

for mmd in $(*.mmd | grep -v "*.orig.mmd"); do
    mmdc -i "${mmd}" -o "${mmd%.mmd}.svg"
done

cp *.svg ../images/
