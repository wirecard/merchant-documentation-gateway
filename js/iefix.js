function isIE() {
    var user_agent = window.navigator.userAgent;
    return (user_agent.indexOf('MSIE') > -1 || user_agent.indexOf('Trident/') > -1);
}

function swapSVGandPNG() {
    $('img').each(function (i, img) {
        requestIdleCallback(function () {
            img.src = img.src.replace( new RegExp('\.svg$'), '.png');
        });
    });
}