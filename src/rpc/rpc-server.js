const RpcBase = require('./base');
const CONST = require('../const');
const {ERROR, errorCreator} = require('../utils/errors');
const Packet = require('../utils/packet');
const utils = require('@sonetjs/utils');

class RpcServer extends RpcBase {
  constructor(props) {
    super(props);
    this.socketServer = props.socketServer;
    this.info = props.info || {
      name:       'rpc-server',
      address:    'localhost',
      namespaces: null,
      useCrypto:  this.useCrypto
    };
    this.logger = props.logger || {
      log:   () => {
      },
      error: () => {
      },
      warn:  () => {
      }
    };
    this.socketServer.onClientConnection(async (clientSocket) => {
      await this.$setupClient(clientSocket);
    });
    this.clients = {};
    const self = this;
    this.register(CONST.HANDSHAKE_INIT, async function () {
      console.log('Init');
      return self.info;
    });

    this.register(CONST.HANDSHAKE_GENERATE_KEY, async function (pass) {
      console.log('PASS IS:', pass);
      /*self.clients[clientId].options.useCrypto = true;
      self.clients[clientId].options.secret = utils.crypto.generateSyncKey(pass);
      console.log(self.clients[clientId].options.secret);
      return self.clients[clientId].options.secret;*/
      return 'kek';
    });

    this.register(CONST.HANDSHAKE_FINISH, async function () {
      console.log('Done');
      /*this.logger.log(`${clientId} connected`);*/
    });
  }

  async $setupClient(clientSocket) {
    this.logger.log(`${clientSocket.id} tries to connect`);
    this.clients[clientSocket.id] = {
      socket:  clientSocket,
      options: {
        useCrypto: false,
        secret:    '',
      }
    };
    for (const mw of this.middlewares[CONST.MIDDLEWARE_ON_CONNECTION]) {
      await mw(clientSocket.id);
    }
    clientSocket.onDisconnect(async () => {
      await this.$processClientDisconnection(clientSocket.id);
    });
    clientSocket.on(CONST.CLIENT, async (packet) => {
      await this.$processClientMessage(clientSocket.id, packet);
    });
  }

  async $processClientDisconnection(clientId) {
    // @todo add some client processing. For now just call all mw`s and remove from clients pool
    for (const mw of this.middlewares[CONST.MIDDLEWARE_ON_DISCONNECTION]) {
      await mw(clientId);
    }
    delete this.clients[clientId];
  }

  async $processClientMessage(id, incPacket) {
    if (this.clients[id].options.useCrypto) incPacket = this.$decypherPacket(id, incPacket);
    incPacket = Packet.fromEncodedPacket(incPacket);

    let resPacket = new Packet(CONST.PACKET_TYPE_RESPOND, CONST.SERVER, incPacket.getId());
    let shouldBreak = false;
    let $break = () => {
      shouldBreak = true;
    };

    for (let mw of this.middlewares[CONST.MIDDLEWARE_ON_RECEIVE]) {
      await mw(incPacket, resPacket, $break);
      if (shouldBreak) {
        let payload = resPacket.getEncoded();
        if (this.clients[id].options.useCrypto) payload = this.$cypherPacket(id, payload);
        this.clients[id].socket.emit(resPacket.getId(), payload);
        return;
      }
    }


    if (!this.registeredCallbacks[incPacket.getEventName()]) {
      resPacket.addMeta('error', true);
      resPacket.addMeta('errorCode', ERROR.RESPOND_NO_EVENT_HANDLER);
      let payload = resPacket.getEncoded();
      if (this.clients[id].options.useCrypto) payload = this.$cypherPacket(id, payload);
      this.clients[id].socket.emit(resPacket.getId(), payload);
      return;
    }

    try {
      incPacket.addMeta('clientId', id);
      const result = await this.registeredCallbacks[incPacket.getEventName()](...incPacket.getRaw().data);
      resPacket.setData([result]);
      console.log('RESPOND PACKET', resPacket.getRaw());
      let payload = resPacket.getEncoded();
      if (this.clients[id].options.useCrypto) payload = this.$cypherPacket(id, payload);
      this.clients[id].socket.emit(resPacket.getId(), payload);

    } catch (e) {
      resPacket.addMeta('error', true);
      resPacket.addMeta('errorCode', ERROR.UNKNOWN_ERROR);
      resPacket.setData([e.message]);
      let payload = resPacket.getEncoded();
      if (this.clients[id].options.useCrypto) payload = this.$cypherPacket(id, payload);
      this.clients[id].socket.emit(resPacket.getId(), payload);

    } finally {
      for (let mw of this.middlewares[CONST.MIDDLEWARE_AFTER_RECEIVE_CALLBACK]) {
        await mw(resPacket);
      }
    }
  }

  $decypherPacket(id, packet) {

  }
}

module.exports = RpcServer;
