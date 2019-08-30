/*
* Script given a postman collection creates asciidoc files with request, response
* source blocks and a metadata table.
*
* Parameters
* --file <postman-collection.json>       Optional. Uses hardcoded filename if unspecified.
* --env <postman-environment.json>       Optional.
*/
/*jshint esversion: 6 */

const newman = require('newman');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const path = require('path');
const xmlparser = require('fast-xml-parser');
const URLSearchParams = require('url').URLSearchParams;
const crypto = require('crypto');
const child_process = require('child_process');

const MIMETYPE_XML = 'application/xml';
const MIMETYPE_HTML = 'text/html';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_NVP = 'application/x-www-form-urlencoded;charset=UTF-8';
const TRANSACTIONSTATE_SUCCESS = 'success';
const TRANSACTIONCODE_SUCCESS = '201.0000';
const DEFAULT_PAYMENT_METHOD = 'creditcard';

// for PMUtil.ElementNamesMap:
const ELEMENT_TRANSACTION_TYPE = 'transaction_type';
const ELEMENT_PAYMENT_METHOD = 'payment_method';
const ELEMENT_FLAT_PAYMENT_METHOD = 'flat_payment_method';
const ELEMENT_TRANSACTION_ID = 'transaction_id';
const ELEMENT_REQUEST_ID = 'request_id';
const ELEMENT_CRYPTOGRAM_TYPE = 'cryptogram_type';
const ELEMENT_PARENT_TRANSACTION_ID = 'parent_transaction_id';
const ELEMENT_MERCHANT_ACCOUNT_ID = 'merchant_account_id';
const GENERIC_ROOT_ELEMENT = 'generic_root_element'; // used in elements map. bc some responses do not have 'payment' as root element

const PM_GUID_VARIABLE = '{{$guid}}';
if (argv.file === undefined) {
    console.error("Please specify a collection with --file <collection>");
    process.exit(1);
}
const postmanCollectionFile = argv.file;
if (fs.existsSync(postmanCollectionFile) === false) {
    console.log("Could not read postman collection file '" + postmanCollectionFile + "'.");
    process.exit(1);
}

const postmanEnvironmentFile = argv.env;
var pmEnv = postmanEnvironmentFile ? stfuGetJsonFromFile(postmanEnvironmentFile) : { parent_transaction_id: '' };

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

function sha256(data) { // binary safe
    return crypto.createHash('sha256').update(data, 'binary').digest('base64');
}

var PMUtil = {};

PMUtil.RequestsIndex = {};
PMUtil.RequestResponseIndex = {};
PMUtil.Endpoints = {};
PMUtil.Collection = stfuGetJsonFromFile(postmanCollectionFile);

/**
* These are wrappers for readElementFromBody() to make code more writable/readable.
* Use the wrappers instead of PMUtil.readElementFromBody() wherever feasible.
*
* @param {string} body The request/response body sent or received by Postman.
* 
* @return {string} The element value.
*/
PMUtil.getTransactionID = (body) => PMUtil.readElementFromBody(ELEMENT_TRANSACTION_ID, body);
PMUtil.getRequestID = (body) => PMUtil.readElementFromBody(ELEMENT_REQUEST_ID, body);
PMUtil.getParentTransactionID = (body) => PMUtil.readElementFromBody(ELEMENT_PARENT_TRANSACTION_ID, body);
PMUtil.getPaymentMethod = (body) => {
    return PMUtil.bodyHasElement(body, 'payment') ? PMUtil.readElementFromBody(ELEMENT_PAYMENT_METHOD, body) : PMUtil.readElementFromBody(ELEMENT_FLAT_PAYMENT_METHOD, body);
};
PMUtil.getMerchantAccountID = (body) => PMUtil.readElementFromBody(ELEMENT_MERCHANT_ACCOUNT_ID, body);
PMUtil.getTransactionType = (body) => { // returns value of transaction type. or parent element name for sonderfälle like get-address-request
    return (PMUtil.bodyHasElement(body, 'payment') || PMUtil.getContentType(body) == MIMETYPE_NVP) ?
        PMUtil.readElementFromBody(ELEMENT_TRANSACTION_TYPE, body) :
        PMUtil.readElementFromBody(GENERIC_ROOT_ELEMENT, body, true);
};

/**
 * Reads the Secondary Payment Method of a given request or response body.
 * 
 * Some have "creditcard" as payment method but are e.g. Google Pay.
 * For these cases the cryptogram-type value is returned.
 *
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} cryptogram-type, e.g. 'google-pay' or undefined
 */
PMUtil.getSecondaryPaymentMethod = (body) => PMUtil.readElementFromBody(ELEMENT_CRYPTOGRAM_TYPE, body);

