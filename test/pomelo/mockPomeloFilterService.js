'use strict';

class Service {
    constructor() {
        this.befores = [];
        this.afters = [];
    }

    before(filter) {
        this.befores.push(filter);
    }

    after(filter) {
        this.afters.unshift(filter);
    }

    beforeFilter(msg, session, cb) {
        let index = 0, self = this;
        let next = function (err, resp, opts) {
            if (err || index >= self.befores.length) {
                cb(err, resp, opts);
                return;
            }

            let handler = self.befores[index++];
            if (typeof handler === 'function') {
                handler(msg, session, next);
            } else if (typeof handler.before === 'function') {
                handler.before(msg, session, next);
            } else {
                console.log('meet invalid before filter, handler or handler.before should be function.');
                next(new Error('invalid before filter.'));
            }
        };
        next();
    }

    afterFilter(err, msg, session, resp, cb) {
        let index = 0, self = this;

        function next(err) {
            if (index >= self.afters.length) {
                cb(err);
                return;
            }
            let handler = self.afters[index++];
            if (typeof handler === 'function') {
                handler(err, msg, session, resp, next);
            } else if (typeof handler.after === 'function') {
                handler.after(err, msg, session, resp, next);
            } else {
                console.log('meet invalid after filter, handler or handler.after should be function.');
                next(new Error('invalid after filter.'));
            }
        }

        next(err);
    }

}

module.exports = Service;