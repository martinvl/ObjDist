var inherits = require('inherits');
var KVCObject = require('kvcobj');

var DEFAULT_OPTIONS = {
    prefix:'root'
};

function ObjDist(transport, options) {
    KVCObject.prototype.constructor.apply(this, [options]);

    this._transport = transport;

    this._setOptions(options, DEFAULT_OPTIONS);
    this._initialize();
}

module.exports = ObjDist;
inherits(ObjDist, KVCObject);

ObjDist.prototype._initialize = function () {
    this._options.delimiter = '/';
    this._namespaces = {};
    this._createNamespaceForKeypath('');

    var self = this;
    this.on('_create', function (keypath) {
        self._createNamespaceForKeypath(keypath);
    });

    this.on('update', function (updated) {
        self._publishUpdate(updated);
    });

    this.on('_delete', function (keypath) {
        self._deleteNamespaceForKeypath(keypath);
    });
};

// --- namespace handling ---
ObjDist.prototype._setupNamespaceHandling = function () {
    var self = this;
    this.on('_create', function (keypath) {
        self._createNamespaceForKeypath(keypath);
    });

    this.on('_delete', function (keypath) {
        self._deleteNamespaceForKeypath(keypath);
    });
};

ObjDist.prototype._createNamespaceForKeypath = function (keypath) {
    if (this._hasNamespaceForKeypath(keypath)) {
        return;
    }

    var channel = this._getChannelForKeypath(keypath);
    var namespace = this._transport.of(channel);

    var self = this;
    namespace.on('connection', function (socket) {
        self._addConnection(socket, keypath);
    });

    this._namespaces[keypath] = namespace;
};

ObjDist.prototype._deleteNamespaceForKeypath = function (keypath) {
    if (!this._hasNamespaceForKeypath(keypath)) {
        return;
    }

    var namespace = this._namespaces[keypath];

    namespace.removeAllListeners();
    namespace.emit('close');

    delete this._namespaces[keypath];
};

ObjDist.prototype._hasNamespaceForKeypath = function (keypath) {
    return this._namespaces[keypath] !== undefined;
};

ObjDist.prototype._getChannelForKeypath = function (keypath) {
    var prefix = this._prefix(this._options.prefix, this._options.delimiter);

    return this._prefixKeypath(keypath, prefix);
};

// --- publishing ---
ObjDist.prototype._publishBase = function (transport) {
    transport = transport || this._transport;

    transport.emit('create', this.getObject());
};

ObjDist.prototype._publishUpdate = function (updated) {
    for (var keypath in this._namespaces) {
        this._publishChangeForChannel(updated, keypath);
    }
};

ObjDist.prototype._publishChangeForChannel = function (updated, superpath) {
    var namespace = this._namespaces[superpath];
    var change = {updated:{}, deleted:[]};

    // find relevant updates
    for (var keypath in updated) {
        if (this._isSuperpath(keypath, superpath)) {
            var value = updated[keypath];
            keypath = this._unprefixKeypath(keypath, superpath);

            if (value !== undefined) {
                change.updated[keypath] = value;
            } else {
                change.deleted.push(keypath);
            }
        }
    }

    if (this._objectSize(change.updated) == 0) {
        delete change.updated;
    }

    if (change.deleted.length == 0) {
        delete change.deleted;
    }

    if (this._objectSize(change) > 0) {
        namespace.emit('update', change);
    }
};

// --- connection handling ---
ObjDist.prototype._addConnection = function (socket, keypath) {
    socket.emit('create', this.getObjectForKeypath(keypath));
};

// Helper functions
ObjDist.prototype._hasPrefix = function (base, prefix) {
    return base.substr(0, prefix.length) == prefix;
};

ObjDist.prototype._prefix = function (base, prefix) {
    if (this._hasPrefix(base, prefix)) {
        return base;
    } else {
        return prefix + base;
    }
};
