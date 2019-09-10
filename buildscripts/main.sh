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

LC_ALL=C

DEBUG=YES #unset to disable

INITDIR="$(pwd)"
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

ASCIIDOCTOR_CMD_COMMON="asciidoctor index.adoc --failure-level=WARN -a systemtimestamp=$(date +%s) -a linkcss -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram"

function increaseErrorCount() {
  ERRORS=$((ERRORS++))
}

function debugMsg() {
  [[ ${DEBUG} ]] && echo >&2 "[$(date +'%T')] ${1}"
}

function scriptError() {
  echo >&2 "Error executing: ${1}"
  increaseErrorCount
  return 1
}

# exitWithError is called on failures that warrant exiting the script
function exitWithError() {
  echo >&2 "Build aborted."
  echo >&2 "${1}"
  exit 1
}

function abortCurrentBuild() {
  echo >&2 "Aborting current build ${1}."
  return 0
}

# writeRepoKey takes WL_REPO_SSHKEY from Travis ENV (generated like this: cat private.key | gzip -9 | base64 | tr -d '\n')
function writeRepoKey() {
  debugMsg "inside writeRepoKey()"

  if [[ -n ${WL_REPO_SSHKEY} ]]; then
    echo "${WL_REPO_SSHKEY}" | base64 -d | gunzip >"${WL_REPO_SSHKEY_PATH}"
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

  debugMsg "Create info files"
  if [[ -z $SKIP ]]; then
    node buildscripts/util/create-info-files.js
  fi

  return $?
}

# create folder where white labeled content is stored
# takes partner name == folder name as argument
function createPartnerFolder() {
  PARTNER=${1}

  # create folder where we will build the documentation
  mkdir -p "${BUILDFOLDER_PATH}"
  debugMsg "Creating ${BUILDFOLDER_PATH}/${PARTNER}"

  # copy the master template to the build directory and name it after the partner
  if [[ -d "${BUILDFOLDER_PATH:?}/${PARTNER:?}" ]]; then
    rm -rf "${BUILDFOLDER_PATH:?}/${PARTNER:?}"
  fi
  cp -r "${MASTERTEMPLATE_PATH}" "${BUILDFOLDER_PATH}/${PARTNER}"
  cp -r "${MASTERTEMPLATE_PATH}/.asciidoctor" "${BUILDFOLDER_PATH}/${PARTNER}/"

  if [[ ${PARTNER} != 'WD' ]]; then
    # fill the partner dir with whitelabel content
    cp -r "${WL_REPO_PATH}/partners/${PARTNER}/content/"* "${BUILDFOLDER_PATH}/${PARTNER}/"
  fi
}