/*
* ElementNamesMap contains map where to find an element in request/response body / per content type
* May be string or path as array.
*/
PMUtil.ElementNamesMap = {
    generic_root_element: {
        xml: GENERIC_ROOT_ELEMENT,
        json: GENERIC_ROOT_ELEMENT,
        nvp: GENERIC_ROOT_ELEMENT
    },
    cryptogram_type: {
        xml: [GENERIC_ROOT_ELEMENT, 'cryptogram', 'cryptogram-type'],
        json: [GENERIC_ROOT_ELEMENT, 'cryptogram', 'cryptogram-type'],
        nvp: 'cryptogram_type'
    },
    payment_method: {
        xml: [GENERIC_ROOT_ELEMENT, 'payment-methods', 'payment-method', '@_name'],
        json: [GENERIC_ROOT_ELEMENT, 'payment-methods', 'payment-method', 0, 'name'],
        nvp: 'payment_method'
    },
    flat_payment_method: {
        xml: [GENERIC_ROOT_ELEMENT, 'payment-method'],
        json: [GENERIC_ROOT_ELEMENT, 'payment-method'],
        nvp: 'payment_method'
    },
    request_id: {
        xml: [GENERIC_ROOT_ELEMENT, 'request-id'],
        json: [GENERIC_ROOT_ELEMENT, 'request-id'],
        nvp: 'request_id'
    },
    transaction_id: {
        xml: [GENERIC_ROOT_ELEMENT, 'transaction-id'],
        json: [GENERIC_ROOT_ELEMENT, 'transaction-id'],
        nvp: 'transaction_id'
    },
    parent_transaction_id: {
        xml: [GENERIC_ROOT_ELEMENT, 'parent-transaction-id'],
        json: [GENERIC_ROOT_ELEMENT, 'parent-transaction-id'],
        nvp: 'parent_transaction_id'
    },
    transaction_type: {
        xml: [GENERIC_ROOT_ELEMENT, 'transaction-type'],
        json: [GENERIC_ROOT_ELEMENT, 'transaction-type'],
        nvp: 'transaction_type'
    },
    merchant_account_id: {
        xml: [GENERIC_ROOT_ELEMENT, 'merchant-account-id'],
        json: [GENERIC_ROOT_ELEMENT, 'merchant-account-id'],
        nvp: 'merchant_account_id'
    }
};

PMUtil.ContentTypeAbbr = {
    [MIMETYPE_XML]: 'xml',
    [MIMETYPE_JSON]: 'json',
    [MIMETYPE_NVP]: 'nvp',
    [MIMETYPE_HTML]: 'html'
};

/**
 * Gives the actual brand name for a payment-method id string.
 *
 * Creates table with general info on the request (is to be hidden by default in frontend)
 * Creates two source blocks, request and response with titles according to Payment Method,
 * Transaction Type and Content Type
 * Request contains all Postman variables unsubstituted for integrators to copy&paste.
 *
 * @param {string} pm String that is found in the request or response body indicating the Payment Method.
 * 
 * @return {string} Brand name of the Payment Method if available or pm input if not.
 */
PMUtil.brandNameOfPaymentMethod = function (pm) {
    const BrandNamesMap = {
        'alipay-xborder': 'Alipay Cross-border',
        'apple-pay': 'Apple Pay',
        'bancontact': 'Bancontact',
        'boleto': 'Boleto',
        'carrier-billing': 'Carrier Billing',
        'creditcard': 'Credit Card',
        'eps': 'eps-Überweisung',
        'giropay': 'giropay',
        'google-pay': 'Google Pay™',
        'sepacredit': 'SEPA Direct Debit'
    };
    if (typeof BrandNamesMap[pm] !== 'undefined') {
        return BrandNamesMap[pm];
    }
    else {
        return pm;
    }
};

/**
 * Write single request/response files for separate include not tied to the adoc tabs page
 *
 * @param {string} rType Request type. Either 'request' or 'response'
 * @param {string} contentTypeAbbr Content type in short form, i.e. xml, json, nvp.
 * @param {string} basename e.g. Creditcard_CaptureAuthorizationForVoidCapture
 * @param {string} path Global path of directory where the subfolders for xml, json, nvp are created in.
 * E.g. 'samples/adoc/'
 * @param {string} body Request or response body to write into the file.
 * 
 * @return {string} Path to file for use in include:: statement
 */
PMUtil.writeSampleFile = function (rType, contentTypeAbbr, basename, path, body) {
    const dirname = contentTypeAbbr + '/'; // add slash to have same format as path
    const fileExtension = '.' + contentTypeAbbr;
    const filename = basename + '_' + rType; // e.g. Creditcard_CaptureAuthorizationForVoidCapture_request

    // create directory to hold the sample files
    if (!fs.existsSync(path + dirname)) {
        fs.mkdirSync(path + dirname, { recursive: true });
    }
    try {
        fs.writeFileSync(path + dirname + filename + fileExtension, body);
    }
    catch (err) {
        throw err;
    }
    return dirname + filename + fileExtension;
};

/**
 * Loop through all requests and create TC tables for each payment method (once)
 * Looks up endpoint information from PMUtil.Endpoints using payment_method, e.g. "klarna-install" as key
 * @param {Object} RequestResponseIndex Whole Request Response Index
 *
 * @return {array} Array of Test Credential Table files written
 */
