#!/bin/bash

type debugMsg &>/dev/null || source buildscripts/global.sh

MSG="Checking the ratio between open/close if..."
debugMsg "$MSG"

set +e

errorFiles=()
for f in *.adoc; do
  open=$(grep -cE 'ifn?def::.*\[\]' "$f")
  close=$(grep -cE 'endif' "$f")
  if (( open != close )); then
    entry="$f   ${open}:${close}"
    echo "$entry"
    errorFiles+=("$entry")
  fi
done

if [[ ${#errorFiles[@]} -gt 0 ]]; then
  debugMsg "Found the following inconsistencies:"
  concatMsg=""
  for entry in "${errorFiles[@]}"; do
    echo "$entry"
    concatMsg+="$entry\\n"
    postToSlack "Found \`ifn?def\` count does not match \`endif\` count!" "\`\`\`$concatMsg\`\`\`"
  done
  exit 1
fi
