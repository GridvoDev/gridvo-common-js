'use strict';
const _ = require("underscore");
var MongoClient = require('mongodb').MongoClient;
const should = require('should');
const sinon = require('sinon');
const {
    ExplicitContext,
} = require('zipkin');
const {createMongoZipkinClient} = require('../../../lib/db/mongo/mongoZipkinClient');
const {TraceContext, createZipkinTracer} = require('../../../lib/trace');

describe.only('restZipkinInterceptor integration test', ()=> {
    let record = sinon.spy();
    let recorder = {record};
    let ctxImpl = new ExplicitContext();
    let tracer = createZipkinTracer({ctxImpl, recorder});
    describe("wrap mongo db client", ()=> {
        context('run mongo calls', ()=> {
            it('should run mongo db collection updateOne command and add zipkin annotations', done=> {
                ctxImpl.scoped(()=> {
                    let traceContext = new TraceContext({
                        traceID: "aaa",
                        parentID: "bbb",
                        spanID: "ccc",
                        flags: 1,
                        step: 3
                    });
                    let client = createMongoZipkinClient({
                        tracer,
                        traceContext,
                        dbName: 'Test',
                        collectionName: "test"
                    });
                    client.then(({db, collection})=> {
                        collection.updateOne({
                                testID: "testID"
                            },
                            {
                                $set: {key: "value"}
                            },
                            {
                                upsert: true
                            },
                            (err, result)=> {
                                if (err) {
                                    done(err);
                                }
                                result.result.n.should.equal(1);
                                let annotations = record.args.map(args => args[0]);
                                let traceId = annotations[0].traceId.traceId;
                                let spanId = annotations[0].traceId.spanId;
                                annotations.forEach(ann => ann.traceId.traceId.should.equal(traceId));
                                annotations.forEach(ann => ann.traceId.spanId.should.equal(spanId));
                                annotations[0].annotation.annotationType.should.equal('ClientSend');
                                annotations[1].annotation.annotationType.should.equal('ServiceName');
                                annotations[1].annotation.serviceName.should.equal('no-service');
                                annotations[2].annotation.annotationType.should.equal('Rpc');
                                annotations[2].annotation.name.should.equal('mongo client send updateOne command');
                                annotations[3].annotation.annotationType.should.equal('BinaryAnnotation');
                                annotations[3].annotation.key.should.equal('mongo.db');
                                annotations[3].annotation.value.should.equal("Test");
                                annotations[4].annotation.annotationType.should.equal('BinaryAnnotation');
                                annotations[4].annotation.key.should.equal('mongo.collection');
                                annotations[4].annotation.value.should.equal("test");
                                annotations[5].annotation.annotationType.should.equal('ServerAddr');
                                annotations[5].annotation.serviceName.should.equal('mongo');
                                annotations[6].annotation.annotationType.should.equal('ClientRecv');
                                db.close();
                                done();
                            });
                    }).catch(err=> {
                        done(err);
                    });
                });
            });
        });
    });
    after(done=> {
        let {MONGODB_SERVICE_HOST = "127.0.0.1", MONGODB_SERVICE_PORT = "27017"} = process.env;
        MongoClient.connect(`mongodb://${MONGODB_SERVICE_HOST}:${MONGODB_SERVICE_PORT}/Test`, (err, db)=> {
            if (err) {
                done(err);
            }
            db.collection('test').drop((err, response)=> {
                if (err) {
                    done(err);
                }
                db.close();
                done();
            });
        });
    });
});
