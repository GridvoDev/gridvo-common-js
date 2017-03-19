'use strict';
const kafka = require('kafka-node');
const {
    Annotation
} = require('zipkin');
const {transformTraceContextToZK} = require('../trace');
const traceContextFeach = require('./kafkaWithZipkinTraceContextFeach');

class MessageConsumer {
    constructor({tracer, serviceName = "no-service-name", clientOpts = {}, consumerOpts = {}}) {
        let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
        this.serviceName = serviceName;
        this.tracer = tracer;
        let {
            connectionString = `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
            clientId = `${this.serviceName}-consumer-client`,
            zkOpts = {}
        } = clientOpts;
        this.clientOpts = {connectionString, clientId, zkOpts};
        let {groupId = `${this.serviceName}-consume-group`} =consumerOpts;
        this.consumerOpts = {groupId};
    }

    consumeMessage(topics, callback) {
        if (!topics) {
            callback(new Error("topics is must"));
            return;
        }
        let client = new kafka.Client(
            this.clientOpts.connectionString, this.clientOpts.clientId, this.clientOpts.zkOpts
        );
        this.consumer = new kafka.HighLevelConsumer(client, topics, this.consumerOpts);
        let self = this;
        this.consumer.on('message', message => {
            let tracer = self.tracer;
            tracer.scoped(() => {
                let data = JSON.parse(message.value);
                let traceContext = traceContextFeach(data);
                let currentID = transformTraceContextToZK(traceContext);
                tracer.setId(currentID);
                tracer.recordAnnotation(new Annotation.ServerRecv());
                tracer.recordServiceName(this.serviceName);
                tracer.recordRpc("kafka client consumer");
                tracer.recordAnnotation(new Annotation.LocalAddr({port: 3001}));
                tracer.recordBinary("kafka.consumer.topic", message.topic);
                let {IS_DEBUG = false} = process.env;
                if (IS_DEBUG) {
                    delete data.zipkinTrace;
                    tracer.recordBinary("kafka.consumer.message", JSON.stringify(data));
                }
                if (currentID.flags !== 0 && currentID.flags != null) {
                    tracer.recordBinary("zipkin-trace-flags", currentID.flags.toString());
                }
                callback(null, message);
                tracer.recordAnnotation(new Annotation.ServerSend());
            });
        });
    }

    close(callback) {
        if (this.consumer) {
            this.consumer.close(true, () => {
                callback();
            });
        }
    }
}

module.exports = MessageConsumer;