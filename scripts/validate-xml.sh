#!/bin/bash

RED="\033[31m"
BLD="\033[1m"
RST="\033[0m"

ERROR_COUNT=0
SIZE="$(ls samples/xml/* | wc -l)"

ERR_FILE="xml-validate-errors.txt"
if [[ -f "$ERR_FILE" ]]; then
    rm "$ERR_FILE"
fi

for f in samples/xml/*; do
    output="$(xmllint --schema samples/payments.xsd --noout ""$f"" 2>&1)"
    if (( $? > 0 )); then
        echo "$output"
        (( ERROR_COUNT++ ))
        echo "$output" >> "$ERR_FILE"
    fi
done

echo -e "${RED}${BLD}Report: ${ERROR_COUNT}/${SIZE} don't validate${RST}"