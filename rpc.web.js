const RPCClient = require('./src/rpc/rpc-client');
const SocketIoUniversalSocket = require('./dist/socket.io/socket.io.socket');
const SocketIoClient = require('socket.io-client');

const VueRPC = (Vue, options) => {
    const socket = SocketIoClient(options.io.host, options.io.options);
    const universalSocket = new SocketIoUniversalSocket(socket);
    const rpcClient = new RPCClient({
        socket:    universalSocket,
        useCrypto: options.useCrypto || false,
    });
    Vue.prototype.$api = rpcClient;
};

module.exports = {
    RPCClient,
    SocketIoUniversalSocket
};