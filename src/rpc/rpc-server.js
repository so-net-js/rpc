const RpcBase = require('./base');
const CONST = require('../const');
const {ERROR, errorCreator} = require('../utils/errors');
const Packet = require('../utils/packet');
const utils = require('@sonetjs/utils');

class RpcServer extends RpcBase {
    constructor(props) {
        super(props);
        this.socketServer = props.socketServer;
        this.info = Object.assign({}, props.info, {
            name:       'rpc-server',
            address:    'localhost',
            namespaces: {},
            useCrypto:  this.useCrypto
        });
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
            return self.info;
        });

        this.register(CONST.HANDSHAKE_GENERATE_KEY, async function (pass) {
            self.clients[this.clientId].options.secret = utils.crypto.generateSyncKey(pass);
            return Buffer.from(self.clients[this.clientId].options.secret);
        });

        this.register(CONST.HANDSHAKE_FINISH, async function () {
            self.logger.log(`${this.clientId} connected`);
        });
    }

    registerNamespace(namespaceName) {
        if (this.info.namespaces[namespaceName]) {
            throw new Error(errorCreator(ERROR.NAMESPACE_ALREADY_REGISTERED));
        }
        this.info.namespaces[namespaceName] = [];
        const self = this;
        return {
            register(eventName, options, callback) {
                self.info.namespaces[namespaceName].push(eventName);
                self.register(`${namespaceName}::${eventName}`, options, callback);
            }
        };
    }

    async $setupClient(clientSocket) {
        this.logger.log(`${clientSocket.id} tries to connect`);
        this.clients[clientSocket.id] = {
            socket:  clientSocket,
            options: {
                useCrypto: false,
                secret:    null,
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
        if (this.clients[id].options.useCrypto) incPacket = this.$decipherPacket(id, incPacket);
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
                if (this.clients[id].options.useCrypto) payload = this.$cipherPacket(id, payload);
                this.clients[id].socket.emit(resPacket.getId(), payload);
                return;
            }
        }

        if (!this.registeredCallbacks[incPacket.getEventName()]) {
            resPacket.addMeta('error', true);
            resPacket.addMeta('errorCode', ERROR.RESPOND_NO_EVENT_HANDLER);
            let payload = resPacket.getEncoded();
            if (this.clients[id].options.useCrypto) payload = this.$cipherPacket(id, payload);
            this.clients[id].socket.emit(resPacket.getId(), payload);
            return;
        }

        try {
            incPacket.addMeta('clientId', id);
            let func = this.registeredCallbacks[incPacket.getEventName()].bind(incPacket.getRaw().meta);
            const result = await func(...incPacket.getRaw().data);
            resPacket.setData([result]);
            let payload = resPacket.getEncoded();
            if (this.clients[id].options.useCrypto) payload = this.$cipherPacket(id, payload);
            this.clients[id].socket.emit(resPacket.getId(), payload);
            if (incPacket.getEventName() === CONST.HANDSHAKE_FINISH && this.clients[id].options.secret) {
                this.clients[id].options.useCrypto = true;
            }
        } catch (e) {
            resPacket.addMeta('error', true);
            resPacket.addMeta('errorCode', ERROR.UNKNOWN_ERROR);
            resPacket.setData([e.message]);
            let payload = resPacket.getEncoded();
            if (this.clients[id].options.useCrypto) payload = this.$cipherPacket(id, payload);
            this.clients[id].socket.emit(resPacket.getId(), payload);

        } finally {
            for (let mw of this.middlewares[CONST.MIDDLEWARE_AFTER_RECEIVE_CALLBACK]) {
                await mw(resPacket);
            }
        }
    }

    $decipherPacket(id, packet) {
        return Buffer.from(utils.crypto.decipherData(packet, this.clients[id].options.secret));
    }

    $cipherPacket(id, packet) {
        return utils.crypto.cipherData(packet, this.clients[id].options.secret);
    }
}

module.exports = RpcServer;
