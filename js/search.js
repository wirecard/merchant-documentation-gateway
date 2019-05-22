
var previousSearchTerm = '';
if ( !editorMode ) {
  var idx;
  function loadLunrIndex() {
    if ( searchIndexStatus != 'empty' ) return true;
    searchIndexStatus = 'requested';
    $.getJSON( 'searchIndex.json', function( data ) {
      idx = lunr.Index.load(data);
      searchIndexStatus = 'loaded';
      // if user typed search term before index was loaded, trigger search again after load
      executeSearch( $( '#searchterm' ).val() );
    });
  }
  function search( searchTerm ) {
    if ( typeof idx === 'undefined' ) return true;
    var results = idx.search(searchTerm);
    var maxResults = 13;
    if ( results.length < maxResults ) {
      maxResults = results.length;
    }
    for ( var i = 0; i < maxResults; i++ ) {
      var result = results[i];
      var tocAnchor = $( 'li.tocify-item[data-unique=' + result.ref + '] > a' );
      var tocParentAnchor = tocAnchor.parent().parent().prev( 'li' );
      var parentText = tocParentAnchor.text();
      if ( tocParentAnchor.length == 0 ) parentText = 'Home';
      $( '#resultslist' ).append('<li class="tocify-item"><a tocref="' + result.ref + '">' + tocAnchor.text() + '</a><br><span class="searchresultsection">in: ' + parentText + '</span></li>');
    }
    if ( results.length == 0 ) {
      $( '#resultslist' ).append('<li class="tocify-item"><a>No results.</a></li>');
    }
    keepClickedSearchResultsBold();
  }
  function showAll( searchTerm ) {
    $('#resultslist').empty();
  }

  var trackingTimer;
  var trackSearchDelay = 2000; // wait before putting serch term into tracker
  function executeSearch(st) {
    $('#resultslist').empty();
    if( st.length > 0 ) {
      //$( '#searchresults' ).show();
      $( '#searchfield' ).trigger('mouseenter');
      search(st);

      window.clearTimeout( trackingTimer );
      trackingTimer = setTimeout( function() {
        if ( st != previousSearchTerm ) {
          previousSearchTerm = st;
          _paq.push( ['trackSiteSearch',
              // Search keyword searched for
              st,
              // Search category selected in your search engine. If you do not need this, set to false
              false,
              // Number of results on the Search results page. Zero indicates a 'No Result Search Keyword'. Set to false if you don't know
              false
          ]);
        }
      }, trackSearchDelay );

      if ( searchIndexStatus == 'loaded' ) $( '#searchterm' ).removeClass( 'wait' );
      else $( '#searchterm' ).addClass( 'wait' );
    }
  }

  $("#toctitle").empty();
    $("body").prepend('<header><form id="searchfield"><input id="searchterm" type="search" placeholder="Quick Search" spellcheck="false" autocomplete="off"></div></header>');
    $("#searchfield").append('<div id="searchresults"><ul id="resultslist"></ul></form>');

    var typingTimer;         //timer identifier
    var markingTimer;        //mark elements timer
    var searchDelay = 500;   //time in ms, 5 second for example
    var markDelay = 1000;

    // add mouseup event just for Edge to trigger on click of clear button
    $("#searchterm").on("mouseup", function(event) {
      typingTimer = setTimeout(function() {
        executeSearch( $("#searchterm").val() );
        markKeyword( $("#searchterm").val() );
      }, searchDelay);
    });

    $("#searchterm").on("search paste keydown keyup click change", function(event) {
      if ( searchIndexStatus == 'empty' ) loadLunrIndex();
      var keyCode = event.keyCode || event.which;
      if ( keyCode === 13 ) {
        event.preventDefault();
      }
      if( $(window).width() < mobileLayoutCutoffWidth ) {
        $('#toc').addClass('hidden-toc');
        $('#tocbtn').removeClass('is-active');
      }
      st = $("#searchterm").val();
      window.clearTimeout( typingTimer );
      typingTimer = setTimeout(function() {
        executeSearch( st );
      }, searchDelay);

      window.clearTimeout( markingTimer );
      markingTimer = setTimeout(function() {
        markKeyword( ( st.length > 3 ) ? st : '' );
      }, markDelay);
    });
}

function keepClickedSearchResultsBold() {
  $('#resultslist > li').each(function(index) {
    var e = $(this);
    var tocref = e.find('a').first().attr('tocref');
    var tocItem = $('li.tocify-item[data-unique=' + tocref + '] > a');
    var pageID = tocItem.attr('href').replace(/\.html.*/, '');
      e.on("click touch", function(event){
        $('#resultslist > li > a').css("font-weight","normal");
        e.css("font-weight","bold");
        tocItem.click();
        // exclude Edge workaround
        if ( isEdgeBrowser ) {
          window.location.href = tocItem[0].href;
          return true;
        }

        if(pageID != tocref) {
          window.requestAnimationFrame(function() {
            setTimeout(function() {
              window.location.href='#' + tocref;
            }, 200);
            setTimeout(function() {
              window.location.href='#' + tocref;
            }, 1000);
          });
        }
      });
      tocItem.trigger('mouseenter');
  });
}
if( $(window).width() < mobileLayoutCutoffWidth ) {
  $( '#searchresults' ).on("click touch", function(){
    $('#resultslist').empty();
  } );
}
