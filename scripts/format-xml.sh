#!/bin/bash

COUNT=1
SIZE="$(ls samples/xml/* | wc -l)"

for f in samples/xml/*; do
    if xmllint --schema samples/payment.xsd --noout "$f" &>/dev/null; then
        xmllint -o "$f" --format "$f"
    else
        echo "$f" >> xml-validation-failed.txt
    fi
    printf "[%4s|%4s]\r" "$COUNT" "$SIZE"
    (( COUNT++ ))
done