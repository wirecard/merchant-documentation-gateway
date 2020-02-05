#!/bin/bash
#           __    __ __         __       __          __
# .--.--.--|  |--|__|  |_.-----|  .---.-|  |--.-----|  |
# |  |  |  |     |  |   _|  -__|  |  _  |  _  |  -__|  |
# |________|__|__|__|____|_____|__|___._|_____|_____|__|
#
#                           herbert.knapp@wirecard.com !
#
# Creates different whitelabeled asciidoc documentations
# for corporate partners with WD version as common base.
#
# To be used in Travis-CI.
#
###############################################################################
# NOTES:
#
# Deployment Folders
#   e.g. for partner XYZ:
#     ${BUILDFOLDER_PATH}/${PARTNER}/html/ corresponds
#     to ${HOME}/build/XYZ/html/ in .travis.yml deployment configuration
#
###############################################################################

set -e
set -o pipefail

LC_ALL=C

DEBUG=YES #unset to disable

source buildscripts/global.sh

export INITDIR="$(pwd)"
BUILDFOLDER_PATH="/tmp/build"

# WIRECARD_REPO_NAME=merchant-documentation-gateway

MASTERTEMPLATE_NAME=master-template
MASTERTEMPLATE_PATH=$(cd .. && pwd)/${MASTERTEMPLATE_NAME}
ERRORS=0
SUCCESSFUL_BUILDS=() # names of successfully built partners
FAILED_BUILDS=()

WL_REPO_NAME=whitelabel-mdg
WL_REPO_ORG=wirecard-cee
WL_REPO_PATH="${INITDIR}/${WL_REPO_ORG}/${WL_REPO_NAME}"
WL_REPO_SSHKEY_PATH="$(mktemp -d)"/repo.key

export INDEX_FILE='index.adoc' # will be overwritten for NOVA, see NOVA_INDEX
ASCIIDOCTOR_CMD_COMMON="asciidoctor ${INDEX_FILE} --failure-level=WARN -a systemtimestamp=$(date +%s) -a root=${INITDIR} -a linkcss -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram"


function increaseErrorCount() {
  ERRORS=$((ERRORS++))
}

function scriptError() {
  echo "Error executing: ${1}" >&2
  increaseErrorCount
  exitWithError "${1}"
}

# exitWithError is called on failures that warrant exiting the script
function exitWithError() {
  echo "Build aborted." >&2
  echo "${1}" >&2
  exit 1
}

function abortCurrentBuild() {
  echo "Aborting current build ${1}." >&2
  exit 1
}

function executeCustomScripts() {
    PARTNER="${1}"
    debugMsg "Executing custom scripts.."
    # execute all custom scripts of the partner
    # IMPORTANT: script MUST NOT use exit, only return!
    for script in "${WL_REPO_PATH}/partners/${PARTNER}/scripts/"*.sh; do
      debugMsg "$(basename ${script}):"
      source "${script}" || scriptError "$(basename ${script})"
    done
    debugMsg "Custom scripts done. Errors: ${ERRORS}"
}


# writeRepoKey takes WL_REPO_SSHKEY from Travis ENV (generated like this: cat private.key | gzip -9 | base64 | tr -d '\n')
function writeRepoKey() {
  debugMsg "inside writeRepoKey()"

  if [[ -n ${WL_REPO_SSHKEY} ]]; then
    B64DEC='base64 -d'
    [[ $(printf 'aWFtYW1hYw==' | base64 -D 2>/dev/null) == 'iamamac' ]] && B64DEC='base64 -D'
    echo "${WL_REPO_SSHKEY}" | ${B64DEC} | gunzip >"${WL_REPO_SSHKEY_PATH}"
    chmod 600 "${WL_REPO_SSHKEY_PATH}"
  else
    exitWithError "Failed in ${FUNCNAME[0]}: Missing repository key."
  fi
}

