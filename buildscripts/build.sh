#!/bin/bash


# set up environment
mkdir -p build/html
cp -r errorpages/* css images js fonts resources build/html/

# run basic tests
php buildscripts/tests/basic-tests.php || true

# build everything
RUBYOPT="-E utf-8" asciidoctor -b html5 --failure-level=WARN -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram index.adoc -o index.html
node buildscripts/split-pages/create-toc.js
node buildscripts/search/lunr-index-builder.js
RUBYOPT="-E utf-8" asciidoctor -b multipage_html5 --failure-level=WARN  -a linkcss -a systemtimestamp=$(date +%s) -a toc=left -a docinfo=shared -a icons=font -r asciidoctor-diagram -r ./buildscripts/asciidoc/multipage-html5-converter.rb index.adoc

# improve naming, CSS, etc.
cp Home.html index.html
# sed -i 's/normal\ normal\ 400\ normal\ 16px/normal normal 400 normal 15px/g' *.svg
# sed -i 's/foreignObject width="[1-9][0-9]\+\.[0-9]\+" height="[1-9][0-9]\+\.[0-9]\+"/foreignObject width="100%" height="100%"/g' *.svg
sed -i 's/<foreignObject/<foreignObject style="overflow: visible;"/g' *.svg

# create correct document structure
mv *.svg toc.json searchIndex.json *.html build/html/