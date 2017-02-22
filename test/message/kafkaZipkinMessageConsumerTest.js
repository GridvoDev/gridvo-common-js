'use strict';
const kafka = require('kafka-node');
const sinon = require('sinon');
const {
    ExplicitContext
} = require('zipkin');
const _ = require('underscore');
const co = require('co');
const should = require('should');
const KafkaZipkinMessageConsumer = require('../../lib/message/kafkaZipkinMessageConsumer');
const {createZipkinTracer} = require('../../lib/trace');

describe('KafkaZipkinMessageConsumer(options) use case test', () => {
    let ctxImpl;
    let recorder;
    let record = sinon.spy();
    let messageConsumer;
    let client
    let producer;
    before(done => {
        process.env.IS_DEBUG = true;
        function setupKafka() {
            return new Promise((resolve, reject) => {
                let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
                client = new kafka.Client(
                    `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
                    "test-consumer-client");
                producer = new kafka.Producer(client);
                producer.on('ready', () => {
                    producer.createTopics(["test-topic3", "test-topic5"], true, (err, data) => {
                        if (err) {
                            reject(err)
                        }
                        client.refreshMetadata(["test-topic3", "test-topic5"], (err) => {
                            if (err) {
                                reject(err)
                            }
                            let message = {
                                suiteID: "suiteID",
                                corpID: "wxf8b4f85f3a794e77",
                                timestamp: 1403610513000,
                                zipkinTrace: {
                                    traceID: "aaa",
                                    parentID: "bbb",
                                    spanID: "ccc",
                                    flags: 1,
                                    step: 3
                                }
                            };
                            producer.send([{
                                topic: "test-topic3",
                                messages: [JSON.stringify(message)]
                            }], (err) => {
                                if (err) {
                                    reject(err)
                                }
                                resolve();
                            });
                        });
                    });
                });
                producer.on('error', (err) => {
                    reject(err);
                });
            });
        };
        function* setup() {
            yield setupKafka();
        };
        co(setup).then(() => {
            recorder = {record};
            ctxImpl = new ExplicitContext();
            let tracer = createZipkinTracer({ctxImpl, recorder});
            messageConsumer = new KafkaZipkinMessageConsumer({
                tracer,
                serviceName: "test-service"
            });
            done();
        }).catch(err => {
            done(err);
        });
    });
    describe('#consumeMessage(topics,callback)', () => {
        context('produce topic message', () => {
            it('should return topic message', done => {
                ctxImpl.scoped(() => {
                    messageConsumer.consumeMessage([{
                        topic: "test-topic3"
                    }, {
                        topic: "test-topic5"
                    }], (err, message) => {
                        let data = JSON.parse(message.value);
                        data.suiteID.should.be.eql("suiteID");
                        data.corpID.should.be.eql("wxf8b4f85f3a794e77");
                        data.timestamp.should.be.eql(1403610513000);
                        data.zipkinTrace.traceID.should.be.eql("aaa");
                        let annotations = record.args.map(args => args[0]);
                        let traceId = annotations[0].traceId.traceId;
                        let spanId = annotations[0].traceId.spanId;
                        annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                        annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                        annotations[0].annotation.annotationType.should.equal('ServerRecv');
                        annotations[1].annotation.annotationType.should.equal("ServiceName");
                        annotations[1].annotation.serviceName.should.equal("test-service");
                        annotations[2].annotation.annotationType.should.equal("Rpc");
                        annotations[2].annotation.name.should.equal("kafka client consumer");
                        annotations[3].annotation.annotationType.should.equal('LocalAddr');
                        annotations[4].annotation.annotationType.should.equal("BinaryAnnotation");
                        annotations[4].annotation.key.should.equal("kafka.consumer.topic");
                        annotations[4].annotation.value.should.equal("test-topic3");
                        annotations[5].annotation.annotationType.should.equal('BinaryAnnotation');
                        annotations[5].annotation.key.should.equal("kafka.consumer.message");
                        annotations[6].annotation.annotationType.should.equal('BinaryAnnotation');
                        done();
                    });
                });
            });
            after(done => {
                producer.close();
                client.close(() => {
                    done();
                });
            });
        });
    });
    after(done => {
        delete process.env.IS_DEBUG;
        messageConsumer.close(() => {
            done();
        });
    });
});