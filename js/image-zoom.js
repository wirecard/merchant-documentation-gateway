function zoomImage(e) {
    var zoomer = e.currentTarget;
    x = e.offsetX / zoomer.offsetWidth * 100
    y = e.offsetY / zoomer.offsetHeight * 100
    zoomer.style.backgroundPosition = x + '% ' + y + '%';
}

function addZoomToLargeImages() {
    const contentWrapperWidth = $('div#content').width();
    $('img').each(function (i, img) {
        const originalWidth = img.width;
        const originalHeight = img.height;
        // svg naturalWidth === 0, therefore do not use < for comparison
        requestIdleCallback(function () {
            if (img.src.match(new RegExp('\.svg$'))) {
                img.width = contentWrapperWidth;
            }
            // do not give zoom to "one liner images"
            console.log(img.width + ' /  ' + img.height + ' < 10 (' + img.width / img.height + ')');

            if (img.width / img.height < 10) {
                $(img).wrap('<figure class="zoom" onmousemove="zoomImage(event)" style="background-image: url(' + img.src + ')"></figure>');
            }

        });
    });
}
