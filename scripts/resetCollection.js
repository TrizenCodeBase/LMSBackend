import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const resetCollection = async () => {
  try {
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('quizsubmissions');
    
    // Drop the entire collection
    await collection.drop();
    console.log('Dropped collection');

    // Create new index with attemptNumber
    await collection.createIndex(
      { userId: 1, courseUrl: 1, dayNumber: 1, attemptNumber: 1 },
      { unique: true }
    );
    console.log('Created new index with attempt number');

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    if (error.code === 26) {
      console.log('Collection does not exist, skipping drop');
      process.exit(0);
    }
    console.error('Error:', error);
    process.exit(1);
  }
};

resetCollection(); 