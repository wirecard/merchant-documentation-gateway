#!/bin/bash

echo "use main.sh!"

set -e

function timed_log {
    echo "[$(date +'%T')] $1"
}

while (( "$#" )); do
    case "$1" in
    -s|--skip)
    SKIP="true"
    ;;
    --single-file)
    SINGLE_FILE="true"
    ;;
    *)
    ;;
    esac
    shift
done

timed_log "set up environment"
mkdir -p build/html
cp -r errorpages/* css images js fonts resources build/html/

# echo "run babel"
# node_modules/.bin/babel js/ -d build/html/js/

timed_log "create mermaid config from CSS"
bash buildscripts/asciidoc/create-mermaid-config.sh

timed_log "check mermaid CSS hash"
# svg mermaid diagrams are stored in mermaid/.
# changes need to be created, moved there and committed.
cp mermaid/*.svg .

# calculate the checksum for mermaid.css.
# mermaid.css is used for the creation of the mermaid diagrams,
# which are cached by the asciidoctor-diagram extension in .asciidoctor/diagram/.
# we do the same with mermaid.css, if it differs, delete all *.svg to force a new generation.
checksum_ref=".asciidoctor/mermaid-css-checksum.txt"
checksum_new="/tmp/mermaid-css-checksum.txt"
sha1sum --text css/mermaid.css > "${checksum_new}"
# show hashes
echo "Reference: $(cat ${checksum_ref})"
echo "Current:   $(cat ${checksum_new})"
if ! diff -q --strip-trailing-cr "${checksum_new}" "${checksum_ref}"; then
    timed_log "delete all *.svg to force re-creation"
    rm ./*.svg
fi

timed_log "run basic tests"
if [[ $SKIP ]]; then
    echo "skipping tests"
else
    php buildscripts/tests/basic-tests.php || true
fi

timed_log "build big html"
if [[ $SINGLE_FILE ]]; then
    mkdir -p /tmp/build-adoc
    for adoc in *.adoc; do
        RUBYOPT="-E utf-8" asciidoctor -b html5 -a basedir="$(pwd)" -a systemtimestamp="$(date +%s)" -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram "$adoc" -o "/tmp/build-adoc/$adoc"
    done
else
    RUBYOPT="-E utf-8" asciidoctor -b html5 -a basedir="$(pwd)" -a systemtimestamp="$(date +%s)" -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram index.adoc -o index.html
fi

timed_log "create toc"
node buildscripts/split-pages/create-toc.js
timed_log "create search index"
node buildscripts/search/lunr-index-builder.js
timed_log "build multipage docs"
RUBYOPT="-E utf-8" asciidoctor -b multipage_html5 -a basedir="$(pwd)" -a linkcss -a systemtimestamp="$(date +%s)" -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram -r ./buildscripts/asciidoc/multipage-html5-converter.rb index.adoc
timed_log "build done"

# improve naming, CSS, etc.

## get first menu entry and replace index.html with it
FIRST=$(sed -n 's/<li><a\ href="\([A-Za-z]\+\.html\)"><span\ class="toc-current">.*/\1/p' index.html)
[[ ${FIRST} ]] && cp ${FIRST} index.html

# sed -i 's/normal\ normal\ 400\ normal\ 16px/normal normal 400 normal 15px/g' *.svg
# sed -i 's/foreignObject width="[1-9][0-9]\+\.[0-9]\+" height="[1-9][0-9]\+\.[0-9]\+"/foreignObject width="100%" height="100%"/g' *.svg
timed_log "post process svg files"
sed -i 's/<foreignObject/<foreignObject style="overflow: visible;"/g' ./*.svg

# create correct document structure
mv ./*.svg toc.json searchIndex.json ./*.html build/html/
timed_log "build complete"
