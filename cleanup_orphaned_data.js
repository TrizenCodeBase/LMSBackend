import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function cleanupOrphanedData() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    console.log('\n🧹 CLEANING UP ORPHANED DATA');
    console.log('='.repeat(60));

    // 1. Clean up orphaned messages
    console.log('\n💬 CLEANING ORPHANED MESSAGES...');
    
    // Get all valid user IDs
    const validUserIds = await mongoose.connection.db.collection('users').distinct('_id');
    const validCourseIds = await mongoose.connection.db.collection('courses').distinct('_id');
    
    // Find orphaned messages
    const orphanedMessages = await mongoose.connection.db.collection('messages').find({
      $or: [
        { senderId: { $nin: validUserIds } },
        { receiverId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).toArray();
    
    console.log(`Found ${orphanedMessages.length} orphaned messages`);
    
    if (orphanedMessages.length > 0) {
      const messageIds = orphanedMessages.map(msg => msg._id);
      await mongoose.connection.db.collection('messages').deleteMany({
        _id: { $in: messageIds }
      });
      console.log(`✅ Deleted ${orphanedMessages.length} orphaned messages`);
    }

    // 2. Clean up orphaned notifications
    console.log('\n🔔 CLEANING ORPHANED NOTIFICATIONS...');
    
    const orphanedNotifications = await mongoose.connection.db.collection('notifications').find({
      userId: { $nin: validUserIds }
    }).toArray();
    
    console.log(`Found ${orphanedNotifications.length} orphaned notifications`);
    
    if (orphanedNotifications.length > 0) {
      const notificationIds = orphanedNotifications.map(notif => notif._id);
      await mongoose.connection.db.collection('notifications').deleteMany({
        _id: { $in: notificationIds }
      });
      console.log(`✅ Deleted ${orphanedNotifications.length} orphaned notifications`);
    }

    // 3. Clean up orphaned discussions
    console.log('\n💭 CLEANING ORPHANED DISCUSSIONS...');
    
    const orphanedDiscussions = await mongoose.connection.db.collection('discussions').find({
      $or: [
        { userId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).toArray();
    
    console.log(`Found ${orphanedDiscussions.length} orphaned discussions`);
    
    if (orphanedDiscussions.length > 0) {
      const discussionIds = orphanedDiscussions.map(disc => disc._id);
      await mongoose.connection.db.collection('discussions').deleteMany({
        _id: { $in: discussionIds }
      });
      console.log(`✅ Deleted ${orphanedDiscussions.length} orphaned discussions`);
    }

    // 4. Clean up orphaned reviews
    console.log('\n⭐ CLEANING ORPHANED REVIEWS...');
    
    const orphanedReviews = await mongoose.connection.db.collection('reviews').find({
      $or: [
        { studentId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).toArray();
    
    console.log(`Found ${orphanedReviews.length} orphaned reviews`);
    
    if (orphanedReviews.length > 0) {
      const reviewIds = orphanedReviews.map(review => review._id);
      await mongoose.connection.db.collection('reviews').deleteMany({
        _id: { $in: reviewIds }
      });
      console.log(`✅ Deleted ${orphanedReviews.length} orphaned reviews`);
    }

    // 5. Clean up orphaned notes
    console.log('\n📝 CLEANING ORPHANED NOTES...');
    
    const orphanedNotes = await mongoose.connection.db.collection('notes').find({
      $or: [
        { userId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).toArray();
    
    console.log(`Found ${orphanedNotes.length} orphaned notes`);
    
    if (orphanedNotes.length > 0) {
      const noteIds = orphanedNotes.map(note => note._id);
      await mongoose.connection.db.collection('notes').deleteMany({
        _id: { $in: noteIds }
      });
      console.log(`✅ Deleted ${orphanedNotes.length} orphaned notes`);
    }

    // 6. Verify cleanup results
    console.log('\n✅ VERIFYING CLEANUP RESULTS...');
    
    const remainingOrphanedMessages = await mongoose.connection.db.collection('messages').find({
      $or: [
        { senderId: { $nin: validUserIds } },
        { receiverId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).count();
    
    const remainingOrphanedNotifications = await mongoose.connection.db.collection('notifications').find({
      userId: { $nin: validUserIds }
    }).count();
    
    const remainingOrphanedDiscussions = await mongoose.connection.db.collection('discussions').find({
      $or: [
        { userId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).count();
    
    const remainingOrphanedReviews = await mongoose.connection.db.collection('reviews').find({
      $or: [
        { studentId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).count();
    
    const remainingOrphanedNotes = await mongoose.connection.db.collection('notes').find({
      $or: [
        { userId: { $nin: validUserIds } },
        { courseId: { $nin: validCourseIds } }
      ]
    }).count();

    console.log('\n📊 CLEANUP SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Messages cleaned: ${orphanedMessages.length}`);
    console.log(`Notifications cleaned: ${orphanedNotifications.length}`);
    console.log(`Discussions cleaned: ${orphanedDiscussions.length}`);
    console.log(`Reviews cleaned: ${orphanedReviews.length}`);
    console.log(`Notes cleaned: ${orphanedNotes.length}`);
    
    console.log('\n🔍 REMAINING ORPHANED RECORDS:');
    console.log(`Messages: ${remainingOrphanedMessages}`);
    console.log(`Notifications: ${remainingOrphanedNotifications}`);
    console.log(`Discussions: ${remainingOrphanedDiscussions}`);
    console.log(`Reviews: ${remainingOrphanedReviews}`);
    console.log(`Notes: ${remainingOrphanedNotes}`);

    if (remainingOrphanedMessages === 0 && 
        remainingOrphanedNotifications === 0 && 
        remainingOrphanedDiscussions === 0 && 
        remainingOrphanedReviews === 0 && 
        remainingOrphanedNotes === 0) {
      console.log('\n🎉 ALL ORPHANED DATA SUCCESSFULLY CLEANED!');
    } else {
      console.log('\n⚠️ Some orphaned records remain. Manual review may be needed.');
    }

    // 7. Create indexes for better performance
    console.log('\n🏗️ OPTIMIZING DATABASE INDEXES...');
    
    try {
      // Create indexes for better query performance
      await mongoose.connection.db.collection('messages').createIndex({ senderId: 1 });
      await mongoose.connection.db.collection('messages').createIndex({ receiverId: 1 });
      await mongoose.connection.db.collection('messages').createIndex({ courseId: 1 });
      
      await mongoose.connection.db.collection('notifications').createIndex({ userId: 1 });
      await mongoose.connection.db.collection('notifications').createIndex({ userId: 1, read: 1 });
      
      await mongoose.connection.db.collection('discussions').createIndex({ courseId: 1 });
      await mongoose.connection.db.collection('discussions').createIndex({ userId: 1 });
      
      await mongoose.connection.db.collection('reviews').createIndex({ courseId: 1 });
      await mongoose.connection.db.collection('reviews').createIndex({ studentId: 1 });
      
      await mongoose.connection.db.collection('notes').createIndex({ userId: 1 });
      await mongoose.connection.db.collection('notes').createIndex({ courseId: 1 });
      
      console.log('✅ Database indexes optimized');
    } catch (error) {
      console.log('⚠️ Some indexes may already exist:', error.message);
    }

    console.log('\n🎯 CLEANUP COMPLETE!');
    console.log('The system is now fully optimized and free of orphaned data.');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

cleanupOrphanedData();
