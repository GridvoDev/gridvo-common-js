'use strict';

function Component(app, opts) {
    let {tracer, serviceName = "unknow-service"} = opts;
    this._app = app;
    this._tracer = tracer;
    this._serviceName = serviceName;
}

Component.prototype.start = function (callback) {
    this._app.set("tracer", this._tracer);
    this._app.set("serviceName", this._serviceName);
    process.nextTick(callback);
}

Component.prototype.afterStart = function (callback) {
    process.nextTick(callback);
}

Component.prototype.stop = function (callback) {
    process.nextTick(callback);
}

module.exports = function (app, opts) {
    return new Component(app, opts);
};