const RpcBase = require('./base');
const CONST = require('../const');
const Packet = require('../utils/packet');
const utils = require('@sonetjs/utils');

class RpcServer extends RpcBase {
  constructor(props) {
    super(props);
    this.socketServer = props.socketServer;
    this.logger = props.logger;
    this.socketServer.onClientConnection(async (clientSocket) => {
      await this.$setupClient(clientSocket);
    });
    this.clients = {};
  }

  async $setupClient(clientSocket) {
    this.logger.log(`${clientSocket.id} tries to connect`);
    this.clients[clientSocket.id] = clientSocket;
    for (const mw of this.middlewares[CONST.MIDDLEWARE_ON_CONNECTION]) {
      await mw(clientSocket.id);
    }
    clientSocket.onDisconnect(async () => {
      await this.$processClientDisconnection(clientSocket.id);
    });
    clientSocket.on(CONST.CLIENT, async (packet) => {
      await this.$processClientMessage(packet);
    });
  }

  async $processClientDisconnection(clientId) {
    // @todo add some client processing. For now just call all mw`s and remove from clients pool
    for (const mw of this.middlewares[CONST.MIDDLEWARE_ON_DISCONNECTION]) {
      await mw(clientId);
    }
    delete this.clients[clientId];
  }

  $processClientMessage(packet) {

  }
}

module.exports = RpcServer;