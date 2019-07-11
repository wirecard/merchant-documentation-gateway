const newman = require('newman');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const xmlparser = require('fast-xml-parser');

const NO_TRANSACTION_ID = 'none';
const NO_PAYMENT_METHOD = 'none';
const MIMETYPE_XML = 'application/xml';
const MIMETYPE_JSON = 'application/json';
const TRANSACTIONSTATE_SUCCESS = 'success';
const TRANSACTIONCODE_SUCCESS = '201.0000';

function writeAdoc(info) {
    const fileExtension = '.adoc';
    const path = 'samples/adoc/';
    const contentTypeShort = info.request.content_type.replace(/.+\//, '');
    const filename = info.payment_method + '-' + info.transaction_type + '-' + contentTypeShort;
    const fileContent = `.Request ` + info.payment_method + `: ` + info.transaction_type + ` (` + contentTypeShort + `)
[source,` + contentTypeShort + `]
----
` + info.request.body + `
----

.Response ` + info.payment_method + `: ` + info.transaction_type + ` (` + contentTypeShort + `)
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

var PMUtil = {};
PMUtil.RequestsIndex = {};
// response is always XML
PMUtil.getTransactionID = function (body) {
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
        default:
            //transactionID = body.replace(/(^|&)transaction_id=(?<tid>[\w-]+)($|&)/, '$<tid>')
            console.log('unknown content-type ' + contentType);
            break;
    }
    return transactionID;
};

PMUtil.getParentTransactionID = function (requestName) {
    if (typeof PMUtil.RequestsIndex[requestName] === 'undefined') {
        return NO_TRANSACTION_ID;
    }
    return PMUtil.RequestsIndex[requestName].parent_transaction_id;
};

PMUtil.getTransactionType = function (body) {
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
        default:
            //transactionType = body.replace(/(^|&)transaction_type=(?<tt>[\w-]+)($|&)/, '$<tt>')
            console.log('unknown content-type ' + contentType);
            break;
    }
    return transactionType;
};

PMUtil.getParentPaymentMethod = function (requestName) {
  const pid = PMUtil.getParentTransactionID(requestName);
  for (request in PMUtil.RequestsIndex) {
      if (PMUtil.RequestsIndex[request].transaction_id == pid) {
          return PMUtil.RequestsIndex[request].payment_method;
      }
  }
  return NO_PAYMENT_METHOD;
}

PMUtil.getPaymentMethod = function (body) {
    var paymentMethod;
    const contentType = PMUtil.getContentType(body);
    switch (contentType) {
        case MIMETYPE_XML:
            var obj = xmlparser.parse(body, { ignoreAttributes: false });
            try {
                paymentMethod = obj.payment['payment-methods']['payment-method']['@_name'];
            }
            catch (err) {
                const requestName = PMUtil.getName(body);
                //console.log('pm not found. therefore "' + requestName + '" must have a parent id. looking for request in table');
                paymentMethod = PMUtil.getParentPaymentMethod(requestName);
                //console.log('pm is found: ' + paymentMethod);
            }
            break;
        case MIMETYPE_JSON:
            var obj = JSON.parse(body);
            paymentMethod = obj.payment['payment-methods']['payment-method'][0]['name'];
            break;
        default:
            //paymentMethod = body.replace(/(^|&)payment_method=(?<pm>[\w-]+)($|&)/, '$<pm>')
            console.log('unknown content-type ' + contentType);
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
        default:
            console.log('unknown content-type');
            console.log('attempt NVP for body:');
            console.log(body);
            var obj = new URLSearchParams(body);
            break;
    }
    return (typeof obj[elementName] !== 'undefined');
};

PMUtil.bodyInjectElementValue = function (requestBody, elementName, elementValue) {
    return body;
};

PMUtil.getName = function (body) {
    const paymentMethod = 'moo'; // do not use getPaymentMethod because recursion...
    const transactionType = PMUtil.getTransactionType(body);
    return paymentMethod + transactionType;
};

PMUtil.getContentType = function (body) {
    var contentType;
    var isJson = (body) => {
        try { JSON.parse(body); } catch (e) { return false; }
        return true;
    };
    switch (true) {
        case xmlparser.validate(body):
            contentType = MIMETYPE_XML;
            break;
        case isJson(body):
            contentType = MIMETYPE_JSON;
            break;
        default:
            break;
    }
    return contentType;
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
    var requestBody = item.request.body.raw;
    var responseBody = args.response.stream.toString();
    var responseCode = args.response.code;
    var contentType = PMUtil.getContentType(requestBody);
    var transactionID = PMUtil.getTransactionID(responseBody);
    var paymentMethod = PMUtil.getPaymentMethod(requestBody);
    var requestName = PMUtil.getName(requestBody);
    var parentTransactionID = PMUtil.getParentTransactionID(requestName);

    PMUtil.RequestsIndex[requestName] = {
        payment_method: paymentMethod,
        response_code: responseCode,
        transaction_id: transactionID,
        parent_transaction_id: parentTransactionID
    }

    const info = {
        request_name: requestName,
        payment_method: paymentMethod,
        transaction_type: PMUtil.getTransactionType(requestBody, contentType),
        transaction_method: transactionMethod,
        request: {
            body: requestBody,
            content_type: contentType
        },
        response: {
            body: responseBody,
            code: responseCode
        }
    }

    writeAdoc(info);
    //console.log(info);
}).on('done', function (err, summary) {
    if (err || summary.error) {
        console.error('collection run encountered an error.');
    }
    else {
        console.log('collection run completed.');
        //console.log(summary);
    }
});
