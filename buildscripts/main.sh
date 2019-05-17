#!/bin/bash

LC_ALL=C

INITDIR=$(pwd)

WIRECARD_REPO_NAME=merchant-documentation-gateway

MASTERTEMPLATE_NAME=master-template
MASTERTEMPLATE_PATH=$(cd .. && pwd)/${MASTERTEMPLATE_NAME}
ERRORS=0

WL_REPO_NAME=whitelabel-mdg
WL_REPO_ORG=wirecard
WL_REPO_PATH=${INITDIR}/${WL_REPO_ORG}/${WL_REPO_NAME}
WL_REPO_SSHKEY_PATH=$(mktemp -d)

# prepare master template
mkdir ${MASTERTEMPLATE_PATH}
cp -r ${INITDIR} ${MASTERTEMPLATE_PATH}/
cd ${MASTERTEMPLATE_PATH} \
  || exitWithError "Line ${LINENO}: Failed to create Template."

function increaseErrorCount() {
  [[ -n ${1} ]] \
    || COUNT=1
  ERRORS=$(( ${ERRORS} + ${COUNT} ))
}

function scriptError {
 &>2 echo "Error executing ${1}"
 increaseErrorCount
 return 1
}

# exitWithError is called on failures that warrant exiting the script
function exitWithError() {
  &>2 echo "Build aborted."
  &>2 echo "${1}"
  exit 1
}

function abortCurrentBuild() {
  &>2 echo "Aborting current build ${1}"
  return true
}

# writeRepoKey takes SSHKEY from Travis ENV (generated like this: cat private.key | gzip -9 | base64; remove newlines)
function writeRepoKey() {
  if [[ -n ${WL_REPO_SSHKEY} ]]; then
    echo "${WL_REPO_SSHKEY}" | base64 -d | gunzip > ${WL_REPO_SSHKEY_PATH}
  else
    exitWithError "Failed in ${FUNCNAME[0]}: Missing repository key."
  fi
}

function checkoutWhitelabelRepository() {
  mkdir -p ${INITDIR}/${WL_REPO_ORG}
  writeRepoKey
  GIT_SSH_COMMAND="ssh -i ${WL_REPO_SSHKEY_PATH}" git clone --depth=1 git@ssh.github.com:${WL_REPO_ORG}/${WL_REPO_NAME}.git ${INITDIR}/${WL_REPO_ORG}/${WL_REPO_NAME}
  return $?
}

# create folder where white labeled content is stored
# takes partner name == folder name as argument
function createPartnerFolder() {
  PARTNER=${1}

  # create folder where we will build the documentation
  mkdir -p ${BUILDFOLDER_PATH}

  # copy the master template to the build directory and name it after the partner
  cp -r ${MASTERTEMPLATE_PATH} ${BUILDFOLDER_PATH}/${PARTNER}

  # fill the partner dir with whitelabel content
  cp -r ${WL_REPO_PATH}/${PARTNER}/content/* ${BUILDFOLDER_PATH}/${PARTNER}/
}

# builds the doc for the individual wl-partner (and ourselves)
function buildPartner() {
  PARTNER=${1}
  createPartnerFolder ${PARTNER}
  cd ${BUILDFOLDER_PATH}/${PARTNER}

  # execute all custom scripts of the partner
  for script in ${WL_REPO_PATH}/${PARTNER}/scripts/*.sh; do
    exec ${script} || scriptError ${script}
    # abort further script executions if the script failed
    [[ $? -gt 0 ]] && break
  done

  # if any script failed, abort right here the build of this WL-partner
  [[ ${ERRORS} -gt 0 ]] && abortCurrentBuild " for WL partner ${PARTNER}" && break
  
  # note: if any test or script that comes later (common build instructions for all partners) fails
  # then the loop that called buildPartner() will handle the error message

  # volkswagen it!
  php buildscripts/tests/basic-tests.php || true

  RUBYOPT="-E utf-8" asciidoctor -b html5 --failure-level=WARN -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram index.adoc -o index.html \
    || scriptError "asciidoctor in line $(( $LINENO - 1 ))"
  node buildscripts/split-pages/create-toc.js \
    || scriptError "create-toc.js in line $(( $LINENO - 1 ))"
  node buildscripts/search/lunr-index-builder.js \
    || scriptError "lunr-index-builder.js in line $(( $LINENO - 1 ))"
  RUBYOPT="-E utf-8" asciidoctor -b multipage_html5 --failure-level=WARN -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram -r ./buildscripts/asciidoc/multipage-html5-converter.rb index.adoc \
    || scriptError "asciidoctor in line $(( $LINENO - 1 ))"

  HTMLFILES=$(ls *.html | grep -vP 'docinfo(-footer)?.html')

  mkdir ${BUILDFOLDER_PATH}/${PARTNER}/html \
    || increaseErrorCount

  mv toc.json searchIndex.json ${HTMLFILES} ${BUILDFOLDER_PATH}/${PARTNER}/html/ \
    || increaseErrorCount
  
  cp -r errorpages css images js fonts resources ${BUILDFOLDER_PATH}/${PARTNER}/html/ \
    || increaseErrorCount

  return ${ERRORS}
}

# main() logic: get list of buildable partners, try build of each partner
# if build succeeds set deployment ENV for this partner
# if build fails, abort and try next partner
function main() {
  checkoutWhitelabelRepository || exitWithError "Failed to checkout WL repository."
  PARTNERSLIST_FILE=${WL_REPO_PATH}/partners_list
  for partner in $(cat $PARTNERSLIST_FILE); do
    ERRORS=0  
    buildPartner ${partner}
    if [[ $? -eq 0 ]]; then         # if everything built well then
      export DEPLOY_${partner}=TRUE # set env for travis deployment
    else                            # if error occurred continue w next in list
      continue
    fi    
  done
  return 0
}

main; exit $?
