var assert = require('chai').assert;
var io = require('socket.io');
var io_client = require('socket.io-client');
var SyncedKVCObject = require('../lib/SyncedKVCObject');

var PORT = 4444;

suite('SyncedKVCObject', function() {
    before(function () {
        this.server = io.listen(PORT).set('log level', 0);
    });

    setup(function (done) {
        var self = this;
        this.server.once('connection', function (socket) {
            self.serverSide = new SyncedKVCObject(socket);
            done();
        });

        this.socket = io_client.connect('http://localhost', {port:PORT, 'force new connection':true});
        this.clientSide = new SyncedKVCObject(this.socket);
    });

    teardown(function () {
        this.socket.removeAllListeners();
        this.socket.disconnect();

        this.clientSide.removeAllListeners();
        this.serverSide.removeAllListeners();
    });

    test('Emits updates from server side', function (done) {
        var obj = {foo:'bar'};

        this.clientSide.on('update', function (updated) {
            assert.deepEqual(updated, obj);
            done();
        });

        this.serverSide.setObject(obj);
    });

    test('Emits updates from client side', function (done) {
        var obj = {foo:'bar'};

        this.serverSide.on('update', function (updated) {
            assert.deepEqual(updated, obj);
            done();
        });

        this.clientSide.setObject(obj);
    });

    test('Emits mixed updates as expected', function (done) {
        var firstObj = {foo:'bar'};
        var secondObj = {foo:'bar', man:{name:'johnny'}};

        var self = this;
        this.clientSide.once('update', function (updated) {
            assert.deepEqual(updated, firstObj);

            self.clientSide.setObject(secondObj);
        });

        this.serverSide.setObject(firstObj);

        this.serverSide.on('update', function (updated) {
            assert.deepEqual(updated, {'man.name':'johnny'});

            assert.deepEqual(self.serverSide.getObject(), secondObj);
            assert.deepEqual(self.clientSide.getObject(), secondObj);

            done();
        });
    });

    test('Emits deletes as expected', function (done) {
        var obj = {foo:'bar', man:{name:'johnny'}};

        var self = this;
        this.serverSide.once('update', function (updated) {
            assert.deepEqual(self.serverSide.getObject(), obj);

            self.serverSide.setValueForKeypath(undefined, 'man.name');
        });

        this.clientSide.setObject(obj);

        this.clientSide.on('update', function (updated) {
            assert.deepEqual(updated, {'man.name':undefined});
            assert.deepEqual(self.clientSide.getObject(), {foo:'bar'});

            done();
        });
    });
});