function cloneWhitelabelRepository() {
  debugMsg "inside cloneWhitelabelRepository()"
  mkdir -p "${INITDIR}/${WL_REPO_ORG}"
  writeRepoKey
  if [[ -d "${WL_REPO_PATH}" ]]; then
    (cd "${WL_REPO_PATH}" && GIT_SSH_COMMAND="ssh -i ${WL_REPO_SSHKEY_PATH}" git pull)
  else
    GIT_SSH_COMMAND="ssh -i ${WL_REPO_SSHKEY_PATH}" git clone --depth=1 git@ssh.github.com:${WL_REPO_ORG}/${WL_REPO_NAME}.git "${WL_REPO_PATH}"
  fi
  return $?
}

function postToSlack() {
  content=$(echo "$1" | sed 's/\.\///g' | sed 's/$/\\n/' | tr -d '\n')
  secondary=$(echo "$2" | sed 's/\.\///g' | sed 's/$/\\n/' | tr -d '\n')
  tmpfile="$(mktemp)"
  if [[ -z $2 ]]; then
    cat > "$tmpfile" << EOF
  { "blocks": [{ "type": "section", "text": {
  "type": "mrkdwn", "text": "${content}"
  }}]}
EOF
else
    cat > "$tmpfile" << EOF
  { "blocks": [
    { "type": "section", "text":
      { "type": "mrkdwn", "text": "${content}" }
    },
    { "type": "section", "text":
      { "type": "mrkdwn", "text": "${secondary}" }
    }
  ]}
EOF
fi
  python3 buildscripts/util/post-to-slack.py -p -f "$tmpfile"
}

