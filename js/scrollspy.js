var currentlyHighlightedElementID;

function highlightTOC() {
  $( 'h2,h3,h4' ).isInViewport({ tolerance: 5 }).run(function(){
    var subsectionTitleElement = $(this);
    var hID = $(this).attr('id');
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
  console.log('documentReady called');
  $('#content').addClass('scene_element--fadeinup');
  //highlightTOC();
  if(getUrlHash() !== false) {
    console.log('getUrlHash: ' + getUrlHash());
    highlightTOCelement(getUrlHash());
    console.log('scrolled to ' + getUrlHash());
  } else {
    console.log('no hash. highlight first h2');
    highlightTOCelement($('#content h2, #content h3').first().attr('id'));
  }
  $(window).on('scroll resize', function() {
    highlightTOC();
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
  markKeyword( $('#searchterm').val() );
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
    console.log('highlight ' + id);
    $('ul.tocify-subheader').hide();
    $('li.tocify-item[data-unique]').removeClass('toc-hl');
    tocElement.addClass('toc-hl');
    tocElement.parents('ul.tocify-subheader').show();
    tocElement.next('ul.tocify-subheader').show();
    tocElement.next('ul.tocify-subheader').children('li.tocify-item').show();
    // TODO: should be handled cleaner in highlightTOC()
    if( $('#' + id).is('h4') === false ) {
      $('#minitoc > ul').html('');
    }
  }
}
