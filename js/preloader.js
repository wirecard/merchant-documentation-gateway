


// returns neighbouring elements as array
// a: num of elements after id
// b: num of elements before id
function getNeighbours( id, b, a ) {
  var neighboursArray = [];

  neighboursArray['previous'] = [];
  while( neighboursArray['previous'].length < b ) {
    var numRemainingItems = b - neighboursArray['previous'].length;
    // do not load further than e.g. 3. not skip data-status=loaded for PREV, bc
    // content jumps on moving mouse over toc vertically upwards bc
    // theres "always" more items to load.
    var previousNeighbours = $( '#' + id ).parent().prevAll( 'div.sect3' );
    for( var i = Math.min( previousNeighbours.length, numRemainingItems ) - 1; i >= 0; i-- ) {
      var pnID = $(previousNeighbours[i]).children('h4').attr('id');
      neighboursArray['previous'].push( pnID );
    }
    // force break here bc jumping to previous main section not implemented yet
    break;
  }

  neighboursArray['next'] = [];
  while( neighboursArray['next'].length < a ) {
    var numRemainingItems = a - neighboursArray['next'].length;
    // only add not already loaded sections to the array
    var nextNeighbours = $( '#' + id ).parent().nextAll( 'div.sect3:not([data-status="loaded"])' );
    for( var i = 0; i < Math.min( nextNeighbours.length, numRemainingItems ); i++ ) {
      var nnID = $(nextNeighbours[i]).children('h4').attr('id');
      neighboursArray['next'].push( nnID );
    }
    // force break here bc jumping to next main section not implemented yet
    break;
  }
  return neighboursArray;
}

function insertContent( element, delay=1000 ) {
  if(element.attr('data-status') === 'loaded') { return true; } else { element.attr('data-status', 'loaded'); }

  element.addClass('render-sandbox');
  var snippetId = element.children('h4').attr('id');
  $.get("/buildscripts/split-pages/" + snippetId + ".html", function(data) {
    element.append(data);
  //  $('#console').html('loading ' + $('#' + snippetId).text() );
    var elementHeight = element[0].scrollHeight;
    //console.log('height of ' + snippetId + ' = ' + elementHeight);
    //console.log(element);
    // must use setTimeout, else height will always be wrong
    setTimeout(function(){
      //console.log('st height of ' + snippetId + ' = ' + element[0].scrollHeight);
      //console.log('st height of ' + snippetId + ' = ' + element.height());
      //console.log('st height of ' + snippetId + ' = ' + element.css("height"));
      //console.log('st height of ' + snippetId + ' = ' + element[0].getBoundingClientRect().height);
      console.log('st height of ' + snippetId + ' = ' + window.getComputedStyle(element[0]).height);
      setTimeout(function(){
        element.removeClass('render-sandbox');
      },0);
    },delay);
  });
}




$('#generated-toc li.tocify-item').on("mouseenter mousedown touchstart", function(event) {
  var uid = $(this).attr('data-unique');
  //look for div with this id, not for h4 bc h4 sometimes have different id
  var udiv = $('div[data-unique="' + uid + '"]');
  // if element exists...
  if($(udiv).length) {
    var h = $(udiv).next();
    if($(h).is('h4')) {
      var contentID = $(h).attr('id');
    }
    else {
      var contentID = $(udiv).nextAll().find('h4')[0].id;
      console.log('contentID:' + contentID);
    }
      if(event.type == 'mousedown' || event.type == 'touchstart') {
        console.log('mousedown for ' + contentID);
        insertContent($('#' + contentID).parent() ,0);
      }
      else if(event.type == 'mouseenter') {
        console.log('mouseenter for ' + contentID);
        //lazyloadContent(contentID, 2500, 1, 0);
      }

  }
});


var snippetsArray = $('h4');
var idArray = [];
var contentElementsArray = [];

for(var i=0; i<snippetsArray.length; i++) {
  var snippetId = snippetsArray[i]['id'];
  console.log(i + ' ' + snippetId);
  contentElementsArray.push( $( '#' + snippetId ).parent() );
  idArray.push(snippetId);
}

var urlHash = getUrlHash();
if(urlHash != '') {
  // insert without delay
  var firstElementId = idArray.indexOf(urlHash);
  for(var i=firstElementId; i>firstElementId-15; i--) {
    console.log('priority loading of ' + idArray[i]);
    insertContent(contentElementsArray[i], i*10);
  }
}

//console.log(contentElementsArray[163]);
//insertContent(contentElementsArray[163]);
for(var i=0; i<4; i++) {
  insertContent(contentElementsArray[i], i*10);
}
/*
for(var i=150; i<snippetsArray.length; i++) {
  var currentElement = contentElementsArray[i];
  setTimeout(insertContent.bind(null, currentElement), 10*i+5000);
}
*/
for(var i=snippetsArray.length-1; i>195; i--) {
  var currentElement = contentElementsArray[i];
  setTimeout(insertContent.bind(null, currentElement), 200*i);
}
