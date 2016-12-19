'use strict';
const _ = require("underscore");
const httpHeader = require("../httpHeader");
const TraceContext = require("../../trace/traceContext");

function feachTraceContext(req) {
    if (_.isUndefined(req.zipkinTrace)) {
        throw new Error("Express must use expressZipkinMiddleware");
    }
    let {traceId, parentId, spanId, sampled, flags} = req.zipkinTrace;
    let step;
    step = req.header(httpHeader.step);
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

