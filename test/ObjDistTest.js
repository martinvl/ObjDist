var assert = require('chai').assert;
var io = require('socket.io');
var io_client = require('socket.io-client');
var ObjDist = require('../lib/ObjDist');
var ObjSync = require('objsync');

var PORT = 5555;

suite('ObjDist', function() {
    before(function () {
        this.server = io.listen(PORT).set('log level', 0);
    });

    setup(function () {
        this.dist = new ObjDist(this.server);
    });

    teardown(function () {
        this.dist.setObject({});
        this.dist._deleteNamespaceForKeypath('');
    });

    suite('internals', function() {
        test('sets default options as expected', function () {
            assert.deepEqual(this.dist._options, {prefix:'root', delimiter:'/'});
        });
    });

    suite('namespace handling', function() {
        test('creates root namespace upon init', function () {
            assert.deepEqual(Object.keys(this.dist._namespaces), ['']);
            assert.equal(this.dist._namespaces[''].name, '/root');
        });

        test('creates namespaces upon update', function () {
            this.dist.setObject({foo:'bar', man:{name:'johnny'}});

            assert.deepEqual(Object.keys(this.dist._namespaces), ['', 'foo', 'man', 'man/name']);

            assert.equal(this.dist._namespaces[''].name, '/root');
            assert.equal(this.dist._namespaces['foo'].name, '/root/foo');
            assert.equal(this.dist._namespaces['man'].name, '/root/man');
            assert.equal(this.dist._namespaces['man/name'].name, '/root/man/name');
        });
    });

    suite('distribution', function() {
        suite('connection', function() {
            test('syncs root base upon connect', function (done) {
                var obj = {foo:'bar'};
                this.dist.setObject(obj);

                var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

                socket.on('create', function (base) {
                    assert.deepEqual(base, obj);
                    done();
                });
            });

            test('syncs deep base upon connect', function (done) {
                var obj = {foo:'bar', man:{name:'johnny'}};
                this.dist.setObject(obj);

                var socket = io_client.connect('http://localhost/root/man', {port:PORT, 'force new connection':true});

                socket.on('create', function (base) {
                    assert.deepEqual(base, obj.man);

                    socket.disconnect();
                    done();
                });
            });
        });

        suite('update', function() {
            test('syncs changes to root connections upon update', function (done) {
                var obj = {foo:'bar', man:{name:'johnny'}};
                this.dist.setObject({foo:'bar'});

                var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

                var self = this;
                socket.on('create', function () {
                    self.dist.setObjectForKeypath(obj.man, 'man');
                });

                socket.once('update', function (payload) {
                    assert.deepEqual(payload.updated, {'man/name':'johnny'});
                    assert.isUndefined(payload.deleted);

                    socket.disconnect();
                    done();
                });
            });

            test('syncs changes to deep connections upon update', function (done) {
                var obj = {foo:'bar', man:{name:'johnny'}};
                this.dist.setObject(obj);

                var socket = io_client.connect('http://localhost/root/man', {port:PORT, 'force new connection':true});

                var self = this;
                socket.on('create', function () {
                    self.dist.setValueForKeypath('jimmy', 'man/name');
                });

                socket.once('update', function (payload) {
                    assert.deepEqual(payload.updated, {'name':'jimmy'});
                    assert.isUndefined(payload.deleted);

                    socket.disconnect();
                    done();
                });
            });

            test('syncs deletes', function (done) {
                var obj = {foo:'bar', man:{name:'johnny'}};
                this.dist.setObject(obj);

                var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

                var self = this;
                socket.on('create', function () {
                    delete obj.man;
                    self.dist.setObject(obj);
                });

                socket.once('update', function (payload) {
                    assert.isUndefined(payload.updated);
                    assert.deepEqual(payload.deleted, ['man/name']);

                    socket.disconnect();
                    done();
                });
            });
        });
    });

    suite('ObjSync integration', function() {
        test('syncs changes', function (done) {
            var obj = {foo:'bar'};
            this.dist.setObject(obj);

            var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});
            var sync = new ObjSync(socket, {delimiter:'/'});

            var self = this;
            sync.once('update', function () {
                assert.deepEqual(sync.getObject(), obj);

                obj = {man:{name:'johnny'}};
                self.dist.setObject(obj);

                sync.once('update', function () {
                    assert.deepEqual(sync.getObject(), obj);

                    socket.disconnect();
                    done();
                });
            });
        });
    });
});
