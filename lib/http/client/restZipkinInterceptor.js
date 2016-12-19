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
        let {traceId, parentId, spanId, flags} = nextID;
        req.headers = req.headers || {};
        req.headers[Header.TraceId] = traceId;
        req.headers[Header.SpanId] = spanId;
        nextID._parentId.ifPresent(psid => {
            req.headers[Header.ParentSpanId] = psid;
        });
        req.headers[Header.Flags] = flags;
        req.headers[httpHeader.step] = step;
        const method = getRequestMethod(req);
        tracer.recordAnnotation(new Annotation.ClientSend());
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(method.toUpperCase());
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
        tracer.recordServiceName(serviceName);
        tracer.recordBinary('http.status_code', res.status.code.toString());
    });
    return res;
}

module.exports = interceptor({
    request,
    response
});