PMUtil.createTestCredentialsTables = function (RequestResponseIndex) {
    const path = 'test-credentials/adoc/';
    var _done = []; // array contains payment methods that already have a tc table written
    var _writtenFiles = [];
    for (var k in RequestResponseIndex) {
        const Transaction = RequestResponseIndex[k];
        const paymentMethod = Transaction.payment_method;
        const folderPathString = Transaction.folder_path_array.join('_'); // e.g. CreditCard_3D
        const basename = camelCase(folderPathString); // e.g. "klarna-install"
        /*
                if (_done.includes(paymentMethod)) continue; // skip if we already have a table for this payment method
                FirstTransaction = Transaction.content_types[Object.keys(RequestResponseIndex[k].content_types)[0]]; // we only need one transaction for credentials, e.g. XML
                const TestCredentials = {
                    maid: FirstTransaction.maid,
                    ba_username: FirstTransaction.request.username, // ba_ because there can additional "usernames" for web interfaces
                    ba_password: FirstTransaction.request.password,
                    endpoints: PMUtil.Endpoints[Transaction.payment_method],
                    http_method: FirstTransaction.request.method,
                    additional_test_credentials: FirstTransaction.additional_test_credentials,
                    folder_description: RequestResponseIndex[k].folder_description
                };
                _done.push(paymentMethod);
        */
        if (_done.includes(basename)) continue; // skip if we already have a table for this payment method
        FirstTransaction = Transaction.content_types[Object.keys(RequestResponseIndex[k].content_types)[0]]; // we only need one transaction for credentials, e.g. XML
        const TestCredentials = {
            maid: FirstTransaction.maid,
            ba_username: FirstTransaction.request.username, // ba_ because there can additional "usernames" for web interfaces
            ba_password: FirstTransaction.request.password,
            endpoints: PMUtil.Endpoints[Transaction.payment_method],
            http_method: FirstTransaction.request.method,
            additional_test_credentials: FirstTransaction.additional_test_credentials,
            folder_description: RequestResponseIndex[k].folder_description
        };
        _done.push(basename);
        //// console.log(TestCredentials);
        _writtenFiles.push(PMUtil.writeTestCredentialsAdocTableFile(basename, path, TestCredentials));
    }
    return _writtenFiles;
}


/**
 * Write adoc file that contains all necessary test credentials for all request of a payment method
 *
 * @param {string} basename e.g. Creditcard_CaptureAuthorizationForVoidCapture
 * @param {string} path Global path of directory where the subfolder for the tables are created in. E.g. 'samples/adoc/'
 * @param {Object} TestCredentials Object containing the Test Credentials
 *
 * @return {string} Path to file for use in include:: statement
 */
PMUtil.writeTestCredentialsAdocTableFile = function (basename, path, TestCredentials) {
    const fileExtension = '.adoc';
    const filename = basename + '_TestCredentials'; // e.g. Creditcard_CaptureAuthorizationForVoidCapture_request

    /*
    Endpoints
    */
    const Endpoints = TestCredentials.endpoints;
    var endpointsAdoc = '==== Endpoint' + ((Object.keys(Endpoints).length > 1) ? 's' : '') + "\n\n";
    for (var ep in Endpoints) {
        endpointsAdoc += '[cols="1v,3"]' + "\n";
        endpointsAdoc += '|===' + "\n";
        endpointsAdoc += 's| Transaction Type' + ((Endpoints[ep].length > 1) ? 's' : '') + ' | ' + Endpoints[ep].map(e => `\`${e}\``).join(', ') + "\n"; // wrap in `` for monospace
        endpointsAdoc += 's| URI | \\' + ep + "\n";
        endpointsAdoc += '|===' + "\n\n";
    }
    endpointsAdoc += "\n";

    /*
    Additional Test Credentials
    */
    var additionalTestCredentialsAdoc = '';
    if (TestCredentials.folder_description !== undefined)
        additionalTestCredentialsAdoc += TestCredentials.folder_description + "\n";
    /*
        const AdditionalTestCredentials = TestCredentials.additional_test_credentials;
        var additionalTestCredentialsAdoc = '';
        if (Object.keys(AdditionalTestCredentials).length > 1) {
            additionalTestCredentialsAdoc = `==== Additional Test Credentials
    `;
            var atcHeader = 'null';
            for (var i in AdditionalTestCredentials) {
                if (i !== atcHeader) { // create new table
                    additionalTestCredentialsAdoc += `[cols="1v,2"]
    |===
    `;
                    if (i !== 'null') // must use string 'null' although "var header = null; in PMUtil.parseAdditionalTestCredentials"
                        additionalTestCredentialsAdoc += '2+s| ' + i + "\n";
                }
                for (var j in AdditionalTestCredentials[i]) {
                    const CredentialsPair = AdditionalTestCredentials[i][j];
                    additionalTestCredentialsAdoc += `e| ` + CredentialsPair.name + ` | ` + '``' + CredentialsPair.value + '``' + "\n";
                }
                if (i !== atcHeader) { // close table
                    additionalTestCredentialsAdoc += "|===\n\n";
                    atcHeader = i;
                }
            }
        }
    */
    var fileContent = `=== Test Credentials
[cols="1v,2"]
|===
h| Merchant Account ID | \`` + TestCredentials.maid + `\`
|===

[cols="1v,2"]
|===
2+|HTTP Basic Authentication

e| Username | \`` + TestCredentials.ba_username + `\`
e| Password | \`` + TestCredentials.ba_password + `\`
|===

` + additionalTestCredentialsAdoc + endpointsAdoc;

    // create directory to hold the table
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
    }
    try {
        fs.writeFileSync(path + filename + fileExtension, fileContent);
        // console.log(styleText('WRITTEN: ', 'green') + filename + fileExtension);
    }
    catch (err) {
        throw err;
    }
    return filename + fileExtension;
};

