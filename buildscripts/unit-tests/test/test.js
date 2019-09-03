const assert = require('assert');
const PMUtil = require('../../tests/samples/postman-to-adoc/modules/pmutil.js');

describe('getTransactionID from requests and responses', function () {
    describe('getTransactionID from XML response', function () {
        it('getTransactionID(bodyResponseXML) should equal 6738403b-b234-40a3-ae54-7f32e425ade7', function () {
            assert.deepEqual(PMUtil.getTransactionID(bodyResponseXML), '6738403b-b234-40a3-ae54-7f32e425ade7');
        })
    })
    describe('getTransactionID from JSON response', function () {
        it('getTransactionID(bodyResponseJSON) should equal f433f3f4-2bd2-4942-a627-58ee44814e0f', function () {
            assert.deepEqual(PMUtil.getTransactionID(bodyResponseJSON), 'f433f3f4-2bd2-4942-a627-58ee44814e0f');
        })
    })
    describe('getTransactionID from NVP response', function () {
        it('getTransactionID(bodyResponseNVP) should equal 5699de97-3be1-4f66-8edc-71cbfffaa53d', function () {
            assert.deepEqual(PMUtil.getTransactionID(bodyResponseNVP), '5699de97-3be1-4f66-8edc-71cbfffaa53d');
        })
    })
});

describe('getTransactionType from requests and responses', function () {
    describe('getTransactionType from XML response', function () {
        it('getTransactionType(bodyResponseXML) should equal refund-debit', function () {
            assert.deepEqual(PMUtil.getTransactionType(bodyResponseXML), 'refund-debit');
        })
    })
    describe('getTransactionType from JSON response', function () {
        it('getTransactionType(bodyResponseJSON) should equal refund-debit', function () {
            assert.deepEqual(PMUtil.getTransactionType(bodyResponseJSON), 'refund-debit');
        })
    })
    describe('getTransactionType from NVP response', function () {
        it('getTransactionType(bodyResponseNVP) should equal get-url', function () {
            assert.deepEqual(PMUtil.getTransactionType(bodyResponseNVP), 'get-url');
        })
    })
});

const bodyResponseXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<payment xmlns="http://www.elastic-payments.com/schema/payment" self="https://api-test.wirecard.com:443/engine/rest/merchants/47cd4edf-b13c-4298-9344-53119ab8b9df/payments/6738403b-b234-40a3-ae54-7f32e425ade7">
    <merchant-account-id ref="https://api-test.wirecard.com:443/engine/rest/config/merchants/47cd4edf-b13c-4298-9344-53119ab8b9df">47cd4edf-b13c-4298-9344-53119ab8b9df</merchant-account-id>
    <transaction-id>6738403b-b234-40a3-ae54-7f32e425ade7</transaction-id>
    <request-id>ace24c63-5120-4183-b6c0-de2e5acff335</request-id>
    <transaction-type>refund-debit</transaction-type>
    <transaction-state>failed</transaction-state>
    <completion-time-stamp>2019-08-29T16:04:23.000Z</completion-time-stamp>
    <statuses>
        <status code="400.1023" description="The Transaction Type of the Parent Transaction is invalid for the current operation.  Please do not try again." severity="error"/>
    </statuses>
    <requested-amount currency="USD">2.22</requested-amount>
    <parent-transaction-id>8d6bf7f9-689d-4555-843f-24ceb95dfd69</parent-transaction-id>
    <account-holder>
        <first-name>Max</first-name>
        <last-name>Cavalera</last-name>
        <email>max.cavalera@wirecard.com</email>
    </account-holder>
    <ip-address>127.0.0.1</ip-address>
    <order-number>180528105918955</order-number>
    <order-detail>Test product 001</order-detail>
    <custom-fields/>
    <payment-methods>
        <payment-method name="alipay-xborder"/>
    </payment-methods>
    <parent-transaction-amount currency="USD">2.220000</parent-transaction-amount>
    <api-id>elastic-api</api-id>
    <cancel-redirect-url>https://demoshop-test.wirecard.com/demoshop/#/cancel</cancel-redirect-url>
    <fail-redirect-url>https://demoshop-test.wirecard.com/demoshop/#/error</fail-redirect-url>
    <success-redirect-url>https://demoshop-test.wirecard.com/demoshop/#/success</success-redirect-url>
    <locale>en</locale>
