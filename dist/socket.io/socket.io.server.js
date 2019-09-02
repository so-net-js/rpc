const UniversalSocketServer = require('../../src/rpc/uni-socket-server');
const UniversalIOSocket = require('./socket.io.socket');

class SocketIOServer extends UniversalSocketServer {
  constructor(ioServer) {
    super();
    this.server = ioServer;
  }

  onClientConnection(handler) {
    this.server.on('connection', (ioSocket) => {
      let uniSocket = new UniversalIOSocket(ioSocket);
      handler(uniSocket);
    });
  }
}

module.exports = SocketIOServer;