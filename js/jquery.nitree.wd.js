(function($){
    var methods = {
        init : function(options) {
            var defaults = {
                treeData: [{'label': 'Empty tree'}],
                inner_util_class: 'ni_inner_util_class'
            };
            options = $.extend(defaults, options);
            function addNodes($el, treeData, root){
                treeData.forEach(function(child){
                    child.attributes = child.attributes || {};
                    $.each(child.attributes, function(key, value){
                        child.attributes[key] = $.isArray(value) ? value.join(' ') : value;
                    });
                    if(child.id){
                        child.attributes.id = child.id;
                    }
                    var $ul = $('<ul>', root ? {'class': 'ni_tree'} : {}),
                        $li = $('<li>', child.attributes),
                        $label = $('<span/>').html(child.label);
                    $li.append($label);
                    $ul.append($li);
                    $el.append($ul);
                    if(child.children){
                        addNodes($li, child.children);
                    }
                });
            }
            function init_tree_open_close($parentElement, except_class){
                //get the relevant elemants
                var $elements = $parentElement.find('li');
                if(except_class){
                    $elements = $elements.filter(':not(.' + except_class + ')');
                }

                //append checkboxes
                $elements
                    .filter(':not(.ni_tree_no_checkbox)')
                    .prepend($('<input>', {'type': 'checkbox', 'class': 'ni_tree_checkbox'}));


                //if it's about appending a subtree (e.i. there is except_class) then open/close control should be appended also to the $parentElement if it didn't have subtree before
                if(except_class && !$parentElement.closest('ul').hasClass('has_subtree')){
                    $parentElement.addClass('has_subtree');
                    $elements = $elements.add($parentElement);
                }

                //append open/close control
                $elements
                    .has('ul')
                    .prepend($('<span>', {'class': 'ni_tree_ctrl'}))
                    .parent().addClass('has_subtree');

                //open/close functionality for the tree
                $elements.find('.ni_tree_ctrl').on('click.ni_tree_open_close', function(){
                    $(this).closest('li')
                        .toggleClass('ni_tree_close');
                });
            }

            //disable the checkboxes of the empty lists (empty = doesn't have li-children with checkboxes)
            function disable_checkboxes_for_empty_lists($tree, number_of_effected){
                var $empty_lists = $tree.find('li').add($tree) //add $tree itself so when the subtree without checkboxes is added the $tree's checkbox will be disabled
                    .has('li')
                    .filter(':not(:has(li .ni_tree_checkbox))');
                $empty_lists.children('.ni_tree_checkbox').prop('disabled', true);
                $empty_lists.children('.ni_tree_checkbox')
                    .removeClass('ni_tree_checkbox')
                    .addClass('ni_tree_checkbox_disabled');
                if($empty_lists.length && (number_of_effected != $empty_lists.length)){
                    disable_checkboxes_for_empty_lists($tree, $empty_lists.length);
                }
            }

            function init_checking_behavior($tree){
                $tree.find('.ni_tree_checkbox').on('change.ni_tree_checking_behavior', function(){
                    var checked = $(this).is(':checked');
                    $(this).parent().find('.ni_tree_checkbox')
                        .prop('checked', checked)
                        .prop('indeterminate', false);

                    $(this).prop("indeterminate", false);
                    $(this).parents('li')
                        .each(function(){
                            var $container_li = $(this).parents('li:first');
                            var $containers_checkboxes = $container_li.children('input.ni_tree_checkbox');
                            $containers_checkboxes.prop("indeterminate", false);
                            if ($container_li.find('li input.ni_tree_checkbox:not(:checked)').length) {
                                $containers_checkboxes.prop('checked', false);
                                if ($container_li.find('li input.ni_tree_checkbox:checked').length) {
                                    $containers_checkboxes.prop("indeterminate", true);
                                }
                            } else {
                                $containers_checkboxes.prop('checked', true);
                            }
                        });
                });
                $tree.find('li.ni_tree_init_checked>.ni_tree_checkbox')
                    .prop('checked', true)
                    .change();
            }
            return this.each(function() {
                if(!options.parentNodeID){
                    addNodes($(this), options.treeData, true);

                    init_tree_open_close($(this));
                    disable_checkboxes_for_empty_lists($(this));
                    init_checking_behavior($(this));
                } else {
                    var $parentNode = $(this).find('#' + options.parentNodeID);
                    //mark the existing nodes under the parentNode so we don't effect them again
                    $parentNode.find('li').addClass(options.inner_util_class);

                    //append the subtree and add functionality
                    addNodes($parentNode, options.treeData, false);
                    init_tree_open_close($parentNode, options.inner_util_class);
                    disable_checkboxes_for_empty_lists($(this));//$(this) - because appending leafs can effect parents
                    init_checking_behavior($parentNode);

                    //remove the mark the existing nodes
                    $parentNode.find('li').removeClass(options.inner_util_class);
                }
            });
        },
        //options example: {selected: false, leafsOnly: true} - get unselected leafs
        get: function(options){
            var defaults = {selected: true, attributeToSelect: 'id'};
            options = $.extend(defaults, options);
            var $lis = this;
            if(options.leafsOnly){
                $lis = this.find('li:not(:has(ul))');
            }
            var $treeCheckboxes;
            if(options.selected){
                $treeCheckboxes = $lis.find('.ni_tree_checkbox:checked');
            } else {
                $treeCheckboxes = $lis.find('.ni_tree_checkbox:not(:checked)');
            }
            return $treeCheckboxes.map(function(){
                return $(this).parent().attr(options.attributeToSelect);
            }).toArray();
        },
        expandAll : function() {
            this.find('.has_subtree').children('li').removeClass('ni_tree_close');
            return this;
        },
        collapseAll : function() {
            this.find('.has_subtree').children('li').addClass('ni_tree_close');
            return this;
        }
    };

    $.fn.niTree = function(methodOrOptions) {
        if(methods[methodOrOptions] ){
            return methods[ methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            // Default to "init"
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.niTree');
        }
    };

})(jQuery);
