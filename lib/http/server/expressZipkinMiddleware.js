'use strict';
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
    const parsed = url.parse(req.originalUrl);
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: parsed.pathname,
        search: parsed.search
    });
}

function zipkinExpressMiddleware({tracer, serviceName = 'unknown'}) {
    return (req, res, next)=> {
        tracer.scoped(() => {
            function readHeader(header) {
                const val = req.header(header);
                if (val != null) {
                    return new Some(val);
                } else {
                    return None;
                }
            }

            if (containsRequiredHeaders(req)) {
                const spanId = readHeader(Header.SpanId);
                spanId.ifPresent(sid => {
                    const traceId = readHeader(Header.TraceId);
                    const parentSpanId = readHeader(Header.ParentSpanId);
                    const sampled = readHeader(Header.Sampled);
                    const flags = readHeader(Header.Flags).flatMap(stringToIntOption).getOrElse(0);
                    const id = new TraceId({
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
                    const currentId = tracer.id;
                    const idWithFlags = new TraceId({
                        traceId: currentId.traceId,
                        parentId: currentId.parentId,
                        spanId: currentId.spanId,
                        sampled: currentId.sampled,
                        flags: readHeader(Header.Flags)
                    });
                    tracer.setId(idWithFlags);
                }
            }
            const id = tracer.id;
            req.zipkinTrace = id;
            tracer.recordAnnotation(new Annotation.ServerRecv());
            tracer.recordServiceName(serviceName);
            tracer.recordRpc(req.method);
            tracer.recordBinary('http.url', formatRequestUrl(req));
            if (id.flags !== 0 && id.flags != null) {
                tracer.recordBinary(Header.Flags, id.flags.toString());
            }
            res.on('finish', () => {
                tracer.scoped(() => {
                    tracer.setId(id);
                    tracer.recordAnnotation(new Annotation.ServerSend());
                    tracer.recordServiceName(serviceName);
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
