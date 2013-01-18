var inherits = require('util').inherits;
var KVCObject = require('KVCObject');

// --- Defaults ---
var DEFAULT_OPTIONS = {
    prefix:'root'
};

function IODistributor(server, options) {
    KVCObject.prototype.constructor.apply(this, [options]);

    this.server = server;
    this.initialize();
}

inherits(IODistributor, KVCObject);
module.exports = IODistributor;

IODistributor.prototype.initialize = function () {
    this._options.delimiter = '/';
    this._namespaces = {};
    this.createNamespaceForKeypath('');

    var self = this;
    this.on('_create', function (keypath) {
        self.createNamespaceForKeypath(keypath);
    });

    this.on('update', function (updated) {
        self.publishUpdate(updated);
    });

    this.on('_delete', function (keypath) {
        self.deleteNamespaceForKeypath(keypath);
    });
};

IODistributor.prototype._setOptions = function (options) {
    KVCObject.prototype._setOptions.apply(this, [options]);

    for (var key in DEFAULT_OPTIONS) {
        this._options[key] = options[key] || DEFAULT_OPTIONS[key];
    }
};

IODistributor.prototype.createNamespaceForKeypath = function (keypath) {
    if (this.hasNamespaceForKeypath(keypath)) {
        return;
    }

    var channel = this._options.delimiter + this._prefixKeypath(keypath, this._options.prefix);
    var namespace = this.server.of(channel);

    var self = this;
    namespace.on('connection', function (socket) {
        self.addConnection(socket, keypath);
    });

    this.setNamespaceForKeypath(namespace, keypath);
};

IODistributor.prototype.hasNamespaceForKeypath = function (keypath) {
    return this.getNamespaceForKeypath(keypath) !== undefined;
};

IODistributor.prototype.getNamespaceForKeypath = function (keypath) {
    keypath = this._prefixKeypath(keypath);

    return this._namespaces[keypath];
};

IODistributor.prototype.setNamespaceForKeypath = function (namespace, keypath) {
    if (this.hasNamespaceForKeypath(keypath)) {
        this.deleteNamespaceForKeypath(keypath);
    }

    keypath = this._prefixKeypath(keypath);

    this._namespaces[keypath] = namespace;
};

IODistributor.prototype.deleteNamespaceForKeypath = function (keypath) {
    keypath = this._prefixKeypath(keypath);

    var namespace = this._namespaces[keypath];
    if (namespace === undefined) {
        return;
    }

    namespace.removeAllListeners();
    namespace.emit('close');

    delete this._namespaces[keypath];
};

IODistributor.prototype.deleteNamespaces = function () {
    for (var keypath in this._namespaces) {
        keypath = this._unprefixKeypath(keypath);

        this.deleteNamespaceForKeypath(keypath);
    }
};

IODistributor.prototype.publishUpdate = function (updated) {
    for (var superpath in this._namespaces) {
        this.publishChangeForSuperpath(updated, superpath);
    }
};

IODistributor.prototype.publishChangeForSuperpath = function (updated, superpath) {
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

IODistributor.prototype.addConnection = function (socket, keypath) {
    socket.emit('create', this.getObjectForKeypath(keypath));
};
