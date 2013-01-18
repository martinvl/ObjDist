ObjSync
=========

Distributes objects over various channels (namespaces) between server and clients
via [Socket.IO](http://socket.io) socket-like transports.

Public API
==========
Methods
-------
* **(constructor)**(< _Socket.IO-server-like_>transport, [< _object_ >options])  
    Creates and returns a new ObjSync object, which communicates via `transport`.  
    Valid options:
    * **prefix** - _string_ - prefix to all channel names. Cannot be empty
    string.
    **Default:** 'root'

Inherits all methods of [KVCObject](https://github.com/martinvl/KVCObject). All
updates are automatically (and minimally) synced.