# builds the doc for the individual wl partner (and WD herself)
function buildPartner() {
  PARTNER=${1}

  debugMsg " "
  debugMsg "::: Building ${PARTNER}"
  createPartnerFolder "${PARTNER}"
  cd "${BUILDFOLDER_PATH}/${PARTNER}"

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

  if [[ ${PARTNER} != 'WD' ]]; then

    debugMsg "Executing custom scripts.."
    # execute all custom scripts of the partner
    # IMPORTANT: script MUST NOT use exit, only return!
    for script in "${WL_REPO_PATH}/partners/${PARTNER}/scripts/"*.sh; do
      debugMsg "$(basename ${script}):"
      source "${script}" || scriptError "$(basename ${script})"
    done
    debugMsg "Custom scripts done. Errors: ${ERRORS}"

    # if any script failed, abort right here the build of this WL-partner
    [[ ${ERRORS} -gt 0 ]] && abortCurrentBuild " for WL partner ${PARTNER}." && return 1
    # if any test or script that comes later (common build instructions for all partners) fails
    # then the loop that called buildPartner() will handle the error message
  fi

  debugMsg "Executing basic tests"
  # execute some basic tests volkswagen
  if [[ -z $SKIP ]] && [[ "${PARTNER}" != "MS" ]]; then
    php buildscripts/tests/basic-tests.php || true
  fi

  debugMsg "Building blob html"
  # build html for toc and index
  # TODO: replace with asciidoctor.js api calls inside these scripts to avoid costly building of html
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b html5 -o index.html ||
    scriptError "asciidoctor in line $((LINENO - 1))"

  debugMsg "Creating TOC json"
  node buildscripts/split-pages/create-toc.js ||
    scriptError "create-toc.js in line $((LINENO - 1))"

  debugMsg "Creating lunr search index"
  node buildscripts/search/lunr-index-builder.js ||
    scriptError "lunr-index-builder.js in line $((LINENO - 1))"

  debugMsg "Building split page docs"
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b multipage_html5 -r ./buildscripts/asciidoc/multipage-html5-converter.rb ||
    scriptError "asciidoctor in line $((LINENO - 1))"

  if [[ -n $NEW_MERMAID ]]; then
    debugMsg "Post process svg files"
    sed -r -i 's/<foreignObject (height|width)/<foreignObject style="overflow: visible;" \1/g' ./*.svg
    cp ./*.svg mermaid/
  fi

  debugMsg "Copy Home.html to index.html"
  cp {Home,index}.html

  HTMLFILES="$(ls ./*.html | grep -vP 'docinfo(-footer)?.html')"

  debugMsg "Moving created web resources to deploy html folder"
  mkdir -p "${BUILDFOLDER_PATH}/${PARTNER}/html"

  mv toc.json searchIndex.json ./*.svg ${HTMLFILES} "${BUILDFOLDER_PATH}/${PARTNER}/html/" ||
    increaseErrorCount

  # fallback png's for IE
  cp mermaid/*.png "${BUILDFOLDER_PATH}/${PARTNER}/html/"

  cp "${BUILDFOLDER_PATH}/${PARTNER}/html"/*.svg mermaid/

  cp -r errorpages css images js fonts resources "${BUILDFOLDER_PATH}/${PARTNER}/html/" ||
    increaseErrorCount

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

  # check arguments that are passed
  while (("$#")); do
    case "$1" in
    -s | --skip)
      SKIP="true"
      ;;
    -f | --force)
      FORCE="true"
      ;;
    -m | --update-mermaid)
      UPDATE_MERMAID=1
      echo "[INFO] will update mermaid diagrams after this run, please check them and commit."
      ;;
    -h | --help)
      echo "Options:"
      echo "* [-s|--skip] skip basic tests, only build"
      echo "* [-f|--force] force all resources to be generated, i.e. mermaid diagrams"
      echo "* [-m|--update-mermaid] copy back all generated *.svg and their respective hashes, in order to update them in a commit"
      ;;
    *) ;;

    esac
    shift
  done

  cloneWhitelabelRepository || exitWithError "Failed to clone whitelabel repository."

  PARTNERSLIST_FILE="${WL_REPO_PATH}/partners_list"
  if ! grep "^${PARTNER}" "${PARTNERSLIST_FILE}" && [[ "${PARTNER}" != "WD" ]]; then
    debugMsg "partner ${PARTNER} not in partners list"
    exit 0
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
  if buildPartner "${PARTNER}"; then # if everything built well then
    debugMsg "SUCCESS! Partner ${PARTNER} built in ${BUILDFOLDER_PATH}/${PARTNER}/html/"
    debugMsg "export DEPLOY_${PARTNER}=TRUE"
    export "DEPLOY_${PARTNER}=TRUE"
    # workaround to get Travis to recognize the ENV vars
    echo "${PARTNER}:${BUILDFOLDER_PATH}/${PARTNER}/html/" >>"${TRAVIS_ENVSET_FILE:-/tmp/travis_envset_file}"
    SUCCESSFUL_BUILDS+=("${PARTNER}") # add to list of successfully built partners
    if [[ "${PARTNER}" == "WD" ]] && [[ -n $UPDATE_MERMAID ]]; then
      debugMsg "Copying back *.svg and their hashes"
      pwd
      cp "${BUILDFOLDER_PATH}/${PARTNER}/html"/*.svg "${INITDIR}/mermaid/"
      cp -r "${BUILDFOLDER_PATH}/${PARTNER}/.asciidoctor" "${INITDIR}"
    fi
  else # if error occurred continue w next in list
    debugMsg "Failed! Could not build partner ${PARTNER}"
    FAILED_BUILDS+=("${PARTNER}") # and add partner to list of failed builds
    return 1
  fi
  echo
  return 0
}

main "$@"
exit $?
