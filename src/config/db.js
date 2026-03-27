import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    logger.info('MongoDB connected (Atlas/Custom URI)');
  } catch (error) {
    logger.warn(`Primary MongoDB connection failed: ${error.message}`);
    logger.info('Falling back to in-memory MongoDB...');

    try {
      const mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      logger.info('In-memory MongoDB connected (data lost on restart)');
    } catch (memError) {
      logger.error(`Fallback memory DB failed: ${memError.message}`);
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

export default connectDB;