/**
 * Write adoc file that contains sample tabs
 *
 * @param {object} RequestResponseIndex all tested requests and their info
 */
PMUtil.writeAdocSummary = function (RequestResponseIndex) {
    const adocFileExtension = '.adoc';
    const path = 'samples/adoc/';

    var _writtenFiles = [];

    for (var t in RequestResponseIndex) {
        const transactionKey = RequestResponseIndex[t];
        const paymentMethodBrandName = transactionKey.payment_method_name;
        const transactionName = transactionKey.name;
        const transactionType = transactionKey.transaction_type;
        const basename = camelCase(t);
        const adocFilename = basename + adocFileExtension;
        const countExistingRequests = (file) => {
            var fileContents;
            if (fs.existsSync(file) === false) { // if adoc doesn't exist at all
                return 0;
            }
            try {
                fileContents = fs.readFileSync(file);
            } catch (err) {
                throw err;
            }
            const _num = (fileContents.toString().match(/\[\.r-details\]/g) || []).length / 2;
            return _num;
        };

        var fileContent = `[.sample-tabs]

=== ` + paymentMethodBrandName + `: ` + transactionName;
        var numSuccessfulRequests = 0;
        var numTotalRequests = 0; // needed for check if we are in last request (to collect all endpoints)
        for (var c in transactionKey.content_types) {
            numTotalRequests = numTotalRequests + 1;
            const transaction = transactionKey.content_types[c]; // "xml transaction" = get-url[0]
            if (transaction.success === false) {
                continue;
            }
            numSuccessfulRequests++;

            const requestFile = PMUtil.writeSampleFile('request', transaction.request.content_type_abbr, basename, path, transaction.request.body_web);
            const responseFile = PMUtil.writeSampleFile('response', transaction.response.content_type_abbr, basename, path, transaction.response.body);

            var statusesAdocTableCells = '';
            transaction.response.engine_status.forEach(function (s, i) {
                statusesAdocTableCells += `e| Code        | ` + '``' + s.code + '``' + `
e| Severity    | ` + '``' + s.severity + '``' + `
e| Description | ` + '``' + s.description + '``' + `
`;                  // add divider between different status messages in response
                if (transaction.response.engine_status.length > 1 && i < (transaction.response.engine_status.length - 1)) {
                    statusesAdocTableCells += '2+|' + "\n";
                }
            });
            fileContent += `
[.tab-content.tab-` + transaction.request.content_type_abbr + `]
==== ` + transaction.request.content_type_abbr.toUpperCase() + `

[.r-details]
.Request Details
[cols="1v,2"]
|===
2+| API Endpoint

e| Method | ` + transaction.request.method + `
e| URI    | ` + '``\\' + transaction.request.endpoint + '``' + `

2+h| Headers
e| Content-Type | \`` + transaction.request.content_type + `\`
e| Accept       | \`` + transaction.request.accept + `\`
|===

//.Request ` + paymentMethodBrandName + `: ` + transactionName + ` (` + transaction.request.content_type_abbr.toUpperCase() + `)
[source,` + transaction.request.content_type_abbr + `]
----
include::` + requestFile + `[]
----

[.r-details]
.Response Details
[cols="1v,2"]
|===
2+h| Headers

e| Content-Type | \`` + transaction.response.content_type + `\`
2+h| Status
` + statusesAdocTableCells + `
|===

//.Response ` + paymentMethodBrandName + `: ` + transactionName + ` (` + transaction.response.content_type_abbr.toUpperCase() + `)
[source,` + transaction.response.content_type_abbr + `]
----
include::` + responseFile + `[]
----
`;
        }
        fileContent += "\n";
        try {
            _writtenFiles.push(t);
            const numExistingRequests = countExistingRequests(path + adocFilename);
            if (numSuccessfulRequests > 0 && numSuccessfulRequests >= numExistingRequests) { // if in a previous run there were more successful requests thant in the current, do not write the adoc
                fs.writeFileSync(path + adocFilename, fileContent);
                process.stderr.write(styleText('WRITTEN: ', 'green') + adocFilename + ' (' + numSuccessfulRequests + ' >= ' + numExistingRequests + ')'  + "\n");
            } else {
                process.stderr.write(styleText('SKIPPED: ', 'red') + adocFilename + ' (' + numSuccessfulRequests + ' ' + ((numSuccessfulRequests === numExistingRequests) ? '===' : '<') + ' ' + numExistingRequests + ')' + "\n");
            }
        }
        catch (err) {
            throw err;
        }
    }
};

