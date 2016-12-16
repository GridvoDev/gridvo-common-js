'use strict';
const _ = require("underscore");
const should = require('should');
const sinon = require('sinon');
const {
    ExplicitContext
} = require('zipkin');
const fetch = require('node-fetch');
const express = require('express');
const expressZipkinMiddleware = require('../../../lib/http/server/expressZipkinMiddleware');

describe('expressZipkinMiddleware integration test', ()=> {
    let record = sinon.spy();
    let recorder = {record};
    let ctxImpl = new ExplicitContext();
    describe("get zipkin http context form req", ()=> {
        context('get http context', ()=> {
            it('is ok then client send http context', done=> {
                let app = express();
                app.use(expressZipkinMiddleware({
                    serviceName: 'service-a',
                    zipkinOpts: {
                        recorder,
                        ctxImpl
                    }
                }));
                app.get('/test', (req, res) => {
                    req.zipkinTrace.traceId.should.be.eql("aaa");
                    req.zipkinTrace.parentId.should.be.eql("bbb");
                    req.zipkinTrace.spanId.should.be.eql("bbb");
                    res.end();
                });
                let server = app.listen(3001, ()=> {
                    let port = server.address().port;
                    let url = `http://127.0.0.1:${port}/test`;
                    fetch(url, {
                        method: 'get',
                        headers: {
                            'X-B3-TraceId': 'aaa',
                            'X-B3-SpanId': 'bbb',
                            'X-B3-Flags': '1'
                        }
                    }).then(()=> {
                        server.close(()=> {
                            done();
                        });
                    });
                });
            });
            it('is ok then client no send http context', done=> {
                let app = express();
                app.use(expressZipkinMiddleware({
                    serviceName: 'service-a',
                    zipkinOpts: {
                        recorder,
                        ctxImpl
                    }
                }));
                app.get('/test', (req, res) => {
                    _.isUndefined(req.zipkinTrace).should.be.eql(false);
                    _.isNull(req.zipkinTrace).should.be.eql(false);
                    res.end();
                });
                let server = app.listen(3001, ()=> {
                    let port = server.address().port;
                    let url = `http://127.0.0.1:${port}/test`;
                    fetch(url, {
                        method: 'get'
                    }).then(()=> {
                        server.close(()=> {
                            done();
                        });
                    });
                });
            });
        });
    });
});