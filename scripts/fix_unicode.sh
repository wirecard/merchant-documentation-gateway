#!/bin/bash

count=1
size="$(ls ./*.adoc | wc -l)"

progressBar() {
    printf "Processing... [%4s|%4s]\r" "$count" "$size"
}

for i in *.adoc; do
    progressBar
    sed -i "s/[”“]/\"/g;s/[‘’]/'/g" "$i"
    sed -i 's/\xC2\xA0/ /g' "$i"
    (( count++ ))
done


