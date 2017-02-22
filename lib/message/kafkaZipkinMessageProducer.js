'use strict';
const _ = require('underscore');
const kafka = require('kafka-node');
const {
    Annotation
} = require('zipkin');
const {transformTraceContextToZK} = require('../trace');

let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
class MessageProducer {
    constructor({tracer, serviceName = "no-service-name"}) {
        this.serviceName = serviceName;
        let clientOpts = {
            connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
            clientId: `${this.topic}-producer-client`,
            zkOpts: {}
        };
        let producerOpts = {
            requireAcks: 1
        };
        let zkOpts = {};
        this.tracer = tracer;
        let self = this;
        this.producerPromise = new Promise((resolve, reject) => {
            self.client = new kafka.Client(
                clientOpts.connectionString, clientOpts.clientId, zkOpts
            );
            let producer = new kafka.HighLevelProducer(self.client, producerOpts);
            producer.on('ready', () => {
                resolve(producer);
            });
            producer.on('error', err => {
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
        let {IS_DEBUG = false} = process.env;
        let rawMessage = _.clone(message);
        let tracer = this.tracer;
        let producerPromise = this.producerPromise;
        let serviceName = this.serviceName;
        let {step}= traceContext;
        tracer.scoped(() => {
            let currentID = transformTraceContextToZK(traceContext);
            tracer.setId(currentID);
            tracer.setId(tracer.createChildId());
            let nextID = tracer.id;
            let {traceId, parentId, spanId, sampled, flags} = nextID;
            message.zipkinTrace = {
                traceID: traceId,
                parentID: parentId,
                spanID: spanId,
                flags,
                sampled,
                step
            };
            var payloads = [{
                topic: topic,
                messages: [JSON.stringify(message)]
            }];
            producerPromise.then(producer => {
                tracer.scoped(() => {
                    tracer.setId(nextID);
                    tracer.recordAnnotation(new Annotation.ClientSend());
                    tracer.recordServiceName(serviceName);
                    tracer.recordRpc("kafka client produce");
                    tracer.recordBinary('kafka.produce.topic', topic);
                    if (IS_DEBUG) {
                        tracer.recordBinary("kafka.produce.message", JSON.stringify(rawMessage));
                    }
                    tracer.recordAnnotation(new Annotation.ServerAddr({
                        serviceName: "kafka"
                    }));
                });
                producer.send(payloads, (err, data) => {
                    tracer.scoped(() => {
                        tracer.setId(nextID);
                        tracer.recordAnnotation(new Annotation.ClientRecv());
                        tracer.recordBinary("kafka.produce.result", JSON.stringify(data));
                    });
                    callback(null, data);
                });
            }).catch(err => {
                callback(err);
            });
        });
    }

    close() {
        return (this.producerPromise.then(() => {
            return new Promise(resolve => this.client.close(resolve));
        }));
    }
}

module.exports = MessageProducer;