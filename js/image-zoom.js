/**
 * zoom effect for hover
 */

function zoomImage(e) {
    var zoomer = e.currentTarget;
    x = e.offsetX / zoomer.offsetWidth * 100
    y = e.offsetY / zoomer.offsetHeight * 100
    zoomer.style.backgroundPosition = x + '% ' + y + '%';
}

function addZoomToLargeImages() {
    const contentWrapperWidth = $('div#content').width();
    $('img').each(function (i, img) {
        if ($(img).attr('data-has-zoom') == 'true' ||
            $(img).attr('no-zoom')) {
            return true;
        }
        const hasZoomClass = $(img).parent().parent().hasClass('zoom');
        $(img).attr('data-has-zoom', 'true');
        const originalWidth = img.width;
        const originalHeight = img.height;
        // svg naturalWidth === 0, therefore do not use < for comparison
        requestIdleCallback(function () {
            if (img.src.match(new RegExp('\.svg$'))) {
                img.width = contentWrapperWidth;
            }
            // do not give zoom to "one liner images"
            if ((img.width / img.height < 10 && (img.width > contentWrapperWidth * 0.95)) || hasZoomClass) {
                // add attribute for click zoom functionality from zoom-vanilla.js
                $(img).attr('data-action', 'zoom');
                // disable mouseover looking glass zoom effect upon popular request :)
                //$(img).wrap('<figure class="zoom" onmousemove="zoomImage(event)" style="background-image: url(' + img.src + ')"></figure>');
            }
        });
        return true;
    });
}

function isSVG(img) {
    return img.src.match(new RegExp('\.svg$'));
}

/**
 * zoom effect for click
 * based on // zoom-vanilla.js - 2.0.6 (https://github.com/spinningarrow/zoom-vanilla.js)
 * modified for correct svg handling in calculateZoom()
 */
