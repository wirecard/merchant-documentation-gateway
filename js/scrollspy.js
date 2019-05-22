var currentlyHighlightedElementID;

function highlightTOC() {
  $( 'div.sect2, div.sect3' ).isInViewport({ tolerance: 100 }).run(function(){
    var subsectionTitleElement = $(this).find("h4:first, h3:first");
    /*
    // works fine without this:
    if( subsectionTitleElement.hasClass('discrete') ){
      subsectionTitleElement = $(this).find("h4:first");
    }*/
    var hID = subsectionTitleElement.attr('id');
    console.log('header in viewport: ' + hID);

    var hasMinitoc = $('#minitoc > ul').has('li').length ?
                                    $('#minitoc-title').html() == subsectionTitleElement.text() : true ? false
                                  : false;
    if(subsectionTitleElement.is('h4') && hasMinitoc === false) {
      // Reset the MiniToc only before refilling
      $('#minitoc > ul').stop(true, true);
      $('#minitoc > ul').html('');
      $('#minitoc > ul').hide(500);
      var hasTitle = false;
      subsectionTitleElement.nextAll('div.sect4').find('h5').each(function() {
        // Avoid costly check of number of elements of find
        if(hasTitle == false) {
          hasTitle = true;
          $('#minitoc > ul').append('<li id="minitoc-title">' + subsectionTitleElement.text() + '</li>');
          $('#minitoc-title').on('click touch', function() { location.href = '#' + subsectionTitleElement.attr('id'); } );
        }
        var e = $(this);
        var title = e.text();
        var link = "#" + e.attr("id");
        var navPoint = "<li>" +
                         "<a href='" + link + "'>" + title + "</a>" +
                       "</li>";
        $('#minitoc > ul').append(navPoint);
      });
      $('#minitoc > ul').delay(1).slideDown(300);
    } else if(subsectionTitleElement.is('h4') === false) {
      $('#minitoc > ul').html('');
    }

    if(currentlyHighlightedElementID !== hID){
      highlightTOCelement(hID);
      currentlyHighlightedElementID = hID;
    }
  });
}

function documentReady() {
  var docTitle = $('h1').html();
  var pageTitle = $('#content h2, #content h3').first().html();
  document.title = pageTitle + ' - ' + docTitle;
  $( "div.sect3 > table.tableblock, div.sect2 > table.tableblock" ).wrap( "<div class='tablewrapper'></div>" );
  $('#content').addClass('scene_element--fadeinup');
  //highlightTOC();
  if(getUrlHash() !== false) {
    highlightTOCelement(getUrlHash());
  } else {
    // no hash. highlight first h2
    highlightTOCelement($('#content h2, #content h3').first().attr('id'));
  }
  var scrollTimer;
  var scrollDelay = 100;
  $(window).on('scroll resize', function() {
    window.cancelIdleCallback( scrollTimer );
    scrollTimer = requestIdleCallback(function() {
      window.requestAnimationFrame(highlightTOC);
    }, { timeout: scrollDelay });
  });

  // code highlighting
  $('pre > code').each(function (i, block) {
    hljs.highlightBlock(block);
  });
  // clipboard functions
  $(function() {
     var pre = document.getElementsByTagName('pre');
     for (var i = 0; i < pre.length; i++) {
       if( $(pre[i]).has('button.clipboard').length ) {
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
   target: function(b) {
             var p = b.parentNode;
               return p.className.includes("highlight")
                   ? p.childNodes[0]
                   : p.childNodes[0];
          }
      }).on('success', function(e) {
    e.clearSelection();
    e.trigger.textContent = 'Copied';
    setTimeout(function() {
        e.trigger.textContent = 'Copy';
    }, 2000);
      });
  });
  setBuildDate();
  requestIdleCallback( function() {
    markKeyword( $('#searchterm').val() );
  }, { timeout: 5000 } );

  $('#content a').filter(function() {
    return this.hostname && this.hostname !== location.hostname;
  }).addClass( 'external-link' ).attr( 'target', '_blank' );
}

$(document).ready(function() {
  documentReady();
});

function highlightTOCelement(id='none') {
  if(id == 'none') {
    $('ul.tocify-subheader').hide();
  } else {
    var tocElement = $('li.tocify-item[data-unique=' + id + ']');
    if(tocElement.length == 0) {
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

    if(childElements.length > 0){
      tocElement.toggleClass('toc-item-expanded');
    }
    // TODO: should be handled cleaner in highlightTOC()
    if( $('#' + id).is('h4') === false ) {
      $('#minitoc > ul').html('');
    }
  }
}
