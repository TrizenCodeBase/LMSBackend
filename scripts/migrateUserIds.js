import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateStudentId, generateInstructorId, generateRandomString } from '../models/generateUserId.js';
import User from '../models/User.js';

dotenv.config();

const generateUniqueId = async (generateFunction) => {
  let id;
  let isUnique = false;
  
  while (!isUnique) {
    id = generateFunction();
    // Check if this ID already exists
    const existingUser = await User.findOne({ userId: id });
    if (!existingUser) {
      isUnique = true;
    }
  }
  return id;
};

const migrateUserIds = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    // Find all users without userId
    const users = await User.find({ userId: { $exists: false } });
    console.log(`Found ${users.length} users without IDs`);

    for (const user of users) {
      let userId;
      
      switch (user.role) {
        case 'student':
          userId = await generateUniqueId(generateStudentId);
          break;
        case 'instructor':
          userId = await generateUniqueId(generateInstructorId);
          break;
        case 'admin':
          userId = await generateUniqueId(() => `TAD${generateRandomString(4)}`);
          break;
        default:
          userId = await generateUniqueId(generateStudentId); // Default to student ID format
      }

      await User.findByIdAndUpdate(user._id, { userId });
      console.log(`Updated user ${user.email} with ID: ${userId}`);
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateUserIds(); 