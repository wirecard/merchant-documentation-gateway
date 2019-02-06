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
  "/404.html" : "#new_anchor_404",
  "/404.html?param" : "#new_anchor",
  "/display/PTD/CIMB+Clicks" : "#CIMB-Clicks",
  "/pages/viewpage.action?pageId=3704226" : "#WPPSecurity-MerchantsIntegratedwithNVP",
  "last entry" : "do not change"
};
