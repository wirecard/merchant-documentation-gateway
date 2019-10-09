/*jshint esversion: 8 */
const fs = require('fs');
const cheerio = require('cheerio');
const minify = require("babel-minify");

/**
 * get all js files and minify them
 * then combine those included in docinfo-footer.html
 */
function minifyJSFiles(path) {
    const dirCont = fs.readdirSync(path);
    const jsFiles = dirCont.filter((elm) => /.*\.js$/gi.test(elm));
    for (var i in jsFiles) {
        const jsFile = jsFiles[i];
        var minifiedJS;
        process.stderr.write('minifying ' + jsFile + "\r");
        try {
            const js = fs.readFileSync(path + jsFile).toString();
            _minJS = minify(js);
            if (_minJS.code === undefined) {
                process.stderr.write('skipped ' + jsFile + " \n");
                console.log(_minJS);
                continue;
            }
            minifiedJS = _minJS.code;
        } catch (err) {
            throw err;
        }
        try {
            fs.writeFileSync(path + jsFile, minifiedJS);
        } catch (err) {
            throw err;
        }
        process.stderr.write('minified ' + jsFile + " \n");
    }
}

function combineJS(htmlFile, jsBlobFile, top = false) {
    try {
        var html = fs.readFileSync(htmlFile);
    } catch (err) {
        throw err;
    }

    var jsBundle = [];
    var $ = cheerio.load(html, {
        xmlMode: true // to avoid wrapping html head tags
    });
    process.stderr.write('combining js files to ' + jsBlobFile + ':');
    $('script[src]').each(function () {
        const scriptFilename = $(this).attr('src');
        if (scriptFilename == jsBlobFile) return false;
        const scriptContent = fs.readFileSync(scriptFilename);
        jsBundle.push(scriptContent);
        process.stderr.write(' ' + scriptFilename);
        $(this).remove();
    });
    process.stderr.write("\n");
    try {
        fs.writeFileSync(jsBlobFile, jsBundle.join("\n\n"));
    } catch (err) {
        throw err;
    }
    try {
        if (top) {
            fs.writeFileSync(htmlFile, '<script src="' + jsBlobFile + '"></script>' + "\n" + $.html());
        }
        else {
            fs.writeFileSync(htmlFile, $.html() + "\n" + '<script src="' + jsBlobFile + '"></script>');
        }
    } catch (err) {
        throw err;
    }
}

minifyJSFiles('js/');
combineJS('docinfo.html', 'js/blob-header.js', true);
combineJS('docinfo-footer.html', 'js/blob-footer.js', false);
