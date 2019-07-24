function isIE() {
    var user_agent = window.navigator.userAgent;
    return (user_agent.indexOf('MSIE') > -1 || user_agent.indexOf('Trident/') > -1);
}

function swapSVGandPNG() {
    $('img').each(function () {
        var svg_name = this.src;
        var png_name = svg_name.split('.').slice(0, -1).join('.') + '.png';
        this.src = png_name;
    });
}