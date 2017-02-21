'use strict';
const _ = require('underscore');
const {
    Annotation,
    HttpHeaders: Header,
    option: {Some, None},
    TraceId
} = require('zipkin');
const url = require('url');
const {createZipkinTracer} = require('../../trace');

function containsRequiredHeaders(req) {
    return req.header(Header.TraceId) !== undefined &&
        req.header(Header.SpanId) !== undefined;
}

function stringToBoolean(str) {
    return str === '1';
}

function stringToIntOption(str) {
    try {
        return new Some(parseInt(str));
    } catch (err) {
        return None;
    }
}

function formatRequestUrl(req) {
    let parsed = url.parse(req.originalUrl);
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: parsed.pathname,
        search: parsed.search
    });
}

function zipkinExpressMiddleware({tracer, serviceName = 'unknown'}) {
    return (req, res, next) => {
        tracer.scoped(() => {
            function readHeader(header) {
                let val = req.header(header);
                if (val != null) {
                    return new Some(val);
                } else {
                    return None;
                }
            }

            if (containsRequiredHeaders(req)) {
                let spanId = readHeader(Header.SpanId);
                spanId.ifPresent(sid => {
                    let traceId = readHeader(Header.TraceId);
                    let parentSpanId = readHeader(Header.ParentSpanId);
                    let sampled = readHeader(Header.Sampled);
                    let flags = readHeader(Header.Flags).flatMap(stringToIntOption).getOrElse(0);
                    let id = new TraceId({
                        traceId,
                        parentId: parentSpanId,
                        spanId: sid,
                        sampled: sampled.map(stringToBoolean),
                        flags
                    });
                    tracer.setId(id);
                });
            } else {
                tracer.setId(tracer.createRootId());
                if (req.header(Header.Flags)) {
                    let currentId = tracer.id;
                    let idWithFlags = new TraceId({
                        traceId: currentId.traceId,
                        parentId: currentId.parentId,
                        spanId: currentId.spanId,
                        sampled: currentId.sampled,
                        flags: readHeader(Header.Flags)
                    });
                    tracer.setId(idWithFlags);
                }
            }
            let id = tracer.id;
            let {traceId, parentId, spanId, sampled, flags} =tracer.id;
            req.zipkinTrace = {
                traceID: traceId,
                parentID: parentId,
                spanID: spanId,
                flags: flags,
                sampled: sampled
            };
            tracer.recordAnnotation(new Annotation.ServerRecv());
            tracer.recordServiceName(serviceName);
            tracer.recordRpc(`express recv ${req.method} request`);
            tracer.recordAnnotation(new Annotation.LocalAddr({port: 3001}));
            tracer.recordBinary('http.url', formatRequestUrl(req));
            let {IS_DEBUG = false} =  process.env;
            if (IS_DEBUG) {
                if(_.isUndefined(req.body) || !req.body){
                    tracer.recordBinary("http.req_body", "null");
                }
                else{
                    tracer.recordBinary("http.req_body", req.body.toString());
                }
            }
            if (id.flags !== 0 && id.flags != null) {
                tracer.recordBinary(Header.Flags, id.flags.toString());
            }
            res.on('finish', () => {
                tracer.scoped(() => {
                    tracer.setId(id);
                    tracer.recordAnnotation(new Annotation.ServerSend());
                    tracer.recordBinary('http.status_code', res.statusCode.toString());
                });
            });
            next();
        });
    };
};

function middleware({tracer, serviceName = "no-service"}) {
    return zipkinExpressMiddleware({tracer: tracer ? tracer : createZipkinTracer(), serviceName});
}

module.exports = middleware;
