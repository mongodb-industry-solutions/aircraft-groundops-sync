import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.DATABASE_NAME || "test";

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  clientPromise = client.connect().then(() => {
    //console.log(`Connected to MongoDB at ${uri}`);
    return client.db(dbName);
  }).catch(err => {
    console.error(`Failed to connect to MongoDB: ${err.message}`);
    throw err;
  });
  clientPromise = client.connect();
  global._mongoClientPromise = clientPromise;
} else {
  clientPromise = global._mongoClientPromise;
}

export { clientPromise };
