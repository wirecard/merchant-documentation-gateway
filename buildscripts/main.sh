#!/bin/bash

LC_ALL=C

INITDIR=$(pwd)
BUILDFOLDER_PATH=${HOME}/build/

WD_REPO_NAME=merchant-documentation-gateway

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
cd ${MASTERTEMPLATE_PATH} || abortBuild "Line ${LINENO}: Failed to create Template."

# Abort called on failure
function abortBuild() {
  &>2 echo "Build aborted."
  &>2 echo "${1}"
  exit 1
}

# Takes SSHKEY from Travis ENV (generated like this: cat private.key | gzip -9 | base64; remove newlines)
function writeRepoKey() {
  if [[ -n ${WL_REPO_SSHKEY} ]]; then
    echo "${WL_REPO_SSHKEY}" | base64 -d | gunzip > ${WL_REPO_SSHKEY_PATH}
  else
    abortBuild "Failed in ${FUNCNAME[0]}: Missing repository key."
  fi
}

function checkoutWhitelabelRepository() {
  mkdir -p ${INITDIR}/${WL_REPO_ORG}
  writeRepoKey
  PKEY=${WL_REPO_SSHKEY_PATH} git clone --depth=1 https://${WL_REPO_USER}:${WL_REPO_PASSWORD}@github.com:${WL_REPO_ORG}/${WL_REPO_NAME}.git ${INITDIR}/${WL_REPO_ORG}/${WL_REPO_NAME}
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

function buildPartner() {
  PARTNER=${1}
  createPartnerFolder ${PARTNER}
  cd ${BUILDFOLDER_PATH}/${PARTNER}/
  # execute all custom scripts of the partner
  for script in ${WL_REPO_PATH}/${PARTNER}/scripts/*.sh; do
    # scriptError increases count in var ERROR
    exec ${script} || scriptError ${script}
    # abort further script executions if a script failed
    [[ $? -gt 0 ]] && break
  done

  php buildscripts/tests/basic-tests.php || true
  RUBYOPT="-E utf-8" asciidoctor -b html5 --failure-level=WARN -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram index.adoc -o index.html
  node buildscripts/split-pages/create-toc.js
  node buildscripts/search/lunr-index-builder.js
  RUBYOPT="-E utf-8" asciidoctor -b multipage_html5 --failure-level=WARN -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram -r ./buildscripts/asciidoc/multipage-html5-converter.rb index.adoc
  HTMLFILES=$(ls *.html | grep -vP 'docinfo(-footer)?.html')

  mkdir ${BUILDFOLDER_PATH}/${PARTNER}/html
  mv toc.json searchIndex.json ${HTMLFILES} ${BUILDFOLDER_PATH}/${PARTNER}/html/
  cp -r errorpages css images js fonts resources ${BUILDFOLDER_PATH}/${PARTNER}/html/
  return ${ERRORS}
}

function main() {
  PARTNERSLIST_FILE=${WL_REPO_PATH}/partners_list}
  for partner in $(cat $PARTNERSLIST_FILE); do
    ERRORS=0  
    buildPartner ${partner}
    # if an error occurred, abort, cleanup and continue w next partner
    [[ ${ERRORS} -gt 0 ]] && cleanup && continue

    # if everything built well, set deployment env for travis deployment
    [[ $? -eq 0 ]] && export DEPLOY_${partner}=TRUE
  done
  return 0
}

function cleanup {
 echo "aborting build of ${partner}"
 cd "${INITDIR}"
 return 0
}

function scriptError {
 echo error executing ${1}
 ERRORS=$(( ${ERRORS} + 1 ))
 return 1
}

main; exit $?
