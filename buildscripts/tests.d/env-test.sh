#!/bin/bash

type debugMsg &>/dev/null || source buildscripts/global.sh

function testEnvironmentDefinition() {
  ADOC_FILE="$1"
  count="$(grep -oE '^:env-\w+:' ${ADOC_FILE} | wc -l)"
  if (( count != 1 )); then
    content="Found ${count} environments defined in ${ADOC_FILE}! Expected: 1"
    debugMsg "$content"
    debugMsg "Exiting..."
    postToSlack "$content"
    exit 1
  fi
}

debugMsg "Checking env-* definitions..."
env_count="$(grep -oE '^:env-(wirecard|po|ms):' ./*.adoc | wc -l)"
if (( env_count > 1 )); then
  errMsg="Found multiple environments defined!"
  result="$(grep -oE '^:env-(wirecard|po|ms):' ./*.adoc)"
  debugMsg "$errMsg"
  debugMsg "$result"
  debugMsg "Exiting..."
  postToSlack "${errMsg}" "\`\`\`${result}\`\`\`"
  exit 1
fi

testEnvironmentDefinition "shortcuts.adoc"
testEnvironmentDefinition "nova.adoc"