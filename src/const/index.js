module.exports = {
  // misc
  DEFAULT_FAIL_TIMEOUT: 1000 * 10,

  // packet
  PACKET_TYPE_REQUEST: 0,
  PACKET_TYPE_RESPOND: 1,
  SERVER:              0,
  CLIENT:              1,

  // middlewares
  MIDDLEWARE_BEFORE_FIRE:            0,
  MIDDLEWARE_AFTER_FIRE:             1,
  MIDDLEWARE_ON_RECEIVE:             2,
  MIDDLEWARE_ON_REGISTER:            3,
  MIDDLEWARE_AFTER_RECEIVE_CALLBACK: 4,
  MIDDLEWARE_ON_CONNECTION:          5,
  MIDDLEWARE_ON_DISCONNECTION:       6,
};
