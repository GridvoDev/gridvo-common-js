'use strict';
const _ = require("underscore");
const httpHeader = require("../httpHeader");
const TraceContext = require("../../trace/traceContext");

function feachTraceContext(req) {
    if (_.isUndefined(req.zipkinTrace)) {
        throw new Error("Express must use expressZipkinMiddleware");
    }
    let {traceID, parentID, spanID, sampled, flags} = req.zipkinTrace;
    let step;
    step = req.header(httpHeader.step);
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

