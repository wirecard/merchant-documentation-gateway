#!/bin/bash

type debugMsg &>/dev/null || source buildscripts/global.sh

MSG="Checking include::shortcuts.adoc[] in all files..."
debugMsg "$MSG"

set +x

shortcuts_count="$(grep -oE '^include::shortcuts.adoc\[\]' ./*.adoc | wc -l)"
if (( shortcuts_count > 2 )); then
  errMsg="Found more than two 'include::shortcuts[]' in the adocs. Output of 'git grep \\\"include::shortcuts\\\" *.adoc' below."
  result="$(grep -oE '^include::shortcuts.adoc\[\]' ./*.adoc )"
  debugMsg "$errMsg"
  debugMsg "$result"
  debugMsg "Exiting..."
  postToSlack "${errMsg//\'/\`}" "\`\`\`${result}\`\`\`"
  exit 1
fi