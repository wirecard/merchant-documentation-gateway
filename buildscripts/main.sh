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
# To be used in Travis-CI. For details see EOF.
#

LC_ALL=C

DEBUG=YES #unset to disable

INITDIR="$(pwd)"
BUILDFOLDER_PATH="${HOME}/build"

WIRECARD_REPO_NAME=merchant-documentation-gateway

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

# prepare master template
mkdir -p "${MASTERTEMPLATE_PATH}"
cp -r "${INITDIR}"/* "${MASTERTEMPLATE_PATH}/"
cd "${MASTERTEMPLATE_PATH}" \
  || exitWithError "Line ${LINENO}: Failed to create template."

function increaseErrorCount() {
  # unless argument contains only digits set increase error count by 1
  [[ ${1} =~ ^[0-9]+$ ]] || COUNT=1
  ERRORS=$(( ERRORS + COUNT ))
}

function debugMsg() {
  [[ ${DEBUG} ]] && >&2 echo ${1}
}

function scriptError() {
  >&2 echo "Error executing ${1}"
  increaseErrorCount
  return 1
}

# exitWithError is called on failures that warrant exiting the script
function exitWithError() {
  >&2 echo "Build aborted."
  >&2 echo "${1}"
  exit 1
}

function abortCurrentBuild() {
  >&2 echo "Aborting current build ${1}."
  return 0
}

# writeRepoKey takes WL_REPO_SSHKEY from Travis ENV (generated like this: cat private.key | gzip -9 | base64; remove newlines)
function writeRepoKey() {
  debugMsg "inside writeRepoKey()"

  if [[ -n ${WL_REPO_SSHKEY} ]]; then
    echo "${WL_REPO_SSHKEY}" | base64 -d | gunzip > "${WL_REPO_SSHKEY_PATH}"
    chmod 600 "${WL_REPO_SSHKEY_PATH}"
  else
    exitWithError "Failed in ${FUNCNAME[0]}: Missing repository key."
  fi
}

function cloneWhitelabelRepository() {
  debugMsg "inside cloneWhitelabelRepository()"
  mkdir -p "${INITDIR}/${WL_REPO_ORG}"
  writeRepoKey
  GIT_SSH_COMMAND="ssh -i ${WL_REPO_SSHKEY_PATH}" git clone --depth=1 git@ssh.github.com:${WL_REPO_ORG}/${WL_REPO_NAME}.git "${WL_REPO_PATH}"
  return $?
}

# create folder where white labeled content is stored
# takes partner name == folder name as argument
function createPartnerFolder() {
  PARTNER=${1}

  # create folder where we will build the documentation
  mkdir -p "${BUILDFOLDER_PATH}"

  # copy the master template to the build directory and name it after the partner
  cp -r "${MASTERTEMPLATE_PATH}" "${BUILDFOLDER_PATH}/${PARTNER}"

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
  createPartnerFolder ${PARTNER}
  cd "${BUILDFOLDER_PATH}/${PARTNER}"

  if [[ ${PARTNER} != 'WD' ]]; then

    debugMsg "Executing custom scripts.."
    # execute all custom scripts of the partner
    # IMPORTANT: script MUST NOT use exit, only return! 
    for script in "${WL_REPO_PATH}/partners/${PARTNER}/scripts/"*.sh; do
      debugMsg "$(basename ${script}):"
      source ${script} || scriptError $(basename ${script})
    done
    debugMsg "Custom scripts done. Errors: ${ERRORS}"

    # if any script failed, abort right here the build of this WL-partner
    [[ ${ERRORS} -gt 0 ]] && abortCurrentBuild " for WL partner ${PARTNER}." && return 1
    # if any test or script that comes later (common build instructions for all partners) fails
    # then the loop that called buildPartner() will handle the error message
  fi

  debugMsg "Executing basic tests"
  # execute some basic tests volkswagen
  # disabled for PoC
  # php buildscripts/tests/basic-tests.php || true

  debugMsg "Building blob html"
  # build html for toc and index
  # TODO: replace with asciidoctor.js api calls inside these scripts to avoid costly building of html
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b html5 -o index.html \
    || scriptError "asciidoctor in line $(( $LINENO - 1 ))"

  debugMsg "Creating TOC json"
  node buildscripts/split-pages/create-toc.js \
    || scriptError "create-toc.js in line $(( $LINENO - 1 ))"

  debugMsg "Creating lunr search index"
  node buildscripts/search/lunr-index-builder.js \
    || scriptError "lunr-index-builder.js in line $(( $LINENO - 1 ))"

  debugMsg "Building split page docs"
  RUBYOPT="-E utf-8" ${ASCIIDOCTOR_CMD_COMMON} -b multipage_html5 -r ./buildscripts/asciidoc/multipage-html5-converter.rb \
    || scriptError "asciidoctor in line $(( $LINENO - 1 ))"

  HTMLFILES=$(ls *.html | grep -vP 'docinfo(-footer)?.html')

  debugMsg "Moving created web resources to deploy html folder"
  mkdir "${BUILDFOLDER_PATH}/${PARTNER}/html" \
    || increaseErrorCount

  mv toc.json searchIndex.json ${HTMLFILES} "${BUILDFOLDER_PATH}/${PARTNER}/html/" \
    || increaseErrorCount
  
  cp -r errorpages css images js fonts resources "${BUILDFOLDER_PATH}/${PARTNER}/html/" \
    || increaseErrorCount

  return ${ERRORS}
}

# main() logic: get list of buildable partners, try build of each partner
# if build succeeds set Travis-CI deployment ENV for this partner
# if build fails, abort and continue with next whitelabel partner
function main() {
  debugMsg "inside main()"
  cloneWhitelabelRepository || exitWithError "Failed to clone whitelabel repository."
  PARTNERSLIST_FILE="${WL_REPO_PATH}/partners_list"
  for partner in WD $(cat "${PARTNERSLIST_FILE}" | grep -v '^#'); do
    ERRORS=0  
    buildPartner ${partner}
    if [[ $? -eq 0 ]]; then           # if everything built well then
      debugMsg "SUCCESS! Partner ${partner} built in ${BUILDFOLDER_PATH}/${PARTNER}/html/"
      debugMsg "export DEPLOY_${partner}=TRUE"
      export DEPLOY_${partner}=TRUE
      SUCCESSFUL_BUILDS+=(${partner}) # add to list of successfully built partners
    else                              # if error occurred continue w next in list
      debugMsg "Failed! Could not build partner ${partner}"
      FAILED_BUILDS+=(${partner})     # and add partner to list of failed builds
      continue
    fi    
  done
  return 0
}

main
exit $?

#
# NOTES:
#
# Deployment Folders
#   e.g. for partner XYZ:
#     ${BUILDFOLDER_PATH}/${PARTNER}/html/ corresponds
#     to ${HOME}/build/XYZ/html/ in .travis.yml deployment configuration
#
