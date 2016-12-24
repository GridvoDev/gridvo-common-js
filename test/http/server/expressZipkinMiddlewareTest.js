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
const {createZipkinTracer} = require('../../../lib/trace');

describe('expressZipkinMiddleware integration test', ()=> {
    describe("get zipkin http context form req", ()=> {
        context('get http context', ()=> {
            it('is ok then client send http context', done=> {
                let record = sinon.spy();
                let recorder = {record};
                let ctxImpl = new ExplicitContext();
                let tracer = createZipkinTracer({ctxImpl, recorder});
                let app = express();
                app.use(expressZipkinMiddleware({
                    tracer,
                    serviceName: 'service-a'
                }));
                app.get('/test', (req, res) => {
                    req.zipkinTrace.traceID.should.be.eql("aaa");
                    req.zipkinTrace.parentID.should.be.eql("bbb");
                    req.zipkinTrace.spanID.should.be.eql("bbb");
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
                        server.close();
                        let annotations = record.args.map(args => args[0]);
                        let traceId = annotations[0].traceId.traceId;
                        let spanId = annotations[0].traceId.spanId;
                        traceId.should.be.eql("aaa");
                        spanId.should.be.eql("bbb");
                        annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                        annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                        annotations[0].annotation.annotationType.should.equal('ServerRecv');
                        annotations[1].annotation.annotationType.should.equal('ServiceName');
                        annotations[1].annotation.serviceName.should.equal('service-a');
                        annotations[2].annotation.annotationType.should.equal('Rpc');
                        annotations[2].annotation.name.should.equal('express recv GET request');
                        annotations[3].annotation.annotationType.should.equal('LocalAddr');
                        annotations[4].annotation.annotationType.should.equal('BinaryAnnotation');
                        annotations[4].annotation.key.should.equal('http.url');
                        annotations[4].annotation.value.should.equal(url);
                        annotations[6].annotation.annotationType.should.equal('ServerSend');
                        annotations[7].annotation.annotationType.should.equal('BinaryAnnotation');
                        annotations[7].annotation.key.should.equal('http.status_code');
                        annotations[7].annotation.value.should.equal("200");
                        done();
                    });
                });
            });
            it('is ok then client no send http context', done=> {
                let record = sinon.spy();
                let recorder = {record};
                let ctxImpl = new ExplicitContext();
                let tracer = createZipkinTracer({ctxImpl, recorder});
                let app = express();
                app.use(expressZipkinMiddleware({
                    tracer,
                    serviceName: 'service-a'
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
                        server.close();
                        let annotations = record.args.map(args => args[0]);
                        let traceId = annotations[0].traceId.traceId;
                        let spanId = annotations[0].traceId.spanId;
                        annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                        annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                        annotations[0].annotation.annotationType.should.equal('ServerRecv');
                        annotations[1].annotation.annotationType.should.equal('ServiceName');
                        annotations[1].annotation.serviceName.should.equal('service-a');
                        annotations[2].annotation.annotationType.should.equal('Rpc');
                        annotations[2].annotation.name.should.equal('express recv GET request');
                        annotations[3].annotation.annotationType.should.equal('LocalAddr');
                        annotations[4].annotation.annotationType.should.equal('BinaryAnnotation');
                        annotations[4].annotation.key.should.equal('http.url');
                        annotations[4].annotation.value.should.equal(url);
                        annotations[5].annotation.annotationType.should.equal('ServerSend');
                        annotations[6].annotation.annotationType.should.equal('BinaryAnnotation');
                        annotations[6].annotation.key.should.equal('http.status_code');
                        annotations[6].annotation.value.should.equal("200");
                        done();
                    });
                });
            });
        });
    });
});