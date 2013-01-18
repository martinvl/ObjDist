var inherits = require('util').inherits;
var KVCObject = require('KVCObject');

function SyncedKVCObject(socket, options) {
    KVCObject.prototype.constructor.apply(this, [options]);

    this._socket = socket;
    this._initialize();
}

inherits(SyncedKVCObject, KVCObject);
module.exports = SyncedKVCObject;

SyncedKVCObject.prototype._initialize = function () {
    this._justReceivedUpdate = false;

    // handle incomming updates
    var self = this;

    this._socket.on('update', function (payload) {
        self._receiveUpdate(payload);
    });

    this.on('update', function (updated) {
        self._sendUpdate(updated);
    });
};

SyncedKVCObject.prototype._receiveUpdate = function (payload) {
    var updated = this._dismantlePayload(payload);

    for (var keypath in updated) {
        this.setValueForKeypath(updated[keypath], keypath, true);
    }

    if (this._hasChanges()) {
        this._justReceivedUpdate = true;
        this._emitChanges();
    }
};

SyncedKVCObject.prototype._sendUpdate = function (updated) {
    if (!this._justReceivedUpdate) {
        var payload = this._assemblePayload(updated);

        if (this._objectSize(payload) > 0) {
            this._socket.emit('update', payload);
        }
    }

    this._justReceivedUpdate = false;
};

SyncedKVCObject.prototype._assemblePayload = function (updated) {
    var payload = {updated:{}, deleted:[]};

    // add updates ad deletes to payload
    for (var keypath in updated) {
        var value = updated[keypath];

        if (value !== undefined) {
            payload.updated[keypath] = value;
        } else {
            payload.deleted.push(keypath);
        }
    }

    // trim payload so it contains only necessary data
    if (this._objectSize(payload.updated) == 0) {
        delete payload.updated;
    }

    if (payload.deleted.length == 0) {
        delete payload.deleted;
    }

    return payload;
}

SyncedKVCObject.prototype._dismantlePayload = function (payload) {
    var updated = {};

    if (payload.updated !== undefined) {
        for (var keypath in payload.updated) {
            updated[keypath] = payload.updated[keypath];
        }
    }

    if (payload.deleted !== undefined) {
        for (var idx in payload.deleted) {
            var keypath = payload.deleted[idx];

            updated[keypath] = undefined;
        }
    }

    return updated;
};
