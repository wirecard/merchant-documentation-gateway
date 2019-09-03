/*
* Script given a postman collection creates asciidoc files with request, response
* source blocks and a metadata table.
*
* Parameters
* --file <postman-collection.json>       Optional. Uses hardcoded filename if unspecified.
* --env <postman-environment.json>       Optional.
*/
/*jshint esversion: 6 */

const argv = require('minimist')(process.argv.slice(2));
const PMUtil = require('./modules/pmutil');
const fs = require('fs');
const newman = require('newman');

if (argv.file === undefined) {
    console.error("Please specify a collection with --file <collection>");
    process.exit(1);
}
const postmanCollectionFile = argv.file;
if (fs.existsSync(postmanCollectionFile) === false) {
    console.log("Could not read postman collection file '" + postmanCollectionFile + "'.");
    process.exit(1);
}
PMUtil.Collection = PMUtil.stfuGetJsonFromFile(postmanCollectionFile);

const postmanEnvironmentFile = argv.env;
var pmEnv = postmanEnvironmentFile ? PMUtil.stfuGetJsonFromFile(postmanEnvironmentFile) : { parent_transaction_id: '' };


var _itemCounter = 0;
newman.run({
    collection: postmanCollectionFile,
    environment: pmEnv, // set notification_endpoint, etc
    reporters: 'htmlextra',
    reporter: {
        htmlextra: {
            export: './report.html'
        }
    }
}).on('start', function (err, args) { // on start of run, log to console
    if (err)
        throw err;
    console.log('Testing ' + postmanCollectionFile + '...');
}).on('beforeRequest', function (err, args) {
    if (err)
        throw err;
    const requestBodySource = PMUtil.getBody(args.request.body);
    const paymentMethod = PMUtil.readPaymentMethod(requestBodySource);
    const transactionType = PMUtil.getTransactionType(requestBodySource);
    const consoleString = paymentMethod + ' -> ' + transactionType;
    process.stderr.write('[  WAIT  ] ' + consoleString + "\r");

}).on('request', function (err, args) {
    if (err)
        throw err;
    _itemCounter++;
    const item = args.item;
    const requestSource = item.request;
    const requestName = item.name;
    const requestPMID = PMUtil.getElementByPath(['event', 0, 'script', 'id']);
    const requestSent = args.request;
    const requestMethod = requestSource.method;
    const requestBodySource = PMUtil.getBody(requestSource.body); // body including unresolved {{variables}}
    const requestFolderInfo = PMUtil.getFolderInfo(_itemCounter);
    const requestFolderDescription = requestFolderInfo.folder_description;
    const requestFolderPathArray = requestFolderInfo.path_array;
    const requestFolderPathString = PMUtil.camelCase(requestFolderPathArray.join('_'));
    const requestBodySent = PMUtil.getBody(requestSent.body);  // body that's actually sent with variables replaced

    if (requestBodySent.trim() == '') {
        process.stderr.write('[' + PMUtil.styleText('EMPTYREQ', 'cyan') + '] ' +
            requestFolderPathArray.join(' ') + ' -> ' + requestName + ': empty request body' + "\n");
        return false;
    }
    // body that has no vars in them (for web display) except request id
    const requestBodyWeb = PMUtil.formatRequestForWeb(requestBodySent);
    const requestContentType = PMUtil.getContentType(requestBodySent);
    const requestContentTypeAbbr = PMUtil.getContentType(requestBodySent, true);
    const paymentMethod = PMUtil.readPaymentMethod(requestBodySent);
    const paymentMethodName = requestFolderPathArray.join(' ');
    const transactionType = PMUtil.getTransactionType(requestBodySent);
    const transactionKey = requestFolderPathString + '_' + PMUtil.camelCase(requestName);
    const parentTransactionID = PMUtil.getParentTransactionID(requestBodySent);
    const merchantAccountID = PMUtil.getMerchantAccountID(requestBodySent);
    const requestEndpoint = 'https://' + requestSent.url.host.join('.') + '/' + requestSent.url.path.join('/');
    const requestEndpointPath = requestSent.url.path.join('/');
    const requestUsername = PMUtil.getAuth(requestSent).username;
    const requestPassword = PMUtil.getAuth(requestSent).password;
    const acceptHeader = PMUtil.getAcceptHeader(requestSource);
    const consoleString = paymentMethodName + ' -> ' + transactionType + ' (' + requestName + ')';
    const AdditionalTestCredentials = requestFolderDescription; // to create per folder test credentials pages

    // if a server is not reachable or there is some other network related issue and no response could be received
    // then do not pursue this request any further
    // do not write anything for this request because we do not know if the request failed because of server issue
    // or client network connectivity is bad
    if (args.response === undefined) {
        process.stderr.write('[' + PMUtil.styleText('  FAIL  ', 'red') + '] ' + consoleString +
            ' FAILED. CONNECTION FAILED' + "\n");
        return false;
    }

    var responseContentType;
    var responseContentTypeAbbr;
    var transactionID;
    const responseBody = PMUtil.formatResponse(args.response.stream.toString());
    const responseCodeHTTP = args.response.code;
    const engineStatusResponses = PMUtil.readEngineStatusResponses(responseBody);
    if (engineStatusResponses[0] === undefined) {
        console.log("\n\n");
        console.log('engine status responses');
        console.log(engineStatusResponses);
        console.log(responseBody);
    }
    var firstResponseCodeOfEngine = engineStatusResponses[0].code.toString();
    if (firstResponseCodeOfEngine.toString() === '600.0000') {
        process.stderr.write('[' + PMUtil.styleText(firstResponseCodeOfEngine.toString(), 'yellow') + '] ' +
            requestFolderPathArray.join(' ') + ' -> ' + requestName + ' (invalid response: no status)' + "\n");
        return false;
    }
    if (firstResponseCodeOfEngine.length === 3) firstResponseCodeOfEngine = 'HTTP ' + firstResponseCodeOfEngine;
    const requestSuccessful = (responses) => {
        for (var i in responses) {
            var responseCode = parseInt(responses[i].code.toString().replace(/\./, ''));
            // bad request gives html and an integer like 400, not 400.0000 like engine
            responseCode = responseCode < 999 ? responseCode * 10000 : responseCode;
            if (responseCode === -1 || responseCode / 10000 >= 400) {
                return false;
            }
        }
        return true;
    };


    responseContentType = PMUtil.getContentType(responseBody);
    responseContentTypeAbbr = PMUtil.getContentType(responseBody, true);

    if (responseContentTypeAbbr !== requestContentTypeAbbr) {
        process.stderr.write('[' + PMUtil.styleText('WRONG-CT', 'magenta') + '] ' + consoleString +
            ': Wrong Content-Type! Expected ' + requestContentTypeAbbr.toUpperCase() + ', got ' + responseContentTypeAbbr.toUpperCase() + "\n");
        return false;
    }

    process.stderr.write('[' + (requestSuccessful(engineStatusResponses) ?
        PMUtil.styleText(firstResponseCodeOfEngine, 'green') :
        PMUtil.styleText(firstResponseCodeOfEngine, 'red')) + '] ' + consoleString + "\n");

    /* ... TO HERE */

    transactionID = PMUtil.getTransactionID(responseBody);

    if (typeof PMUtil.RequestsIndex === 'undefined') {
        PMUtil.RequestsIndex = [];
    }

    PMUtil.RequestsIndex[transactionID] = {
        response_code: responseCodeHTTP,
        parent_transaction_id: parentTransactionID,
        payment_method: paymentMethod
    };

    if (typeof PMUtil.RequestResponseIndex === 'undefined') {
        PMUtil.RequestResponseIndex = {}; // array for sort order
    }
    if (typeof PMUtil.RequestResponseIndex[transactionKey] === 'undefined') {
        PMUtil.RequestResponseIndex[transactionKey] = {};
    }
    Object.assign(PMUtil.RequestResponseIndex[transactionKey],
        {
            name: requestName, // name of req in postman collection
            folder_path_array: requestFolderPathArray,
            folder_description: requestFolderDescription,
            transaction_type: transactionType,
            payment_method: paymentMethod,
            payment_method_name: paymentMethodName, // folders in postman coll.
            additional_test_credentials: AdditionalTestCredentials // for now same as folder_description
        });
    if (typeof PMUtil.RequestResponseIndex[transactionKey].content_types === 'undefined') {
        PMUtil.RequestResponseIndex[transactionKey].content_types = {};
    }
    Object.assign(PMUtil.RequestResponseIndex[transactionKey].content_types,
        {
            [requestContentTypeAbbr]: {
                request: {
                    content_type: requestContentType,
                    content_type_abbr: requestContentTypeAbbr,
                    body_source: requestBodySource,
                    body_sent: requestBodySent,
                    body_web: requestBodyWeb,
                    method: requestMethod,
                    endpoint: requestEndpoint,
                    username: requestUsername,
                    password: requestPassword,
                    accept: acceptHeader
                },
                response: {
                    content_type: responseContentType,
                    content_type_abbr: responseContentTypeAbbr,
                    body: responseBody,
                    http_status_code: responseCodeHTTP,
                    engine_status: engineStatusResponses
                },
                maid: merchantAccountID,
                transaction_id: transactionID,
                parent_transaction_id: parentTransactionID,
                success: requestSuccessful(engineStatusResponses),
                item_number: _itemCounter
            }
        });

    /*
    Endpoints: {
        [payment_method]: {
            '/engine/rest/paymentmethods/': ['get-url', 'debit', 'blablubb'],
            '/engine/rest/payments/': ['refund-debit']
        }
    }    
    */

    // add transaction types to endpoint index later used in creating test credentials tables
    if (PMUtil.Endpoints[paymentMethod] === undefined)
        PMUtil.Endpoints[paymentMethod] = {};
    if (PMUtil.Endpoints[paymentMethod][requestEndpoint] === undefined)
        PMUtil.Endpoints[paymentMethod][requestEndpoint] = [];
    PMUtil.Endpoints[paymentMethod][requestEndpoint].push(transactionType); // add e.g. get-url to endpoint object
    PMUtil.Endpoints[paymentMethod][requestEndpoint] =
        [...new Set(PMUtil.Endpoints[paymentMethod][requestEndpoint].sort())]; // remove duplicate entries of sorted array
}).on('done', function (err, summary) {
    if (err || summary.error) {
        console.error('collection run encountered an error.');
    }
    else {
        console.log('collection run completed.');

    }
    // console.log('writing test credentials tables');
    process.stderr.write('writing test credentials tables...' + "\r");
    var _numTCT = PMUtil.createTestCredentialsTables(PMUtil.RequestResponseIndex).length;
    process.stderr.write('writing test credentials tables: ' + _numTCT + "\n");

    // console.log('writing adoc request/response and sample files (' + Object.keys(PMUtil.RequestResponseIndex).length + ' items)');
    PMUtil.writeAdocSummary(PMUtil.RequestResponseIndex);
});
