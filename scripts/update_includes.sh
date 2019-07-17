#!/bin/bash

# REPORT="report-rename.json"
# LENGTH="$(jq -r '.renames | .[] | .old + \" \" + .new' \"${REPORT}\" | wc -l)"
# LENGTH=$(jq -r '.renames | .[] | .old + " " + .new' "${REPORT}" | wc -l)
COUNT=1
LENGTH=$(jq -r '.renames | .[] | .old + ";" + .new' report-rename.json | tr -d '\r' | wc -l)


for line in $(jq -r '.renames | .[] | .old + ";" + .new' report-rename.json | tr -d '\r'); do
    IFS=';' read -ra array <<< "$line"
    sed -i "s:$(basename ${array[0]}):$(basename ${array[1]}):" *.adoc
    printf "[%5s|%5s]\r" "$COUNT" "$LENGTH"
    (( COUNT++ ))
done