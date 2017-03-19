'use strict';
const _ = require("underscore");
const {
    Annotation,
} = require('zipkin');

class Filter {
    constructor(options) {
        let {tracer, serviceName = "unknow-service"} = options;
        this._tracer = tracer;
        this._serviceName = serviceName;
    }

    before(msg, session, next) {
        let tracer = this._tracer;
        let self = this;
        tracer.scoped(() => {
            tracer.setId(tracer.createRootId());
            session.traceID = tracer.id;
            let {traceId, parentId, spanId, sampled, flags} =tracer.id;
            session.zipkinTrace = {
                traceID: traceId,
                parentID: parentId,
                spanID: spanId,
                flags: flags,
                sampled: sampled
            };
            tracer.recordAnnotation(new Annotation.ServerRecv());
            tracer.recordServiceName(self._serviceName);
            tracer.recordAnnotation(new Annotation.LocalAddr({port: 3011}));
            tracer.recordBinary('pomelo.msg', JSON.stringify(msg));
        });
        next();
    }

    after(err, msg, session, resp, next) {
        let tracer = this._tracer;
        let self = this;
        tracer.scoped(() => {
            let tracerID = session.traceID;
            tracer.setId(tracerID);
            tracer.recordAnnotation(new Annotation.ServerSend());
            if (_.isUndefined(resp.errcode)) {
                tracer.recordBinary('pomelo.res.mqtt.granted', resp.toString());
            }
            else {
                tracer.recordBinary('pomelo.res.errcode', resp.errcode.toString());
            }
            let {IS_DEBUG = false} =  process.env;
            if (IS_DEBUG) {
                tracer.recordBinary('pomelo.res', JSON.stringify(resp));
            }
        });
        next(err);
    }
}

module.exports = function (options) {
    return new Filter(options);
};