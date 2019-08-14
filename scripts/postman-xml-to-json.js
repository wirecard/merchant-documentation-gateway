/* replace XML samples in postman collection with JSON
*
* Parameters
* --input <postman-collection-xml.json>    Input file, a PM Collection containing XML requests
* --output <postman-environment-json.json>  Output file, a PM Collection containing JSON requests
*/
/*jshint esversion: 6 */

const child_process = require('child_process');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');

const inputFileName = (argv.input === undefined) ? ' Wirecard XML.postman_collection.json' : argv.input;
if (fs.existsSync(inputFileName) === false) {
    console.log('could not read input postman collection file. specify with --input <postman_collection.json>');
    process.exit(1);
}
const outputFileName = (argv.output === undefined) ?
    inputFileName.replace(/(_XML)?\.json$/, '_JSON.json') :
    argv.output;

/**
 * Very simple JSON file to Object conversion
 * 
 * @param {string} inputFileName is path+filename of the file to read
 * @returns {object}
 */
function simpleReadJSON(inputFileName) {
    try {
        JsonObject = JSON.parse(fs.readFileSync(inputFileName));
    }
    catch (err) {
        throw err;
    }
    return JsonObject;
}

/**
 * Recursively replaces all request bodies in a PM Collection with converted to JSON ones
 * Changes Content-Type header and adds Accept header for application/json
 * Start with first item: PMCollection.item
 * @param {string} folder is "item" in a PM Collection
 * @returns {object}
 */
function replaceXMLRequestswithJSON(folder) {
    for (var i in folder) {
        var Item = folder[i];
        if (Item.item !== undefined) {
            replaceXMLRequestswithJSON(Item.item);
        }
        try {
            process.stdout.write('.');
            Item.request.body.raw = xml2json(Item.request.body.raw);
            for (var h in Item.request.header) {
                if (Item.request.header[h].key == 'Content-Type') {
                    Item.request.header[h].value = 'application/json';
                }
            }
            Item.request.header.push({
                "key": "Accept",
                "name": "Accept",
                "type": "text",
                "value": "application/json"
            });
        }
        catch (err) {
            continue;
        }
    }
}

/**
 * Spawns xml2json.py and pipes XML body to its stdin
 * Parses output to JSON object, then removes any 'xmlns:xsi' element
 * @param {string} body 
 * @returns {string} Prettified JSON string
 */
function xml2json(body) {
    try { // yep. turned out to be that easy in the end
        const jsonObject = JSON.parse(child_process.spawnSync('python3', ['scripts/xml2json.py'], { input: body }).stdout.toString('utf8'));
        if (jsonObject[Object.keys(jsonObject)[0]]['xmlns:xsi'] !== undefined) {
            delete jsonObject[Object.keys(jsonObject)[0]]['xmlns:xsi'];
        }
        return JSON.stringify(jsonObject, null, 2);
    }
    catch (err) {
        throw (err);
    }
}

var PMCollection = simpleReadJSON(inputFileName);
replaceXMLRequestswithJSON(PMCollection.item);
process.stdout.write("\n" + 'Done' + "\n");

try {
    fs.writeFileSync(outputFileName, JSON.stringify(PMCollection, null, 2));
    console.log('Converted Postman Collection written to: ' + outputFileName);
}
catch (err) {
    throw err;
}
