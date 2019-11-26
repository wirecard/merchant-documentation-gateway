var currentlyHighlightedElementID;

function replaceHash(hID) {
  window.history.replaceState({}, document.title, window.location.pathname + (hID.length ? '#' + hID : ''));
}

var hashToSet = '';
var hashChangeTimer, miniTocTimer, miniTocSubsectionTimer, miniTocCloseTimer;

var inViewportElement;
var _tmpInViewPortID = null;

var miniTocInViewportElement;
var _tmpMiniTocInViewPortID = null;

function highlightMiniToc(id) {
  $('#minitoc li[data-content-id]').removeClass('active');
  $('#minitoc li[data-content-id=' + id + ']').addClass('active');
}

function updateMiniTOC() {
  if (inViewportElement === undefined) {
    return false;
  }
  const sectionHeadElement = inViewportElement.find('h4').first();
  const sectionHeadID = sectionHeadElement.attr('id');
  const navTitle = sectionHeadElement.text();
  // create MiniToc
  var _tmpMiniToc = $('<ul>', {
    id: 'minitoc'
  });

  // create head element of MiniToc
  var _miniTocHeadAnchor = $('<a>', {
    href: '#' + sectionHeadID,
    text: navTitle
  });

  _miniTocHeadAnchor.on('click touch', function (event) {
    // if this hasclass open, do click, else addclass
    if ($('#minitoc').hasClass('minitoc-open')) {
      miniTocClick(event, sectionHeadElement, sectionHeadID);
    }
    else {
      event.preventDefault();
      $('#minitoc').addClass('minitoc-open');
      // close after timeout automatically wuthout mouseleave
      miniTocCloseTimer = setTimeout(function () {
        $('#minitoc').removeClass('minitoc-open');
      }, 3800);
    }
  });

  var _minitocHeadElement = $('<li>', {
    id: 'minitoc-header'
  });
  _minitocHeadElement.append(_miniTocHeadAnchor);
  _tmpMiniToc.append(_minitocHeadElement);

  // add subsection elements to MiniToc
  var subsectionTitles = sectionHeadElement.nextAll('div.sect4').find('h5');

  if (subsectionTitles.length) {
    subsectionTitles.each(function () {
      const subsectionElement = $(this);
      const subsectionTitle = subsectionElement.text();
      const sectionID = subsectionElement.attr('id');
      var miniTocElement = $('<li>');
      miniTocElement.attr('data-content-id', sectionID);
      var miniTocElementAnchor = $('<a>');
      miniTocElementAnchor.text(subsectionTitle);
      miniTocElementAnchor.attr('href', '#' + sectionID);
      miniTocElementAnchor.on('click touch', function (event) {
        miniTocClick(event, subsectionElement, sectionID);
      });

      // add generated elements to MiniToc
      miniTocElement.append(miniTocElementAnchor);
      _tmpMiniToc.append(miniTocElement);
    });
    $('#minitoc').replaceWith(_tmpMiniToc);
    $('#minitoc').mouseover(() => {
      $('#minitoc').addClass('minitoc-open');
      clearTimeout(miniTocCloseTimer);
    }).mouseleave(() => {
      $('#minitoc').removeClass('minitoc-open');
    });
    highlightMiniToc(_tmpMiniTocInViewPortID);
  }
}
function highlightTOC() {
  $('div.sect2, div.sect3').isInViewport({ tolerance: 100 }).run(function () {
    inViewportElement = $(this);
    hasSubsections = $(inViewportElement).children('div.sect4').length ? true : false;
    var subsectionTitleElement = inViewportElement.find("h4:first, h3:first");
    var hID = subsectionTitleElement.attr('id');
    if (currentlyHighlightedElementID !== hID) {
      highlightTOCelement(hID);
      currentlyHighlightedElementID = hID;
    }
    if (inViewportElement.is('div.sect3')) {
      _tmpInViewPortID = inViewportElement.find('h4').first().attr('id');
    }
  });

  // separate for miniToc
  $('div.sect4').isInViewport({ tolerance: 100 }).run(function () {
    miniTocInViewportElement = $(this);
    _tmpMiniTocInViewPortID = miniTocInViewportElement.find('h5').first().attr('id');

  });
}

function miniTocClick(event, sectionElement, sectionID, callback = () => { }) {
  event.preventDefault();
  $('html, body').animate({ // add smooth scrolling
    scrollTop: sectionElement.offset().top
  }, 500).promise().then(callback);
  history.pushState(null, null, '#' + sectionID);
}

