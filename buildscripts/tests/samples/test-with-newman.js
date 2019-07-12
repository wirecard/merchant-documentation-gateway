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

function writeAdoc(info) {
    const fileExtension = '.adoc';
    const path = 'samples/adoc/';
    const paymentMethodBrandName = brandNameOfPaymentMethod(info.payment_method);
    const contentTypeShort = PMUtil.getContentType(info.request.body_source, type='short');
    const filename = info.payment_method + '_' + info.transaction_type + '_' + contentTypeShort;
    const fileContent = `.Request ` + paymentMethodBrandName + `: ` + info.transaction_type + ` (` + contentTypeShort.toUpperCase() + `)
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

// response is always XML
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
    var transactionMethod = item.request.method;
    var requestBodySource = item.request.body.raw; // body including {{variable}}
    var requestBodyFinal = args.request.body.raw;  // body that's actually sent, with variables replaced
    var responseBody = PMUtil.formatXML(args.response.stream.toString());
    var responseCode = args.response.code;
    var contentType = PMUtil.getContentType(requestBodyFinal);
    var transactionID = PMUtil.readTransactionID(responseBody);
    var paymentMethod = PMUtil.readPaymentMethod(requestBodyFinal);
    var transactionType = PMUtil.readTransactionType(requestBodyFinal);
    var parentTransactionID = PMUtil.readParentTransactionID(requestBodyFinal);
    var requestName = PMUtil.getName(requestBodyFinal);

    if (typeof PMUtil.RequestsIndex[paymentMethod] === 'undefined') {
        PMUtil.RequestsIndex[paymentMethod] = [];
    }

    PMUtil.RequestsIndex[paymentMethod][transactionType] = {
        response_code: responseCode,
        transaction_id: transactionID,
        parent_transaction_id: parentTransactionID
    }

    const info = {
        request_name: requestName,
        payment_method: paymentMethod,
        transaction_type: PMUtil.readTransactionType(requestBodyFinal, contentType),
        transaction_method: transactionMethod,
        request: {
            body_source: requestBodySource,
            body_final: requestBodyFinal,
            content_type: contentType
        },
        response: {
            body: responseBody,
            code: responseCode
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
