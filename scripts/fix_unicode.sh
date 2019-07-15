#!/bin/bash

count=1
size="$(ls ./*.adoc | wc -l)"

progressBar() {
    printf "Processing... [%4s|%4s]\r" "$count" "$size"
}

for i in *.adoc; do
    progressBar
    sed -i "s/[”“]/\"/g;s/[‘’]/'/g" "$i" # remove 'smart' quotes
    sed -i 's/\xC2\xA0/ /g;s/\xef\xbb\xbf//g' "$i" # remove NoBreak Space and UTF-8 BOM
    sed -i 's/[[:space:]]\+$//' "$i" # remove trailing whitespaces
    # tr -s ' ' "$i" # squeeze multiple spaces
    (( count++ ))
done


