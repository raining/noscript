// ----------------------------------------------------------------------------------------------------------------- //
// no.Model
// ----------------------------------------------------------------------------------------------------------------- //

/**
    @constructor
    @param {string} id
    @param {Object} params
    @param {Object=} data
*/
no.Model = function(id, params, data) {
    this.init(id, params, data);
};

/**
    @param {string} id
    @param {Object} params
    @param {Object=} data
*/
no.Model.prototype.init = function(id, params, data) {
    this.id = id;
    this.params = params;

    this.setData(data);

    var info = this.info = no.Model._infos[id];

    if (info.maxage) {
        this.maxage = info.maxage;
    }

    this.key = no.Model.key(id, params, info);
};

// ----------------------------------------------------------------------------------------------------------------- //

// Typedefs.

/**
    @typedef {function(
        new:no.Model,
        string,
        Object,
        Object=
    )}
*/
no.Model.type_class;

/**
    @typedef {{
        id: string,
        keyParams: Object,
        reqParams: Object
    }}
*/
no.Model.type_info;

// ----------------------------------------------------------------------------------------------------------------- //

/** @type { Object.<string, no.Model.type_class> } */
no.Model._classes = {};

/** @type { Object.<string, no.Model.type_info> } */
no.Model._infos = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string | no.Model.type_info} info
    @param {no.Model.type_class=} class_
*/
no.Model.register = function(info, class_) {
    if (typeof info === 'string') {
        info = {
            'id': info
        };
    }

    var keyParams = info.keyParams = info.keyParams || {};
    info.reqParams = info.reqParams || keyParams;

    info.keysOrder = no.object.keys(keyParams).sort();

    var id = info.id;

    no.Model._infos[id] = info;
    no.Model._classes[id] = class_ || no.Model;

    no.cache.register(id, info);
};

/**
    @param {string} id
    @param {Object} params
    @param {Object=} data
    @return {no.Model}
*/
no.Model.create = function(id, params, data) {
    var class_ = no.Model._classes[id];

    return new class_(id, params, data);
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id
    @return {no.Model.type_info}
*/
no.Model.info = function(id) {
    return no.Model._infos[id];
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id
    @param {!Object} params
    @param {no.Model.type_info=} info
    @return {string}
*/
no.Model.key = function(id, params, info) {
    info || ( info = no.Model._infos[id] );

    var keyParams = info.keyParams;
    var keysOrder = info.keysOrder;

    var key = 'model=' + id;

    for (var i = 0, l = keysOrder.length; i < l; i++) {
        var pName = keysOrder[i];
        var pValue = params[pName] || keyParams[pName];
        if (pValue) {
            key += '&' + pName + '=' + pValue;
        }
    }

    return key;
};

// ----------------------------------------------------------------------------------------------------------------- //

no.Model.prototype.get = function(path) {
    return no.path.get( this.data, path );
};

no.Model.prototype.set = function(path, value, options) {
    var oldValue = no.path.set( this.data, path, value );
    if ( !options.silent && !no.isEqual( value, oldValue ) ) {
        /*
        this.trigger( 'change', {
            path: path,
            before: oldValue,
            after: value
        });
        */
    }
};

no.Model.prototype.getData = function() {
    return this.data;
};

no.Model.prototype.setData = function(data) {
    if (data) {
        this.data = this.processData(data);
        // this.trigger( 'change', {} ); // FIXME
    }
};

no.Model.prototype.processData = function(data) {
    return data;
};

// ----------------------------------------------------------------------------------------------------------------- //

no.Model.prototype.processParams = function(params) {
    return params;
};

// ----------------------------------------------------------------------------------------------------------------- //
// Кэширующие метода для no.Model.
// ----------------------------------------------------------------------------------------------------------------- //

no.Model._cache = {};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @typedef {{
        model: no.Model,
        timestamp: number
    }}
*/
no.Model.type_cacheItem;

// ----------------------------------------------------------------------------------------------------------------- //

no.Model.register = function(id, info) {
    no.Model._cache[id] = {};
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id                  id модели.
    @param {string|Object} key          key или params.
    @return {no.Model.type_cacheItem}   Возвращает соответствующую запись в кэше или null.
*/
no.Model.getRaw = function(id, key) {
    var key = (typeof key === 'string') ? key : no.Model.key(id, key);

    return no.Model._cache[id].items[key] || null;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id
    @param {string|Object} key
    @return {no.Model}
*/
no.Model.get = function(id, key) {
    var cached = no.Model.getRaw(id, key);
    if (cached) {
        return cached.model;
    }

    return null;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id
    @param {string|Object} key
    @return {(boolean|undefined)}
*/
no.Model.isCached = function(id, key) {
    var cached = no.Model.getRaw(id, key);
    if (!cached) { return; } // undefined означает, что кэша нет вообще, а false -- что он инвалидный.

    var maxage = cached.model.maxage; // Время жизни модели в милисекундах. После прошествии этого времени, модель будет считаться невалидной.
    if (maxage) {
        var now = +new Date();
        var timestamp = cached.timestamp;

        if (now - timestamp > maxage) {
            return false;
        }
    }

    return true;
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {no.Model} model
    @param {number} timestamp
*/
no.Model.set = function(model, timestamp) {
    var id = model.id;
    var key = model.key;

    timestamp || ( timestamp = +new Date() );

    var items = no.Model._cache[id].items;

    if (!items[key]) {
        items[key] = {
            model: model,
            timestamp: timestamp
        };
    } else {
        cached.model.setData( model.data );
        cached.timestamp = timestamp;
    }
};

// ----------------------------------------------------------------------------------------------------------------- //

/**
    @param {string} id
    @param {string} key
*/
no.Model.destroy = function(id, key) {
    delete no.Model._cache[id].items[key];
};

/**
    @param {string} id
    @param {function(no.Model) boolean=} condition
*/
no.Model.clear = function(id, condition) {
    if (condition) {
        var items = no.Model._cache[id];
        for (var key in items) {
            if (condition( items[key].model )) {
                no.Model.destroy(id, key);
            }
        }
    } else {
        no.Model._cache[id].items = {};
    }
};

