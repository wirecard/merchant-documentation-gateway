#!/bin/bash

# Tests all asciidoc files in current dir for errors / warnings
# Gets corresponding Ticket ID from git log where available
# Changes Exit Code accordingly for CI systems

LC_ALL=C
EXIT_CODE=0

# find out which PSPDOC the file belongs to
function getPSPDOC() {
  PSPDOC=$(git --no-pager log --decorate=short --pretty=oneline --follow -- "${1}" | sed -n 's/.*(origin\/\(PSPDOC-[0-9]\+\)).*/\1/p' | head -n 1)
  [[ ${PSPDOC} ]] || PSPDOC="No PSPDOC"
  echo ${PSPDOC}
}

# get Warnings and Error messages from asciidoctor
function getWarnings() {
  ADOCMSG=$(RUBYOPT="-E utf-8" asciidoctor --failure-level=WARN -b html5 -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram "${1}" -o /dev/null 2>&1)
  AD_EXIT_CODE=$?
  [[ ${AD_EXIT_CODE} -gt 0 ]] && echo ${ADOCMSG}
  return ${AD_EXIT_CODE}
}

for file in *.adoc; do
  FILE_FAILED=0
  PSPDOC=$(getPSPDOC ${file})
  ADOCWARNINGS=$(getWarnings ${file})
  AD_EXIT_CODE=$?

  FILE_ARRAY=("${file}" "${PSPDOC}" "${ADOCWARNINGS}" "${EXIT_CODE}")
  [[ ${AD_EXIT_CODE} -gt 0 ]] && EXIT_CODE=${AD_EXIT_CODE} && FILE_FAILED=${AD_EXIT_CODE}

  if [[ ${FILE_FAILED} -gt 0 ]]; then
    echo -e "-- [ \e[1mTEST FAILED\e[0m ] ------------------------------------"
    echo
    echo "     IN: ${FILE_ARRAY[0]}"
    echo "   FROM: ${FILE_ARRAY[1]}"
    if [[ ${AD_EXIT_CODE} -gt 0 ]]; then
      echo "   TYPE: asciidoc syntax"
      echo "MESSAGE: ${FILE_ARRAY[2]}"
      echo
      echo "-------------------------------------------------------"
    fi
    echo
    echo
  fi
done

exit ${EXIT_CODE}
