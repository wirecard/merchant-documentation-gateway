// indicates whether user uses arrow keys to navigate
var hightlightSearchResult = false;

var previousSearchTerm = '';
var idx;

function loadLunrIndex() {
  if (searchIndexStatus != 'empty') {
    return true;
  }
  searchIndexStatus = 'requested';
  $.getJSON('searchIndex.json', function (data) {
    idx = lunr.Index.load(data);
    searchIndexStatus = 'loaded';
    // if user typed search term before index was loaded, trigger search again after load
    executeSearch($('#searchterm').val());
  });
}
function search(searchTerm) {
  if (typeof idx === 'undefined') {
    return true;
  }
  var results = idx.search(searchTerm);
  var maxResults = 13;
  if (results.length < maxResults) {
    maxResults = results.length;
  }
  for (var i = 0; i < maxResults; i += 1) {
    var result = results[i];
    var tocAnchor = $('li.tocify-item[data-unique=' + result.ref + '] > a');
    var tocParentAnchor = tocAnchor.parent().parent().prev('li');
    var parentText = tocParentAnchor.text();
    if (tocParentAnchor.length == 0) {
      parentText = 'Home';
    }
    // $('#resultslist').append('<li class="tocify-item"><a tocref="' + result.ref + '">' +
    //   tocAnchor.text() + '</a><br><span class="searchresultsection">in: ' + parentText + '</span></li>');
    $('<li/>', { class: "tocify-item" })
      .append($('<a/>', { tocref: result.ref, text: tocAnchor.text() }))
      .append($('<br>'))
      .append($('<span/>', { class: "searchresultsection", text: "in: " + parentText }))
      .hover(function () {
        $('.selected').removeClass('selected');
        $(this).addClass('selected');
        hightlightSearchResult = true;
      })
      .appendTo($('#resultslist'));
  }
  if (results.length === 0) {
    $('#resultslist').append('<li class="tocify-item"><a>No results.</a></li>');
  }
  keepClickedSearchResultsBold();
}
function showAll(searchTerm) {
  $('#resultslist').empty();
}

function executeSearch(st) {
  $('#resultslist').empty();
  if (st.length > 0) {
    //$( '#searchresults' ).show();
    $('#searchfield').trigger('mouseenter');
    search(st);

    window.clearTimeout(trackingTimer);
    trackingTimer = setTimeout(function () {
      if (st != previousSearchTerm) {
        previousSearchTerm = st;
        _paq.push(['trackSiteSearch',
          // Search keyword searched for
          st,
          // Search category selected in your search engine. If you do not need this, set to false
          false,
          // Number of results on the Search results page. Zero indicates a 'No Result Search Keyword'. Set to false if you don't know
          false
        ]);
      }
    }, trackSearchDelay);

    if (searchIndexStatus == 'loaded') {
      $('#searchterm').removeClass('wait');
    } else {
      $('#searchterm').addClass('wait');
    }
  }
}

if (!editorMode) {

  var trackingTimer;
  var trackSearchDelay = 2000; // wait before putting serch term into tracker

  $("#toctitle").empty();
  $("body").prepend('<header><form id="searchfield"><input id="searchterm" type="search" placeholder="Quick Search" spellcheck="false" autocomplete="off"></div></header>');
  $("#searchfield").append('<div id="searchresults"><ul id="resultslist"></ul></form>');

  var typingTimer;         //timer identifier
  var markingTimer;        //mark elements timer
  var searchDelay = 500;   //time in ms, 5 second for example
  var markDelay = 1000;

  // add mouseup event just for Edge to trigger on click of clear button
  $("#searchterm").on("mouseup", function (event) {
    typingTimer = setTimeout(function () {
      executeSearch($("#searchterm").val());
      //markKeyword($("#searchterm").val(), true);
    }, searchDelay);
  });

  $("#searchterm").on("search paste keydown keyup click change", function (event) {
    // skip event IF arrow key up or down is pressed,
    // in order to display selected items correct
    var keyCode = event.keyCode || event.which;
    switch (keyCode) {
      case 13: // enter
      case 38: // arrow up
      case 40: // arrow down
        return;
    }

    if (searchIndexStatus == 'empty') {
      loadLunrIndex();
    }
    if (keyCode === 13) {
      event.preventDefault();
    }
    if ($(window).width() < mobileLayoutCutoffWidth) {
      $('#toc').addClass('hidden-toc');
      $('#tocbtn').removeClass('is-active');
    }
    st = $("#searchterm").val();
    window.clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      executeSearch(st);
      hightlightSearchResult = false;
    }, searchDelay);

    window.clearTimeout(markingTimer);
    markingTimer = setTimeout(function () {
      markKeyword((st.length > 3) ? st : '', true);
    }, markDelay);
  });
}

function keepClickedSearchResultsBold() {
  $('#resultslist > li').each(function (index) {
    var e = $(this);
    var tocref = e.find('a').first().attr('tocref');
    var tocItem = $('li.tocify-item[data-unique=' + tocref + '] > a');
    if (tocItem.attr('href') !== undefined) {
      var pageID = tocItem.attr('href').replace(/\.html.*/, '');
    }
    e.on("click touch", function (event) {
      $('#resultslist > li > a').css("font-weight", "normal");
      e.css("font-weight", "bold");
      tocItem.click();
      // exclude Edge workaround
      if (isEdgeBrowser || isInternetExplorer) {
        window.location.href = tocItem[0].href;
        return true;
      }
      if (pageID != tocref) {
        window.requestAnimationFrame(function () {
          setTimeout(function () {
            window.location.href = '#' + tocref;
          }, 200);
          setTimeout(function () {
            window.location.href = '#' + tocref;
            scrollToFirstMark();
          }, 1000);
        });
      } else {
        scrollToFirstMark();
      }
    });
    tocItem.trigger('mouseenter');
  });
}
if ($(window).width() < mobileLayoutCutoffWidth) {
  $('#searchresults').on("click touch", function () {
    $('#resultslist').empty();
  });
}

// enable the user to use arrow keys and enter to navigate search results
$('#searchfield').keydown(function (e) {
  var results = $('#resultslist');
  var keyCode = e.keyCode || e.which;

  switch (keyCode) {
    case 38: // arrow up
      e.preventDefault();
      results.find(':not(:first-child).selected').removeClass('selected')
        .prev().addClass('selected');
      break;
    case 40: // arrow down
      e.preventDefault();
      results.find(':not(:last-child).selected').removeClass('selected')
        .next().addClass('selected');
      // initial add of 'selected' class
      if (!hightlightSearchResult && results.length > 0) {
        results.children(':first').addClass('selected');
        hightlightSearchResult = true;
      }
      break;
    case 13: // enter
      e.preventDefault();
      results.find('.selected').click();
      break;
  }
});