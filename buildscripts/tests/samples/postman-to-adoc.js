/*
* Script given a postman collection creates asciidoc files with request, response
* source blocks and a metadata table.
*
* Parameters
* --file <postman-collection.json>       Optional. Uses hardcoded filename if unspecified.
*/

const newman = require('newman');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const xmlparser = require('fast-xml-parser');
const URLSearchParams = require('url').URLSearchParams;

const MIMETYPE_XML = 'application/xml';
const MIMETYPE_HTML = 'text/html';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_NVP = 'application/x-www-form-urlencoded;charset=UTF-8'
const TRANSACTIONSTATE_SUCCESS = 'success';
const TRANSACTIONCODE_SUCCESS = '201.0000';

const ELEMENT_TRANSACTION_TYPE = 'transaction_type';
const ELEMENT_PAYMENT_METHOD = 'payment_method';
const ELEMENT_TRANSACTION_ID = 'transaction_id';
const ELEMENT_CRYPTOGRAM_TYPE = 'cryptogram_type';
const ELEMENT_PARENT_TRANSACTION_ID = 'parent_transaction_id';
const ELEMENT_MERCHANT_ACCOUNT_ID = 'merchant_account_id';

const postmanCollectionFile = (argv['file'] === undefined) ? '00DOC.postman_collection.json' : argv['file'];

var PMUtil = {};

