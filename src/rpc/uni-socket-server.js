class UniversalSocketServer {
    onClientConnection(handler) {
        throw new Error('You should override this method');
    }
}

module.exports = UniversalSocketServer;