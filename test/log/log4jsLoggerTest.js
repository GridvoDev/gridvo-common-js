'use strict';
const should = require('should');
const Log4jsLogger = require('../../lib/log/log4jsLogger');

describe('log4jsLogger use case test', ()=> {
    let logger;
    before(()=> {
        let options = {
            serviceName: "service-name",
        }
        logger = new Log4jsLogger(options);
    });
    describe('#log(level, message, traceContext)', ()=> {
        context('log message with level and http context)', ()=> {
            it('can log defalut message', ()=> {
                logger.log();
            });
            it('can log message', ()=> {
                logger.log("error", "is a error message", {traceID: "123", step: 3});
            });
        });
    });
    describe('#setLevel(level)', ()=> {
        context('set log level)', ()=> {
            it('it no log', ()=> {
                logger.setLevel("error");
                logger.log();
            });
        });
    });
});