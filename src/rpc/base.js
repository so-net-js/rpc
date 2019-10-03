const CONST = require('../const');
const Events = require('events');

class Base extends Events {

    constructor(props) {
        super();
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

        this.formatters = {
            type:     (argName, argValue, type) => {
                if (typeof argValue !== type && argValue !== undefined) {
                    return {
                        error:        true,
                        errorMessage: `Param "${argName}" is "${typeof argValue}" instead of "${type}"`
                    };
                }
            },
            format:   async (argName, argValue, func) => {
                try {
                    let res = await func(argValue);
                    return {
                        value: res,
                    };
                } catch (e) {
                    return {
                        error:        true,
                        errorMessage: `Format of param "${argName}" failed: ${e.message}`,
                    };
                }
            },
            required: (argName, argValue, isTrue) => {
                if (isTrue && argValue === undefined) {
                    return {
                        error:        true,
                        errorMessage: `Param "${argName}" is required, but it is undefined`,
                    };
                }
            },
            default:  (argName, argValue, defaultValue) => {
                if (argValue === undefined) return {value: defaultValue};
            },
            validate: async (argName, argValue, validate) => {
                try {
                    let res = await validate(argValue);
                    if (res) return;
                    return {
                        error:        true,
                        errorMessage: `Param "${argName}" has not passed validation`
                    };
                } catch (e) {
                    return {
                        error:        true,
                        errorMessage: `Validation of param "${argName}" failed: ${e.message}`
                    };
                }
            }
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

    register(eventName, options, callback) {
        let clb;
        let opts;
        if (typeof options === 'function') {
            clb = options;
            opts = undefined;
        } else if (typeof options === 'object' && typeof callback === 'function') {
            clb = callback;
            opts = options;
        }

        let shouldBreak = false;
        let $break = () => {
            shouldBreak = true;
        };
        for (let md of this.middlewares[CONST.MIDDLEWARE_ON_REGISTER]) {
            let {$eventName, $callback, $options} = md(eventName, opts, clb, $break);
            if ($eventName) eventName = $eventName;
            if ($callback) clb = $callback;
            if ($options) opts = $options;
        }
        if (shouldBreak) return;
        if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);
        if (opts) clb = this.prepareCallback(clb, opts, eventName);
        this.registeredCallbacks[eventName] = clb;
    }

    async registerAsync(eventName, options, callback) {
        let clb;
        let opts;
        if (typeof options === 'function') {
            clb = options;
            opts = undefined;
        } else if (typeof options === 'object' && typeof callback === 'function') {
            clb = callback;
            opts = options;
        }

        let shouldBreak = false;
        let $break = () => {
            shouldBreak = true;
        };
        for (let md of this.middlewares[CONST.MIDDLEWARE_ON_REGISTER]) {
            let {$eventName, $callback, $options} = await md(eventName, opts, clb, $break);
            if ($eventName) eventName = $eventName;
            if ($callback) callback = $callback;
            if ($options) opts = $options;
        }
        if (shouldBreak) return;
        if (this.registeredCallbacks[eventName]) throw new Error(`Callback for ${eventName} has already been registered.`);
        if (opts) clb = this.prepareCallback(clb, opts, eventName);
        this.registeredCallbacks[eventName] = clb;
    }

    prepareCallback(clb, options, eventName) {
        const self = this;
        const clbArgsText = clb.toString().match(/\((.*)\)/)[1];
        const argsNames = clbArgsText.split(',').map(el => el.trim());
        return async function (...args) {
            let nArgs = [];
            for (let i = 0; i < argsNames.length; i++) {
                let argName = argsNames[i];
                let argValue = args[i];

                if (!options[argName]) {
                    nArgs.push(argValue);
                    continue;
                }

                let finalValue = argValue;
                for (let formatter in options[argName]) {
                    let res = await self.formatters[formatter](argName, argValue, options[argName][formatter]);
                    if (res && res.error) {
                        throw new Error(`Formatter error: Method: ${self.parseEventName(eventName)}, Message: ${res.errorMessage}`);
                    }
                    if (res && res.value) finalValue = res.value;
                }
                nArgs.push(finalValue);
            }

            clb = clb.bind(this);
            return await clb(...nArgs);
        };
    }

    parseEventName(eventName) {
        console.log(eventName);
        let arr = eventName.split('::');
        return arr.join('.');
    }
}

module.exports = Base;
