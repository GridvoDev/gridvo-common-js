'use strict';
const {
    Tracer,
    ExplicitContext,
    ConsoleRecorder,
    BatchRecorder,
    CountingSampler,
    option: {Some, None},
    TraceId
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
const {KafkaLogger} = require('zipkin-transport-kafka');

let _recorder = new ConsoleRecorder();
let _ctxImpl = new ExplicitContext();
function createZipkinTracer({ctxImpl = _ctxImpl, recorder = _recorder, http = false, scribe = false, kafka = false}) {
    if (http) {
        let {ZIPKIN_SERVICE_HOST = "127.0.0.1", ZIPKIN_HTTP_TRANSPORT_PORT = "9411"} = process.env;
        let recorder = new BatchRecorder({
            logger: new HttpLogger({
                endpoint: `http://${ZIPKIN_SERVICE_HOST}:${ZIPKIN_HTTP_TRANSPORT_PORT}/api/v1/spans`
            })
        });
        return new Tracer({ctxImpl, recorder});
    }
    if (kafka) {
        let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
        let recorder = new BatchRecorder({
            logger: new KafkaLogger({
                clientOpts: {
                    connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
                }
            })
        });
        return new Tracer({ctxImpl, recorder});
    }
    return new Tracer({ctxImpl, recorder});
};

function transformTraceContextToZK(traceContext) {
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

    function readTraceContext(key) {
        let val = traceContext[key];
        if (val != null) {
            return new Some(val);
        } else {
            return None;
        }
    };
    let traceID;
    traceID = new TraceId({
        traceId: readTraceContext("traceID"),
        parentId: readTraceContext("parentID"),
        spanId: traceContext.spanID,
        sampled: readTraceContext("sampled").map(stringToBoolean),
        flags: readTraceContext("flags").flatMap(stringToIntOption).getOrElse(0)
    });
    return traceID;
};

module.exports = {
    transformTraceContextToZK,
    createZipkinTracer
};