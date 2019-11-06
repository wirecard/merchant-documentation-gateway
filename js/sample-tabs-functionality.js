function enableRequestDetailsHideShow() {
    console.log("enableRequestDetailsHideShow");
    $('table.r-details > caption').each(function () {
        if ($(this).hasClass('hide-show-enabled')) {
            return;
        }
        $(this).addClass('hide-show-enabled');
        $(this).unbind();
        $(this).on('click touch', function (e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).toggleClass('r-details-expanded');
            return false;
        });
    });
}

function createSampleTabs() {
    console.log("createSampleTabs");
    var sampleTabs = $('div.sample-tabs');
    sampleTabs.each(function () {
        if ($(this).hasClass('tabs-enabled'))
            return;
        $(this).addClass('tabs-enabled');
        const headlineElement = $(this).children('h3,h4,h5').first();
        if (headlineElement.length == 0) {
            return false;
        }

        var xmlTab = $(this).children('div.tab-xml').first();
        var xmlTabWrap = $('<div class="xmlTabWrap">');
        var xmlTabElements = $(this).children('div.tab-xml').children(':nth-child(-n+5)');
        xmlTabWrap.append(xmlTabElements);
        xmlTab.prepend(xmlTabWrap);

        var jsonTab = $(this).children('div.tab-json').first();
        var jsonTabWrap = $('<div class="jsonTabWrap">');
        var jsonTabElements = $(this).children('div.tab-json').children(':nth-child(-n+5)');
        jsonTabWrap.append(jsonTabElements);
        jsonTab.prepend(jsonTabWrap);

        var nvpTab = $(this).children('div.tab-nvp').first();
        var nvpTabWrap = $('<div class="nvpTabWrap">');
        var nvpTabElements = $(this).children('div.tab-nvp').children(':nth-child(-n+5)');
        nvpTabWrap.append(nvpTabElements);
        nvpTab.prepend(nvpTabWrap);

        var Tabs = {
            xml: (xmlTabElements.length ? xmlTabWrap : undefined),
            json: (jsonTabElements.length ? jsonTabWrap : undefined),
            nvp: (nvpTabElements.length ? nvpTabWrap : undefined)
        };

        Object.keys(Tabs).forEach(function (key) {
            return Tabs[key] == null && delete Tabs[key];
        });

        var _btnrow = $('<div/>', { class: 'btn-samples-row' });
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
                }
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