/**
 * Get Accept header from Postman Request item
 *
 * Defaults to XML which is the engine's default response header unless otherwise specified in Accept.
 *
 * @param {string} request Request item from the Postman Collection.
 * 
 * @return {string} Content Type that is being sent as Accept header
 */
PMUtil.getAcceptHeader = function (request) {
    // XML by default as it is default response content type if no accept header specified
    return (request.headers.reference.accept !== undefined) ? request.headers.reference.accept.value : MIMETYPE_XML;
};

/**
 * Prettifies XML and JSON bodies
 *
 * @param {string} body String that contains the body.
 * 
 * @return {string} Returns prettified body if JSON or XML, else returns body unmodified.
 */
PMUtil.formatResponse = function (body) {
    const contentType = PMUtil.getContentType(body);
    if (contentType === MIMETYPE_XML) {
        return PMUtil.formatXML(body);
    }
    if (contentType === MIMETYPE_JSON) {
        return PMUtil.formatJSON(body);
    }
    return body;
};

/**
 * Gets username and password of basic authentication headers.
 * 
 * Returns Object with undefined members if not auth available instead of failing.
 *
 * @param {string} request Postman request item.
 * 
 * @return {Object} Returns Object with members 'username' and 'password'.
 */
PMUtil.getAuth = function (request) {
    var Auth = {};
    try {
        Auth.username = request.auth.basic.reference.username.value;
        Auth.password = request.auth.basic.reference.password.value;
    }
    catch (e) { }
    return Auth;
};

/**
 * Reads the API engine response status code, description and severity from response body.
 *
 * @param {string} body Response body received from the API.
 * 
 * @return {Array} Array of Objects containing each status code, severity and description.
 */
PMUtil.readEngineStatusResponses = function (body) {
    var statusResponse = [];
    const contentType = PMUtil.getContentType(body);
    var obj;
    var objRoot;
    switch (contentType) {
        case MIMETYPE_HTML:
            try {
                obj = xmlparser.parse(body, {});
                statusResponse = [{
                    code: parseInt(obj.html.head.title.replace(/([0-9]+)\ .*/, '$1')),
                    description: obj.html.head.title.replace(/([0-9]+)\ (.*)/, '$2'),
                    severity: 'error'
                }];
            }
            catch (e) {
                console.log('readEngineStatusResponses<HTML> failed.');
                console.log(body);
                console.log(statusResponse);
            }
            break;
        case MIMETYPE_XML:
            try {
                obj = xmlparser.parse(body, { ignoreAttributes: false });
                objRoot = obj[Object.keys(obj)[0]];
                statusResponse = [];
                var statuses = objRoot.statuses.status;
                statuses = Array.isArray(statuses) ? statuses : [statuses];
                statuses.forEach(status => {
                    statusResponse.push({
                        code: status['@_code'],
                        description: status['@_description'],
                        severity: status['@_severity']
                    });
                });
            }
            catch (e) {
                // console.log('isXML');
                console.log(body);
                console.log('readEngineStatusResponses<XML> failed.');
                console.log(obj);
            }
            break;
        case MIMETYPE_JSON:
            try {
                obj = JSON.parse(body);
                objRoot = obj[Object.keys(obj)[0]];
                objRoot.statuses.status.forEach(status => {
                    statusResponse.push({
                        code: status.code,
                        description: status.description,
                        severity: status.severity
                    });
                });
            }
            catch (e) {
                console.log(body);
                console.log('readEngineStatusResponses<JSON> failed.');
                console.log(obj);
            }
            break;
        case MIMETYPE_NVP:
            const Params = new URLSearchParams(body);
            for (var [k, v] of Params.entries()) {
                const matches = k.match(/status_code(_[0-9]+)?/);
                const ext = (matches && matches[1]) ? matches[1] : "";
                if (matches) {
                    statusResponse.push({
                        code: Params.get(matches[0]),
                        description: Params.get('status_description' + ext),
                        severity: Params.get('status_severity' + ext)
                    });
                }
            }
            if (statusResponse.length === 0) {
                statusResponse.push({
                    code: '600.0000',
                    description: 'No Status response',
                    severity: 'ERROR'
                });
            }
            break;
        default:
            console.log(body);
            console.log('in readEngineStatusResponses: unknown content type');
            break;
    }
    return statusResponse;
};

/**
* Generates a RFC4122 version 4 compliant UUID
* From https://stackoverflow.com/a/2117523
*
* @return {string} UUID v4
*/
PMUtil.uuidv4 = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};


PMUtil.getElementByPath = function (e, obj, key = false) {
    if (e[0] === GENERIC_ROOT_ELEMENT) {
        e[0] = Object.keys(obj)[0];
    }
    return e.reduce((x, i) => (x && x[i]) ? (key ? i : x[i]) : undefined, obj);
};


/**
 * Reads element value from XML or JSON body if found and mapped in ElementNamesMap.
 *
 * @param {string} elementName Name or path (see PMUtil.ElementNamesMap) of element whose value is to be returned.
 * @param {string} body Request body in which to look for the element.
 * @param {boolean} key Optional: returns name of element. Use to get name of GENERIC_ROOT_ELEMENT
 * 
 * @return {string} Value of the element or undefined if not found in ElementNamesMap.
 */
