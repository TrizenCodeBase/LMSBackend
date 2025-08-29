import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function comprehensiveDebug() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const studentId = 'TST0YSQ';
    
    console.log('\n=== COMPREHENSIVE DEBUGGING ===');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Find the student
    const student = await mongoose.connection.db.collection('users').findOne({ userId: studentId });
    if (!student) {
      console.log('❌ Student not found!');
      return;
    }
    
    console.log('\n📋 STUDENT INFO:');
    console.log(`Name: ${student.name}`);
    console.log(`User ID: ${student.userId}`);
    console.log(`MongoDB _id: ${student._id}`);
    console.log(`Role: ${student.role}`);
    
    // 2. Search for quiz submissions with different userId formats
    console.log('\n🔍 SEARCHING FOR QUIZ SUBMISSIONS:');
    
    // Search with string userId
    const submissionsWithStringId = await mongoose.connection.db.collection('quizsubmissions').find({ userId: studentId }).toArray();
    console.log(`\nQuiz submissions with string userId (${studentId}): ${submissionsWithStringId.length}`);
    
    // Search with ObjectId
    const submissionsWithObjectId = await mongoose.connection.db.collection('quizsubmissions').find({ userId: student._id }).toArray();
    console.log(`Quiz submissions with ObjectId (${student._id}): ${submissionsWithObjectId.length}`);
    
    // Search with studentId field
    const submissionsWithStudentId = await mongoose.connection.db.collection('quizsubmissions').find({ studentId: student._id }).toArray();
    console.log(`Quiz submissions with studentId field: ${submissionsWithStudentId.length}`);
    
    // Search by name (in case userId is different)
    const submissionsByName = await mongoose.connection.db.collection('quizsubmissions').find({ 
      $text: { $search: student.name } 
    }).toArray();
    console.log(`Quiz submissions by name search: ${submissionsByName.length}`);
    
    // Get ALL quiz submissions and filter manually
    const allQuizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({}).toArray();
    console.log(`\nTotal quiz submissions in database: ${allQuizSubmissions.length}`);
    
    // Manual search for any submissions that might belong to this student
    const possibleSubmissions = allQuizSubmissions.filter(sub => {
      // Check if userId matches (string or ObjectId)
      if (sub.userId && (sub.userId.toString() === studentId || sub.userId === studentId)) return true;
      
      // Check if studentId matches
      if (sub.studentId && sub.studentId.toString() === student._id.toString()) return true;
      
      // Check if courseUrl matches the student's course
      if (sub.courseUrl && sub.courseUrl === 'd5c63-web-development-bootcamp-TIN59PR') {
        // This might be the student's submission
        return true;
      }
      
      return false;
    });
    
    console.log(`\nPossible submissions for this student: ${possibleSubmissions.length}`);
    
    if (possibleSubmissions.length > 0) {
      console.log('\n📝 POSSIBLE QUIZ SUBMISSIONS:');
      possibleSubmissions.forEach((sub, index) => {
        console.log(`\nSubmission ${index + 1}:`);
        console.log(`  Course URL: ${sub.courseUrl}`);
        console.log(`  Day Number: ${sub.dayNumber}`);
        console.log(`  Score: ${sub.score}%`);
        console.log(`  Attempt Number: ${sub.attemptNumber}`);
        console.log(`  Is Completed: ${sub.isCompleted}`);
        console.log(`  Submitted Date: ${sub.submittedDate}`);
        console.log(`  Title: ${sub.title}`);
        console.log(`  userId: ${sub.userId} (type: ${typeof sub.userId})`);
        console.log(`  studentId: ${sub.studentId} (type: ${typeof sub.studentId})`);
      });
    }
    
    // 3. Check course progress data
    console.log('\n📚 COURSE PROGRESS ANALYSIS:');
    const enrolledCourses = await mongoose.connection.db.collection('usercourses').find({ userId: student._id }).toArray();
    console.log(`Total enrolled courses: ${enrolledCourses.length}`);
    
    enrolledCourses.forEach((course, index) => {
      console.log(`\nCourse ${index + 1}:`);
      console.log(`  Course ID: ${course.courseId}`);
      console.log(`  Course URL: ${course.courseUrl}`);
      console.log(`  Status: ${course.status}`);
      console.log(`  Progress: ${course.progress}%`);
      console.log(`  Completed Days: ${course.completedDays?.join(', ') || 'None'}`);
      console.log(`  Days Completed Per Duration: ${course.daysCompletedPerDuration}`);
      
      // Calculate expected progress
      if (course.completedDays && course.completedDays.length > 0) {
        const expectedProgress = Math.round((course.completedDays.length / 26) * 100);
        console.log(`  Expected Progress (17/26): ${expectedProgress}%`);
        console.log(`  Progress Discrepancy: ${expectedProgress - course.progress}%`);
      }
    });
    
    // 4. Check if there are any quiz submissions for the specific course
    console.log('\n🎯 COURSE-SPECIFIC QUIZ SEARCH:');
    const courseUrl = 'd5c63-web-development-bootcamp-TIN59PR';
    const courseSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({ courseUrl }).toArray();
    console.log(`Total quiz submissions for course ${courseUrl}: ${courseSubmissions.length}`);
    
    if (courseSubmissions.length > 0) {
      console.log('\nAll submissions for this course:');
      courseSubmissions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Day ${sub.dayNumber}: ${sub.score}% (userId: ${sub.userId}, studentId: ${sub.studentId})`);
      });
    }
    
    // 5. Check leaderboard calculation
    console.log('\n🏆 LEADERBOARD CALCULATION DEBUG:');
    
    // Simulate the backend leaderboard calculation
    const allStudents = await mongoose.connection.db.collection('users').find({ role: 'student' }).toArray();
    console.log(`Total students: ${allStudents.length}`);
    
    // Find this student in the leaderboard calculation
    const studentInLeaderboard = allStudents.find(s => s.userId === studentId);
    if (studentInLeaderboard) {
      console.log(`\nStudent found in leaderboard calculation: ${studentInLeaderboard.name}`);
      
      // Get their quiz scores using the backend method
      const quizScores = await mongoose.connection.db.collection('quizsubmissions').aggregate([
        {
          $match: { 
            isCompleted: true,
            userId: studentInLeaderboard._id
          }
        },
        {
          $group: {
            _id: '$userId',
            totalScore: { $sum: '$score' },
            quizCount: { $sum: 1 }
          }
        }
      ]).toArray();
      
      console.log(`\nBackend leaderboard quiz calculation:`);
      console.log(`Quiz scores found: ${quizScores.length}`);
      if (quizScores.length > 0) {
        console.log(`Total quiz score: ${quizScores[0].totalScore}`);
        console.log(`Quiz count: ${quizScores[0].quizCount}`);
        console.log(`Average quiz score: ${(quizScores[0].totalScore / quizScores[0].quizCount).toFixed(2)}`);
      }
    }
    
  } catch (error) {
    console.error('Error in comprehensive debugging:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

comprehensiveDebug();
