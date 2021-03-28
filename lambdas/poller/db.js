const { MongoClient } = require('mongodb');

// Create cached connection variable

let cachedDb;

// A function for connecting to MongoDB,
// taking a single parameter of the connection string
async function connectToDatabase() {
  // If the database connection is cached,
  // use it instead of creating a new connection
  if (cachedDb) {
    return cachedDb;
  }

  // If no connection is cached, create a new one
  const client = await MongoClient.connect(process.env.MONGODB_FULL_URI, {
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

module.exports = connectToDatabase;
