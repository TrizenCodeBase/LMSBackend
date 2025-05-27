import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropIndex = async () => {
  try {
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    const collection = mongoose.connection.collection('quizsubmissions');
    await collection.dropIndex('studentId_1_courseId_1_dayNumber_1');
    console.log('Successfully dropped old index');

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

dropIndex(); 