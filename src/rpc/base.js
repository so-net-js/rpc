const CONST = require('../const');

class Base {
  constructor(props) {
    this.defaultFailTimeout = props.timeout || CONST.DEFAULT_FAIL_TIMEOUT;
    this.useCrypto = props.useCrypto || CONST.DEFAULT_USE_CRYPTO;
    this.registeredCallbacks = {};
    this.middlewares = {
      [CONST.MIDDLEWARE_ON_REGISTER]:            [],
      [CONST.MIDDLEWARE_ON_DISCONNECTION]:       [],
      [CONST.MIDDLEWARE_AFTER_FIRE]:             [],
      [CONST.MIDDLEWARE_AFTER_RECEIVE_CALLBACK]: [],
      [CONST.MIDDLEWARE_BEFORE_FIRE]:            [],
      [CONST.MIDDLEWARE_ON_CONNECTION]:          [],
      [CONST.MIDDLEWARE_ON_RECEIVE]:             [],
    };
  }

  useMiddleware(middlewareType, middleware) {
    this.middlewares[middlewareType].push(middleware);
  }

  use(middleware) {
    if (typeof middleware === 'function') {
      middleware(this);
      return;
    }

    if (!middleware.install) {
      throw new Error('Middleware should have install method');
    }

    middleware.install(this);
  }

  async useAsync(middleware) {
    if (typeof middleware === 'function') {
      await middleware(this);
      return;
    }

    if (!middleware.install) {
      throw new Error('Middleware should have install method');
    }

    await middleware.install(this);
  }

  register(eventName, callback) {
    let shouldBreak = false;
    let $break = () => {
      shouldBreak = true;
    };
    for (let md of this.middlewares[CONST.MIDDLEWARE_ON_REGISTER]) {
      let {$eventName, $callback} = md(eventName, callback, $break);
      if ($eventName) eventName = $eventName;
      if ($callback) callback = $callback;
    }
    if (shouldBreak) return;
    if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);
    this.registeredCallbacks[eventName] = callback;
  }

  async registerAsync(eventName, callback) {
    let shouldBreak = false;
    let $break = () => {
      shouldBreak = true;
    };
    for (let md of this.middlewares[CONST.MIDDLEWARE_ON_REGISTER]) {
      let {$eventName, $callback} = await md(eventName, callback, $break);
      if ($eventName) eventName = $eventName;
      if ($callback) callback = $callback;
    }
    if (shouldBreak) return;
    if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);
    this.registeredCallbacks[eventName] = callback;
  }
}

module.exports = Base;
