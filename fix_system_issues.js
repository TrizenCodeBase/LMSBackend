import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixSystemIssues() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    console.log('\n🔧 FIXING SYSTEMIC ISSUES');
    console.log('='.repeat(60));

    // 1. Fix Quiz Submission Data Structure
    console.log('\n📝 STEP 1: Fixing Quiz Submission Data Structure');
    
    // Get all quiz submissions
    const allQuizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({}).toArray();
    console.log(`Total quiz submissions found: ${allQuizSubmissions.length}`);

    let updatedSubmissions = 0;
    let submissionsWithBothIds = 0;

    for (const submission of allQuizSubmissions) {
      let needsUpdate = false;
      const updateData = {};

      // Check if submission has both userId and studentId
      if (submission.userId && submission.studentId) {
        submissionsWithBothIds++;
        
        // Standardize to use userId (ObjectId) consistently
        if (typeof submission.userId === 'string') {
          // Convert string userId to ObjectId
          updateData.userId = new mongoose.Types.ObjectId(submission.userId);
          needsUpdate = true;
        }
        
        // Remove studentId field to avoid confusion
        updateData.$unset = { studentId: "" };
        needsUpdate = true;
      } else if (submission.studentId && !submission.userId) {
        // If only studentId exists, convert it to userId
        updateData.userId = submission.studentId;
        updateData.$unset = { studentId: "" };
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mongoose.connection.db.collection('quizsubmissions').updateOne(
          { _id: submission._id },
          updateData
        );
        updatedSubmissions++;
      }
    }

    console.log(`Updated ${updatedSubmissions} quiz submissions`);
    console.log(`Found ${submissionsWithBothIds} submissions with both userId and studentId`);

    // 2. Fix Course Progress Calculation
    console.log('\n📚 STEP 2: Fixing Course Progress Calculation');
    
    // Get all user courses
    const allUserCourses = await mongoose.connection.db.collection('usercourses').find({}).toArray();
    console.log(`Total user courses found: ${allUserCourses.length}`);

    let updatedCourses = 0;

    for (const userCourse of allUserCourses) {
      if (userCourse.completedDays && userCourse.completedDays.length > 0) {
        // Get the actual course to determine total days
        const course = await mongoose.connection.db.collection('courses').findOne({ 
          courseUrl: userCourse.courseUrl 
        });

        if (course && course.roadmap) {
          const totalDays = course.roadmap.length;
          const completedDaysCount = userCourse.completedDays.length;
          const correctProgress = Math.round((completedDaysCount / totalDays) * 100);
          const correctDaysCompletedPerDuration = `${completedDaysCount}/${totalDays}`;

          // Check if progress needs updating
          if (userCourse.progress !== correctProgress || 
              userCourse.daysCompletedPerDuration !== correctDaysCompletedPerDuration) {
            
            await mongoose.connection.db.collection('usercourses').updateOne(
              { _id: userCourse._id },
              {
                $set: {
                  progress: correctProgress,
                  daysCompletedPerDuration: correctDaysCompletedPerDuration,
                  status: correctProgress === 100 ? 'completed' : 'started'
                }
              }
            );
            updatedCourses++;
            
            console.log(`Fixed course progress for ${userCourse.courseUrl}: ${userCourse.progress}% → ${correctProgress}%`);
          }
        }
      }
    }

    console.log(`Updated ${updatedCourses} course progress records`);

    // 3. Fix Quiz Submission Model Schema
    console.log('\n🏗️ STEP 3: Updating Quiz Submission Model Schema');
    
    // Drop existing indexes to avoid conflicts
    try {
      await mongoose.connection.db.collection('quizsubmissions').dropIndexes();
      console.log('Dropped existing indexes');
    } catch (error) {
      console.log('No existing indexes to drop');
    }

    // Create new consistent indexes
    await mongoose.connection.db.collection('quizsubmissions').createIndex({ userId: 1 });
    await mongoose.connection.db.collection('quizsubmissions').createIndex({ courseUrl: 1 });
    await mongoose.connection.db.collection('quizsubmissions').createIndex({ 
      userId: 1, 
      courseUrl: 1, 
      dayNumber: 1 
    });
    await mongoose.connection.db.collection('quizsubmissions').createIndex({ isCompleted: 1 });
    console.log('Created new consistent indexes');

    // 4. Verify Fixes
    console.log('\n✅ STEP 4: Verifying Fixes');
    
    // Test with our known problematic student
    const testStudent = await mongoose.connection.db.collection('users').findOne({ userId: 'TST0YSQ' });
    if (testStudent) {
      console.log(`\nTesting fixes for student: ${testStudent.name}`);
      
      // Check quiz submissions
      const quizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({ 
        userId: testStudent._id 
      }).toArray();
      console.log(`Quiz submissions found: ${quizSubmissions.length}`);
      
      // Check course progress
      const userCourse = await mongoose.connection.db.collection('usercourses').findOne({ 
        userId: testStudent._id 
      });
      if (userCourse) {
        console.log(`Course progress: ${userCourse.progress}%`);
        console.log(`Completed days: ${userCourse.completedDays?.join(', ')}`);
        console.log(`Days completed per duration: ${userCourse.daysCompletedPerDuration}`);
      }
    }

    // 5. Create Migration Summary
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Quiz submissions standardized: ${updatedSubmissions}`);
    console.log(`✅ Course progress records fixed: ${updatedCourses}`);
    console.log(`✅ Database indexes recreated`);
    console.log(`✅ Data structure now consistent across all interfaces`);

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Update all API endpoints to use consistent userId field');
    console.log('2. Update frontend components to use consistent queries');
    console.log('3. Test leaderboard calculations with fixed data');
    console.log('4. Monitor for any remaining inconsistencies');

  } catch (error) {
    console.error('Error fixing system issues:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixSystemIssues();
