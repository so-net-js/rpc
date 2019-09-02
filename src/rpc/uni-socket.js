class UniversalSocket {
  constructor(id) {
    this.id = id;
  }

  onConnect(handler) {
    throw new Error('You should override this method');
  }

  onDisconnect(handler) {
    throw new Error('You should override this method');
  }

  close() {
    throw new Error('You should override this method');
  }

  on(eventName, handler) {
    throw new Error('You should override this method');
  }

  once(eventName, handler) {
    throw new Error('You should override this method');
  }

  emit(eventName, buffer) {
    throw new Error('You should override this method');
  }
}

module.exports = UniversalSocket;