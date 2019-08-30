/* Convert all XML requests to a different target language in a postman collection.
*
* Parameters
* --name <old:new> Colon separated pair of words, e.g. XML:JSON which means XML occurences will be replace with JSON
*                  (does not apply to the filename).
* Also: the second element of the pair (the new term) will be appended to all request names.
* --input <postman-collection-xml.json>    Input file, a PM Collection containing XML requests.
* --output <postman-collection-converted.json>  Output file, a PM Collection containing converted requests.
* --script <script.py> Convertion script, used to convert XML to whatever the target language is.
* --accept <content-type> Specify Accept header.
* --content-type <content-type> Specify ContentType of request.
*/
/*jshint esversion: 6 */

const child_process = require('child_process');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');

// ############################################################################
// PARSE ALL COMMAND LINE OPTIONS
// ############################################################################
if (argv.name === undefined || (argv.name.match(/:/g) || []).length != 1) {
    console.error('Please specify an update pair with --name old:new.');
    process.exit(1);
}
const [oldName, newName] = argv.name.split(":");

const inputFileName = argv.input;
if (inputFileName === undefined) {
    console.error('Input Postman collection missing. Specify with --input <postman_collection.json>');
    process.exit(1);
}
if (fs.existsSync(inputFileName) === false) {
    console.error('Input file ' + inputFileName + ' does not exist');
    process.exit(1);
}

const outputFileName = (argv.output === undefined) ?
    inputFileName.replace(/.json$/, '_output.json') :
    argv.output;

const script = argv.script;
if (script === undefined) {
    console.error('Convertion script (Python script) missing. Specify with --script <convertion.py>');
    process.exit(1);
} else if (fs.existsSync(script) === false) {
    console.error('Script ' + script + ' does not exist');
    process.exit(1);
}

const content_type = argv['content-type'];
if (content_type === undefined) {
    console.error('ContentType missing. Specify with --content-type <content-type>.');
    process.exit(1);
}
const accept_header = argv.accept;
if (accept_header === undefined) {
    console.error('Accept header missing. Specify with --accept <content-type>.');
    process.exit(1);
}

function updateText(name) {
    return name.replace(oldName, newName);
}

// ############################################################################
// FUNCTIONS
// ############################################################################

/**
 * Very simple JSON file to Object conversion
 * 
 * @param {string} inputFileName is path+filename of the file to read
 * @returns {object}
 */
function simpleReadJSON(inputFileName) {
    var jsonObject;
    try {
        jsonObject = JSON.parse(fs.readFileSync(inputFileName));
    }
    catch (err) {
        throw err;
    }
    jsonObject.info.name = updateText(jsonObject.info.name);
    return jsonObject;
}

/**
 * Recursively replaces all request bodies in a PM Collection with converted to JSON ones
 * Changes Content-Type header and adds Accept header for application/json
 * Start with first item: PMCollection.item
 * @param {string} folder is "item" in a PM Collection
 * @returns {object}
 */
function replaceXMLRequests(folder) {
    for (var i in folder) {
        var Item = folder[i];
        if (Item.item !== undefined) {
            replaceXMLRequests(Item.item);
        }
        if (Item.request === undefined) {
            // Item.name += " " + newName;
            continue;
        }
        try {
            process.stdout.write('.');
            // Item.request.name += " " + newName;
            Item.request.body.raw = convert(Item.request.body.raw);
            for (var h in Item.request.header) {
                if (Item.request.header[h].key == 'Content-Type') {
                    Item.request.header[h].value = content_type;
                }
            }
            Item.request.header.push({
                "key": "Accept",
                "name": "Accept",
                "type": "text",
                "value": accept_header
            });
        }
        catch (err) {
            if (Item.request === undefined)
                continue;
            console.log(Item.request.body.raw);
            throw err;
        }
    }
}

/**
 * Spawns script and pipes XML body to its stdin
 * Parses output to JSON object, then removes any 'xmlns:xsi' element
 * @param {string} body 
 * @returns {string} Prettified JSON string
 */
function convert(body) {
    try { // yep. turned out to be that easy in the end
        const content = child_process.spawnSync('python3', [script], { input: body }).stdout.toString('utf8');
        if (content_type === "application/json") {
            const jsonObject = JSON.parse(content);
            if (jsonObject[Object.keys(jsonObject)[0]]['xmlns:xsi'] !== undefined) {
                delete jsonObject[Object.keys(jsonObject)[0]]['xmlns:xsi'];
            }
            return JSON.stringify(jsonObject, null, 2);
        }
        return content;
    }
    catch (err) {
        throw (err);
    }
}

var PMCollection = simpleReadJSON(inputFileName);
replaceXMLRequests(PMCollection.item);
process.stdout.write("\n" + 'Done' + "\n");

try {
    fs.writeFileSync(outputFileName, JSON.stringify(PMCollection, null, 2));
    console.log('Converted Postman Collection written to: ' + outputFileName);
}
catch (err) {
    throw err;
}
