'use strict';
const {
    Tracer,
    ExplicitContext,
    BatchRecorder,
    option: {Some, None},
    TraceId
} = require('zipkin');
const {KafkaLogger} = require('zipkin-transport-kafka');

let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
let _recorder = new BatchRecorder({
    logger: new KafkaLogger({
        clientOpts: {
            connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
        }
    })
});
let _ctxImpl = new ExplicitContext();

function createZipkinTracer({ctxImpl = _ctxImpl, recorder = _recorder}) {
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
    let spanID = readTraceContext("spanID");
    spanID.ifPresent(sid=> {
        traceID = new TraceId({
            traceId: readTraceContext("traceID"),
            parentId: readTraceContext("parentID"),
            spanId: sid,
            sampled: readTraceContext("sampled").map(stringToBoolean),
            flags: readTraceContext("flags").flatMap(stringToIntOption).getOrElse(0)
        });
    });
    return traceID;
};

module.exports = {
    transformTraceContextToZK,
    createZipkinTracer
};