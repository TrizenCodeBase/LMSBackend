import mongoose from 'mongoose';
import dotenv from 'dotenv';
import QuizSubmission from '../models/QuizSubmission.js';

dotenv.config();

const updateIndexes = async () => {
  try {
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('quizsubmissions');
    
    // Drop all existing indexes
    await collection.dropIndexes();
    console.log('Dropped all existing indexes');

    // Create new compound unique index
    await collection.createIndex(
      { userId: 1, courseUrl: 1, dayNumber: 1, attemptNumber: 1 },
      { unique: true, background: true }
    );
    console.log('Created new compound unique index');

    // Update any documents without attempt numbers
    const result = await collection.updateMany(
      { attemptNumber: { $exists: false } },
      { $set: { attemptNumber: 1 } }
    );
    console.log(`Updated ${result.modifiedCount} documents with missing attempt numbers`);

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateIndexes(); 