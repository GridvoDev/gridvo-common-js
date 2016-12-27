'use strict';
var MongoClient = require('mongodb').MongoClient;
const {Annotation} = require('zipkin');
const {transformTraceContextToZK} = require('../../trace');

function createMongoZipkinClient({dbName = "unknow", collectionName = "unknow", tracer, traceContext, serviceName = 'no-service'}) {
    let {MONGODB_SERVICE_HOST = "127.0.0.1", MONGODB_SERVICE_PORT = "27017"} = process.env;

    function mkZipkinCallback(callback, id) {
        return function zipkinCallback(...args) {
            tracer.scoped(() => {
                tracer.setId(id);
                tracer.recordAnnotation(new Annotation.ClientRecv());
            });
            callback.apply(this, args);
        };
    }

    function commonAnnotations(rpc) {
        tracer.recordAnnotation(new Annotation.ClientSend());
        tracer.recordAnnotation(new Annotation.ServiceName(serviceName));
        tracer.recordRpc(`mongo client send ${rpc} command`);
        tracer.recordBinary('mongo.db', dbName);
        tracer.recordBinary('mongo.collection', collectionName);
        tracer.recordAnnotation(new Annotation.ServerAddr({
            serviceName: "mongo"
        }));
    }

    let mongoClient = new Promise((resolve, reject)=> {
        MongoClient.connect(`mongodb://${MONGODB_SERVICE_HOST}:${MONGODB_SERVICE_PORT}/${dbName}`, (err, db)=> {
            if (err) {
                reject(err)
            }
            let collectionCommands = [
                'findOne',
                "findOneAndUpdate",
                "findOneAndReplace",
                "findOneAndDelete",
                "updateOne",
                "updateMany ",
                "deleteMany",
                "deleteOne",
                "insertOne",
                "insertMany",
                "count",
                "createIndex",
                "createIndexes",
                "distinct",
                "drop",
                "dropIndex",
                "dropIndexes",
                "ensureIndex",
                "group",
                "geoNear",
                "geoHaystackSearch"
            ];
            let collection = db.collection(collectionName);
            collectionCommands.forEach((method) => {
                let actualFn = collection[method];
                collection[method] = function (...args) {
                    let callback = args.pop();
                    let nextID;
                    tracer.scoped(() => {
                        let currentID = transformTraceContextToZK(traceContext);
                        tracer.setId(currentID);
                        tracer.setId(tracer.createChildId());
                        nextID = tracer.id;
                        commonAnnotations(method);
                    });
                    let wrapper = mkZipkinCallback(callback, nextID);
                    let newArgs = [...args, wrapper];
                    actualFn.apply(this, newArgs);
                };
            });
            resolve({db, collection});
        });
    });
    return mongoClient;
};

module.exports = {
    createMongoZipkinClient
};