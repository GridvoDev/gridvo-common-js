'use strict';
const _ = require("underscore");
const should = require('should');
const sinon = require('sinon');
const {
    ExplicitContext
} = require('zipkin');
const zipkinFilter = require('../../lib/pomelo/zipkinFilter');
const {createZipkinTracer} = require('../../lib/trace');
const FilterService = require('./mockPomeloFilterService');

describe('zipkinFilter integration test', ()=> {
    describe("zipkinFilter(options)", ()=> {
        context('zipkin support', ()=> {
            it('is filter can support zipkin', done=> {
                let record = sinon.spy();
                let recorder = {record};
                let ctxImpl = new ExplicitContext();
                let tracer = createZipkinTracer({ctxImpl, recorder});
                let service = new FilterService();
                let filter = zipkinFilter({
                    tracer,
                    serviceName: 'service-a'
                });
                let mockSession = {
                    key: "123"
                };
                let _session;
                service.before(filter);
                service.beforeFilter({
                    cmd: "publish",
                    topic: "test-topic"
                }, mockSession, ()=> {
                    _session = mockSession;
                    should.exist(mockSession);
                    should.exist(mockSession.traceID);
                    should.exist(mockSession.zipkinTrace);
                    let annotations = record.args.map(args => args[0]);
                    let traceId = annotations[0].traceId.traceId;
                    let spanId = annotations[0].traceId.spanId;
                    annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                    annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                    annotations[0].annotation.annotationType.should.equal('ServerRecv');
                    annotations[1].annotation.annotationType.should.equal('ServiceName');
                    annotations[1].annotation.serviceName.should.equal('service-a');
                    annotations[2].annotation.annotationType.should.equal('LocalAddr');
                    annotations[3].annotation.annotationType.should.equal('BinaryAnnotation');
                    annotations[3].annotation.key.should.equal('pomelo.msg');
                    annotations[3].annotation.value.should.equal('{"cmd":"publish","topic":"test-topic"}');
                });
                service.after(filter);
                service.afterFilter(null, {
                    cmd: "publish",
                    topic: "test-topic"
                }, mockSession, {
                    errcode: 0
                }, ()=> {
                    should.exist(mockSession);
                    should.strictEqual(mockSession, _session);
                    let annotations = record.args.map(args => args[0]);
                    annotations[4].annotation.annotationType.should.equal('ServerSend');
                    annotations[5].annotation.annotationType.should.equal('BinaryAnnotation');
                    annotations[5].annotation.key.should.equal('pomelo.res.errcode');
                    annotations[5].annotation.value.should.equal("0");
                    done();
                });
            });
        });
    });
});