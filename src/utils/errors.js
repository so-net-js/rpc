const ERROR = {
    REQUEST_TIMEOUT:              1,
    REQUEST_NO_EVENT:             2,
    RESPOND_NO_EVENT_HANDLER:     3,
    UNKNOWN_ERROR:                4,
    NAMESPACE_ALREADY_REGISTERED: 5,
};

function errorCreator(err) {
    return ERROR[err];
}

module.exports = {
    errorCreator,
    ERROR
};