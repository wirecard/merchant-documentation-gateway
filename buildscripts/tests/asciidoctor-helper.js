/*

helper script to talk to asciidoctor.js api

*/

var argv = require( 'minimist' )( process.argv.slice( 2 ) );
var asciidoctor = require( 'asciidoctor.js' )();

if( argv['file'] !== undefined ) adocFilename = argv['file']

const memoryLogger = asciidoctor.MemoryLogger.$new();
asciidoctor.LoggerManager.setLogger(memoryLogger);

var adocFilename = 'index.adoc'
if( argv['file'] !== undefined ) adocFilename = argv['file']

const doc = asciidoctor.loadFile( adocFilename, {'safe': 'safe', 'catalog_assets': true} )

// to get warnings for wrong internal references!
Opal.gvars.VERBOSE = true
doc.convert()

/*
console.log(errorMessage.severity.toString()); // 'ERROR'
console.log(errorMessage.message['text']); // 'invalid part, must have at least one section (e.g., chapter, appendix, etc.)'
*/

var result = new Object()

result.links = doc.getLinks()
result.ids = doc.getIds()
result.errors = memoryLogger.getMessages()
//result.references = doc.getRefs()
//result.images = doc.getImages()
//result.footnotes = doc.getFootnotes()
//result.indexTerms = doc.getIndexTerms()

console.log( JSON.stringify( result, null, 2 ) )
//console.log( doc.getRefs() )