// combines requests from two PM collections
// usage: postman-combine-collections.js --output <output-file.json> FILES
/*jshint esversion: 6 */

const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');

const outputFileName = (argv['output'] === undefined) ? ('out.json') : argv['output'];

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

const inputFiles = argv['_'].slice();
for (i in inputFiles) {
    if (fs.existsSync(inputFiles[i]) === false) {
        console.log('could not read ' + inputFiles[i]);
        process.exit(1);
    }
}

const Collection = simpleReadJSON(inputFiles.shift());
while (inputFiles.length > 0) {
    const nextFile = simpleReadJSON(inputFiles.shift());
    for (var i in nextFile.item) {
        Collection.item.push(nextFile.item[i]);
    }
}

try {
    fs.writeFileSync(outputFileName, JSON.stringify(Collection, null, 2));
    console.log('Combined Postman Collection written to: ' + outputFileName);
}
catch (err) {
    throw err;
}
