'use strict';
const interceptor = require('rest/interceptor');
const {
    HttpHeaders: Header,
    Annotation,
} = require('zipkin');
const httpHeader = require('../httpHeader');
const {transformTraceContextToZK} = require('../../trace');

function getRequestMethod(req) {
    let method = 'get';
    if (req.entity) {
        method = 'post';
    }
    if (req.method) {
        method = req.method;
    }
    return method;
}

function request(req, {tracer, traceContext, serviceName = 'no-service', remoteServiceName = "no-remote-service"}) {
    let {step = 0}= traceContext;
    tracer.scoped(() => {
        let currentID = transformTraceContextToZK(traceContext);
        tracer.setId(currentID);
        tracer.setId(tracer.createChildId());
        let nextID = tracer.id;
        this.traceId = nextID;
        req.headers = req.headers || {};
        req.headers[Header.TraceId] = nextID.traceId;
        req.headers[Header.SpanId] = nextID.spanId;
        nextID._parentId.ifPresent(psid => {
            req.headers[Header.ParentSpanId] = psid;
        });
        nextID.sampled.ifPresent(sampled => {
            req.headers[Header.Sampled] = sampled ? '1' : '0';
        });
        req.headers[Header.Flags] = nextID.flags;
        req.headers[httpHeader.step] = step;
        const method = getRequestMethod(req);
        tracer.recordAnnotation(new Annotation.ClientSend());
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(`rest send ${method.toUpperCase()} request`);
        tracer.recordBinary('http.url', req.path);
        if (remoteServiceName) {
            tracer.recordAnnotation(new Annotation.ServerAddr({
                serviceName: remoteServiceName
            }));
        }
    });
    return req;
}

function response(res, {tracer, serviceName = 'no-service'}) {
    tracer.scoped(() => {
        tracer.setId(this.traceId);
        tracer.recordAnnotation(new Annotation.ClientRecv());
        tracer.recordBinary('http.status_code', res.status.code.toString());
        tracer.recordBinary('http.body', res.entity.toString());
    });
    return res;
}

module.exports = interceptor({
    request,
    response
});
