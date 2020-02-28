function enableRequestDetailsHideShow() {
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
    var sampleTabs = $('.discrete.sample-tabs');
    sampleTabs.each(function () {
        if ($(this).hasClass('tabs-enabled'))
            return;
        $(this).addClass('tabs-enabled');
        const headlineElement = $(this);
        var xmlTabWrap = $('<div class="xmlTabWrap">');
        var xmlTabElements = $(this).siblings('.tab-xml').nextUntil('h2,h3,h4,h5,h6,h7,h8');
        xmlTabWrap.append(xmlTabElements);
        $(this).after(xmlTabWrap);

        var jsonTabWrap = $('<div class="jsonTabWrap">');
        var jsonTabElements = $(this).siblings('.tab-json').nextUntil('h2,h3,h4,h5,h6,h7,h8');
        jsonTabWrap.append(jsonTabElements);
        $(this).after(jsonTabWrap);
 
        var nvpTabWrap = $('<div class="nvpTabWrap">');
        var nvpTabElements = $(this).siblings('.tab-nvp').nextUntil('h2,h3,h4,h5,h6,h7,h8');
        nvpTabWrap.append(nvpTabElements);
        $(this).after(nvpTabWrap);

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
                class: 'btn-samples-tab ' + contentType
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