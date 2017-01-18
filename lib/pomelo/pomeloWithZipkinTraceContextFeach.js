'use strict';
const _ = require("underscore");
const TraceContext = require("../trace/traceContext");

function feachTraceContext(msg) {
    if (_.isUndefined(msg.zipkinTrace)) {
        throw new Error("Pomelo must use zipkinFilter");
    }
    let {traceID, parentID, spanID, sampled, flags} = msg.zipkinTrace;
    let step = 0;
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

