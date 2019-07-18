function enableRequestDetailsHideShow() {
    $('table.r-details > caption').each(function() {
        $(this).on('click touch', function() {
            $(this).toggleClass('r-details-expanded');
            $(this).siblings('tbody').toggle();
            $(this).siblings('thead').toggle();
        });
    });
}

enableRequestDetailsHideShow();
