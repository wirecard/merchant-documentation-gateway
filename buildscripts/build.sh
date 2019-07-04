#!/bin/bash

set -e

function timed_log {
    echo "[$(date +'%T')] $1"
}

echo "set up environment"
mkdir -p build/html
cp -r errorpages/* css images js fonts resources build/html/

# echo "run babel"
# node_modules/.bin/babel js/ -d build/html/js/


# svg mermaid diagrams are stored in mermaid/.
# changes need to be created, moved there and committed.
cp mermaid/*.svg .

# calculate the checksum for mermaid.css.
# mermaid.css is used for the creation of the mermaid diagrams,
# which are cached by the asciidoctor-diagram extension in .asciidoctor/diagram/.
# we do the same with mermaid.css, if it differs, delete all *.svg to force a new generation.
checksum_ref=".asciidoctor/mermaid-css-checksum.txt"
checksum_new="/tmp/mermaid-css-checksum.txt"
sha1sum --text -z css/mermaid.css > "${checksum_new}"
# show hashes
echo "Reference: $(cat ${checksum_ref})"
echo "Current:   $(cat ${checksum_new})"
if ! diff -q --strip-trailing-cr "${checksum_new}" "${checksum_ref}"; then
    echo "Delete all *.svg to force re-creation"
    rm *.svg
fi

echo "run basic tests"
php buildscripts/tests/basic-tests.php || true

echo "build big html"
RUBYOPT="-E utf-8" asciidoctor -b html5 -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font index.adoc -o index.html &> /dev/null
echo "create toc"
node buildscripts/split-pages/create-toc.js &> /dev/null
echo "create search index"
node buildscripts/search/lunr-index-builder.js &> /dev/null
echo "build multipage docs"
RUBYOPT="-E utf-8" asciidoctor -b multipage_html5 --failure-level=WARN -a linkcss -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram -r ./buildscripts/asciidoc/multipage-html5-converter.rb index.adoc

# improve naming, CSS, etc.
cp Home.html index.html &> /dev/null
# sed -i 's/normal\ normal\ 400\ normal\ 16px/normal normal 400 normal 15px/g' *.svg
# sed -i 's/foreignObject width="[1-9][0-9]\+\.[0-9]\+" height="[1-9][0-9]\+\.[0-9]\+"/foreignObject width="100%" height="100%"/g' *.svg
echo "post process svg files"
sed -i 's/<foreignObject/<foreignObject style="overflow: visible;"/g' *.svg

# create correct document structure
mv *.svg toc.json searchIndex.json *.html build/html/
echo "build complete."
