/*
Tests validity of redirect-map.js entries
Checks if anchor and file exist
Posts results to Slack
*/

const cheerio = require('cheerio');
const fs = require('fs');

const redirectMapFile = 'errorpages/redirect-map.js';
try {
    eval(fs.readFileSync(redirectMapFile).toString());
} catch (err) {
    console.log("could not read redirect map");
    process.exit(1);
}

var $;
var statusCode = 0;
var invalidRedirects = {};
const anchorIndexFile = 'anchor-index.json';

var anchorIndexFileContents;
try {
    anchorIndexFileContents = fs.readFileSync(anchorIndexFile);
} catch (err) {
    throw err;
}
AnchorIndex = JSON.parse(anchorIndexFileContents);

function getAdocFileNameByAnchorName(anchorName) {
    for (adocFileName in AnchorIndex) {
        for (anchor in AnchorIndex[adocFileName]) {
            if (anchor === anchorName) return adocFileName;
        }
    }
    return '';
}

for (key in redirectMap) {
    const url = redirectMap[key];
    const file = url.replace(/#.*/, '');
    const anchor = (url.includes('#') ? url.replace(/.*#/, '') : undefined);
    try {
        $ = cheerio.load(fs.readFileSync(file));
    } catch (err) {
        statusCode = 1;
    }
    if (anchor !== undefined) {
        if ($('#' + anchor).attr('id') !== anchor) {
            if (invalidRedirects[file] === undefined) {
                invalidRedirects[file] = {};
                invalidRedirects[file]['anchors'] = [];
            }
            invalidRedirects[file]['adoc'] = getAdocFileNameByAnchorName(file.replace(/.html$/, ''));
            invalidRedirects[file]['anchors'].push(anchor);
        }
    }
}
//console.log(invalidRedirects);
/*
[
	{
		"type": "section",
		"text": {
			"type": "mrkdwn",
			"text": "*Error*: Faulty redirects in *redirect-map.js*: "
		}
	},
	{
		"type": "section",
		"fields": [
			{
				"type": "mrkdwn",
				"text": "RestApi.html#bla (_cf. 04-00-rest-api.adoc_)\nWrongLink.html\n"
			}
		]
	}
]
*/
function createSlackMessage(invalidRedirects) {
    var string = '';
    var text = function(invalidRedirects) {
        for (filename in invalidRedirects) {
            var element = invalidRedirects[filename];
            var anchors = element['anchors'];
            var adocFile = element['adoc'];
            var adocString = '\n' + (adocFile.length ? '_(' + adocFile + ')_' : '');
            if(anchors.length) {
                anchors.forEach(a => {
                    string += '*' + filename + '#' + a + '*' + adocString + '\n\n';
                });
            }
            else {
                string += '*' + filename + '*' + adocString + '\n\n';
            }
        }
        return string;
    }
    var msg = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Error*: Faulty redirects in *redirect-map.js*: "
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": text(invalidRedirects)
                }
            ]
        }
    ];
    return msg;
}
console.log( JSON.stringify( createSlackMessage(invalidRedirects), null, 2 ));
process.exit(statusCode);
