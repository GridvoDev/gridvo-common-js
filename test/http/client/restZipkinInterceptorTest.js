'use strict';
const _ = require("underscore");
const should = require('should');
const sinon = require('sinon');
const {
    ExplicitContext,
    HttpHeaders: ZipkinHeader
} = require('zipkin');
const express = require('express');
const rest = require('rest');
const restZipkinInterceptor = require('../../../lib/http/client/restZipkinInterceptor');
const httpHeader = require('../../../lib/http/httpHeader');
const {TraceContext, createZipkinTracer} = require('../../../lib/trace');

describe('restZipkinInterceptor integration test', ()=> {
    let record = sinon.spy();
    let recorder = {record};
    let ctxImpl = new ExplicitContext();
    let tracer = createZipkinTracer({ctxImpl, recorder});
    describe("wrap rest http client", ()=> {
        context('requst web werver', ()=> {
            it('should add headers to requests', done=> {
                let app = express();
                app.get('/test', (req, res) => {
                    res.json({
                        traceId: req.header(ZipkinHeader.TraceId),
                        spanId: req.header(ZipkinHeader.SpanId),
                        parentSpanId: req.header(ZipkinHeader.ParentSpanId),
                        step: req.header(httpHeader.step)
                    });
                });
                let server = app.listen(3001, ()=> {
                    ctxImpl.scoped(()=> {
                        let traceContext = new TraceContext({
                            traceID: "aaa",
                            parentID: "bbb",
                            spanID: "ccc",
                            flags: 1,
                            step: 3
                        });
                        let client = rest.wrap(restZipkinInterceptor, {
                            tracer,
                            traceContext,
                            serviceName: 'test-service',
                            remoteServiceName: 'test-remote-service'
                        });
                        let port = server.address().port;
                        let url = `http://127.0.0.1:${port}/test`;
                        client(url).then(response=> {
                            server.close();
                            let data = JSON.parse(response.entity);
                            data.traceId.should.be.eql("aaa");
                            data.parentSpanId.should.be.eql("ccc");
                            data.step.should.be.eql("3");
                            const annotations = record.args.map(args => args[0]);
                            const traceId = annotations[0].traceId.traceId;
                            const spanId = annotations[0].traceId.spanId;
                            data.traceId.should.be.eql(traceId);
                            data.spanId.should.be.eql(spanId);
                            annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                            annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                            annotations[0].annotation.annotationType.should.equal('ClientSend');
                            annotations[1].annotation.annotationType.should.equal('ServiceName');
                            annotations[1].annotation.serviceName.should.equal('test-service');
                            annotations[2].annotation.annotationType.should.equal('Rpc');
                            annotations[2].annotation.name.should.equal('GET');
                            annotations[3].annotation.annotationType.should.equal('BinaryAnnotation');
                            annotations[3].annotation.key.should.equal('http.url');
                            annotations[3].annotation.value.should.equal(url);
                            annotations[4].annotation.annotationType.should.equal('ServerAddr');
                            annotations[4].annotation.serviceName.should.equal('test-remote-service');
                            annotations[5].annotation.annotationType.should.equal('ClientRecv');
                            annotations[6].annotation.annotationType.should.equal('ServiceName');
                            annotations[6].annotation.serviceName.should.equal('test-service');
                            annotations[7].annotation.annotationType.should.equal('BinaryAnnotation');
                            annotations[7].annotation.key.should.equal('http.status_code');
                            annotations[7].annotation.value.should.equal("200");
                            done();
                        }).catch(err=> {
                            server.close();
                            done(err);
                        });
                    });
                });
            });
        });
    });
});
