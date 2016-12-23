'use strict';
const kafka = require('kafka-node');
const {
    Annotation
} = require('zipkin');
const {transformTraceContextToZK, createZipkinTracer} = require('../trace');

let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
class MessageProducer {
    constructor(options = {serviceName: "no-service-name"}) {
        this.serviceName = options.serviceName;
        let clientDefaults = {
            connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
            clientId: `${this.topic}-producer-client`,
            zkOpts: {}
        };
        let clientOpts = Object.assign({}, clientDefaults, options.clientOpts || {});
        let producerDefaults = {
            requireAcks: 1
        };
        let producerOpts = Object.assign({}, producerDefaults, options.producerOpts || {});
        let tracer = options.tracer ? options.tracer : createZipkinTracer({});
        this.tracer = tracer;
        let self = this;
        this.producerPromise = new Promise((resolve, reject) => {
            self.client = new kafka.Client(
                clientOpts.connectionString, clientOpts.clientId, clientOpts.zkOpts
            );
            let producer = new kafka.HighLevelProducer(self.client, producerOpts);
            producer.on('ready', ()=> {
                resolve(producer);
            });
            producer.on('error', err=> {
                if (self.client) {
                    self.client.close();
                }
                reject(err);
            });
        });
    }

    produceMessage(topic, message, traceContext, callback) {
        if (!topic || !message) {
            callback(null, null);
            return;
        }
        let tracer = this.tracer;
        let producerPromise = this.producerPromise;
        let serviceName = this.serviceName;
        let {step}= traceContext;
        tracer.scoped(() => {
            let currentID = transformTraceContextToZK(traceContext);
            tracer.setId(currentID);
            tracer.setId(tracer.createChildId());
            let nextID = tracer.id;
            let {traceId, parentId, spanId, flags} = nextID;
            message.zipkinTrace = {
                traceID: traceId,
                parentID: parentId,
                spanID: spanId,
                flags,
                step
            };
            var payloads = [{
                topic: topic,
                messages: [JSON.stringify(message)]
            }];
            producerPromise.then(producer=> {
                tracer.scoped(()=> {
                    tracer.setId(nextID);
                    tracer.recordAnnotation(new Annotation.ClientSend());
                    tracer.recordServiceName(serviceName);
                    tracer.recordRpc("kafka client produce");
                    tracer.recordBinary('topic', topic);
                    tracer.recordAnnotation(new Annotation.ServerAddr({
                        serviceName: "kafka"
                    }));
                });
                producer.send(payloads, (err, data) => {
                    tracer.scoped(()=> {
                        tracer.setId(nextID);
                        tracer.recordAnnotation(new Annotation.ClientRecv());
                        tracer.recordBinary("result", JSON.stringify(data));
                    });
                    callback(null, data);
                });
            }).catch(err=> {
                callback(err);
            });
        });
    }

    close() {
        return (this.producerPromise.then(()=> {
            return new Promise(resolve=> this.client.close(resolve));
        }));
    }
}

module.exports = MessageProducer;