var assert = require('chai').assert;
var io = require('socket.io');
var io_client = require('socket.io-client');
var IODistributor = require('../lib/IODistributor');

var PORT = 4444;

suite('IODistributor', function() {
    before(function () {
        this.server = io.listen(PORT).set('log level', 0);
    });

    setup(function () {
        this.distributor = new IODistributor(this.server);
    });

    teardown(function () {
        this.distributor.removeAllListeners();
        this.distributor.deleteNamespaces();
    });

    suite('Internals', function () {
        test('Creates and deletes namespaces as expected', function () {
            this.distributor.setObject({foo:'bar', man:{name:'johnny'}});
            assert.deepEqual(Object.keys(this.distributor._namespaces), ['', 'foo', 'man', 'man/name']);

            this.distributor.setObject({});
            assert.deepEqual(Object.keys(this.distributor._namespaces), ['']);
        });
    });

    suite('Distribution', function () {
        test('Distributes base upon connection', function (done) {
            var object = {foo:'bar', man:{name:'johnny'}};
            this.distributor.setObject(object);

            var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

            socket.on('create', function (base) {
                assert.deepEqual(base, object);

                done();
            });
        });

        test('Distributes base upon connection to subchannel', function (done) {
            var object = {foo:'bar', man:{name:'johnny'}};
            this.distributor.setObject(object);

            var socket = io_client.connect('http://localhost/root/man', {port:PORT, 'force new connection':true});

            socket.on('create', function (base) {
                assert.deepEqual(base, object.man);

                done();
            });
        });

        test('Distributes updates as expected', function (done) {
            var object = {foo:'bar', man:{name:'johnny'}};
            this.distributor.setObject(object);

            var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

            var h = this;
            socket.on('create', function (base) {
                object.man.name = 'jimmy';
                h.distributor.setObjectForKeypath(object.man, 'man');
            });

            socket.on('update', function (changed) {
                assert.deepEqual(changed.updated, {'man/name':'jimmy'});

                socket.removeAllListeners();
                done();
            });
        });

        test('Distributes updates as expected to subchannel', function (done) {
            var object = {foo:'bar', man:{name:'johnny'}};
            this.distributor.setObject(object);

            var socket = io_client.connect('http://localhost/root/man', {port:PORT, 'force new connection':true});

            var h = this;
            socket.on('create', function (base) {
                object.man.name = 'jimmy';
                h.distributor.setObjectForKeypath(object.man, 'man');
            });

            socket.on('update', function (changed) {
                assert.deepEqual(changed.updated, {'name':'jimmy'});

                socket.removeAllListeners();
                done();
            });
        });

        test('Distributes deletes as expected', function (done) {
            var object = {foo:'bar', man:{name:'johnny'}};
            this.distributor.setObject(object);

            var socket = io_client.connect('http://localhost/root', {port:PORT, 'force new connection':true});

            var h = this;
            socket.on('create', function (base) {
                object.man.name = 'jimmy';
                h.distributor.setObjectForKeypath(undefined, 'man');
            });

            socket.on('update', function (change) {
                assert.deepEqual(change.deleted, ['man/name']);

                socket.removeAllListeners();
                done();
            });
        });
    });
});
