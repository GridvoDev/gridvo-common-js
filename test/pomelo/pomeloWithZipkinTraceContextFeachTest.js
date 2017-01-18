'use strict';
const _ = require("underscore");
const should = require('should');
const feachTraceContext = require('../../lib/pomelo/pomeloWithZipkinTraceContextFeach');

describe('feachTraceContext function test', ()=> {
    describe('#feachTraceContext(contextCarrier)', ()=> {
        context('feach trace context from pomelo session', ()=> {
            it('throw err when session no zipkinTrace', ()=> {
                let session = {};
                feachTraceContext.bind(null, session).should.throw();
            });
            it('is not throw err when session has zipkinTrace', ()=> {
                let session = {
                    zipkinTrace: {}
                };
                feachTraceContext.bind(null, session).should.not.throw();
            });
            it('return context', ()=> {
                let session = {
                    zipkinTrace: {
                        traceID: "aaa",
                        parentID: "aaa",
                        spanID: "aaa",
                        flags: 1
                    },
                };
                let context = feachTraceContext(session);
                context.traceID.should.equal("aaa");
                context.parentID.should.equal("aaa");
                context.spanID.should.equal("aaa");
                context.flags.should.equal(1);
                context.step.should.equal(0);
            });
        });
    });
});