# create folder where white labeled content is stored
# takes partner name == folder name as argument
function createPartnerFolder() {
  PARTNER=${1}

  # create folder where we will build the documentation
  mkdir -p "${BUILDFOLDER_PATH}"
  debugMsg "Creating ${BUILDFOLDER_PATH}/${PARTNER}"

  if [[ "${2}" == "NOVA" ]]; then
    export NOVA="NOVA"
    echo "exporting NOVA env"
    mkdir -p "${BUILDFOLDER_PATH}/${PARTNER}"
  fi

  # copy the master template to the build directory and name it after the partner
  if [[ -d "${BUILDFOLDER_PATH:?}/${PARTNER:?}/${NOVA:+NOVA}" ]]; then
    rm -rf "${BUILDFOLDER_PATH:?}/${PARTNER:?}/${NOVA:+NOVA}"
  fi
  cp -r "${MASTERTEMPLATE_PATH}" "${BUILDFOLDER_PATH}/${PARTNER}/${NOVA:+NOVA}"
  cp -r "${MASTERTEMPLATE_PATH}/.asciidoctor" "${BUILDFOLDER_PATH}/${PARTNER}/${NOVA:+NOVA/}"

  if [[ "${PARTNER}" != 'WD' ]]; then
    # fill the partner dir with whitelabel content
    cp -r "${WL_REPO_PATH}/partners/${PARTNER}/content/"* "${BUILDFOLDER_PATH}/${PARTNER}/${NOVA:+NOVA/}"
  fi

  debugMsg "Running tests from tests.d/"
  ROOT="$(pwd)"
  pushd "${BUILDFOLDER_PATH}/${PARTNER}/${NOVA:+NOVA/}" >/dev/null

  for testscript in "$ROOT"/buildscripts/tests.d/*.sh; do
    if ! source "$testscript"; then
      debugMsg "Exiting..."
      exit 1
    fi
  done
  
  popd >/dev/null
}

function setUpMermaid() {
  debugMsg "Create mermaid config from CSS"
  bash buildscripts/asciidoc/create-mermaid-config.sh

  debugMsg "Check mermaid CSS hash"
  # svg mermaid diagrams are stored in mermaid/.
  # changes need to be created, moved there and committed.
  cp mermaid/*.svg .

  if [[ -n $MERMAID_UPDATE_CHECK ]]; then
    # calculate the checksum for mermaid.css.
    # mermaid.css is used for the creation of the mermaid diagrams,
    # which are cached by the asciidoctor-diagram extension in .asciidoctor/diagram/.
    # we do the same with mermaid.css, if it differs, delete all *.svg to force a new generation.
    checksum_ref=".asciidoctor/mermaid-css-checksum.txt"
    checksum_new="/tmp/mermaid-css-checksum.txt"
    sha1sum --text css/mermaid.css >"${checksum_new}"
    # show hashes
    echo "Reference: $(cat ${checksum_ref})"
    echo "Current:   $(cat ${checksum_new})"
    if ! diff -q --strip-trailing-cr "${checksum_new}" "${checksum_ref}"; then
      debugMsg "Delete all *.svg to force re-creation"
      rm ./*.svg
      debugMsg "Overwriting checksum file with new checksum"
      cp "${checksum_new}" "${checksum_ref}"
      NEW_MERMAID="true"
    fi
  fi

  if [[ -n $FORCE ]]; then
    debugMsg "Delete all *.svg to force re-creation (due to --force flag)"
    rm -f ./*.svg
    NEW_MERMAID="true"
  fi
}

# builds the doc for the individual wl partner (and WD herself)
function buildPartner() {
  PARTNER=${1}

  echo
  debugMsg "::: Building ${PARTNER} ${NOVA}"

  BPATH="${PARTNER}"
  if [[ "${2}" == "NOVA" ]]; then
    debugMsg "[NOVA] build started"
    export NOVA="NOVA"
    NOVA_INDEX="nova.adoc"
    export INDEX_FILE=${NOVA_INDEX}
    BPATH="${BPATH}/NOVA"
  fi

  createPartnerFolder "${PARTNER}" "${NOVA}"
  cd "${BUILDFOLDER_PATH}/${BPATH}"

  if [[ ${SKIP_MERMAID} == "true" ]]; then
    timed_log "SKIPPING MERMAID CREATION: --skip-mermaid is set"
  else
    setUpMermaid
  fi

  setUpMermaid

  if [[ "${PARTNER}" != "WD" ]] && [[ -z ${NOVA} ]]; then

    executeCustomScripts "${PARTNER}" || abortCurrentBuild " for WL partner ${PARTNER}."

    # if any script failed, abort right here the build of this WL-partner
    # if any test or script that comes later (common build instructions for all partners) fails
    # then the loop that called buildPartner() will handle the error message
  fi

  debugMsg "Executing basic tests"
  # execute some basic tests volkswagen
  TEST_PARTNER_ARRAY=(WD) #contains partners that will be tested, eg. TEST_PARTNER_ARRAY=(WD PO)
  if [[ -z $SKIP ]] && printf '%s\n' "${TEST_PARTNER_ARRAY[@]}" | grep -E '^'"${PARTNER}"'$' >&/dev/null; then
    php buildscripts/tests/basic-tests.php || true
  else
    debugMsg "[SKIP] basic tests"
  fi

  debugMsg "Minifying and combining js files"
  node buildscripts/util/combine-and-minify.js

  debugMsg "Beautify samples"
  find samples/xml auto-generated/samples -name "*.xml" -exec tidy -xml -quiet -indent -modify -wrap 100 -utf8 {} \;
  find samples/json auto-generated/samples -name "*.json" -exec jsonlint --in-place --quiet {} \; 2>/dev/null

  debugMsg "Building blob html"
  # build html for toc and index
  # TODO: replace with asciidoctor.js api calls inside these scripts to avoid costly building of html
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b html5 -o index.html ${NOVA_INDEX} ||
    scriptError "asciidoctor in line $((LINENO - 1))"

  debugMsg "Creating TOC json"
  node buildscripts/split-pages/create-toc.js ||
    scriptError "create-toc.js in line $((LINENO - 1))"

  debugMsg "Creating lunr search index"
  node buildscripts/search/lunr-index-builder.js ||
    scriptError "lunr-index-builder.js in line $((LINENO - 1))"

  debugMsg "Building split page docs"
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b multipage_html5 \
  -r ./buildscripts/asciidoc/multipage-html5-converter.rb ${NOVA_INDEX} ||
    scriptError "asciidoctor in line $((LINENO - 1))"

  if [[ -n $NEW_MERMAID ]]; then
    debugMsg "Post process svg files"
    sed -r -i 's/<foreignObject (height|width)/<foreignObject style="overflow: visible;" \1/g' ./*.svg
    cp ./*.svg mermaid/
  fi

  debugMsg "Copy Home.html to index.html"
  cp {Home,index}.html

  HTMLFILES="$(ls ./*.html | grep -vE 'docinfo(-footer)?.html')"

  debugMsg "Moving created web resources to deploy html folder"
  mkdir -p "${BUILDFOLDER_PATH}/${BPATH}/html"

  mv toc.json searchIndex.json ./*.svg ${HTMLFILES} "${BUILDFOLDER_PATH}/${BPATH}/html"

  # fallback png's for IE
  cp mermaid/*.png "${BUILDFOLDER_PATH}/${BPATH}/html/"

  cp "${BUILDFOLDER_PATH}/${BPATH}/html"/*.svg mermaid/

  cp -r errorpages css images js fonts resources "${BUILDFOLDER_PATH}/${BPATH}/html/"

  return ${ERRORS}
}

# main() logic: build partner, set by ENV variable ${PARTNER}, see .travis.yml
function main() {
  debugMsg "inside main()"

  if [[ -z $PARTNER ]]; then
    debugMsg 'no $PARTNER env variable set'
    debugMsg 'assuming $PARTNER=WD'
    PARTNER="WD"
  fi

  COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)

  if [[ ${COMMIT_MSG} == *'[wd]'* ]]; then
    debugMsg 'Commit message contains [wd]'
    WDONLY="true"
    debugMsg '-> Only WD will be built'
    if [[ ${WDONLY} == 'true' && ${PARTNER} != 'WD' ]]; then
      debugMsg '-> Skipping build for '${PARTNER}
      return 0
    fi
  fi

  if [[ ${COMMIT_MSG} == *'[quick]'* ]]; then
    debugMsg 'Commit message contains [quick]'
    # can also be set with cli argument
    SKIP_MERMAID="true"
    debugMsg '-> Mermaid diagram creation will be skipped'
  fi

  # check arguments that are passed
  while (("$#")); do
    case "$1" in
    -s | --skip)
      SKIP="true"
      ;;
    -sm | --skip-mermaid)
      SKIP_MERMAID="true"
      ;;
    -sn | --skip-nova)
      SKIP_NOVA="true"
      ;;
    -f | --force)
      FORCE="true"
      ;;
    -h | --help)
      echo "Options:"
      echo "* [-s|--skip] skip basic tests, only build"
      echo "* [-sm|--skip-mermaid] skip mermaid diagram build"
      echo "* [-sn|--skip-nova] skip NOVA docs build"
      echo "* [-f|--force] force all resources to be generated, i.e. mermaid diagrams"
      echo "* [--pdf] build pdf"
      ;;
    --pdf)
      createPartnerFolder "${PARTNER}"
      cd "${BUILDFOLDER_PATH}/${PARTNER}"
      setUpMermaid
      executeCustomScripts "${PARTNER}"
      debugMsg "Creating PDF..."
      # asciidoctor-pdf -a icons=font -r asciidoctor-diagram ${INDEX_FILE}
      # -a pdf-fontsdir="fonts-pdf;GEM_FONTS_DIR" \
      RUBYOPT="-E utf-8" asciidoctor-pdf \
        -a pdf-theme=config/pdf-theme.yml \
        -a pdf-fontsdir="fonts-pdf;GEM_FONTS_DIR" \
        -r asciidoctor-diagram \
        ${INDEX_FILE}
      if [[ -z $CI ]]; then
        mv index.pdf "docu-$(date +%Y%m%d-%H%M%S).pdf"
      fi
      debugMsg "DONE!"
      exit 0
      ;;
    *) ;;

    esac
    shift
  done

  if [[ ${PARTNER} == 'WD' ]]; then
    debugMsg "Skipping WL Repo checkout for partner ${PARTNER}"
  else
    cloneWhitelabelRepository || exitWithError "Failed to clone whitelabel repository."
    PARTNERSLIST_FILE="${WL_REPO_PATH}/partners_list"
    if ! grep "^${PARTNER}" "${PARTNERSLIST_FILE}" && [[ "${PARTNER}" != "WD" ]]; then
      debugMsg "partner ${PARTNER} not in partners list"
      exit 0
    fi
  fi
  debugMsg "Create info files"
  if [[ -z $SKIP ]]; then
    node buildscripts/util/create-info-files.js
  fi

  # prepare master template
  # need to delete folder before to avoid weird file permission errors
  debugMsg "Prepare template"
  if [[ -d "${MASTERTEMPLATE_PATH}" ]]; then
    rm -rf "${MASTERTEMPLATE_PATH}"
  fi
  mkdir -p "${MASTERTEMPLATE_PATH}"
  cp -r "${INITDIR}"/* "${MASTERTEMPLATE_PATH}/"
  cp -r "${INITDIR}/.asciidoctor" "${MASTERTEMPLATE_PATH}/"
  cd "${MASTERTEMPLATE_PATH}" ||
    exitWithError "Line ${LINENO}: Failed to create template."

  ERRORS=0
  if buildPartner "${PARTNER}"; then
    # if everything built well then
    debugMsg "SUCCESS! Partner ${PARTNER} built in ${BUILDFOLDER_PATH}/${PARTNER}/html/"
    debugMsg "export DEPLOY_${PARTNER}=TRUE"
    export "DEPLOY_${PARTNER}=TRUE"
    # workaround to get Travis to recognize the ENV vars
    echo "${PARTNER}:${BUILDFOLDER_PATH}/${PARTNER}/html/" >>"${TRAVIS_ENVSET_FILE:-/tmp/travis_envset_file}"
    SUCCESSFUL_BUILDS+=("${PARTNER}") # add to list of successfully built partners
  else # if error occurred continue w next in list
    debugMsg "Failed! Could not build partner ${PARTNER}"
    FAILED_BUILDS+=("${PARTNER}") # and add partner to list of failed builds
    return 1
  fi

  if [[ "${PARTNER}" != "WD" ]]; then
    debugMsg "Partner does not support NOVA"
  elif [[ -n $SKIP_NOVA ]]; then
    debugMsg "Skipping NOVA for ${PARTNER}"
  elif buildPartner "${PARTNER}" "NOVA"; then
    debugMsg "SUCCESS! NOVA for ${PARTNER} built in ${BUILDFOLDER_PATH}/${PARTNER}/${NOVA}/html/"
    debugMsg "export DEPLOY_${PARTNER}_${NOVA}=TRUE"
    export DEPLOY_${PARTNER}_${NOVA}=TRUE
    debugMsg "Adding robots.txt for NOVA"
    echo "User-agent: * " > ${BUILDFOLDER_PATH}/${PARTNER}/${NOVA}/html/robots.txt
    echo "Disallow: /" >> ${BUILDFOLDER_PATH}/${PARTNER}/${NOVA}/html/robots.txt
    debugMsg "Change tracker id for NOVA"
    sed -i "s/'setSiteId', '1'/'setSiteId', '4'/" ${BUILDFOLDER_PATH}/${PARTNER}/${NOVA}/html/docinfo.html
    echo "${PARTNER}_${NOVA}:${BUILDFOLDER_PATH}/${PARTNER}/${NOVA}/html/" >>"${TRAVIS_ENVSET_FILE:-/tmp/travis_envset_file}_nova"
  else
    debugMsg "Failed! Could not build NOVA ${PARTNER}"
  fi

  echo
  return 0
}

main "$@"
exit $?