document.addEventListener('DOMContentLoaded', function () {
    +function () {
        "use strict";
        var OFFSET = 80

        // From http://youmightnotneedjquery.com/#offset
        function offset(element) {
            var rect = element.getBoundingClientRect()
            var scrollTop = window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0
            var scrollLeft = window.pageXOffset ||
                document.documentElement.scrollLeft ||
                document.body.scrollLeft ||
                0
            return {
                top: rect.top + scrollTop,
                left: rect.left + scrollLeft
            }
        }

        function zoomListener() {
            var activeZoom = null
            var initialScrollPosition = null
            var initialTouchPosition = null

            function listen() {
                document.body.addEventListener('click', function (event) {
                    if (event.target.getAttribute('data-action') !== 'zoom' ||
                        event.target.tagName !== 'IMG') return

                    zoom(event)
                })
            }

            function zoom(event) {
                event.stopPropagation()

                if (document.body.classList.contains('zoom-overlay-open')) return

                if (event.metaKey || event.ctrlKey) return openInNewWindow()

                closeActiveZoom({ forceDispose: true })

                activeZoom = vanillaZoom(event.target)
                activeZoom.zoomImage()

                addCloseActiveZoomListeners()
            }

            function openInNewWindow() {
                window.open(event.target.getAttribute('data-original') ||
                    event.target.currentSrc ||
                    event.target.src,
                    '_blank')
            }

            function closeActiveZoom(options) {
                options = options || { forceDispose: false }
                if (!activeZoom) return

                activeZoom[options.forceDispose ? 'dispose' : 'close']()
                removeCloseActiveZoomListeners()
                activeZoom = null
            }

            function addCloseActiveZoomListeners() {
                // todo(fat): probably worth throttling this
                window.addEventListener('scroll', handleScroll)
                document.addEventListener('click', handleClick)
                document.addEventListener('keyup', handleEscPressed)
                document.addEventListener('touchstart', handleTouchStart)
                document.addEventListener('touchend', handleClick)
            }

            function removeCloseActiveZoomListeners() {
                window.removeEventListener('scroll', handleScroll)
                document.removeEventListener('keyup', handleEscPressed)
                document.removeEventListener('click', handleClick)
                document.removeEventListener('touchstart', handleTouchStart)
                document.removeEventListener('touchend', handleClick)
            }

            function handleScroll(event) {
                if (initialScrollPosition === null) initialScrollPosition = window.pageYOffset
                var deltaY = initialScrollPosition - window.pageYOffset
                if (Math.abs(deltaY) >= 40) closeActiveZoom()
            }

            function handleEscPressed(event) {
                if (event.keyCode == 27) closeActiveZoom()
            }

            function handleClick(event) {
                event.stopPropagation()
                event.preventDefault()
                closeActiveZoom()
            }

            function handleTouchStart(event) {
                initialTouchPosition = event.touches[0].pageY
                event.target.addEventListener('touchmove', handleTouchMove)
            }

            function handleTouchMove(event) {
                if (Math.abs(event.touches[0].pageY - initialTouchPosition) <= 10) return
                closeActiveZoom()
                event.target.removeEventListener('touchmove', handleTouchMove)
            }

            return { listen: listen }
        }

        var vanillaZoom = (function () {
            var fullHeight = null
            var fullWidth = null
            var overlay = null
            var imgScaleFactor = null

            var targetImage = null
            var targetImageWrap = null
            var targetImageClone = null

            function zoomImage() {
                var img = document.createElement('img')
                img.onload = function () {
                    fullHeight = Number(img.height)
                    fullWidth = Number(img.width)
                    console.log(img);
                    zoomOriginal()
                }
                img.src = targetImage.currentSrc || targetImage.src
            }

            function zoomOriginal() {
                targetImageWrap = document.createElement('div')
                targetImageWrap.className = 'zoom-img-wrap'
                targetImageWrap.style.position = 'absolute'
                targetImageWrap.style.top = offset(targetImage).top + 'px'
                targetImageWrap.style.left = offset(targetImage).left + 'px'

                targetImageClone = targetImage.cloneNode()
                targetImageClone.style.visibility = 'hidden'

                targetImage.style.width = targetImage.offsetWidth + 'px'
                targetImage.parentNode.replaceChild(targetImageClone, targetImage)

                document.body.appendChild(targetImageWrap)
                targetImageWrap.appendChild(targetImage)

                targetImage.classList.add('zoom-img')
                targetImage.setAttribute('data-action', 'zoom-out')

                overlay = document.createElement('div')
                overlay.className = 'zoom-overlay'

                document.body.appendChild(overlay)

                calculateZoom()
                triggerAnimation()
            }

            function calculateZoom() {
                var svg = isSVG(targetImage);

                targetImage.offsetWidth // repaint before animating

                var originalFullImageWidth = svg ? targetImage.clientWidth * 2 : targetImage.clientWidth
                var originalFullImageHeight = svg ? targetImage.clientHeight * 2 : targetImage.clientHeight

                var maxScaleFactor = originalFullImageWidth / targetImage.width

                var viewportHeight = window.innerHeight - OFFSET
                var viewportWidth = window.innerWidth - OFFSET

                var imageAspectRatio = originalFullImageWidth / originalFullImageHeight
                var viewportAspectRatio = viewportWidth / viewportHeight

                if (originalFullImageWidth < viewportWidth && originalFullImageHeight < viewportHeight) {
                    imgScaleFactor = maxScaleFactor
                } else if (imageAspectRatio < viewportAspectRatio) {
                    imgScaleFactor = (viewportHeight / originalFullImageHeight) * maxScaleFactor
                } else {
                    imgScaleFactor = (viewportWidth / originalFullImageWidth) * maxScaleFactor
                }
            }

            function triggerAnimation() {
                targetImage.offsetWidth // repaint before animating

                var imageOffset = offset(targetImage)
                var scrollTop = window.pageYOffset

                var viewportY = scrollTop + (window.innerHeight / 2)
                var viewportX = (window.innerWidth / 2)

                var imageCenterY = imageOffset.top + (targetImage.height / 2)
                var imageCenterX = imageOffset.left + (targetImage.width / 2)

                var translateY = Math.round(viewportY - imageCenterY)
                var translateX = Math.round(viewportX - imageCenterX)

                var targetImageTransform = 'scale(' + imgScaleFactor + ')'
                var targetImageWrapTransform =
                    'translate(' + translateX + 'px, ' + translateY + 'px) translateZ(0)'

                targetImage.style.webkitTransform = targetImageTransform
                targetImage.style.msTransform = targetImageTransform
                targetImage.style.transform = targetImageTransform

                targetImageWrap.style.webkitTransform = targetImageWrapTransform
                targetImageWrap.style.msTransform = targetImageWrapTransform
                targetImageWrap.style.transform = targetImageWrapTransform

                document.body.classList.add('zoom-overlay-open')
            }

            function close() {
                document.body.classList.remove('zoom-overlay-open')
                document.body.classList.add('zoom-overlay-transitioning')

                targetImage.style.webkitTransform = ''
                targetImage.style.msTransform = ''
                targetImage.style.transform = ''

                targetImageWrap.style.webkitTransform = ''
                targetImageWrap.style.msTransform = ''
                targetImageWrap.style.transform = ''

                if (!'transition' in document.body.style) return dispose()

                targetImageWrap.addEventListener('transitionend', dispose)
                targetImageWrap.addEventListener('webkitTransitionEnd', dispose)
            }

            function dispose() {
                targetImage.removeEventListener('transitionend', dispose)
                targetImage.removeEventListener('webkitTransitionEnd', dispose)

                if (!targetImageWrap || !targetImageWrap.parentNode) return

                targetImage.classList.remove('zoom-img')
                targetImage.style.width = ''
                targetImage.setAttribute('data-action', 'zoom')

                targetImageClone.parentNode.replaceChild(targetImage, targetImageClone)
                targetImageWrap.parentNode.removeChild(targetImageWrap)
                overlay.parentNode.removeChild(overlay)

                document.body.classList.remove('zoom-overlay-transitioning')
            }

            return function (target) {
                targetImage = target
                return { zoomImage: zoomImage, close: close, dispose: dispose }
            }
        }())

        zoomListener().listen()
    }()
});
