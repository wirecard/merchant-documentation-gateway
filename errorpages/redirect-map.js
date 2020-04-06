//
// This map contains the request string of the old page and where the visitor
// should be redirected to in case he visits an old documentation URL
//
// If you want to add an entry you must use this format:
// "<old page>" : "<new anchor>",
// Note: the last entry must never end with a comma!
//
// Examples
// "/display/PTD/CIMB+Clicks": "#CIMB-Clicks",
// "/pages/viewpage.action?pageId=3704226" : "#WPPSecurity-MerchantsIntegratedwithNVP",
//

var redirectMap = {
  "/WPP.html" : "IntegrationGuides_WPP_v2.html",
  "/display/PTD/API+merchant+specification" : "RestApi.html",
  "/display/PTD/Appendix+K:+Test+Access+Data+and+Credentials" : "AppendixK.html",
  "/display/PTD/Wirecard+Payment+Page" : "PPv2.html",
  "/display/PTD/Credit+Card+with+WPP" : "PPv2.html#PPv2_CC",
  "/display/PTD/Seamless+Mode" : "PPv2.html#WPP_Seamless",
  "/display/PTD/REST+API" : "RestApi.html",
  "/display/PTD/3-D+Secure+2" : "CreditCard.html#CreditCard_3DS2",
  "/display/PTD/Credit+Card" : "PaymentMethods.html",
  "/display/PTD/General+Platform+Features" : "GeneralPlatformFeatures.html",
  "/display/PTD/HPP+Integration" : "PPv2.html#PaymentPageSolutions_WPP_HPP",
  "/display/PTD/PayPal" : "API_PaymentMethods_PayPal.html",
  "/display/PTD/Return+Codes+and+Transaction+Statuses" : "StatusCodes.html",
  "/display/PTD/Embedded+Payment+Page" : "PPv2.html#PaymentPageSolutions_WPP_EPP",
  "/display/PTD/Hosted+Payment+Page" : "PPv2.html#PaymentPageSolutions_WPP_HPP",
  "/display/PTD/Shop+Systems" : "ShopSystems.html",
  "/display/PTD/Transaction+Types" : "CreditCard.html#CreditCard_TransactionTypes",
  "/display/PTD/EPP+Integration" : "PPv2.html#PaymentPageSolutions_PPv2_EPP_Integration",
  "/display/PTD/Payment+Page" : "PPv2.html",
  "/display/PTD/CIMB+Clicks" : "CIMBClicks.html",
  "last entry" : "do not change"
};
