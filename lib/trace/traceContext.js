'use strict';

class TraceContext {
    constructor({traceID, parentID, spanID, sampled, flags, step}) {
        this._traceID = traceID;
        this._parentID = parentID;
        this._spanID = spanID;
        this._sampled = sampled;
        this._flags = flags;
        this._step = step;
    }

    get traceID() {
        return this._traceID;
    }

    get parentID() {
        return this._parentID;
    }

    get spanID() {
        return this._spanID;
    }

    get sampled() {
        return this._sampled
    }

    get flags() {
        return this._flags;
    }

    get step() {
        return this._step;
    }
}

module.exports = TraceContext;