#!/bin/bash

# CHARS=$(python -c 'print(u"\u0091\u0092\u00a0\u200E".encode("utf8"))')
# CHARS=$(python -c 'print(u"\u00a0".encode("utf8"))')

# sed -i 's/['"$CHARS"']//g' "$@"

sed -i 's/\xc2\x91\|\xc2\x92\|\xc2\xa0\|\xe2\x80\x8e//' "$@"