PMUtil.readElementFromBody = function (elementName, body, key = false) {
    var elementValue;
    const contentType = PMUtil.getContentType(body);
    var obj;
    var e;
    switch (contentType) {
        case MIMETYPE_XML:
            obj = xmlparser.parse(body, { ignoreAttributes: false });
            e = PMUtil.ElementNamesMap[elementName].xml.slice();
            if (!Array.isArray(e))
                e = [e];
            elementValue = PMUtil.getElementByPath(e, obj, key);
            break;
        case MIMETYPE_JSON:
            obj = JSON.parse(body);
            e = PMUtil.ElementNamesMap[elementName].json.slice();
            if (!Array.isArray(e))
                e = [e];
            elementValue = PMUtil.getElementByPath(e, obj, key);
            break;
        case MIMETYPE_NVP:
            obj = [...new URLSearchParams(body)].map(arr => { return [ arr[0], arr[1] ]; }).reduce((arr, item) => (arr[item[0]] = item[1], arr) ,{})
            try {
                e = PMUtil.ElementNamesMap[elementName].nvp.slice();
            }
            catch (err) {
                console.log('NVP element ' + elementName + ' not found in ElementNamesMap');
                console.log(PMUtil.ElementNamesMap);
                return elementValue;
            }
            if(obj[e] !== undefined)
                elementValue = obj[e].trim();
            break;
        case MIMETYPE_HTML:
            elementValue = undefined; // explicitly set to undefined (not really necessary, already is undefined)
            break;
        default:
            console.log('in readElement: ' + elementName + ' + unknown content type');
            break;
    }
    return elementValue;
};

/**
 * Get the Payment Method of a transaction's Parent Transaction.
 *
 * Some requests do not specify a Payment Method, only a Parent Transaction ID.
 * This method looks up the Payment Method of the parent in table that holds all transactions.
 * 
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} The Payment Method of the parent of the request.
 */
PMUtil.getParentPaymentMethod = function (body) {
    const pid = PMUtil.getParentTransactionID(body);
    if (pid === undefined) {
        // credit card requests also work if there's not payment method specified
        // getParentTransactionID returns undefined, because request has no parent-transaction-id 
        return DEFAULT_PAYMENT_METHOD;
    }
    else {
        //console.log('looking for pid: ' + pid + ' in RequestsIndex');
        for (var transaction_id in PMUtil.RequestsIndex) {
            if (transaction_id === pid) {
                return PMUtil.RequestsIndex[transaction_id].payment_method;
            }
        }
    }
    return DEFAULT_PAYMENT_METHOD;
};

/**
 * Reads the Payment Method of a given request or response body.
 * 
 * KEEP THIS! needed because of getSecondaryPaymentMethod inside it
 * 
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} The Payment Method of the request/response sample.
 */
PMUtil.readPaymentMethod = function (body) {
    const secondaryPaymentMethod = PMUtil.getSecondaryPaymentMethod(body);
    if (secondaryPaymentMethod !== undefined) {
        // returns 'google-pay', we can skip and return the found 2ndary pm
        return secondaryPaymentMethod;
    }
    paymentMethod = PMUtil.getPaymentMethod(body);
    if (paymentMethod === undefined) {
        paymentMethod = PMUtil.getParentPaymentMethod(body);
    }
    return paymentMethod.trim();
};

/**
 * Checks if a request or response body contains a certaing element (on root level)
 *
 * @param {string} body The request/response body sent or received by Postman.
 * @param {string} elementName Name of the element to look for.
 * 
 * @return {boolean} True if element exists, else false.
 */
PMUtil.bodyHasElement = function (body, elementName) {
    const contentType = PMUtil.getContentType(body);
    var obj;
    switch (contentType) {
        case MIMETYPE_XML:
            obj = xmlparser.parse(body, { ignoreAttributes: false });
            break;
        case MIMETYPE_JSON:
            obj = JSON.parse(body);
            break;
        case MIMETYPE_NVP:
            return (new URLSearchParams(body).get(elementName) !== null);
        default:
            console.log('bodyHasElement: unknown content-type');
            console.log(body);
            break;
    }
    return (typeof obj[elementName] !== 'undefined');
};

PMUtil.bodyInjectElementValue = function (requestBody, elementName, elementValue) {
    return body;
};

/**
 * Determines the Content Type of a given request/response body.
 *
 * Attempt to parse given body as XML, JSON
 * Else attempt to identify NVP by looking for mandatory request_id parameter.
 * 
 * @param {string} body The request/response body sent or received by Postman.
 * @param {boolean} short Default false returns the complete mime type, e.g. "application/xml". true returns, e.g. "xml"
 * 
 * @return {string} contentType
 */
