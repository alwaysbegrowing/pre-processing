const { MongoClient } = require('mongodb');
const { SecretsManager } = require('aws-sdk');


const secretName = 'MONGODB_FULL_URI';

// Use cache across lambdas
// https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
let cachedMongoURI;
let cachedDb;

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase() {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (cachedDb) {
    return cachedDb;
  }
  if (!cachedMongoURI) {
    const client = new SecretsManager();
    const { SecretString } = await client.getSecretValue({ SecretId: secretName }).promise();
    cachedMongoURI = SecretString;
  }

  // If no connection is cached, create a new one
  const client = await MongoClient.connect(cachedMongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Select the database through the connection,
  // using the database path of the connection string
  const db = client.db('TwitchHighlights_Dev');

  // Cache the database connection and return the connection
  cachedDb = db;
  return db;
}

exports.connectToDatabase = connectToDatabase;
