const UniversalSocket = require('../../src/rpc/uni-socket');

class SocketIOSocket extends UniversalSocket {
  constructor(socket) {
    super(socket.id);
    this.socket = socket;
  }

  close() {
    this.socket.close();
  }

  emit(eventName, buffer) {
    this.socket.emit(eventName, buffer);
  }

  on(eventName, handler) {
    this.socket.on(eventName, handler);
  }

  once(eventName, handler) {
    this.socket.once(eventName, handler);
  }

  onConnect(handler) {
    this.socket.on('connect', handler);
  }

  onDisconnect(handler) {
    this.socket.on('disconnect', handler);
  }
}

module.exports = SocketIOSocket;
