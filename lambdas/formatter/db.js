const { MongoClient } = require('mongodb');
const { SecretsManager } = require('aws-sdk');

// Use cache across lambdas
// https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
let cachedMongoURI;
let cachedDb;

async function connectToDatabase(MONGODB_FULL_URI_ARN, dbName) {
  if (cachedDb) {
    return cachedDb;
  }
  if (!cachedMongoURI) {
    const client = new SecretsManager();
    const { SecretString } = await client
      .getSecretValue({ SecretId: MONGODB_FULL_URI_ARN })
      .promise();
    cachedMongoURI = SecretString;
  }

  // If no connection is cached, create a new one
  const client = await MongoClient.connect(cachedMongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Select the database through the connection,
  // using the database path of the connection string
  const db = client.db(dbName);

  // Cache the database connection and return the connection
  cachedDb = db;
  return db;
}
const setClipData = async (MONGODB_FULL_URI_ARN, videoId, data) => {
  const db = await connectToDatabase(MONGODB_FULL_URI_ARN);
  const filter = { videoId };
  const updateDoc = {
    $set: data,
  };
  const options = { upsert: true };

  const updateResults = await db.collection('timestamps').updateOne(filter, updateDoc, options);
  return updateResults;
};
exports.setClipData = setClipData;
