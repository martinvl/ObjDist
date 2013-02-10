ObjSync
=========
Distributes objects between server and clients via
[Socket.IO](http://socket.io)-socket-like transports. Works on a
[KVCObject](https://github.com/martinvl/KVCObject), by opening a channel on
each node in the object tree, streaming only relevant, minimal updates in each
channel.

Use [ObjSync](https://github.com/martinvl/ObjSync) on clients in order to receive.

Public API
---------
* **(constructor)**(< _Socket.IO-server-like_>transport, [< _object_ >options])  
    Creates and returns a new ObjSync object, which communicates via `transport`.  
    Valid options:
    * **prefix** - _string_ - prefix to all channel names. Cannot be empty
    string.
    **Default:** 'root'

Inherits all methods of [KVCObject](https://github.com/martinvl/KVCObject). All
updates are automatically (and minimally) synced.

Example
---------
Server-side
```javascript
var io = require('socket.io');
var ObjDist = require('objdist');

var transport = io.listen(8888);
var dist = new ObjDist(transport);

dist.setObject({foo:'bar', person:{name:'johnny'}});
```

Client-side A, connecting to _root_, receiving all updates
```javascript
var io = require('socket.io-client');
var ObjSync = require('objsync');

var transport = io.connect('localhost/root', {port:8888});
var sync = new ObjSync(transport);

sync.once('update', function (updated) {
    console.dir(updated); // { foo: 'bar', 'person.name': 'johnny' }
    console.dir(sync.getObject()); // { foo: 'bar', person: { name: 'johnny' } }
});
```

Client-side B, connection to _root/person_, receiving only updates in the
`person`-subtree
```javascript
var io = require('socket.io-client');
var ObjSync = require('objsync');

var transport = io.connect('localhost/root/person', {port:8888});
var sync = new ObjSync(transport);

sync.once('update', function (updated) {
    console.dir(updated); // { name: 'johnny' }
    console.dir(sync.getObject()); // { name: 'johnny' }
});
```
