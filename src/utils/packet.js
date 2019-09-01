const utils = require('@sonetjs/utils');
const {encoder, decoder} = require('@sonetjs/binary-parser');

class Packet {
  constructor(type, from, id) {
    this.id = id || utils.id.nano();
    this.type = type;
    this.from = from;
    this.meta = {};
    this.data = [];
  }

  static fromEncodedPacket(packet) {
    let decoded = decoder.decode(packet);
    return Packet.fromDecodedPacket(decoded);
  }

  static fromDecodedPacket(p) {
    let packet = new Packet(p.type, p.from, p.id);
    packet.setMeta(p.meta);
    packet.setData(p.data);
    return packet;
  }

  setMeta(meta) {
    this.meta = meta;
  }

  addMeta(key, value) {
    this.meta[key] = value;
  }

  removeMeta(key) {
    if (!this.meta[key]) return;
    delete this.meta[key];
  }

  setData(data) {
    this.data = data;
  }

  getRaw() {
    return {
      id:   this.id,
      type: this.type,
      from: this.from,
      meta: this.meta,
      data: this.data,
    };
  }

  getEncoded() {
    let dt = this.getRaw();
    return encoder.encode(dt);
  }
}

module.exports = Packet;