PMUtil.RequestsIndex = {};
PMUtil.RequestResponseIndex = {};
/**
* These are wrappers for readElementFromBody() to make code more writable/readable.
* Use the wrappers instead of PMUtil.readElementFromBody() wherever feasible.
*
* @param {string} body The request/response body sent or received by Postman.
* 
* @return {string} The element value.
*/
PMUtil.getTransactionID = (body) => PMUtil.readElementFromBody(ELEMENT_TRANSACTION_ID, body);
PMUtil.getTransactionType = (body) => PMUtil.readElementFromBody(ELEMENT_TRANSACTION_TYPE, body);
PMUtil.getParentTransactionID = (body) => PMUtil.readElementFromBody(ELEMENT_PARENT_TRANSACTION_ID, body);
PMUtil.getPaymentMethod = (body) => PMUtil.readElementFromBody(ELEMENT_PAYMENT_METHOD, body);
PMUtil.getMerchantAccountID = (body) => PMUtil.readElementFromBody(ELEMENT_MERCHANT_ACCOUNT_ID, body);
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
    cryptogram_type: {
        xml: ['payment', 'cryptogram', 'cryptogram-type'],
        json: ['payment', 'cryptogram', 'cryptogram-type'],
        nvp: 'cryptogram_type'
    },
    payment_method: {
        xml: ['payment', 'payment-methods', 'payment-method', '@_name'],
        json: ['payment', 'payment-methods', 'payment-method', 0, 'name'],
        nvp: 'payment_method'
    },
    transaction_id: {
        xml: ['payment', 'transaction-id'],
        json: ['payment', 'transaction-id'],
        nvp: 'transaction_id'
    },
    parent_transaction_id: {
        xml: ['payment', 'parent-transaction-id'],
        json: ['payment', 'parent-transaction-id'],
        nvp: 'parent_transaction_id'
    },
    transaction_type: {
        xml: ['payment', 'transaction-type'],
        json: ['payment', 'transaction-type'],
        nvp: 'transaction_type'
    },
    merchant_account_id: {
        xml: ['payment', 'merchant-account-id'],
        json: ['payment', 'merchant-account-id'],
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
 * Creates two source blocks, request and response with titles according to Payment Method, Transaction Type and Content Type
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
 * Writes .adoc file with table and code blocks for request, response and other info
 *
 * Creates table with general info on the request (is to be hidden by default in frontend)
 * Creates two source blocks, request and response with titles according to Payment Method, Transaction Type and Content Type
 * Request contains all Postman variables unsubstituted for integrators to copy&paste.
 *
 * @param {string} info Contains request and response body as well as metadata (status code, engine response, etc.)
 * 
 * @return Nothing.
 */
/*PMUtil.writeAdoc = function (info) {
    const fileExtension = '.adoc';
    const path = 'samples/adoc/';
    const paymentMethodBrandName = PMUtil.brandNameOfPaymentMethod(info.payment_method);
    const requestContentTypeAbbr = PMUtil.getContentType(info.request.body_source, type = 'short');
    const responseContentTypeAbbr = PMUtil.getContentType(info.response.body, type = 'short');
    const filename = info.payment_method + '_' + info.transaction_type + '_' + requestContentTypeAbbr;
    //const curlPayloadString = encodeURIComponent(info.request.body_source.replace('{{$guid}}', PMUtil.uuidv4()));
    //const curlString = "curl -u '" + info.request.username + ":" + info.request.password + "' -H \"" + info.request.content_type + '" -d "' + curlPayloadString + '" ' + info.request.endpoint;
    var statusesAdocTableCells = '';
    info.response.engine_status.forEach(s => {
        statusesAdocTableCells += `| Code        | ` + '``' + s.code + '``' + `
| Severity    | ` + '``' + s.severity + '``' + `
| Description | ` + '``' + s.description + '``' + `
`;
    });
    const fileContent = `
[.request-details]
.Request Details
[%autowidth, cols="1v,2", stripes="none"]
|===
2+| API Endpoint

e| Method | ` + info.request.method + `
e| URI    | ` + '``\\' + info.request.endpoint + '``' + `

2+h| Header
e| Content-type | \`` + info.request.content_type + `\`
e| Accept       | \`` + info.request.accept + `\`

2+h| Authentication
e| Type     | _HTTP Basic Authentication_
e| Username | \`` + info.request.username + `\`
e| Password | \`` + info.request.password + `\`
|===

.Request ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + requestContentTypeAbbr.toUpperCase() + `)
[source,` + requestContentTypeAbbr + `]
----
` + info.request.body_sent + `
----

---

[%autowidth, cols="1v,2", stripes="none"]
|===
2+| Transaction Results

` + statusesAdocTableCells + `
|===

.Response ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + responseContentTypeAbbr.toUpperCase() + `)
[source,` + responseContentTypeAbbr + `]
----
` + info.response.body + `
----
`;
    try {
        fs.writeFileSync(path + filename + fileExtension, fileContent);
    }
    catch (err) {
        throw err;
    }
}
*/

PMUtil.writeAdocSummary = function (RequestResponseIndex) {
    const fileExtension = '.adoc';
    const path = 'samples/adoc/';

    for (var r in RequestResponseIndex) {
        const paymentMethods = RequestResponseIndex[r];
        const paymentMethod = r;
        const paymentMethodBrandName = PMUtil.brandNameOfPaymentMethod(paymentMethod);
        for (var t in paymentMethods) {
            const transactionTypes = paymentMethods[t];
            const transactionType = t;
            const filename = paymentMethod + '_' + transactionType + fileExtension;
            var fileContent = `
[.sample-tabs]

== ` + paymentMethodBrandName + `: ` + transactionType;

            for (var c in transactionTypes) {
                const transaction = transactionTypes[c];
                var statusesAdocTableCells = '';
                transaction.response.engine_status.forEach(function (s, i) {
                    statusesAdocTableCells += `| Code        | ` + '``' + s.code + '``' + `
| Severity    | ` + '``' + s.severity + '``' + `
| Description | ` + '``' + s.description + '``' + `
`;                  // add divider between different status messages in response
                    if (transaction.response.engine_status.length > 1 && i < (transaction.response.engine_status.length - 1)) {
                        statusesAdocTableCells += '2+|' + "\n";
                    }
                });
                fileContent += `
[.tab-` + transaction.request.content_type_abbr + `]
=== ` + transaction.request.content_type_abbr.toUpperCase() + `

[.r-details]
.Request Details
[%autowidth, cols="1v,2", stripes="none"]
|===
2+| API Endpoint

e| Method | ` + transaction.request.method + `
e| URI    | ` + '``\\' + transaction.request.endpoint + '``' + `

2+h| Headers
e| Content-Type | \`` + transaction.request.content_type + `\`
e| Accept       | \`` + transaction.request.accept + `\`

2+h| Authentication
e| Type     | HTTP Basic Authentication
e| Username | \`` + transaction.request.username + `\`
e| Password | \`` + transaction.request.password + `\`
|===

.Request ` + paymentMethodBrandName + `: ` + transactionType + ` (` + transaction.request.content_type_abbr.toUpperCase() + `)
[source,` + transaction.request.content_type_abbr + `]
----
` + transaction.request.body_source + `
----

---

[.r-details]
.Response Details
[%autowidth, cols="1v,2", stripes="none"]
|===
2+| Transaction Results

| Content Type | \`` + transaction.response.content_type + `\`
` + statusesAdocTableCells + `
|===

.Response ` + paymentMethodBrandName + `: ` + transactionType + ` (` + transaction.response.content_type_abbr.toUpperCase() + `)
[source,` + transaction.response.content_type_abbr + `]
----
` + transaction.response.body + `
----
`;

            }
            fileContent += "\n";
            try {
                fs.writeFileSync(path + filename, fileContent);
            }
            catch (err) {
                throw err;
            }
        }
    }
}


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
    if (contentType == MIMETYPE_XML) {
        return PMUtil.formatXML(body);
    }
    if (contentType == MIMETYPE_JSON) {
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
PMUtil.readEngineResponse = function (body) {
    var statusResponse = [];
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_HTML:
            try {
                var obj = xmlparser.parse(body, {});
                statusResponse = [{
                    code: parseInt(obj.html.head.title.replace(/([0-9]+)\ .*/, '$1')),
                    description: obj.html.head.title.replace(/([0-9]+)\ (.*)/, '$2'),
                    severity: 'error'
                }];
            }
            catch (e) {
                console.log(body)
                console.log('readEngineResponse failed.')
                console.log(e);
                console.log(obj);
                console.log(statusResponse);
            }
            break;
        case MIMETYPE_XML:
            try {
                var obj = xmlparser.parse(body, { ignoreAttributes: false });
                statusResponse = [];
                var statuses = obj.payment.statuses.status;
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
                console.log('isXML');
                //console.log(body)
                console.log('readEngineResponse failed.')
                console.log(obj.payment.statuses);
            }
            break;
        case MIMETYPE_JSON:
            try {
                var obj = JSON.parse(body);
                obj.payment.statuses.status.forEach(status => {
                    statusResponse.push({
                        code: status.code,
                        description: status.description,
                        severity: status.severity
                    });
                });
            }
            catch (e) {
                console.log(body)
                console.log('readEngineResponse failed.')
                console.log(obj);
            }
            break;
        case MIMETYPE_NVP:
            // no NVP response from engine
            //Response = new URLSearchParams(body).get('merchant-account-id');
            break;
        default:
            console.log(body);
            console.log('in readEngineResponse: unknown content type');
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

/**
 * Reads element value from XML or JSON body if found and mapped in ElementNamesMap.
 *
 * @param {string} elementName Name or path of element whose value is to be returned.
 * @param {string} body Request body in which to look for the element.
 * 
 * @return {string} Value of the element or undefined if not found in ElementNamesMap.
 */
PMUtil.readElementFromBody = function (elementName, body) {
    const getElementByPath = function (e, obj) {
        return e.reduce((x, i) => (x && x[i]) ? x[i] : undefined, obj);
    }
    var elementValue = undefined;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, { ignoreAttributes: false });
            var e = PMUtil.ElementNamesMap[elementName].xml;
            e = Array.isArray(e) ? e : [e];
            elementValue = getElementByPath(e, obj);
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            var e = PMUtil.ElementNamesMap[elementName].json;
            e = Array.isArray(e) ? e : [e];
            elementValue = getElementByPath(e, obj);
            break;
        case MIMETYPE_NVP:
            var obj = new URLSearchParams(body);
            try {
                var e = PMUtil.ElementNamesMap[elementName].nvp;
            }
            catch (err) {
                console.log('NVP element ' + elementName + ' not found in ElementNamesMap');
                console.log(PMUtil.ElementNamesMap);
                return elementValue;
            }
            if (obj.get(e) !== null) {
                elementValue = obj.get(e);
            }
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
    console.log('looking for pid: ' + pid + ' in RequestsIndex');
    for (paymentMethod in PMUtil.RequestsIndex) {
        const pm = PMUtil.RequestsIndex[paymentMethod];
        for (transactionType in pm) {
            if (pm[transactionType].transaction_id === pid) {
                console.log('found it in ' + paymentMethod + ' -> ' + transactionType)
                return paymentMethod;
            }
        }
    }
    return undefined;
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
    return paymentMethod;
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
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, { ignoreAttributes: false });
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
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
 * @param {string} type Default 'full' returns the complete mime type, e.g. "application/xml". 'short' returns, e.g. "xml"
 * 
 * @return {string} contentType
 */
PMUtil.getContentType = function (body, type = 'full') {
    const isJSON = (body) => {
        try { JSON.parse(body); } catch (e) { return false; }
        return true;
    };
    const isNVP = (body) => {
        return (new URLSearchParams(body).get('request_id') !== null) ? true : false;
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
    else if (isNVP(body) === true) {
        contentType = MIMETYPE_NVP;
    }

    if (type == 'short') {
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

newman.run({
    collection: postmanCollectionFile,
    environment: {
        "parent-transaction-id": "123-123-123-123" // remove..
    }
}).on('start', function (err, args) { // on start of run, log to console
    console.log('Testing ' + postmanCollectionFile + '...');
}).on('beforeRequest', function (err, args) {
    // placeholder. not necessary for now.
}).on('request', function (err, args) {
    const item = args.item;
    const requestSource = item.request;
    const requestSent = args.request;
    const requestMethod = requestSource.method;
    const requestBodySource = requestSource.body.raw; // body including unresolved {{variables}}
    const requestBodySent = requestSent.body.raw;  // body that's actually sent with variables replaced
    const responseBody = PMUtil.formatResponse(args.response.stream.toString());
    const responseCodeHTTP = args.response.code;
    const responseOfEngine = PMUtil.readEngineResponse(responseBody);
    const requestContentType = PMUtil.getContentType(requestBodySent);
    const requestContentTypeAbbr = PMUtil.getContentType(requestBodySent, 'short');
    const paymentMethod = PMUtil.readPaymentMethod(requestBodySent);
    const transactionType = PMUtil.getTransactionType(requestBodySent);
    const parentTransactionID = PMUtil.getParentTransactionID(requestBodySent);
    const merchantAccountID = PMUtil.getMerchantAccountID(requestBodySent);
    const requestEndpoint = 'https://' + requestSent.url.host.join('.') + '/' + requestSent.url.path.join('/');
    const requestUsername = PMUtil.getAuth(requestSent).username;
    const requestPassword = PMUtil.getAuth(requestSent).password;
    const acceptHeader = PMUtil.getAcceptHeader(requestSource);

    var responseContentType;
    var responseContentTypeAbbr;
    var transactionID;
    if (responseCodeHTTP < 400) { // else there is no response element parsing possible
        responseContentType = PMUtil.getContentType(responseBody);
        responseContentTypeAbbr = PMUtil.getContentType(responseBody, 'short');
        transactionID = PMUtil.getTransactionID(responseBody);
    }

    if (typeof PMUtil.RequestsIndex[paymentMethod] === 'undefined') {
        PMUtil.RequestsIndex[paymentMethod] = [];
    }

    PMUtil.RequestsIndex[paymentMethod][transactionType] = {
        response_code: responseCodeHTTP,
        transaction_id: transactionID,
        parent_transaction_id: parentTransactionID
    }

    /*
    * Contains all necessary information to create the .adoc table and blocks.
    */
    const info = {
        payment_method: paymentMethod,
        transaction_type: transactionType,
        merchant_account_id: merchantAccountID,
        request: {
            body_source: requestBodySource,
            body_sent: requestBodySent,
            content_type: requestContentType,
            method: requestMethod,
            endpoint: requestEndpoint,
            username: requestUsername,
            password: requestPassword,
            accept: acceptHeader
        },
        response: {
            content_type: responseContentType,
            body: responseBody,
            http_status_code: responseCodeHTTP,
            engine_status: responseOfEngine
        }
    }

    //this global thing will replace local const info. remove const info later.
    if (typeof PMUtil.RequestResponseIndex[paymentMethod] === 'undefined') {
        PMUtil.RequestResponseIndex[paymentMethod] = {}; // array for sort order
    }
    if (typeof PMUtil.RequestResponseIndex[paymentMethod][transactionType] === 'undefined') {
        PMUtil.RequestResponseIndex[paymentMethod][transactionType] = {};
    }
    Object.assign(PMUtil.RequestResponseIndex[paymentMethod][transactionType], {
        [requestContentTypeAbbr]: {
            request: {
                content_type: requestContentType,
                content_type_abbr: requestContentTypeAbbr,
                body_source: requestBodySource,
                body_sent: requestBodySent,
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
                engine_status: responseOfEngine
            },
            transaction_id: transactionID,
            parent_transaction_id: parentTransactionID,
            success: true //TODO simple true/false for success. decide elsewhere which it is
        }

    });

    // TODO TODO TODO: decide on status code wether to write samples or not.
    // TODO TODO TODO: slack notifications...
    //PMUtil.writeAdoc(info);
}).on('done', function (err, summary) {
    if (err || summary.error) {
        console.error('collection run encountered an error.');
    }
    else {
        console.log('collection run completed.');
        //console.log(JSON.stringify(PMUtil.RequestResponseIndex, null, 2));
        //console.log(PMUtil.RequestResponseIndex);
    }
    console.log('writing adoc file');
    //console.log(PMUtil.RequestResponseIndex['creditcard']);
    PMUtil.writeAdocSummary(PMUtil.RequestResponseIndex);
});
