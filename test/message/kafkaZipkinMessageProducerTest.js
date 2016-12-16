'use strict';
const kafka = require('kafka-node');
const sinon = require('sinon');
const {
    ExplicitContext,
    ConsoleRecorder
} = require('zipkin');
const _ = require('underscore');
const co = require('co');
const should = require('should');
const KafkaZipkinMessageProducer = require('../../lib/message/kafkaZipkinMessageProducer');
const TraceContext = require('../../lib/trace/traceContext');

describe('KafkaZipkinMessageProducer(options) use case test', ()=> {
    let ctxImpl;
    let recorder;
    let record = sinon.spy();
    let messageProducer;
    let consumer;
    before(done=> {
        function setupKafka() {
            return new Promise((resolve, reject)=> {
                let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
                let client = new kafka.Client(
                    `${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`,
                    "wechat-server-interaction-test-producer-client");
                let initProducer = new kafka.Producer(client);
                initProducer.on('ready', ()=> {
                    initProducer.createTopics(["test-topic1", "test-topic2"], true, (err, data)=> {
                        if (err) {
                            reject(err)
                        }
                        client.refreshMetadata(["test-topic1", "test-topic2"], (err)=> {
                            if (err) {
                                reject(err)
                            }
                            initProducer.close((err)=> {
                                if (err) {
                                    reject(err)
                                }
                                resolve();
                            });
                        });
                    });
                });
                initProducer.on('error', (err)=> {
                    reject(err);
                });
            });
        };
        function* setup() {
            yield setupKafka();
        };
        co(setup).then(()=> {
            recorder = {record};
            ctxImpl = new ExplicitContext();
            messageProducer = new KafkaZipkinMessageProducer({
                serviceName: "test-service",
                zipkinOpts: {
                    recorder,
                    ctxImpl
                }
            });
            done();
        }).catch(err=> {
            done(err);
        });
    });
    describe('#produceMessage(topic, message, traceContext, callback)', ()=> {
        context('produce topic message', ()=> {
            it('should return null if no topic or message', done=> {
                let message = null;
                let traceContext = {};
                messageProducer.produceMessage("test-topic1", message, traceContext, (err, data)=> {
                    _.isNull(data).should.be.eql(true);
                    done();
                });
            });
            it('should return data,add http context to message and record http context if message is send success', done=> {
                ctxImpl.scoped(()=> {
                    let message = {
                        suiteID: "suiteID",
                        corpID: "wxf8b4f85f3a794e77",
                        timestamp: 1403610513000
                    };
                    let traceContext = new TraceContext({
                        traceID: "aaa",
                        parentID: "bbb",
                        spanID: "ccc",
                        flags: 1,
                        step: 3
                    });
                    messageProducer.produceMessage("test-topic1", message, traceContext, (err, data)=> {
                        let annotations = record.args.map(args => args[0]);
                        let traceId = annotations[0].traceId.traceId;
                        let spanId = annotations[0].traceId.spanId;
                        annotations.forEach(ann=> ann.traceId.traceId.should.equal(traceId));
                        annotations.forEach(ann=> ann.traceId.spanId.should.equal(spanId));
                        annotations[0].annotation.annotationType.should.equal("ClientSend");
                        annotations[1].annotation.annotationType.should.equal("ServiceName");
                        annotations[1].annotation.serviceName.should.equal("test-service");
                        annotations[2].annotation.annotationType.should.equal("Rpc");
                        annotations[2].annotation.name.should.equal("kafka-topic-produce");
                        annotations[3].annotation.annotationType.should.equal("BinaryAnnotation");
                        annotations[3].annotation.key.should.equal("topic");
                        annotations[3].annotation.value.should.equal("test-topic1");
                        annotations[4].annotation.annotationType.should.equal("ClientRecv");
                        annotations[5].annotation.annotationType.should.equal("ServiceName");
                        annotations[5].annotation.serviceName.should.equal("test-service");
                        annotations[6].annotation.annotationType.should.equal("BinaryAnnotation");
                        annotations[6].annotation.key.should.equal("result");
                        _.isNull(data).should.be.eql(false);
                        let {ZOOKEEPER_SERVICE_HOST = "127.0.0.1", ZOOKEEPER_SERVICE_PORT = "2181"} = process.env;
                        let client = new kafka.Client(`${ZOOKEEPER_SERVICE_HOST}:${ZOOKEEPER_SERVICE_PORT}`);
                        let topics = [{
                            topic: "test-topic1"
                        }];
                        let options = {
                            groupId: "test-group"
                        };
                        consumer = new kafka.HighLevelConsumer(client, topics, options);
                        consumer.on('message', function (message) {
                            let data = JSON.parse(message.value);
                            data.suiteID.should.be.eql("suiteID");
                            data.corpID.should.be.eql("wxf8b4f85f3a794e77");
                            data.timestamp.should.be.eql(1403610513000);
                            let {traceID, parentID, spanID, sampled, flags, step} = data.zipkinTrace;
                            traceID.should.be.eql("aaa");
                            parentID.should.be.eql("ccc");
                            spanID.should.be.eql(spanId);
                            flags.should.be.eql(1);
                            step.should.be.eql(3);
                            done();
                        });
                    });
                });
            });
            after(done=> {
                consumer.close(true, (err)=> {
                    if (err) {
                        done(err);
                    }
                    done();
                });
            });
        });
    });
    after(done=> {
        messageProducer.close().then(done);
    });
});