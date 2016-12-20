'use strict';
const log4js = require('log4js');

class Logger {
    constructor(options) {
        let {serviceName = "no-name"} = options;
        this._serviceName = serviceName;
        log4js.configure({
            appenders: [
                {
                    type: "console",
                    layout: {
                        type: 'pattern',
                        pattern: "%d [%p] %m%n"
                    }
                },
            ]
        });
        this._log4jsLogger = log4js.getLogger();
    }

    setLevel(level) {
        switch (level) {
            case "info":
                this._log4jsLogger.setLevel("INFO");
                return;
            case "error":
                this._log4jsLogger.setLevel("ERROR");
                return;
            case "trace":
                this._log4jsLogger.setLevel("TRACE");
                return;
            case "debug":
                this._log4jsLogger.setLevel("DEBUG");
                return;
            case "warn":
                this._log4jsLogger.setLevel("WARN");
                return;
            case "fatal":
                this._log4jsLogger.setLevel("FATAL");
                return;
            default:
                return
        }
    }

    log(level = "info", message = "no message", traceContext = {}) {
        switch (level) {
            case "info":
                this.info(message, traceContext);
                return;
            case "error":
                this.error(message, traceContext);
                return;
            case "trace":
                this.trace(message, traceContext);
                return;
            case "debug":
                this.debug(message, traceContext);
                return;
            case "warn":
                this.warn(message, traceContext);
                return;
            case "fatal":
                this.fatal(message, traceContext);
                return;
            default:
                return
        }
    }

    info(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.info(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.info(`[${this._serviceName}] - ${message}`);
        }
    }

    error(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.error(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.error(`[${this._serviceName}] - ${message}`);
        }
    }

    trace(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.trace(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.trace(`[${this._serviceName}] - ${message}`);
        }
    }

    debug(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.debug(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.debug(`[${this._serviceName}] - ${message}`);
        }
    }

    warn(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.warn(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.warn(`[${this._serviceName}] - ${message}`);
        }
    }

    fatal(message = "no message", traceContext = {}) {
        let {traceID, step} = traceContext;
        if (traceID || step) {
            this._log4jsLogger.fatal(`[${this._serviceName}] [${traceID}] [${step}] - ${message}`);
        }
        else {
            this._log4jsLogger.fatal(`[${this._serviceName}] - ${message}`);
        }
    }
}

module.exports = Logger;