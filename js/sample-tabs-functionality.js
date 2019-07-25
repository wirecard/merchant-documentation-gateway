function enableRequestDetailsHideShow() {
    $('table.r-details > caption').each(function () {
        $(this).on('click touch', function () {
            $(this).toggleClass('r-details-expanded');
            $(this).siblings('tbody').toggle();
            $(this).siblings('thead').toggle();
        });
    });
}

function createSampleTabs() {
    var sampleTabs = $('div.sample-tabs');
    sampleTabs.each(function () {
        const headlineElement = $(this).children('h3,h4,h5').first();
        if (headlineElement.length == 0) {
            return false;
        }
        const headlineAnchor = headlineElement.children('a.link').last(); // make sure this selector is not too strict
        const xmlTab = $(this).children('div.tab-xml').first();
        const jsonTab = $(this).children('div.tab-json').first();
        const nvpTab = $(this).children('div.tab-nvp').first();
        var Tabs = {
            xml: (xmlTab.length ? xmlTab : undefined),
            json: (jsonTab.length ? jsonTab : undefined),
            nvp: (nvpTab.length ? nvpTab : undefined)
        };
        Object.keys(Tabs).forEach(function (key) {
            return Tabs[key] == null && delete Tabs[key];
          });
        var _btnrow = $('<div/>', { class: 'btn-samples-row'});
        for (var contentType in Tabs) {
            const _tab_self = Tabs[contentType];
            var _btn = $('<button/>', {
                text: contentType.toUpperCase(),
                class: 'btn-samples-tab'
            });
            _btn.on('click touch', function () {
                //hide all. show yourself
                for (var t in Tabs) {
                    $(Tabs[t]).hide();
                };
                $(this).addClass('active');
                $(this).siblings('.btn-samples-tab').removeClass('active');
                $(_tab_self).show();
            });
            _btn.appendTo(_btnrow);
        }
        _btnrow.insertAfter(headlineElement);
        $(_btnrow).children('button').first().click();
    });
}

enableRequestDetailsHideShow();
createSampleTabs();