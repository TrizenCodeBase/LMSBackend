import mongoose from 'mongoose';
import User from '../models/User.js';

const migrationConfig = {
  // Update this with your MongoDB connection string
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database'
};

async function addReferralCountToUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(migrationConfig.mongoURI);
    console.log('Connected to MongoDB');

    // Update all users to ensure they have a referralCount field
    const result = await User.updateMany(
      { referralCount: { $exists: false } }, // Find users without referralCount
      { $set: { referralCount: 0 } } // Set referralCount to 0
    );

    console.log(`Migration completed successfully!`);
    console.log(`Updated ${result.modifiedCount} users`);
    console.log(`Matched ${result.matchedCount} users`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
addReferralCountToUsers(); 