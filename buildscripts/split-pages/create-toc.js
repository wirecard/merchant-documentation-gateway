//var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
const url = require('url');
const cheerio = require('cheerio');


try {
	var htmlFile = fs.readFileSync('index.html');
} catch (err) {
	console.log("\nfile read error\n");
    process.exit(1);
}

const $ = cheerio.load( htmlFile );

function recursiveBuildTocArray(parentID, elements, level, maxLevel=3) {
  var tocArray = [];
  if(level > maxLevel) return [];
  elements.each(function() {
    var h = $(this).children(":first-child");
    var nextLevel = level + 1;
    var elementID = h.attr('id');
    var elementText = h.text();
    if( h.is('h2,h3,h4,h5')) {
      tocArray.push({
        id: elementID,
        parentID : parentID,
        attributes: {
          text: elementText,
          level: level,
        },
        children: recursiveBuildTocArray(elementID, $(this).find('div.sect' + nextLevel), nextLevel)
      });
    }
  });
  return tocArray;
}

var tocArray = [];
tocArray = recursiveBuildTocArray(false, $('div.sect1'), 1);

//console.log(JSON.stringify(tocArray, null, 2));

function createHTML(elements, level, num) {
	var ul = $('<ul/>');
	switch(true) {
		case (level == 2):
			ul.attr('id', 'tocify-header' + num);
			var className = 'tocify-header';
			break;
		case (level > 2):
		  ul.attr('data-tag', level);
		  break;
		default:
			var className = 'tocify-subheader';
			break;
	}
	ul.attr('class', className);
	for (var i = 0; i < elements.length; i++) {;
		e = elements[i];
		var li = $('<li/>').attr('data-unique', e.id).attr('class', 'tocify-item');
		var a = $('<a/>').attr('href', e.id);
		a.text(e.attributes.text);
		li.append(a);
		ul.append(li);
		if(e.children.length > 0) ul.append(createHTML(e.children, level+1, num));
	}
	return ul;
}

var toc = $('<div/>').attr('id', 'generated-toc');
for (var i = 0; i < tocArray.length; i++) {
	toc.append( $.html(createHTML([ tocArray[i] ], 2, i)) );
}

//console.log( $.html(toc) );

//fs.writeFileSync( 'toc.html', $.html(toc) );

writeTOCjson('toc.json');

function writeTOCjson(filepath) {
	try {
	    fs.writeFileSync(filepath, JSON.stringify(tocArray, null, 2));
    }
    catch (err) {
      console.log("error writing file: " + err);
    }
}