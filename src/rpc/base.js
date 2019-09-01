const CONST = require('../const');

class Base {
  constructor(props) {
    this.defaultFailTimeout = props.timeout || CONST.DEFAULT_FAIL_TIMEOUT;
    this.registeredCallbacks = {};
    this.middlewares = {};
  }
}

module.exports = Base;