</payment>`;

const bodyResponseJSON = `{
    "payment": {
        "statuses": {
            "status": [
                {
                    "code": "400.1023",
                    "description": "The Transaction Type of the Parent Transaction is invalid for the current operation.  Please do not try again.",
                    "severity": "error"
                }
            ]
        },
        "locale": "en",
        "merchant-account-id": {
            "value": "47cd4edf-b13c-4298-9344-53119ab8b9df",
            "ref": "https://api-test.wirecard.com:443/engine/rest/config/merchants/47cd4edf-b13c-4298-9344-53119ab8b9df"
        },
        "transaction-id": "f433f3f4-2bd2-4942-a627-58ee44814e0f",
        "request-id": "b27dbf2d-b9b9-42e8-a2ce-4f46de352b21",
        "transaction-type": "refund-debit",
        "transaction-state": "failed",
        "completion-time-stamp": 1567423897000,
        "requested-amount": {
            "value": 2.22,
            "currency": "USD"
        },
        "parent-transaction-id": "0cab2b66-8741-4b47-a90e-229e90695a5f",
        "account-holder": {
            "email": "max.cavalera@wirecard.com",
            "first-name": "Max",
            "last-name": "Cavalera"
        },
        "ip-address": "127.0.0.1",
        "order-number": "180528105918955",
        "order-detail": "Test product 001",
        "custom-fields": {
            "custom-field": []
        },
        "payment-methods": {
            "payment-method": [
                {
                    "name": "alipay-xborder"
                }
            ]
        },
        "parent-transaction-amount": {
            "value": 2.220000,
            "currency": "USD"
        },
        "api-id": "elastic-api",
        "cancel-redirect-url": "https://demoshop-test.wirecard.com/demoshop/#/cancel",
        "fail-redirect-url": "https://demoshop-test.wirecard.com/demoshop/#/error",
        "success-redirect-url": "https://demoshop-test.wirecard.com/demoshop/#/success",
        "self": "https://api-test.wirecard.com:443/engine/rest/merchants/47cd4edf-b13c-4298-9344-53119ab8b9df/payments/f433f3f4-2bd2-4942-a627-58ee44814e0f"
    }
}`;

const bodyResponseNVP = `order_number=180528105918955&order_detail=Test+product+001&payment_method_url=https%3A%2F%2Fopenapi.alipaydev.com%2Fgateway.do%3F_input_charset%3Dutf-8%26body%3DTest%2Bproduct%2B001%26currency%3DUSD%26notify_url%3Dhttps%253A%252F%252Fapi-test.wirecard.com%253A443%252Fengine%252Fnotification%252Falipay-xborder%252F%26order_gmt_create%3D2019-09-02%2B19%253A32%253A43%26order_valid_time%3D21600%26out_trade_no%3D5699de97-3be1-4f66-8edc-71cbfffaa53d%26partner%3D2088101122136241%26return_url%3Dhttps%253A%252F%252Fapi-test.wirecard.com%253A443%252Fengine%252Fnotification%252Falipay-xborder%252Fredirect%252F5699de97-3be1-4f66-8edc-71cbfffaa53d%252F%26secondary_merchant_id%3D0000003173B0F907%26secondary_merchant_industry%3D4555%26secondary_merchant_name%3Dtesting-merchant%26service%3Dcreate_forex_trade%26sign%3Dfff83061f981e5b4ef098904465b1a51%26sign_type%3DMD5%26subject%3D180528105918955%26timeout_rule%3D12h%26total_fee%3D2.22&locale=en&requested_amount=2.22&completion_time_stamp=20190902113243&merchant_account_id=47cd4edf-b13c-4298-9344-53119ab8b9df&fail_redirect_url=https%3A%2F%2Fdemoshop-test.wirecard.com%2Fdemoshop%2F%23%2Ferror&first_name=Max&email=max.cavalera%40wirecard.com&payment_method=alipay-xborder&transaction_id=5699de97-3be1-4f66-8edc-71cbfffaa53d&status_severity_1=information&last_name=Cavalera&ip_address=127.0.0.1&transaction_type=get-url&status_code_1=201.0000&status_description_1=The+resource+was+successfully+created.&cancel_redirect_url=https%3A%2F%2Fdemoshop-test.wirecard.com%2Fdemoshop%2F%23%2Fcancel&success_redirect_url=https%3A%2F%2Fdemoshop-test.wirecard.com%2Fdemoshop%2F%23%2Fsuccess&transaction_state=success&requested_amount_currency=USD&request_id=38724342-6ce1-41dc-bc5a-5006176e7aec-get-url&`;