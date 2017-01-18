'use strict';
const _ = require("underscore");
const TraceContext = require("../trace/traceContext");

function feachTraceContext(session) {
    if (_.isUndefined(session.zipkinTrace)) {
        throw new Error("Pomelo must use zipkinFilter");
    }
    let {traceID, parentID, spanID, sampled, flags} = session.zipkinTrace;
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