function documentReady() {
  inViewportElement = undefined;
  highlightTOC();
  // set title of page
  const docTitle = $('h1').html();
  const pageTitle = $('#content h2 > a.link, #content h3 > a.link').first().text();
  document.title = pageTitle ? (pageTitle + ' - ' + docTitle) : docTitle;

  $("div.sect3 > table.tableblock, div.sect2 > table.tableblock").wrap("<div class='tablewrapper'></div>");
  $('#content').addClass('scene_element--fadeinup');
  if (getUrlHash() !== false) {
    highlightTOCelement(getUrlHash());
  } else {
    // no hash. highlight first h2
    highlightTOCelement($('#content h2, #content h3').first().attr('id'));
  }
  var scrollTimer;
  var scrollDelay = 10;
  $(window).on('scroll', function () {
    window.cancelIdleCallback(scrollTimer);
    requestAnimationFrame(highlightTOC);
    scrollTimer = requestIdleCallback(function () {
      if (window.scrollY <= 75) {
        window.cancelIdleCallback(scrollTimer);
        $('#minitoc').empty();
      } else {
        requestAnimationFrame(updateMiniTOC);
      }
    }, { timeout: scrollDelay });

  });

  // clipboard functions
  $(function () {
    var pre = document.getElementsByTagName('pre');
    for (var i = 0; i < pre.length; i++) {
      if ($(pre[i]).has('button.clipboard').length || $(pre[i]).not(':has(code)').length) {
        continue;
      }
      var b = document.createElement('button');
      b.className = 'clipboard';
      b.textContent = 'Copy';
      if (pre[i].childNodes.length === 1 && pre[i].childNodes[0].nodeType === 3) {
        var div = document.createElement('div');
        div.textContent = pre[i].textContent;
        pre[i].textContent = '';
        pre[i].appendChild(div);
      }
      pre[i].appendChild(b);
    }
    new ClipboardJS('.clipboard', {
      target: function (b) {
        var p = b.parentNode;
        return p.className.includes("highlight") ? p.childNodes[0] : p.childNodes[0];
      }
    }).on('success', function (e) {
      e.clearSelection();
      e.trigger.textContent = 'Copied';
      setTimeout(function () {
        e.trigger.textContent = 'Copy';
      }, 2000);
    });
  });
  setBuildDate();
  requestIdleCallback(function () {
    markKeyword($('#searchterm').val(), false);
  }, { timeout: 5000 });

  $('#content a').filter(function () {
    return this.hostname && this.hostname !== location.hostname;
  }).addClass('external-link').attr('target', '_blank');

  requestIdleCallback(function () {
    hljs.initHighlighting();
    $('pre > code').each(function (i, block) {
      requestIdleCallback(function () {
        hljs.highlightBlock(block);
      });
    });
  }, { timeout: 15000 });
  $('#spinner-container').fadeOut();
  // IE fixes
  // if(isInternetExplorer || isEdgeBrowser) { }
  if (isInternetExplorer) {
    swapSVGandPNG();
  }
  addZoomToLargeImages();
  enableRequestDetailsHideShow();
  createSampleTabs();
}

$(document).ready(function () {
  documentReady();
});

function highlightTOCelement(id) {
  id = (typeof id !== 'undefined') ? id : 'none';
  if (id == 'none') {
    $('ul.tocify-subheader').hide();
  } else {
    var tocElement = $('li.tocify-item[data-unique=' + id + ']');
    if (tocElement.length == 0) {
      return;
    }
    var tocElementUL = tocElement.next('ul.tocify-subheader');
    var tocElementParentUL = tocElement.parents('ul.tocify-subheader');
    var childElements = tocElementUL.children('li.tocify-item');

    $('li.tocify-item[data-unique]').removeClass('toc-hl');
    $('li.tocify-item[data-unique], ul.tocify-subheader').removeClass('toc-item-expanded');
    tocElement.addClass('toc-hl');
    tocElementParentUL.toggleClass('toc-item-expanded');
    tocElementParentUL.prev('li.tocify-item[data-unique]').toggleClass('toc-item-expanded');

    if (childElements.length > 0) {
      tocElement.toggleClass('toc-item-expanded');
    }
  }
}

var scrollSpyLoaded;
