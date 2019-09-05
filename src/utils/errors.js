const ERROR = {
  REQUEST_TIMEOUT:  1,
  REQUEST_NO_EVENT: 2,
};

function errorCreator(err) {
  return ERROR[err];
}

module.exports = {
  errorCreator,
  ERROR
};