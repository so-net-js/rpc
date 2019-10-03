const CONST = require('../const');

class RpcClientNamespace {
    constructor(fire, namespaceName, namespaceData) {
        this.name = namespaceName;
        this.data = namespaceData;
        this.serverFire = fire;
        this.tempData = {};
        this.resetTempData();
        this.namespaceData = {
            meta:    null,
            timeout: null
        };
        this.$initMethods();
    }


    setTimeout(timeout) {
        this.tempData.timeout = timeout;
        return this;
    }

    setMeta(key, value) {
        if (!this.tempData.meta) this.tempData.meta = {};
        this.tempData.meta[key] = value;
        return this;
    }

    setNamespaceTimeout(timeout) {
        this.namespaceData.timeout = timeout;
        return this;
    }

    setNamespaceMeta(key, value) {
        if (!this.namespaceData.meta) this.namespaceData.meta = {};
        this.namespaceData.meta[key] = value;
        return this;
    }

    $initMethods() {
        this.data.forEach(method => {
            const self = this;
            let meta = this.tempData.meta ? this.tempData.meta : (this.namespaceData.meta ? this.namespaceData.meta : {});
            let timeout = this.tempData.timeout ? this.tempData.timeout : (this.namespaceData.timeout ? this.namespaceData.timeout : CONST.DEFAULT_FAIL_TIMEOUT);
            this[method] = async function (...args) {
                let res = await self.serverFire({
                    eventName: `${self.name}::${method}`,
                    args,
                    meta,
                    timeout
                });
                self.resetTempData();
                return res;
            };
        });
    }

    resetTempData() {
        this.tempData = {
            meta:    null,
            timeout: null,
        };
    }
}

module.exports = RpcClientNamespace;