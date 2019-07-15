const newman = require('newman');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const xmlparser = require('fast-xml-parser');
const URLSearchParams = require('url').URLSearchParams;

const NO_TRANSACTION_ID = 'none';
const NO_PAYMENT_METHOD = 'none';
const MIMETYPE_XML = 'application/xml';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_NVP = 'application/x-www-form-urlencoded;charset=UTF-8'
const TRANSACTIONSTATE_SUCCESS = 'success';
const TRANSACTIONCODE_SUCCESS = '201.0000';

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
    const paymentMethodBrandName = brandNameOfPaymentMethod(info.payment_method);
    const contentTypeShort = PMUtil.getContentType(info.request.body_source, type='short');
    const filename = info.payment_method + '_' + info.transaction_type + '_' + contentTypeShort;
    const fileContent = `
[.request-details]
.Request Details
[%autowidth, cols="1v,2", stripes="none"]
|===
2+| API Endpoint

| Method | ` + info.request.method + `
| URI    | ` + '``\\' + info.request.endpoint + '``' + `
| Content Type | \`` + info.request.content_type + `\`

2+h| Authentication
| Type | _HTTP Basic Authentication_
| Username | \`` + info.request.username + `\`
| Password | \`` + info.request.password + `\`
|===

.Request ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + contentTypeShort.toUpperCase() + `)
[source,` + contentTypeShort + `]
----
` + info.request.body_source + `
----

