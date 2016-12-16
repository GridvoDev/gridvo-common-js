'use strict';
const _ = require("underscore");
const should = require('should');
const feachTraceContext = require('../../../lib/http/server/expressWithZipkinTraceContextFeach');

describe('feachTraceContext function test', ()=> {
    describe('#feachTraceContext(contextCarrier)', ()=> {
        context('feach log http context from express req', ()=> {
            it('throw err when req no zipkinTrace', ()=> {
                let req = {};
                feachTraceContext.bind(null, req).should.throw();
            });
            it('is not throw err when req has zipkinTrace', ()=> {
                let req = {
                    zipkinTrace: {},
                    header: headerName=> {
                        return undefined;
                    }
                };
                feachTraceContext.bind(null, req).should.not.throw();
            });
            it('return context if no http header and traceId eql spanId', ()=> {
                let req = {
                    zipkinTrace: {
                        traceId: "aaa",
                        parentId: "aaa",
                        spanId: "aaa",
                        flags: 1
                    },
                    header: headerName=> {
                        return undefined;
                    }
                };
                let context = feachTraceContext(req);
                context.traceID.should.equal("aaa");
                context.parentID.should.equal("aaa");
                context.spanID.should.equal("aaa");
                context.flags.should.equal(1);
                context.step.should.equal(0);
            });
            it('return context if no http header and traceId not eql spanId', ()=> {
                let req = {
                    zipkinTrace: {
                        traceId: "aaa",
                        parentId: "aaa",
                        spanId: "bbb",
                        flags: 0
                    },
                    header: headerName=> {
                        return undefined;
                    }
                };
                let context = feachTraceContext(req);
                context.traceID.should.equal("aaa");
                context.parentID.should.equal("aaa");
                context.spanID.should.equal("bbb");
                context.flags.should.equal(0);
                _.isNaN(context.step).should.equal(true);
            });
            it('return context if have http header', ()=> {
                let req = {
                    zipkinTrace: {
                        traceId: "aaa",
                        parentId: "aaa",
                        spanId: "aaa",
                        flags: 1
                    },
                    header: headerName=> {
                        return 2
                    }
                };
                let context = feachTraceContext(req);
                context.traceID.should.equal("aaa");
                context.parentID.should.equal("aaa");
                context.spanID.should.equal("aaa");
                context.flags.should.equal(1);
                context.step.should.equal(3);
            });
        });
    });
});