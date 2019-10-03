const RPCClient = require('./src/rpc/rpc-client');
const RPCServer = require('./src/rpc/rpc-server');
const SocketIoUniversalServer = require('./dist/socket.io/socket.io.server');
const SocketIoUniversalSocket = require('./dist/socket.io/socket.io.socket');

module.exports = {
    RPCClient,
    RPCServer,
    SocketIoUniversalSocket,
    SocketIoUniversalServer
};