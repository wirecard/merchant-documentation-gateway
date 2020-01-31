/*

talks to asciidoctor.js api
tests words

*/

const argv = require('minimist')(process.argv.slice(2));
const asciidoctor = require('asciidoctor.js')();
const fs = require('fs');
const levenshtein = require('js-levenshtein');

const infoFile = 'buildscripts/info-files.json';
const infoFiles = stfuGetJsonFromFile(infoFile);

const anchorIndexFile = infoFiles['anchor-index-file'];
const AnchorIndex = stfuGetJsonFromFile(anchorIndexFile);

const typoWordsListFile = infoFiles['typo-words-list'];
const typoWordsList = readLines(typoWordsListFile);

var Result = new Object();

function getNested(obj, ...args) {
    return args.reduce((obj, level) => obj && obj[level], obj)
}

/**
 * Reads plain text file
 *
 * Returns a lines array without empty lines.
 *
 * @param {string} file Path to text file.
 * 
 * @return {Array} Array of lines split by newline.
 */
function readLines(file) {
    var fileContents;
    try {
        fileContents = fs.readFileSync(file);
    } catch (err) {
        throw err;
    }
    return fileContents.toString()
        .split(/\r?\n/)         // split by line
        .filter(function (e) {
            return e !== '';    // remove empty array entries
        });
}

/**
 * Reads JSON file without complaining about empty files or invalid content
 *
 * If file doesn't exist returns empty Object.
 * If file content is invalid JSON it returns empty Object unless strict == true
 *
 * @param {string} file Path to .json file.
 * @param {boolean} strict Decides wether to throw or ignore invalid JSON
 * 
 * @return {Object} Object or {}.
 */
function stfuGetJsonFromFile(file, strict = false) {
    var fileContents;
    try {
        fileContents = fs.readFileSync(file);
    } catch (err) {
        if (err.code === 'ENOENT') fileContents = '{}';
        else throw err;
    }
    try {
        JsonObject = JSON.parse(fileContents);
    }
    catch (err) {
        if (strict) throw err;
        else JsonObject = {};
    }
    return JsonObject;
}

const memoryLogger = asciidoctor.MemoryLogger.$new();
asciidoctor.LoggerManager.setLogger(memoryLogger);

var adocFilename = 'index.adoc';
if (argv['file'] !== undefined) adocFilename = argv['file'];

var adocFileContents;
try {
    adocFileContents = fs.readFileSync(adocFilename);
} catch (err) {
    throw err;
}

const isNOVA = (argv['nova'] == 'true');
const indexFileName = isNOVA ? 'nova.adoc' : 'index.adoc'
var includeStatement = 'include::shortcuts.adoc[]\n' + (isNOVA ? ':env-nova:\n' : '');
includeStatement += ':root: ' + process.cwd() + "\n"

// process.stderr.write(includeStatement);

adocFileContents = includeStatement + adocFileContents;
const doc = asciidoctor.load(adocFileContents, { 'safe': 'safe', 'catalog_assets': true });

var _similarWords = []
doc.getSourceLines().forEach((line, lineNumber) => {
    if (line) {
        var words = line.match(/[^\W_]{5,}/g);
        if (words) {
            words.forEach(word => {
                typoWordsList.forEach(referenceWord => {
                    var levenshteinScore = levenshtein(referenceWord, word);
                    // only look at lv values > 0 && <= 3
                    if (levenshteinScore && levenshteinScore <= 4) {
                        _similarWords.push({
                            "line": lineNumber + 1,
                            "word": word,
                            "reference-word": referenceWord,
                            "scores": {
                                "levenshtein": levenshteinScore
                            }
                        });
                    }
                });
            });
        }
    }
});

//Result.similarWords = _similarWords;

// to get warnings for wrong internal references!
Opal.gvars.VERBOSE = true;
doc.convert();

Result.links = doc.getLinks();
Result.ids = doc.getIds();
Result.errors = memoryLogger.getMessages();

//process.stderr.write('asciidoctor-helper: Testing ' + adocFilename + ' with index ' + indexFileName + "\n");
if (adocFilename == indexFileName) {
    Result.errors = Result.errors.filter(e => getNested(e, 'message', 'source_location', 'path') != '<stdin>');
}
//Result.references = doc.getRefs()
//Result.images = doc.getImages()
//Result.footnotes = doc.getFootnotes()
//Result.indexTerms = doc.getIndexTerms()

if (adocFilename !== indexFileName) {
    AnchorIndex[adocFilename] = Result.ids;
    try {
        fs.writeFileSync(anchorIndexFile, JSON.stringify(AnchorIndex, null, 2));
    }
    catch (err) {
        throw err;
    }
}

// do not remove. output is required by basic-tests.php
process.stdout.write(JSON.stringify(Result, null, 2));
//process.stderr.write("\n" + adocFilename + "\n");
//process.stderr.write(JSON.stringify(Result.errors, null, 2));

