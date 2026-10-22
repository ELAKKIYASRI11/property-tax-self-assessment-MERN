const mongoose = require('mongoose');

const getMongoUri = () =>
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/property_tax_portal';

// Cache the connection promise across serverless invocations so warm functions reuse it.
let cached = global.__mongooseConn;
if (!cached) {
  cached = global.__mongooseConn = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(getMongoUri(), {
        dbName: process.env.MONGODB_DB || 'property_tax_portal',
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        console.log(`MongoDB Connected: ${m.connection.host}/${m.connection.name}`);
        return m;
      })
      .catch((error) => {
        cached.promise = null;
        console.error(`MongoDB Connection Error: ${error.message}`);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;
