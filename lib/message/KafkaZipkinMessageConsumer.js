'use strict';
const kafka = require('kafka-node');
const {
    Annotation
} = require('zipkin');
const {transformTraceContextToZK} = require('../trace');
const traceContextFeach = require('./kafkaWithZipkinTraceContextFeach');

let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
class MessageConsumer {
    constructor({tracer, serviceName = "no-service-name"}) {
        this.serviceName = serviceName;
        this.tracer = tracer;
        let clientOpts = {
            connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
            clientId: `${this.serviceName}-consumer-client`,
            zkOpts: {}
        };
        this.clientOpts = clientOpts;
        let consumerOpts = {
            groupId: `${this.serviceName}-consume-group`
        };
        this.consumerOpts = consumerOpts;
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
        this.consumer.on('message', message=> {
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
                tracer.recordBinary("topic", message.topic);
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
            this.consumer.close(true, ()=> {
                callback();
            });
        }
    }
}

module.exports = MessageConsumer;