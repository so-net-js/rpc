const RpcBase = require('./base');
const Packet = require('../utils/packet');
const CONST = require('../const');
const utils = require('@sonetjs/utils');
const RpcClientNamespace = require('./rpc-client-namespace');
const {errorCreator, ERROR} = require('../utils/errors');


class RpcClient extends RpcBase {
    constructor(props) {
        super(props);
        this.socket = props.socket;
        this.socket.on(CONST.SERVER, async (packet) => {
            await this.$setupIncomingPacketHandler(packet);
        });
        this.socket.onConnect(async () => {
            await this.$processConnection();
        });
        this.socket.onDisconnect(async () => {
            await this.$processDisconnection();
        });
        this.connectionInfo = {
            connected:  false,
            name:       '',
            address:    '',
            namespaces: {},
        };
        if (this.useCrypto) {
            this.connectionInfo.secret = null;
            this.connectionInfo.ecdhKey = utils.crypto.generateECDHKeyPair();
        }
    }

    async ready() {
        return new Promise(resolve => {
            this.on('ready', resolve);
        });
    }

    async $processConnection() {
        await this.$doHandshake();
        let shouldBreak = false;
        const $break = () => {
            shouldBreak = true;
        };
        for (const md of this.middlewares[CONST.MIDDLEWARE_ON_CONNECTION]) {
            await md(this.connectionInfo, $break);
        }
        if (shouldBreak) return this.socket.close();
        this.$initNamespaces();
    }

    async $processDisconnection() {
        this.connectionInfo.connected = false;
        this.$destroyNamespaces();
        for (const md of this.middlewares[CONST.MIDDLEWARE_ON_DISCONNECTION]) {
            await md(this.connectionInfo);
        }
    }

    async $doHandshake() {
        let info = await this.$fire({
            eventName: CONST.HANDSHAKE_INIT,
            args:      [this.useCrypto ? this.connectionInfo.ecdhKey.getPublic().encode('hex') : '']
        });
        this.connectionInfo.connected = true;
        this.connectionInfo.name = info.name;
        this.connectionInfo.address = info.address;
        this.connectionInfo.namespaces = info.namespaces;
        if (!this.useCrypto) {
            await this.$fire({
                eventName: CONST.HANDSHAKE_FINISH
            });
            return this.emit('ready');
        }
        const serverPK = utils.crypto.getECDHPublicKeyFromHex(info.serverPublicKey);
        this.connectionInfo.tempSharedKey = utils.crypto.deriveECDHSharedKey(this.connectionInfo.ecdhKey, serverPK.getPublic());

        const msg = utils.crypto.hash(this.connectionInfo.tempSharedKey);
        const sig = utils.crypto.ecdhSign(msg, this.connectionInfo.ecdhKey).toDER();

        let serverRes = await this.$fire({
            eventName: CONST.HANDSHAKE_CONFIRM,
            args:      [
                msg,
                sig
            ]
        });

        if (!utils.crypto.ecdhVerify(serverRes.msg, serverRes.sig, serverPK)) {
            console.log('Server is a lie!');
            this.socket.close();
        }

        // start using temp generated shared key
        this.connectionInfo.secret = utils.crypto.generatePasswordKey(this.connectionInfo.tempSharedKey);

        let trueSecret = await this.$fire({
            eventName: CONST.HANDSHAKE_GENERATE_KEY,
            args:      [utils.crypto.hash(utils.id.uuid())]
        });
        this.connectionInfo.secret = utils.crypto.generatePasswordKey(trueSecret);
        await this.$fire({
            eventName: CONST.HANDSHAKE_FINISH
        });
        this.emit('ready');
    }

    $initNamespaces() {

        Object.keys(this.connectionInfo.namespaces).forEach(namespace => {
            this[namespace] = new RpcClientNamespace(this.$fire.bind(this), namespace, this.connectionInfo.namespaces[namespace]);
        });
    }

    $destroyNamespaces() {
        Object.keys(this.connectionInfo.namespaces).forEach(namespace => {
            delete this[namespace];
        });
    }

    async $setupIncomingPacketHandler(packet) {
    }

    async $fire(props) {
        if (!props.eventName) throw new Error(errorCreator(ERROR.REQUEST_NO_EVENT));
        if (!props.args) props.args = [];

        let packet = new Packet(CONST.PACKET_TYPE_REQUEST, CONST.CLIENT);
        packet.addMeta('eventName', props.eventName);
        if (props.meta) {
            Object.keys(props.meta).forEach(key => {
                packet.addMeta(key, props.meta[key]);
            });
        }
        packet.setData(props.args);

        const promise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(errorCreator(ERROR.REQUEST_TIMEOUT)));
            }, props.timeout || CONST.DEFAULT_FAIL_TIMEOUT);

            this.socket.once(packet.getRaw().id, (respondPacket) => {
                clearTimeout(timer);
                try {
                    if (this.connectionInfo.secret) {
                        respondPacket = this.$decipherPacket(respondPacket);
                    }
                    respondPacket = Packet.fromEncodedPacket(respondPacket);
                    if (respondPacket.getRaw().meta.error) {
                        throw new Error(`Code: ${respondPacket.getRaw().meta.errorCode}, Message: ${respondPacket.getRaw().data[0]}`);
                    }
                    resolve(respondPacket.getRaw().data[0]);
                } catch (e) {
                    reject(new Error(e.message));
                }
            });
        });

        let shouldBreak = false;
        let returnResult = undefined;
        const $break = (result) => {
            returnResult = result;
            shouldBreak = true;
        };
        for (let mw of this.middlewares[CONST.MIDDLEWARE_BEFORE_FIRE]) {
            let res = await mw($break, packet);
            if (shouldBreak) return returnResult;
            if (res) packet = res;
        }

        let toSend = packet.getEncoded();
        if (this.connectionInfo.secret) toSend = this.$cipherPacket(toSend);
        this.socket.emit(CONST.CLIENT, toSend);
        returnResult = await promise;

        for (let mw of this.middlewares[CONST.MIDDLEWARE_AFTER_FIRE]) {
            let res = await mw($break, returnResult);
            if (shouldBreak) return returnResult;
            if (res) returnResult = res;
        }

        return returnResult;
    }

    $decipherPacket(packet) {
        return Buffer.from(utils.crypto.decipherData(packet, this.connectionInfo.secret));
    }

    $cipherPacket(packet) {
        return utils.crypto.cipherData(packet, this.connectionInfo.secret);
    }
}


module.exports = RpcClient;