.Response ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + contentTypeShort.toUpperCase() + `)
[source,` + contentTypeShort + `]
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
var brandNameOfPaymentMethod = function (pm) {
    var BrandNamesMap = {
        'alipay-xborder': 'Alipay Cross-border',
        'bancontact': 'Bancontact',
        'boleto': 'Boleto',
        'carrier-billing': 'Carrier Billing',
        'creditcard': 'Credit Card',
        'eps': 'eps-Überweisung',
        'giropay': 'giropay',
        'sepacredit': 'SEPA Direct Debit'
    };
    if (typeof BrandNamesMap[pm] !== 'undefined') {
        return BrandNamesMap[pm];
    }
    else {
        return pm;
    }
}

var PMUtil = {};
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
PMUtil.readEngineResponse = function(body) {
    var obj = xmlparser.parse(body, { ignoreAttributes: false });
    return {
        code: obj.payment.statuses.status['@_code'],
        description: obj.payment.statuses.status['@_description'],
        severity: obj.payment.statuses.status['@_severity']
    }
}

/**
 * Reads the transaction ID from XML body.
 * Other Content Types prepared but not used.
 *
 * @param {string} body Response body sent or received by Postman.
 * 
 * @return {string} Transaction ID field value found in XML body.
 */
PMUtil.readTransactionID = function (body) {
    var transactionID = NO_TRANSACTION_ID;
    var contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, {});
            if (typeof obj.payment['transaction-id'] !== 'undefined') {
                transactionID = obj.payment['transaction-id'];
            }
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            transactionID = obj.payment['transaction-id']
            break;
        case MIMETYPE_NVP:
            transactionID = new URLSearchParams(body).get('transaction-id');
            break;
        default:
            console.log('in readTransactionID: unknown content type');
            break;
    }
    return transactionID;
};

PMUtil.getParentTransactionID = function (requestName) {

    // TODO TODO TODO

    /*
    if (typeof PMUtil.RequestsIndex[requestName] === 'undefined') {
        return NO_TRANSACTION_ID;
    }
    return PMUtil.RequestsIndex[requestName].parent_transaction_id;
    */
};

/**
 * Reads the Parent Transaction ID from request/response body.
 *
 * @param {string} body If request: the actual request body sent by Postman with all variables replaced.
 * 
 * @return {string} Parent Transaction ID field value found in body.
 */
PMUtil.readParentTransactionID = function (body) {
    var parentTransactionID;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, {});
            parentTransactionID = obj.payment['parent-transaction-id'];
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            parentTransactionID = obj.payment['parent-transaction-id']
            break;
        case MIMETYPE_NVP:
            parentTransactionID = new URLSearchParams(body).get('parent-transaction-id');
            break;
        default:
            console.log('in readParentTransactionID: unknown content type');
            break;
    }
    return parentTransactionID;
};

/**
 * Reads the Transaction Type from request/response body.
 *
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} Transaction ID field value found in body.
 */
PMUtil.readTransactionType = function (body) {
    var transactionType;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, {});
            transactionType = obj.payment['transaction-type'];
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            transactionType = obj.payment['transaction-type']
            break;
        case MIMETYPE_NVP:
            transactionType = new URLSearchParams(body).get('transaction_type');
            break;
        default:
            console.log('readTransactionType: unknown content-type ' + contentType);
            console.log(body);
            break;
    }
    return transactionType;
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
    const pid = PMUtil.readParentTransactionID(body);
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
}

/**
 * Reads the Payment Method of a given request or response body.
 *
 * @param {string} body The request/response body sent or received by Postman.
 * 
 * @return {string} The Payment Method of the request/response sample.
 */
PMUtil.readPaymentMethod = function (body) {
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
    const transactionType = PMUtil.readTransactionType(body);
    return paymentMethod + transactionType;
};

/**
 * Determines the Content Type of a given request/response body.
 *
 * @param {string} body The request/response body sent or received by Postman.
 * @param {string} type If specified as 'full' returns the complete mime type, e.g. "application/xml". Else the shorthand, e.g. "xml"
 * 
 * @return {string} contentType
 */
PMUtil.getContentType = function (body, type='full') {
    const ContentTypeShort = {
        [MIMETYPE_XML]: 'xml',
        [MIMETYPE_JSON]: 'json',
        [MIMETYPE_NVP]: 'nvp'
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

    if (isXML(body) === true) {
        contentType = MIMETYPE_XML;
    }
    else if (isJSON(body) === true) {
        contentType = MIMETYPE_JSON;
    }
    else if (isNVP(body) === true) {
        contentType = MIMETYPE_NVP;
    }

    if(type == 'short') {
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

newman.run({
    collection: '00DOC.postman_collection.json',
    environment: {
        "parent-transaction-id": "123-123-123-123"
    }
}).on('start', function (err, args) { // on start of run, log to console
    console.log('running a collection...');
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
    var item = args.item;
    var requestMethod = item.request.method;
    var requestBodySource = item.request.body.raw; // body including {{variable}}
    var requestBodyFinal = args.request.body.raw;  // body that's actually sent, with variables replaced
    var responseBody = PMUtil.formatXML(args.response.stream.toString());
    var responseCodeHTTP = args.response.code;
    var responseOfEngine = PMUtil.readEngineResponse(responseBody);
    var contentType = PMUtil.getContentType(requestBodyFinal);
    var transactionID = PMUtil.readTransactionID(responseBody);
    var paymentMethod = PMUtil.readPaymentMethod(requestBodyFinal);
    var transactionType = PMUtil.readTransactionType(requestBodyFinal);
    var parentTransactionID = PMUtil.readParentTransactionID(requestBodyFinal);
    var requestName = PMUtil.getName(requestBodyFinal);
    var requestEndpoint = 'https://' + args.request.url.host.join('.') + '/' + args.request.url.path.join('/');
    var requestUsername = args.request.auth.basic.reference.username.value;
    var requestPassword = args.request.auth.basic.reference.password.value;

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
        transaction_type: PMUtil.readTransactionType(requestBodyFinal, contentType),
        request: {
            body_source: requestBodySource,
            body_final: requestBodyFinal,
            content_type: contentType,
            method: requestMethod,
            endpoint: requestEndpoint,
            username: requestUsername,
            password: requestPassword
        },
        response: {
            body: responseBody,
            http_status_code: responseCodeHTTP,
            engine_status: responseOfEngine
        }
    }

    writeAdoc(info);
}).on('done', function (err, summary) {
    if (err || summary.error) {
        console.error('collection run encountered an error.');
    }
    else {
        console.log('collection run completed.');
    }
});
