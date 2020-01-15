$('header').prepend($('.closebtn'));
$('#toctitle').click(function (event) {
  /*
  removeHash();
  window.scrollTo(0, 0);
  $('#minitoc > ul').html('');
  $('#tocify-header0 > li:nth-child(1) > a:nth-child(1)').click();
  */
  event.preventDefault();
  const _currentRoot = location.pathname.substring(0, location.pathname.lastIndexOf("/")) + '/';
  location.href = _currentRoot;
});

$('<nav id="minitoc-container"><ul id="minitoc"></ul></nav>').insertAfter('header');
$('<span id="console"></span>').insertAfter("header");
$('header').prepend('<button class="hamburger hamburger--arrow is-active" type="button" id="tocbtn"><span class="hamburger-box"><span class="hamburger-inner"></span></span></button>');
highlightTOC();

function hideNav() {
  $('#toc').addClass('hidden-toc');
  $('#tocbtn').removeClass('is-active');
  //$('header').addClass('blue');
}

function showNav() {
  $('#toc').removeClass('hidden-toc');
  $('#tocbtn').addClass('is-active');
  //$('header').removeClass('blue');
}

function initializeForScreenSize() {
  if (window.matchMedia('(max-width: ' + mobileLayoutCutoffWidth + 'px)').matches) {
    hideNav();
  }
  else {
    showNav();
  }
}
initializeForScreenSize();
$(window).on('resize', function () {
  initializeForScreenSize();
});

$('#content').on("click touch", function () {
  $('#minitoc').removeClass('minitoc-open');
  if ($('#toc').width() > 0 && $(window).width() < mobileLayoutCutoffWidth) {
    hideNav();
  }
});

$('#tocbtn').on("click touch", function () {
  $('#toc').toggleClass('hidden-toc');
  $(this).toggleClass('is-active');
  $('header').toggleClass('blue');
  $(window).scrollLeft(0);
  $('#resultslist').empty();
});

$('#resultslist, #toc').on("click touch", function () {
  if ($(window).width() < mobileLayoutCutoffWidth) {
    hideNav();
  }
});

function shortenForTOC(linkText) {
  const tocReplacements = [[/REST\ API\ \&\ Wirecard\ Payment\ Page\ v1/, 'REST API & WPP v1']];
  for (var i in tocReplacements) {
    var pattern = tocReplacements[i][0];
    var replacement = tocReplacements[i][1];
    linkText = linkText.replace(pattern, replacement);
  }
  return linkText;
}

function createTOCElements(elements, level, num) {
  rootID = tocData[num].id;
  var ul = $('<ul/>');
  var className;
  switch (true) {
    case (level == 2):
      ul.attr('id', 'tocify-header' + num);
      className = 'tocify-header';
      break;
    // jshint -W086
    case (level > 2): // no break..
      ul.attr('data-tag', level);
    default:
      className = 'tocify-subheader';
      break;
    // jshint +W086
  }
  ul.attr('class', className);
  for (var i = 0; i < elements.length; i++) {
    e = elements[i];
    var li = $('<li/>').attr('data-unique', e.id).attr('class', 'tocify-item');
    var a;
    if (level == 2 || level == 3) {
      a = $('<a/>').attr('href', e.id + '.html');
      if (maskStringEncoded !== '') a.attr('href', e.id + '.html?' + maskStringEncoded);
    }
    else {
      a = $('<a/>').attr('href', e.parentID + '.html' + '#' + e.id);
      if (maskStringEncoded !== '') a.attr('href', e.parentID + '.html?' + maskStringEncoded + '#' + e.id);
    }
    var linkText = shortenForTOC(e.attributes.text);
    a.text(linkText);
    li.append(a);
    ul.append(li);
    if (e.children.length > 0 && level < 4) {
      li.addClass('has-children');
      ul.append(createTOCElements(e.children, level + 1, num));
    }
  }
  return ul;
}

function buildTOC(data) {
  tocData = data;
  for (var i = 0; i < data.length; i++) {
    toc.append(createTOCElements([data[i]], 2, i));
  }
}

function replaceRootHref() {
  var element = $('li.tocify-item[data-unique=Home] > a');
  element.attr('href', '/');
}

function addTOCbindings() {
  $('li.tocify-item > a').click(function (event) {
    $('#minitoc').empty();
    // workaround for smoothState
    // uses window.location bc body id doesn't reliably change
    var currentPageID = location.pathname.substring(location.pathname.lastIndexOf("/") + 1).replace(new RegExp("\.html.*"), '');
    var clickedItemID = $(this).parent().attr('data-unique');
    setTimeout(function () {
      highlightTOCelement(clickedItemID);
    }, 0);
    $('#minitoc').empty();
    var pageUrl = $(this).attr('href');
    if (pageUrl == currentPageID + '.html') {
      event.preventDefault();
      window.scrollTo(0, 0);
      $('#minitoc').empty();
      return false;
    }
    if (pageUrl.indexOf(currentPageID + '.html') != 0) {
      // exclude Edge workaround
      if (isEdgeBrowser || isInternetExplorer) {
        window.location.href = pageUrl;
        return true;
      }
      window.stop();
      smoothState.load(pageUrl);
      event.preventDefault();
    }
  });

  var priorityTimeoutHandler;
  $('li.tocify-item > a').on('mouseenter touchstart', function (event) {
    if (searchIndexStatus !== 'loaded') {
      return false;
    }
    if (location.hostname !== this.hostname) {
      return false;
    }
    clearTimeout(priorityTimeoutHandler);
    var pageName = $(this).attr('href').replace(new RegExp("#.*/ "), '');
    priorityTimeoutHandler = setTimeout(function () {
      prioritizePage(pageName);
    }, 180);
  });
}

var toc = $('<div>');
toc.attr('id', 'generated-toc');
toc.addClass('tocify');
var _timeBefore = new Date().getTime();

$.getJSON('toc.json', function (data) {
  serverResponseTime = new Date().getTime() - _timeBefore;
  globalTOC = data;
  replaceTOCstub();
  buildTOC(data);
  $('#generated-toc').replaceWith(toc);
  if (maskString) applyMask(maskString);
  addTOCbindings();
  if (typeof scrollSpyLoaded !== undefined) documentReady();
  replaceRootHref();
  if (editorMode) initMaskEditor(data);
  if (!isEdgeBrowser && !isInternetExplorer) {
    //recursivePreload( globalTOC );
    fillPreloadQueueWithTOC(globalTOC);
    initPagePreloading();
  }
  else {
    loadLunrIndex();
  }
});
