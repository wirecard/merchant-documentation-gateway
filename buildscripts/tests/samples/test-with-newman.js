/*
* Script given a postman collection creates asciidoc files with request, response
* source blocks and a metadata table (to be hidden by default, opens onClick in frontend).
*
* Parameters
* --file <postman-collection.json>       Optional. Uses hardcoded filename if unspecified.
*/

const newman = require('newman');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const xmlparser = require('fast-xml-parser');
const URLSearchParams = require('url').URLSearchParams;

const NO_TRANSACTION_ID = 'none';
const NO_PAYMENT_METHOD = 'none';
const MIMETYPE_XML = 'application/xml';
const MIMETYPE_HTML = 'text/html';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_NVP = 'application/x-www-form-urlencoded;charset=UTF-8'
const TRANSACTIONSTATE_SUCCESS = 'success';
const TRANSACTIONCODE_SUCCESS = '201.0000';

const ELEMENT_TRANSACTION_TYPE = 'transaction_type';
const ELEMENT_TRANSACTION_ID = 'transaction_id';
const ELEMENT_CRYPTOGRAM_TYPE = 'cryptogram_type';
const ELEMENT_PARENT_TRANSACTION_ID = 'parent_transaction_id';
const ELEMENT_MERCHANT_ACCOUNT_ID = 'merchant_account_id';

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
function writeAdoc(info) {
    const fileExtension = '.adoc';
    const path = 'samples/adoc/';
    const paymentMethodBrandName = PMUtil.brandNameOfPaymentMethod(info.payment_method);
    const requestContentTypeShort = PMUtil.getContentType(info.request.body_source, type = 'short');
    const responseContentTypeShort = PMUtil.getContentType(info.response.body, type = 'short');
    const filename = info.payment_method + '_' + info.transaction_type + '_' + requestContentTypeShort;
    //const curlPayloadString = encodeURIComponent(info.request.body_source.replace('{{$guid}}', PMUtil.uuidv4()));
    //const curlString = "curl -u '" + info.request.username + ":" + info.request.password + "' -H \"" + info.request.content_type + '" -d "' + curlPayloadString + '" ' + info.request.endpoint;
    const fileContent = `
[.request-details]
.Request Details
[%autowidth, cols="1v,2", stripes="none"]
|===
2+| API Endpoint

| Method | ` + info.request.method + `
| URI    | ` + '``\\' + info.request.endpoint + '``' + `

2+| Header
| content-type | \`` + info.request.content_type + `\`
| accept       | \`` + info.request.accept + `\`

2+h| Authentication
| Type     | _HTTP Basic Authentication_
| Username | \`` + info.request.username + `\`
| Password | \`` + info.request.password + `\`
|===

.Request ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + requestContentTypeShort.toUpperCase() + `)
[source,` + requestContentTypeShort + `]
----
` + info.request.body_source + `
----