PMUtil.getContentType = function (body, short = false) {
    const isJSON = (body) => {
        try { JSON.parse(body); } catch (e) { return false; }
        return true;
    };
    const isNVP = (body) => {
        return ([...new URLSearchParams(body)].length > 0);
    };

    const isXML = (body) => {
        return (xmlparser.validate(body) === true);
    };

    const isHTML = (body) => {
        if (xmlparser.validate(body) === true) {
            var htmlObj = xmlparser.parse(body, { ignoreAttributes: false });
            return (htmlObj.html !== undefined);
        }
        return false;
    };

    // check HTML first, because HTML can be parsed as XML
    if (isHTML(body) === true) {
        contentType = MIMETYPE_HTML;
    }
    else if (isXML(body) === true) {
        contentType = MIMETYPE_XML;
    }
    else if (isJSON(body) === true) {
        contentType = MIMETYPE_JSON;
    }
    else /* if (isNVP(body) === true) */ {
        contentType = MIMETYPE_NVP;
    }

    if (short) {
        return PMUtil.ContentTypeAbbr[contentType];
    } else {
        return contentType;
    }
};

PMUtil.transactionHasFailed = function (body) {
    // write anew. not in use yet.
};

// from https://gist.github.com/sente/1083506/d2834134cd070dbcc08bf42ee27dabb746a1c54d#gistcomment-2254622
PMUtil.formatXML = function (xml) {
    const PADDING = ' '.repeat(2); // set desired indent size here
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;
    xml = xml.replace(reg, '$1\r\n$2$3');
    return xml.split('\r\n').map((node, index) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        } else if (node.match(/^<\/\w/) && pad > 0) {
            pad -= 1;
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        } else {
            indent = 0;
        }
        pad += indent;
        return PADDING.repeat(pad - indent) + node;
    }).join('\r\n');
};

PMUtil.formatJSON = function (jsonString) {
    return JSON.stringify(JSON.parse(jsonString), null, 2);
};

PMUtil.formatRequestForWeb = function (body_sent) {
    const requestID = new RegExp(PMUtil.getRequestID(body_sent));
    const formattedBody = body_sent.slice();
    return formattedBody.replace(requestID, PM_GUID_VARIABLE);
};

const ConsoleColors = {
    bg: {
        black: "\x1b[40m",
        blue: "\x1b[44m",
        cyan: "\x1b[46m",
        green: "\x1b[42m",
        magenta: "\x1b[45m",
        red: "\x1b[41m",
        yellow: "\x1b[43m",
        white: "\x1b[47m"
    },
    fg: {
        black: "\x1b[30m",
        blue: "\x1b[34m",
        cyan: "\x1b[36m",
        green: "\x1b[32m",
        magenta: "\x1b[35m",
        red: "\x1b[31m",
        yellow: "\x1b[33m",
        white: "\x1b[37m"
    },
    ctrl: {
        blink: "\x1b[5m",
        bright: "\x1b[1m",
        dim: "\x1b[1m",
        hidden: "\x1b[8m",
        reset: "\x1b[0m",
        reverse: "\x1b[7m",
        underscore: "\x1b[4m"
    }
};

const styleText = function (text, style, type = 'fg') {
    return (ConsoleColors[type] === undefined || ConsoleColors[type][style] === undefined) ? text : ConsoleColors[type][style] + text + ConsoleColors.ctrl.reset;
};

// removes non-chars, remove empty array elements, capitalize, concatenate for CamelCase and add extension
const camelCase = function (str) {
    return str.replace(/[^A-Za-z0-9_]/g, ' ').split(' ').filter(function (el) { return el != ''; })
        .map(function (el) { return (el.charAt(0).toUpperCase() + el.slice(1)); }).join('');
};

/**
 * NOT IN USE!
 * Converts a Markdown string to Asciidoc with kramdoc
 * 
 * @param {string} txtMarkdown Contains ATC info like above
 * 
 * @return {string} Asciidoc text
 */
PMUtil.markdown2adoc = function (txtMarkdown) {
    var txtAdoc;
    //const _tmpfile = child_process.spawnSync('mktemp').stdout.toString('utf8'); // Error: ENOENT: no such file or directory, open 'C:\tmp\tmp.DCGQiKZehy
    const _tmpfile = '_' + PMUtil.uuidv4() + '.tmp';
    try {
        fs.writeFileSync(_tmpfile, txtMarkdown);
    }
    catch (err) {
        throw err;
    }
    try {
        txtAdoc = child_process.spawnSync('kramdoc', [_tmpfile, '-o', '-']).stdout.toString('utf8');
    }
    catch (err) {
        throw (err);
    }
    fs.unlinkSync(_tmpfile);
    return txtAdoc;
};


/**
 * Extracts additional Test Credentials from PM collection request description
 *
 * e.g.
 * ATC:Merchant Account
 * name::value
 * another name :: some other value
 *
 * ATC: Consumer Account
 * Password on Website::WebseitenPasswort123!"§!"§
 * 
 * @param {string} itemDescription Contains ATC info like above
 * 
 * @return {array} Array of name value pair objects
 */
