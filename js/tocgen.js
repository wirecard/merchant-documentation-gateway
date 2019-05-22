function createTOCElements(elements, level, num) {
  rootID = tocData[num].id;
  //console.log('level ' + level + ' rootID ' + rootID);
  var ul = $('<ul/>');
  switch(true) {
      case (level == 2):
          ul.attr('id', 'tocify-header' + num);
          var className = 'tocify-header';
          break;
      case (level > 2): // no break..
        ul.attr('data-tag', level);
      default:
          var className = 'tocify-subheader';
          break;
  }
  ul.attr('class', className);
  for (var i = 0; i < elements.length; i++) {
      e = elements[i];
      var li = $('<li/>').attr('data-unique', e.id).attr('class', 'tocify-item');
      if(level == 2 || level == 3 ) {
        var a = $('<a/>').attr('href', e.id + '.html');
        if(maskStringEncoded !== '') a.attr('href', e.id + '.html?' + maskStringEncoded);
      }
      else {
        var a = $('<a/>').attr('href', e.parentID + '.html' + '#' + e.id);
        if(maskStringEncoded !== '') a.attr('href', e.parentID + '.html?' + maskStringEncoded + '#' + e.id);
      }

      a.text(e.attributes.text);
      li.append(a);
      ul.append(li);
      if(e.children.length > 0 && level < 4) {
        li.addClass('has-children');
        ul.append(createTOCElements(e.children, level+1, num));
      }
  }
  return ul;
}

function buildTOC(data) {
  tocData = data;
  for (var i = 0; i < data.length; i++) {
      toc.append( createTOCElements([ data[i] ], 2, i) );
  }
}

function addTOCbindings() {
  $( 'li.tocify-item > a' ).click( function( event ) {
    // workaround for smoothState
    // uses window.location bc body id doesn't reliably change
    var currentPageID = location.pathname.substring( location.pathname.lastIndexOf("/") + 1).replace( new RegExp( "\.html.*" ), '' );
    var clickedItemID = $(this).parent().attr( 'data-unique' );
    setTimeout( function() {
      highlightTOCelement( clickedItemID );
    }, 0 );
    var pageUrl = $(this).attr( 'href' );
    if ( pageUrl == currentPageID + '.html' ) {
      event.preventDefault();
      window.scrollTo( 0,0 );
      return false;
    }
    if( pageUrl.indexOf( currentPageID + '.html') != 0 ) {
      // exclude Edge workaround
      if ( isEdgeBrowser || isInternetExplorer ) {
        window.location.href = pageUrl;
        return true;
      }
      window.stop();
      setTimeout(function() {
          smoothState.load( pageUrl );
      },20);
    event.preventDefault();
   }
  });

  var priorityTimeoutHandler;
  $( 'li.tocify-item > a' ).on( 'mouseenter touchstart', function( event ){
    if ( searchIndexStatus !== 'loaded' ) {
      console.log('index not loaded yet, skipping preload on mouseover to prevent bubbling');
      return false;
    }
    if ( location.hostname !== this.hostname ) {
      console.log('external link, no preload');
      return false;
    }
    clearTimeout( priorityTimeoutHandler );
    var pageName = $( this ).attr( 'href' ).replace( new RegExp( "#.*/ "), '' );
    priorityTimeoutHandler = setTimeout( function() {
      console.log('inside priorityTimeoutHandler, pagename: ' + pageName);
      prioritizePage( pageName );
    }, 180 );
  });
}

var toc = $( '<div>' );
toc.attr( 'id', 'generated-toc' );
toc.addClass( 'tocify' );
var _timeBefore= new Date().getTime();

$.getJSON( 'toc.json', function( data ) {
  serverResponseTime = new Date().getTime() - _timeBefore;
  console.log('server response time, i.e. json load time: ' + serverResponseTime);
  globalTOC = data;
  console.log('maskstring: ' + maskString)
  replaceTOCstub();
  buildTOC( data );
  $('#generated-toc').replaceWith( toc );
  console.log('applymask');
  if( maskString ) applyMask( maskString );
  documentReady();
  addTOCbindings();
  if( editorMode ) initMaskEditor( data );
  if( !isEdgeBrowser && !isInternetExplorer ) {
    //recursivePreload( globalTOC );
    fillPreloadQueueWithTOC( globalTOC );
    initPagePreloading();
  }
});