.Response ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + responseContentTypeShort.toUpperCase() + `)
[source,` + responseContentTypeShort + `]
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

var PMUtil = {};

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
    if (typeof request.headers.reference.accept !== 'undefined') {
        return request.headers.reference.accept.value;
    }
    return MIMETYPE_XML;
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
    var BrandNamesMap = {
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
 * Prettifies XML and JSON bodies
 *
 * @param {string} body String that contains the body.
 * 
 * @return {string} Returns prettified body if JSON or XML, else returns body unmodified.
 */
PMUtil.formatResponse = function (body) {
    var contentType = PMUtil.getContentType(body);
    if (contentType == MIMETYPE_XML) {
        return PMUtil.formatXML(body);
    }
    if (contentType == MIMETYPE_JSON) {
        return PMUtil.formatJSON(body);
    }
    return body;
};

/**
 * Get username and password of basic authentication.
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
    catch (e) {
        console.log('getAuth: no username and password found.');
    }
    return Auth;
};


PMUtil.RequestsIndex = {};
/**
 * Reads the API engine response status code, description and severity from response body.
 *
 * Maps the parsed XML to an object and returns the object (to be used )
 *
 * @param {string} pm String that is found in the request or response body indicating the Payment Method.
 * 
 * @return {string} Brand name of the Payment Method if available or pm input if not.
 */
PMUtil.readEngineResponse = function (body) {
    var Response = {};
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_HTML:
            try {
                var obj = xmlparser.parse(body, { ignoreAttributes: false });
                Response = {
                    code: parseInt(obj.html.head.title.replace(/([0-9]+)\ .*/,'$1')),
                    description: obj.html.head.title.replace(/([0-9]+)\ (.*)/,'$2'),
                    severity: 'error'
                };
                console.log('content type html');
                console.log(Response);
            }
            catch (e) {
                console.log(body)
                console.log('readEngineResponse failed.')
                console.log(obj);
            }
            break;
        case MIMETYPE_XML:
            try {
                var obj = xmlparser.parse(body, { ignoreAttributes: false });
                Response = {
                    code: obj.payment.statuses.status['@_code'],
                    description: obj.payment.statuses.status['@_description'],
                    severity: obj.payment.statuses.status['@_severity']
                };
            }
            catch (e) {
                console.log(body)
                console.log('readEngineResponse failed.')
                console.log(obj);
            }
            break;
        case MIMETYPE_JSON:
            try {
                var obj = JSON.parse(body);
                Response = {
                    code: obj.payment.statuses.status[0].code,
                    description: obj.payment.statuses.status[0].description,
                    severity: obj.payment.statuses.status[0].severity
                };
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
    return Response;
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

// TODO needs to be adapted for NVP!
// then replace the obsolete readTransactionType, etc.
PMUtil.ElementNamesMap = {
    cryptogram_type: {
        xml: 'cryptogram-type',
        json: 'cryptogram-type',
        nvp: 'cryptogram_type'
    },
    transaction_id: {
        xml: 'transaction-id',
        json: 'transaction-id',
        nvp: 'transaction_id'
    },
    parent_transaction_id: {
        xml: 'parent-transaction-id',
        json: 'parent-transaction-id',
        nvp: 'parent_transaction_id'
    },
    parent_transaction_id: {
        xml: 'parent-transaction-id',
        json: 'parent-transaction-id',
        nvp: 'parent_transaction_id'
    },
    transaction_type: {
        xml: 'transaction-type',
        json: 'transaction-type',
        nvp: 'transaction_type'
    },
    merchant_account_id: {
        xml: 'merchant-account-id',
        json: 'merchant-account-id',
        nvp: 'merchant_account_id'
    }
};

/**
 * Reads element value from XML or JSON body if found and mapped in ElementNamesMap.
 *
 * @param {string} elementName Name of element whose value is to be returned.
 * @param {string} body Request body in which to look for the element.
 * 
 * @return {string} Value of the element or undefined if not found in ElementNamesMap.
 */
PMUtil.readElementFromBody = function (elementName, body) {
    var elementValue = undefined;
    var contentType = PMUtil.getContentType(body);
    var e = undefined;
    switch (contentType) {
        case MIMETYPE_XML:
            try {
                e = PMUtil.ElementNamesMap[elementName].xml;
            }
            catch (err) {
                console.log('XML element ' + elementName + ' not found in ElementNamesMap');
                console.log(PMUtil.ElementNamesMap);
                return elementValue;
            }
            var obj = xmlparser.parse(body, {});
            if (typeof obj.payment[e] !== 'undefined') {
                elementValue = obj.payment[e];
            }
            break;
        case MIMETYPE_JSON:
            try {
                e = PMUtil.ElementNamesMap[elementName].json;
            }
            catch (err) {
                console.log('JSON element ' + elementName + ' not found in ElementNamesMap');
                console.log(PMUtil.ElementNamesMap);
                return elementValue;
            }
            var obj = JSON.parse(body);
            if (typeof obj.payment[e] !== 'undefined') {
                elementValue = obj.payment[e];
            }
            break;
        case MIMETYPE_NVP:
            try {
                e = PMUtil.ElementNamesMap[elementName].nvp;
            }
            catch (err) {
                console.log('NVP element ' + elementName + ' not found in ElementNamesMap');
                console.log(PMUtil.ElementNamesMap);
                return elementValue;
            }
            var obj = new URLSearchParams(body);
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
    const pid = PMUtil.readElementFromBody(ELEMENT_PARENT_TRANSACTION_ID, body);
    console.log('looking for pid: ' + pid);
    for (paymentMethod in PMUtil.RequestsIndex) {
        const pm = PMUtil.RequestsIndex[paymentMethod];
        for (transactionType in pm) {
            if (pm[transactionType].transaction_id === pid) {
                return paymentMethod;
            }
        }
    }
    return undefined;
};

/**
 * Reads the Secondary Payment Method of a given request or response body.
 * 
 * Some have "creditcard" as payment method but are e.g. Google Pay.
 * For these cases the cryptogram value is returned.
 *
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} cryptogram-type, e.g. 'google-pay' or undefined
 */
PMUtil.readSecondaryPaymentMethod = function (body) {
    var secondaryPaymentMethod = undefined;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            try {
                var obj = xmlparser.parse(body, { ignoreAttributes: false });
                secondaryPaymentMethod = obj.payment['cryptogram'][PMUtil.ElementNamesMap[ELEMENT_CRYPTOGRAM_TYPE].xml];
            }
            catch (e) { }
            break;
        case MIMETYPE_JSON:
            try {
                var obj = JSON.parse(body);
                secondaryPaymentMethod = obj.payment['cryptogram'][PMUtil.ElementNamesMap[ELEMENT_CRYPTOGRAM_TYPE].json];
            }
            catch (e) { }
            break;
        case MIMETYPE_NVP:
            secondaryPaymentMethod = new URLSearchParams(body).get(PMUtil.ElementNamesMap[ELEMENT_CRYPTOGRAM_TYPE].nvp);
            // get returns null if not found. we want undefined.
            secondaryPaymentMethod = (secondaryPaymentMethod == null) ? undefined : secondaryPaymentMethod;
            break;
        default:
            console.log('readSecondaryPaymentMethod: unknown content-type ' + contentType);
            console.log(body);
            break;
    }
    if (secondaryPaymentMethod !== undefined) {
        console.log(body);
        console.log('cryptogram-type found: ' + secondaryPaymentMethod);
    }
    return secondaryPaymentMethod;
};

/**
 * Reads the Payment Method of a given request or response body.
 * 
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} The Payment Method of the request/response sample.
 */
PMUtil.readPaymentMethod = function (body) {
    var secondaryPaymentMethod = PMUtil.readSecondaryPaymentMethod(body);
    if (secondaryPaymentMethod !== undefined) {
        // returns 'google-pay', we can skip and return the found 2ndary pm
        return secondaryPaymentMethod;
    }
    var paymentMethod;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, { ignoreAttributes: false });
            try {
                paymentMethod = obj.payment['payment-methods']['payment-method']['@_name'];
            }
            catch (err) {
                paymentMethod = PMUtil.getParentPaymentMethod(body);
            }
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            paymentMethod = obj.payment['payment-methods']['payment-method'][0]['name'];
            break;
        case MIMETYPE_NVP:
            paymentMethod = new URLSearchParams(body).get('payment_method');
            break;
        default:
            console.log('readPaymentMethod: unknown content-type ' + contentType);
            console.log(body);
            break;
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

PMUtil.getName = function (body) {
    // TODO TODO TODO. is this still necessary? or use readTransactionType instead
    // try: search&replace PMUtil.getName with PMUtil.readTransactionType
    const paymentMethod = ''; // do not use getPaymentMethod because recursion...
    const transactionType = PMUtil.readElementFromBody(ELEMENT_TRANSACTION_TYPE, body);
    return paymentMethod + transactionType;
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
    const ContentTypeShort = {
        [MIMETYPE_XML]: 'xml',
        [MIMETYPE_JSON]: 'json',
        [MIMETYPE_NVP]: 'nvp',
        [MIMETYPE_HTML]: 'html'
    };

    var isJSON = (body) => {
        try { JSON.parse(body); } catch (e) { return false; }
        return true;
    };
    var isNVP = (body) => {
        if (new URLSearchParams(body).get('request_id') !== null) {
            return true;
        }
        else {
            return false;
        }
    };

    var isXML = (body) => {
        return (xmlparser.validate(body) === true);
    };

    var isHTML = (body) => {
        if( xmlparser.validate(body) === true ) {
           var htmlObj = xmlparser.parse(body, { ignoreAttributes: false });
           return ( htmlObj.html !== undefined );
        }
        return false;
    };

    if (isXML(body) === true) {
        contentType = MIMETYPE_XML;
    }
    if (isHTML(body) === true) {
        contentType = MIMETYPE_HTML;
    }
    else if (isJSON(body) === true) {
        contentType = MIMETYPE_JSON;
    }
    else if (isNVP(body) === true) {
        contentType = MIMETYPE_NVP;
    }

    if (type == 'short') {
        return ContentTypeShort[contentType];
    } else {
        return contentType;
    }
};

// obsolete?
PMUtil.getTransactionStatus = function (body) {
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, { ignoreAttributes: false });
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            break;
        default:
            var obj = new URLSearchParams(body);
            break;
    }
    return {
        status_codes: obj['statuses'],
        state: obj['transaction-state']
    };
};

PMUtil.transactionHasFailed = function (body) {
    const TransactionStatus = PMUtil.getTransactionStatus(body);
    return (TransactionStatus['transaction-state'] !== TRANSACTIONCODE_SUCCESS)
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

var postmanCollectionFile = '00DOC.postman_collection.json';
if (argv['file'] !== undefined) postmanCollectionFile = argv['file'];

var RequestResponseIndex = {};

newman.run({
    collection: postmanCollectionFile,
    environment: {
        "parent-transaction-id": "123-123-123-123" // remove..
    }
}).on('start', function (err, args) { // on start of run, log to console
    console.log('Testing ' + postmanCollectionFile + '...');
}).on('beforeRequest', function (err, args) {
    /*
        var request = args.request;
        // inject transaction id of parent to parent-transaction id here before request is sent!
        var item = args.item;
        var requestBody = item.request.body.raw;
        console.log('moooo');
    
        var requestName = PMUtil.getName(requestBody);
    
        if (PMUtil.bodyHasElement(requestBody, 'parent-transaction-id')) {
            var parentTransactionID = PMUtil.getParentTransactionID(requestName);
            requestBody = PMUtil.bodyInjectElementValue(requestBody, 'parent-transaction-id', parentTransactionID);
        }
        */
}).on('request', function (err, args) {
    const item = args.item;
    const requestMethod = item.request.method;
    const requestBodySource = item.request.body.raw; // body including unresolved {{variables}}
    const requestBodyFinal = args.request.body.raw;  // body that's actually sent with variables replaced
    const responseBody = PMUtil.formatResponse(args.response.stream.toString());
    const responseCodeHTTP = args.response.code;
    const responseOfEngine = PMUtil.readEngineResponse(responseBody);
    const requestContentType = PMUtil.getContentType(requestBodyFinal);
    const requestContentTypeShort = PMUtil.getContentType(requestBodyFinal, 'short');
    const paymentMethod = PMUtil.readPaymentMethod(requestBodyFinal);
    const transactionType = PMUtil.readElementFromBody(ELEMENT_TRANSACTION_TYPE, requestBodyFinal);
    const parentTransactionID = PMUtil.readElementFromBody(ELEMENT_PARENT_TRANSACTION_ID, requestBodyFinal);
    const merchantAccountID = PMUtil.readElementFromBody(ELEMENT_MERCHANT_ACCOUNT_ID, requestBodyFinal);
    const requestName = PMUtil.getName(requestBodyFinal);
    const requestEndpoint = 'https://' + args.request.url.host.join('.') + '/' + args.request.url.path.join('/');
    const requestUsername = PMUtil.getAuth(args.request).username;
    const requestPassword = PMUtil.getAuth(args.request).password;
    const acceptHeader = PMUtil.getAcceptHeader(item.request);

    var responseContentType;
    var transactionID;
    if( responseCodeHTTP < 400 ) { // else there is no response element parsing possible
        responseContentType = PMUtil.getContentType(responseBody);
        transactionID = PMUtil.readElementFromBody(ELEMENT_TRANSACTION_ID, responseBody);
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
        request_name: requestName,
        payment_method: paymentMethod,
        transaction_type: transactionType,
        request: {
            body_source: requestBodySource,
            body_final: requestBodyFinal,
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
    if (typeof RequestResponseIndex[paymentMethod] === 'undefined') {
        RequestResponseIndex[paymentMethod] = []; // array for sort order
    }
    // RequestResponseIndex['paypal']['debit']['xml']
    RequestResponseIndex[paymentMethod].push({
        [transactionType]: {
            [requestContentTypeShort]: {
                request: {
                    content_type: requestContentType,
                    body_source: requestBodySource,
                    body_final: requestBodyFinal,
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
        }
    });

    // TODO TODO TODO: decide on status code wether to write samples or not.
    // TODO TODO TODO: slack notifications...
    writeAdoc(info);
}).on('done', function (err, summary) {
    if (err || summary.error) {
        console.error('collection run encountered an error.');
    }
    else {
        console.log('collection run completed.');
        //console.log(JSON.stringify(RequestResponseIndex, null, 2));
    }
});
