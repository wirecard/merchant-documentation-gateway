#!/bin/bash

COUNT=1
LENGTH=$(jq -r '.renames | .[] | .old + ";" + .new' report-rename.json | tr -d '\r' | wc -l)

for line in $(jq -r '.renames | .[] | .old + ";" + .new' report-rename.json | tr -d '\r'); do
    IFS=';' read -ra array <<< "$line"
    files="$(grep -lF ${array[0]} *.adoc)"
    sed -i "s:$(basename ${array[0]}):$(basename ${array[1]}):" "$files"
    printf "[%5s|%5s]\r" "$COUNT" "$LENGTH"
    (( COUNT++ ))
done