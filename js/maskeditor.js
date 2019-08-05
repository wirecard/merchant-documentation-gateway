var maskArray = [];
var levelPrefixes = ['', 's', 'i'];

// by default all are unchecked
// initialize by checking those which are no included in blacklist (=blacklistArray)
function initCheckboxes(items) {

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    //if included in blacklistArray, then uncheck the box

    //TODO make robust for non editor generated mask. e.g. gibberish where
    // mask contains e.g. 2-2s0-3 meaning 2 will first be hidden, then enabled
    // again.
    var cb = $('li[id="' + item.id + '"] > input[type="checkbox"]');
    if (blacklistArray.includes(item.id) === true) {
      cb.click();
    }
    cb.next().click(function () {
      window.location.href = '#' + $(this).parent().attr('id');
    });
    initCheckboxes(item.children);
  }
}

function resetItems(items) {
  items = (typeof items !== 'undefined') ? items : tocArray;
  /*
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var elementID = item['attributes']['element'];
    $('#' + elementID).parent().show();
    if(item.children.length > 0) {
      resetItems(item.children);
    }
    console.log('show ' + elementID);
  }
  */
  $('#generated-toc .tocify-header, #generated-toc .tocify-subheader, #generated-toc .tocify-item').show();
  $('.sect1, .sect2, .sect3').show();
}

function generateMask(elements, maskStr, level) {

  if (level == 0) maskArray = [];
  for (var i = 0; i < elements.length; i++) {

    var item = elements[i];
    var checkboxElement = $('li[id="' + item.id + '"] > input[type="checkbox"]');

    if ($(checkboxElement).is(':checked')) {
      //console.log('element is checked: ' + item.id);
      continue;
    }
    if ($(checkboxElement).is(':checked') === false && $(checkboxElement).is(':indeterminate') === false) {
      //console.log('element is unchecked: ' + item.id);
      maskArray.push(maskStr + levelPrefixes[level] + i);
    }
    if ($(checkboxElement).is(':indeterminate')) {
      //console.log('element is undetermined: ' + item.id);
      generateMask(item.children, maskStr + levelPrefixes[level] + i, level + 1);
    }

  }

}


function generateInvertedMask(elements, maskStr, level) {

  if (level == 0) maskArray = [];
  for (var i = 0; i < elements.length; i++) {

    var item = elements[i];
    var checkboxElement = $('li[id="' + item.id + '"] > input[type="checkbox"]');

    if ($(checkboxElement).is(':checked') === false && $(checkboxElement).is(':indeterminate') === false) {
      //console.log('element is checked: ' + item.id);
      continue;
    }
    if ($(checkboxElement).is(':checked') === true) {
      //console.log('element is unchecked: ' + item.id);
      maskArray.push(maskStr + levelPrefixes[level] + i);
    }
    if ($(checkboxElement).is(':indeterminate') === true) {
      //console.log('element is undetermined: ' + item.id);
      generateInvertedMask(item.children, maskStr + levelPrefixes[level] + i, level + 1);
    }

  }

}

function createCustomURL() {
  if (maskArray.length > 0) {
    var maskString = maskArray.join('-');
    resetItems();
    applyMask(maskString);
    var customUrl = window.location.href.split('?')[0] + '?' + LZString.compressToEncodedURIComponent(maskString);
    $('#customurlinput').val((customUrl.length > 2083) ? 'invalid URL' : customUrl);
  }
  else {
    resetItems();
    applyMask('');
    $('#customurlinput').val(window.location.href.split('?')[0]);
  }
}

//$(
function initMaskEditor(tocArray) {
  var masktree = $('#masktree').niTree({ treeData: tocArray });

  $('#customurlpreviewbtn').click(function () {
    window.open($('#customurlinput').val());
  });
  $('#customurlinput').click(function () {
    this.select();
  });
  $('#maskeditor').show();
  $('.ni_tree_checkbox').prop('checked', true);
  initCheckboxes(tocArray);

  var uncheckedBoxesArray = masktree.niTree('get', { selected: false, attributeToSelect: 'id' });

  generateMask(tocArray, '', 0);
  createCustomURL();

  $('.ni_tree_checkbox').change(function (element) {
    generateMask(tocArray, '', 0);
    createCustomURL();
  });
}

