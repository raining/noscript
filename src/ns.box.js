/**
 * Это внутренний класс, который не должен использоваться приложением.
 * @classdesc Box - это тип View, который умеет выбирать какие View показывать.
 * @param {string} id
 * @param {object} params
 * @constructor
 * @private
 */
ns.Box = function(id, params) {
    this.id = id;
    this.params = params;

    this.views = {};

    // у бокса нет декларации и ключ строить не надо
    this.key = ns.Box.getKey(id);

    this.node = null;

    /**
     * Активные (видимые) в данный момент виды.
     * @private
     * @type {object}
     */
    this.active = {};

    this._visible = false;

    this.info = {
        isBox: true,
        isCollection: false
    };
};

/**
 * Возвращает ключ вида
 * @param {string} id Название вида
 * @param {object} params Параметры для ключа
 * @param {ns.L} type Тип
 * @returns {string}
 * @private
 */
ns.Box.prototype._getViewKey = function(id, params, type) {
    var key;
    if (type === ns.L.BOX) {
        key = ns.Box.getKey(id);
    } else {
        key = ns.View.getKey(id, params);
    }

    return key;
};

/**
 *
 * @param {string} id
 * @param {object} params
 * @param {string} type Тип вида.
 * @returns {ns.View}
 * @private
 */
ns.Box.prototype._getView = function(id, params, type) {
    var key = this._getViewKey(id, params, type);
    return this.views[key];
};

/**
 *
 * @param {string} id
 * @param {object} params
 * @param {ns.L} type
 * @returns {ns.View}
 * @private
 */
ns.Box.prototype._addView = function(id, params, type) {
    var view = this._getView(id, params, type);
    if (!view) {
        if (type === ns.L.BOX) {
            view = new ns.Box(id, params);
        } else {
            view = ns.View.create(id, params, type === ns.L.ASYNC);
        }
        this.views[view.key] = view;
    }
    return view;
};

/**
 *
 * @param {array} descs
 * @returns {array}
 * @private
 */
ns.Box.prototype._getDescendantsAndSelf = function(descs) {
    var views = this.views;
    var active = this.active;

    descs.push(this);

    for (var id in active) {
        var view = views[ active[id] ];
        view._getDescendantsAndSelf(descs);
    }

    return descs;
};

/**
 * Ищем все новые блоки и блоки, требующие перерисовки.
 * @param {object} updated
 * @param {object} layout
 * @param {object} params
 * @private
 */
ns.Box.prototype._getRequestViews = function(updated, layout, params) {
    var layoutActive = {};
    for (var id in layout) {
        var childViewLayout = layout[id];
        //  Согласно новому layout'у здесь должен быть view с id/params.
        //  Создаем его (если он уже есть, он возьмется из this.views).
        var view = this._addView(id, params, childViewLayout.type);
        //  Идем вниз рекурсивно.
        view._getRequestViews(updated, childViewLayout.views, params);

        layoutActive[id] = view.key;
    }

    // сохраняем новый активный layout, в дальнейшем работает с ним
    this.active = layoutActive;
};

/**
 * Боксы всегда валидные, т.е. не toplevel, поэтому просто идем вниз по дереву.
 * @param {object} tree
 * @param {object} params
 * @private
 */
ns.Box.prototype._getUpdateTree = function(tree, params) {
    if ( this.isNone() ) {
        tree.views[this.id] = this._getViewTree(params);

    } else {
        for (var id in this.active) {
            var viewKey = this.active[id];
            this.views[viewKey]._getUpdateTree(tree, params);
        }
    }
};

/**
 * Строим дерево блоков.
 * @param {object} params
 * @returns {object}
 * @private
 */
ns.Box.prototype._getViewTree = function(params) {
    var tree = this._getCommonTree();

    for (var id in this.active) {
        var viewKey = this.active[id];
        tree.views[id] = this.views[viewKey]._getViewTree(params);
    }

    return tree;
};

ns.Box.prototype.beforeUpdateHTML = function(params, events) {
    var activeLayout = this.active;
    for (var viewId in activeLayout) {
        var viewKey = activeLayout[viewId];
        //  Достаем ранее созданный блок (в _getRequestViews).
        /** @type {ns.View} */
        var view = this.views[viewKey];
        view.beforeUpdateHTML(params, events);
    }

    this._hideInactiveViews(events);
};

/**
 * Скрываем все неактивные виды в боксе
 * @param {object} events
 * @private
 */
ns.Box.prototype._hideInactiveViews = function(events) {
    var hideEvents = events['ns-view-hide'];
    // Пройдёмся по всем вложенным видам, чтобы кинуть hide, которым не попали в newLayout
    for (var key in this.views) {
        var view = this.views[key];
        // Если вид не входит в новый active
        if (this.active[view.id] !== view.key) {

            // Скроем виды, не попавшие в layout
            var descs = view._getDescendantsAndSelf( [] );
            for (var i = 0, l = descs.length; i < l; i++) {
                // Метод #_hide сам все сделает по правильной логике
                descs[i]._hide(hideEvents);
            }
        }
    }
};

