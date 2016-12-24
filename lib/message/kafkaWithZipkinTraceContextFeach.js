'use strict';
const _ = require("underscore");
const TraceContext = require("../trace/traceContext");

function feachTraceContext(data) {
    if (_.isUndefined(data.zipkinTrace)) {
        throw new Error("must use kafkaZipkinMessageProducer");
    }
    let {traceID, parentID, spanID, sampled, flags,step} = data.zipkinTrace;
    if (_.isUndefined(step)) {
        if (traceID == spanID) {
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
        traceID,
        parentID,
        spanID,
        sampled,
        flags,
        step
    });
};

module.exports = feachTraceContext;

