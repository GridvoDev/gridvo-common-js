'use strict';
const kafka = require('kafka-node');
const {
    Tracer,
    ExplicitContext,
    BatchRecorder,
    option: {Some, None},
    Annotation,
    TraceId
} = require('zipkin');
const {KafkaLogger} = require('zipkin-transport-kafka');

let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
class MessageProducer {
    constructor(options = {serviceName: "no-service-name"}) {
        this.serviceName = options.serviceName;
        let clientDefaults = {
            connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
            clientId: `wechat-server-interaction-${this.topic}-producer-client`,
            zkOpts: {}
        };
        let clientOpts = Object.assign({}, clientDefaults, options.clientOpts || {});
        let producerDefaults = {
            requireAcks: 1
        };
        let producerOpts = Object.assign({}, producerDefaults, options.producerOpts || {});
        let _recorder = new BatchRecorder({
            logger: new KafkaLogger({
                clientOpts: {
                    connectionString: `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
                }
            })
        });
        let _ctxImpl = new ExplicitContext();
        let {ctxImpl = _ctxImpl, recorder = _recorder} = options.zipkinOpts ? options.zipkinOpts : {};
        this.tracer = new Tracer({ctxImpl, recorder});
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
        function stringToBoolean(str) {
            return str === '1';
        }

        function stringToIntOption(str) {
            try {
                return new Some(parseInt(str));
            } catch (err) {
                return None;
            }
        }

        function readTraceContext(key) {
            let val = traceContext[key];
            if (val != null) {
                return new Some(val);
            } else {
                return None;
            }
        };
        let tracer = this.tracer;
        let producerPromise = this.producerPromise;
        let serviceName = this.serviceName;
        let {step}= traceContext;
        tracer.scoped(() => {
            let spanID = readTraceContext("spanID");
            spanID.ifPresent(sid=> {
                let currentID = new TraceId({
                    traceId: readTraceContext("traceID"),
                    parentId: readTraceContext("parentID"),
                    spanId: sid,
                    sampled: readTraceContext("sampled").map(stringToBoolean),
                    flags: readTraceContext("flags").flatMap(stringToIntOption).getOrElse(0)
                });
                tracer.setId(currentID);
            });
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
                    tracer.recordRpc("kafka-topic-produce");
                    tracer.recordBinary('topic', topic);
                });
                producer.send(payloads, (err, data) => {
                    tracer.scoped(()=> {
                        tracer.setId(nextID);
                        tracer.recordAnnotation(new Annotation.ClientRecv());
                        tracer.recordServiceName(serviceName);
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