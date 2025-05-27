import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const updateCollection = async () => {
  try {
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('quizsubmissions');
    
    // Drop all indexes
    await collection.dropIndexes();
    console.log('Dropped all indexes');

    // Create new index with attemptNumber
    await collection.createIndex(
      { userId: 1, courseUrl: 1, dayNumber: 1, attemptNumber: 1 },
      { unique: true }
    );
    console.log('Created new index with attempt number');

    // Update existing documents to add attemptNumber if missing
    const result = await collection.updateMany(
      { attemptNumber: { $exists: false } },
      { $set: { attemptNumber: 1 } }
    );
    console.log(`Updated ${result.modifiedCount} existing documents with attempt number`);

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateCollection(); 