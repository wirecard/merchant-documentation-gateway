/*

helper script to talk to asciidoctor.js api

*/

const argv = require('minimist')(process.argv.slice(2));
const asciidoctor = require('asciidoctor.js')();
const fs = require('fs');

if (argv['file'] !== undefined) adocFilename = argv['file'];

const memoryLogger = asciidoctor.MemoryLogger.$new();
asciidoctor.LoggerManager.setLogger(memoryLogger);

var adocFilename = 'index.adoc';
if (argv['file'] !== undefined) adocFilename = argv['file'];

const doc = asciidoctor.loadFile(adocFilename, { 'safe': 'safe', 'catalog_assets': true });

// to get warnings for wrong internal references!
Opal.gvars.VERBOSE = true;
doc.convert();

var Result = new Object();

Result.links = doc.getLinks();
Result.ids = doc.getIds();
Result.errors = memoryLogger.getMessages();
//Result.references = doc.getRefs()
//Result.images = doc.getImages()
//Result.footnotes = doc.getFootnotes()
//Result.indexTerms = doc.getIndexTerms()

if (adocFilename !== 'index.adoc') {
    const anchorIndexFile = 'anchor-index.json';
    var AnchorIndex = {};
    var fileContents;
    try {
        fileContents = fs.readFileSync(anchorIndexFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            fileContents = '{}';
        } else {
            throw err;
        }
    }
    try {
        AnchorIndex = JSON.parse(fileContents);
    }
    catch (err) {
        AnchorIndex = {};
    }
    AnchorIndex[adocFilename] = Result.ids;
    try {
        fs.writeFileSync(anchorIndexFile, JSON.stringify(AnchorIndex, null, 2));
    }
    catch (err) {
        throw err;
    }
}

// do not remove. output is required by basic-tests.php
console.log( JSON.stringify( Result, null, 2 ) );