PMUtil.parseAdditionalTestCredentials = function (itemDescription) {
    var AdditionalTestCredentials = {};
    if (itemDescription === undefined)
        return AdditionalTestCredentials;

    const descriptionLines = itemDescription.content.split("\n");
    const headerRegex = new RegExp('^ATC:\ *(.+)');
    const keyValueRegex = new RegExp('^\ *(.+)\ *::\ *(.+)\ *');
    var header = null;
    for (var i in descriptionLines) {
        const line = descriptionLines[i];

        headerMatches = line.match(headerRegex);
        // if line is like "ATC: Consumer Account"
        if (headerMatches !== null)
            header = headerMatches[1];
        // create key for header if it does not exist
        if (AdditionalTestCredentials[header] === undefined) {
            AdditionalTestCredentials[header] = [];
        }

        const atc = line.match(keyValueRegex);
        if (atc !== null && atc.length > 1) { // if line is like "Password on Website::PaSS123"
            const atcName = atc[1];
            const atcValue = atc[2];
            AdditionalTestCredentials[header].push({ name: atcName, value: atcValue });
        }
    }
    return AdditionalTestCredentials;
};


/**
 * Get folders info: structure/path of a given request body and folder description
 *
 * Walks through item tree of PM collection and returns path as array if found.
 * 
 * @param {string} body The request body before being sent by Postman.
 * @param {string} requestName Necessary for identical body in same folder.
 * 
 * @return {array} Array of path elements, e.g. ["Klarna", "SE", "Utils"]
 */
PMUtil.getFolderInfo = function (itemNumber) {
    var itemPath = [];
    var folderDescription;
    var _cnt = 0;
    var folderInfo = (i, path) => {
        for (var key in i) {
            var folder = i[key];
            if (folder.item !== undefined) {
                var _path = path.slice();
                _path.push(folder.name);
                if (folder.description !== undefined) folderDescription = folder.description;
                folderInfo(folder.item, _path);
            }
            else {
                _cnt++
                if (_cnt == itemNumber) {
                        itemPath = path;
                        return true;
                }
            }
        }
    };
    folderInfo(PMUtil.Collection.item, [], itemNumber);
    return {
        path_array: itemPath,
        folder_description: folderDescription
    };
};

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
    const paymentMethod = PMUtil.readPaymentMethod(args.request.body.raw);
    const transactionType = PMUtil.getTransactionType(args.request.body.raw);
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
    const requestBodySource = requestSource.body.raw; // body including unresolved {{variables}}
    const requestFolderInfo = PMUtil.getFolderInfo(_itemCounter);
    const requestFolderDescription = requestFolderInfo.folder_description;
    const requestFolderPathArray = requestFolderInfo.path_array;
    const requestFolderPathString = camelCase(requestFolderPathArray.join('_'));
    const requestBodySent = requestSent.body.raw;  // body that's actually sent with variables replaced

    if (requestBodySent.trim() == '') {
        process.stderr.write('[' + styleText('EMPTYREQ', 'cyan') + '] ' + requestFolderPathArray.join(' ') + ' -> ' + requestName + ': empty request body' + "\n");
        return false;
    }

    const requestBodyWeb = PMUtil.formatRequestForWeb(requestSent.body.raw);  // body that has no vars in them (for web display) except request id
    const requestContentType = PMUtil.getContentType(requestBodySent);
    const requestContentTypeAbbr = PMUtil.getContentType(requestBodySent, true);
    const paymentMethod = PMUtil.readPaymentMethod(requestBodySent);
    const paymentMethodName = requestFolderPathArray.join(' ');
    const transactionType = PMUtil.getTransactionType(requestBodySent);
    const transactionKey = requestFolderPathString + '_' + camelCase(requestName);
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
        process.stderr.write('[' + styleText('  FAIL  ', 'red') + '] ' + consoleString + ' FAILED. CONNECTION FAILED' + "\n");
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
        process.stderr.write('[' + styleText(firstResponseCodeOfEngine.toString(), 'yellow') + '] ' + requestFolderPathArray.join(' ') + ' -> ' + requestName + ' (invalid response: no status)' + "\n");
        return false;
    }
    if (firstResponseCodeOfEngine.length === 3) firstResponseCodeOfEngine = 'HTTP ' + firstResponseCodeOfEngine;
    const requestSuccessful = (responses) => {
        for (var i in responses) {
            var responseCode = parseInt(responses[i].code.toString().replace(/\./, ''));
            responseCode = responseCode < 999 ? responseCode * 10000 : responseCode; // bad request gives html and an integer like 400, not 400.0000 like engine
            if (responseCode === -1 || responseCode / 10000 >= 400) {
                return false;
            }
        }
        return true;
    };


    responseContentType = PMUtil.getContentType(responseBody);
    responseContentTypeAbbr = PMUtil.getContentType(responseBody, true);

    if (responseContentTypeAbbr !== requestContentTypeAbbr) {
        process.stderr.write('[' + styleText('WRONG-CT', 'magenta') + '] ' + consoleString + ': Response has different content-type than request' + "\n");
        return false;
    }

    process.stderr.write('[' + (requestSuccessful(engineStatusResponses) ? styleText(firstResponseCodeOfEngine, 'green') : styleText(firstResponseCodeOfEngine, 'red')) + '] ' + consoleString + "\n");

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
