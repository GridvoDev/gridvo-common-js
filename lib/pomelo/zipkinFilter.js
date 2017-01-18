'use strict';
const {
    Annotation,
} = require('zipkin');

let Filter = function (app) {
    this._app = app;
};

Filter.prototype.before = function (msg, session, next) {
    let tracer = this._app.get("tracer");
    let self = this;
    tracer.scoped(() => {
        tracer.setId(tracer.createRootId());
        self._app.set("tracerID", tracer.id);
        let {traceId, parentId, spanId, sampled, flags} =tracer.id;
        msg.zipkinTrace = {
            traceID: traceId,
            parentID: parentId,
            spanID: spanId,
            flags: flags,
            sampled: sampled
        };
        tracer.recordAnnotation(new Annotation.ServerRecv());
        tracer.recordServiceName(self._app.get("serviceName"));
        tracer.recordRpc(`pomelo recv ${msg.cmd} request`);
        tracer.recordAnnotation(new Annotation.LocalAddr({port: 3011}));
        tracer.recordBinary('topic', msg.topic);
    });
    next();
}

Filter.prototype.after = function (err, msg, session, resp, next) {
    let tracer = this._app.get("tracer");
    let self = this;
    tracer.scoped(() => {
        let tracerID = self._app.get("tracerID");
        tracer.setId(tracerID);
        tracer.recordAnnotation(new Annotation.ServerSend());
        tracer.recordBinary('errcode', resp.errcode.toString());
    });
    next(err);
}

module.exports = function (app) {
    return new Filter(app);
};