/**
 * Обновляем бокс.
 * @param {HTMLElement} node
 * @param {object} layout
 * @param {object} params
 * @param {object} options
 * @param {object} events
 * @private
 */
ns.Box.prototype._updateHTML = function(node, layout, params, options, events) {
    var oldNode;
    // Если
    //  - старой ноды не было
    //  - или этот box не toplevel (т.е. родительский view обновил свою ноду)
    if (!this.node || !options.toplevel) {
        // Ищем новую ноду бокса.
        var newNode = ns.byClass('ns-view-' + this.id, node)[0];
        // И если есть
        if (newNode) {
            // Сохраним ссылку на старую ноду
            oldNode = this.node;
            // Обновим ноду бокса
            this.node = newNode;
        }
    }

    if (!this.node) {
        throw new Error("[ns.Box] Can't find node for '" + this.id + "'");
    }

    var views = this.views;

    //  Строим новый active согласно layout'у.
    //  Т.е. это тот набор блоков, которые должны быть видимы в боксе после окончания всего апдейта
    //  (включая синхронную и все асинхронные подапдейты).
    for (var id in layout) {
        var selfLayout = layout[id];
        var key = this._getViewKey(id, params, selfLayout.type);

        //  Достаем ранее созданный блок (в _getRequestViews).
        /** @type {ns.View} */
        var view = views[key];

        //  Обновляем его.
        view._updateHTML(node, selfLayout.views, params, options, events);

        // Вставка ноды в DOM будет выполнена во время сортировки нод в боксе (ниже).
    }

    // Пройдёмся по всем вложенным видам,
    // чтобы перенести ноды вложенных видов в новую ноду бокса (если есть)
    this._transferViewsToNewNode(oldNode);

    //  Сортируем ноды видов внутри бокса. Попутно добавляются новые ноды видов.
    this._sortViewNodes();

    this._show();
};

/**
 * Сортировка видов внутри бокса.
 * Новые ноды видов также добавляются тут.
 * @private
 */
ns.Box.prototype._sortViewNodes = function() {
    var active = this.active;
    var views = this.views;

    // Итератор по HTMLCollection, который возвращает видимые ноды видов.
    var viewNodesIterator = (function(children) {
        var position = -1;
        var childrenCount = children.length;
        return {
            getNext: function() {
                for (position += 1; position < childrenCount; position++) {
                    if (ns.hasClass(children[position], 'ns-view-visible')) {
                        return children[position];
                    }
                }
                return null;
            }
        };
    })(this.node.children);

    for (var viewId in active) {
        var viewKey = active[viewId];
        var view = views[viewKey];
        var cursorViewNode = viewNodesIterator.getNext();

        if (cursorViewNode !== view.node) {
            if (cursorViewNode) {
                this.node.insertBefore(view.node, cursorViewNode);
            } else {
                this.node.appendChild(view.node);
            }
        }
    }
};

/**
 * Переносит неактивные виды из старой ноды в новую после перерисовки бокса.
 * @param {HTMLElement} oldNode
 * @private
 */
ns.Box.prototype._transferViewsToNewNode = function(oldNode) {
    // если старой ноды нет, то значит бокс не перерисовывался
    if (!oldNode) {
        return;
    }

    var views = this.views;
    for (var key in views) {
        var view = views[key];
        // Если вид не входит в новый active
        if (this.active[view.id] !== view.key) {
            var viewNode = view.node;
            // Если нода вида лежит в старой ноде бокса
            if (oldNode.contains(viewNode)) {
                // Перенесём её в новую ноду бокса (сам вид скрыт).
                this.node.appendChild(viewNode);
            }
        }
    }
};

/**
 *
 * @returns {boolean}
 * @private
 */
ns.Box.prototype._show = function() {
    if (this._visible === false) {
        this._showNode();
        this._visible = true;
        // always returns false to prevent events trigger
    }

    return false;
};

/**
 * Скрывает view
 * @returns {Boolean}
 * @protected
 */
ns.Box.prototype._hide = function() {
    if (this._visible === true) {
        this._hideNode();
        this._visible = false;
        // always returns false to prevent events trigger
    }

    return false;
};

/**
 * Returns true if box has status NONE
 * @returns {boolean}
 */
ns.Box.prototype.isNone = function() {
    return !this.node;
};

// копируем нужные методы из ns.View
ns.Box.prototype._getCommonTree = ns.View.prototype._getCommonTree;
ns.Box.prototype._hideNode = ns.View.prototype._hideNode;
ns.Box.prototype._showNode = ns.View.prototype._showNode;

ns.Box.prototype.isOk = no.true;
ns.Box.prototype.isLoading = no.false;

/**
 * Создает ключ для ns.Box.
 * @param {string} id Название ns.Box.
 * @returns {string}
 * @static
 */
ns.Box.getKey = function(id) {
    return 'box=' + id;
};
