'use strict';
const _ = require("underscore");
const TraceContext = require("../trace/traceContext");

function feachTraceContext(data) {
    if (_.isUndefined(data.zipkinTrace)) {
        throw new Error("must use kafkaZipkinMessageProducer");
    }
    let {traceId, parentId, spanId, sampled, flags, step} = data.zipkinTrace;
    if (_.isUndefined(step)) {
        if (traceId == spanId) {
            step = 0;
        }
        else {
            step = NaN;
        }
    }
    else {
        step += 1
    }
    return new TraceContext({
        traceID: traceId,
        parentID: parentId,
        spanID: spanId,
        sampled,
        flags,
        step
    });
};

module.exports = feachTraceContext;

