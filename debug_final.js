import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function finalDebug() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const studentId = 'TST0YSQ';
    
    console.log('\n=== FINAL DEBUGGING RESULTS ===');
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
    
    // 2. Get quiz submissions with studentId field (this found 4 submissions!)
    console.log('\n📝 QUIZ SUBMISSIONS FOUND:');
    const submissionsWithStudentId = await mongoose.connection.db.collection('quizsubmissions').find({ studentId: student._id }).toArray();
    console.log(`Quiz submissions with studentId field: ${submissionsWithStudentId.length}`);
    
    if (submissionsWithStudentId.length > 0) {
      console.log('\nDetailed Quiz Submissions:');
      submissionsWithStudentId.forEach((submission, index) => {
        console.log(`\nSubmission ${index + 1}:`);
        console.log(`  Course URL: ${submission.courseUrl}`);
        console.log(`  Day Number: ${submission.dayNumber}`);
        console.log(`  Score: ${submission.score}%`);
        console.log(`  Attempt Number: ${submission.attemptNumber}`);
        console.log(`  Is Completed: ${submission.isCompleted}`);
        console.log(`  Submitted Date: ${submission.submittedDate}`);
        console.log(`  Title: ${submission.title}`);
        console.log(`  userId: ${submission.userId}`);
        console.log(`  studentId: ${submission.studentId}`);
      });
      
      // Group by day
      const submissionsByDay = submissionsWithStudentId.reduce((acc, submission) => {
        const key = `Day ${submission.dayNumber}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(submission);
        return acc;
      }, {});
      
      console.log('\n📊 QUIZ SUBMISSIONS BY DAY:');
      Object.entries(submissionsByDay).forEach(([dayKey, submissions]) => {
        console.log(`\n${dayKey}:`);
        submissions.forEach((sub, i) => {
          console.log(`  Attempt ${i + 1}: ${sub.score}% (Attempt #${sub.attemptNumber})`);
        });
        
        // Calculate average for this day
        const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
        const avgScore = totalScore / submissions.length;
        console.log(`  Average for ${dayKey}: ${avgScore.toFixed(2)}%`);
      });
    }
    
    // 3. Calculate scores using different methods
    console.log('\n🧮 SCORE CALCULATIONS:');
    
    // Method 1: Simple sum of all quiz scores (Backend method)
    const totalQuizScore = submissionsWithStudentId.reduce((sum, sub) => sum + sub.score, 0);
    console.log(`Method 1 - Total Quiz Score (Backend): ${totalQuizScore}`);
    
    // Method 2: Average of all quiz scores
    const avgQuizScore = submissionsWithStudentId.length > 0 ? totalQuizScore / submissionsWithStudentId.length : 0;
    console.log(`Method 2 - Average Quiz Score: ${avgQuizScore.toFixed(2)}`);
    
    // Method 3: Average by day, then sum (Frontend method)
    const submissionsByDayForCalc = submissionsWithStudentId.reduce((acc, submission) => {
      const key = `${submission.courseUrl}-${submission.dayNumber}`;
      if (!acc[key]) {
        acc[key] = { totalScore: 0, count: 0 };
      }
      acc[key].totalScore += submission.score;
      acc[key].count += 1;
      return acc;
    }, {});
    
    const dayAverages = Object.values(submissionsByDayForCalc).map(day => day.totalScore / day.count);
    const sumOfDayAverages = dayAverages.reduce((sum, avg) => sum + avg, 0);
    console.log(`Method 3 - Sum of Day Averages (Frontend): ${sumOfDayAverages.toFixed(2)}`);
    
    // 4. Get course progress
    console.log('\n📚 COURSE PROGRESS:');
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
        console.log(`  Expected Progress (${course.completedDays.length}/26): ${expectedProgress}%`);
        console.log(`  Progress Discrepancy: ${expectedProgress - course.progress}%`);
      }
    });
    
    // 5. Calculate expected total scores
    console.log('\n📈 EXPECTED TOTAL SCORES:');
    const totalCourseProgress = enrolledCourses.reduce((sum, course) => sum + (course.progress || 0), 0);
    console.log(`Total Course Progress: ${totalCourseProgress}%`);
    console.log(`Backend Method Total: ${totalCourseProgress + totalQuizScore}`);
    console.log(`Frontend Method Total: ${totalCourseProgress + sumOfDayAverages}`);
    
    // 6. Check why leaderboard shows 67.5
    console.log('\n🔍 LEADERBOARD MYSTERY:');
    console.log(`Leaderboard shows quiz score: 67.5`);
    console.log(`Our calculation shows: ${totalQuizScore}`);
    console.log(`Difference: ${67.5 - totalQuizScore}`);
    
    // Check if there are any other submissions that might be included
    const allSubmissionsForCourse = await mongoose.connection.db.collection('quizsubmissions').find({ 
      courseUrl: 'd5c63-web-development-bootcamp-TIN59PR' 
    }).toArray();
    
    console.log(`\nTotal submissions for this course: ${allSubmissionsForCourse.length}`);
    console.log(`Submissions by different users:`);
    
    const submissionsByUser = allSubmissionsForCourse.reduce((acc, sub) => {
      const userId = sub.userId || sub.studentId;
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(sub);
      return acc;
    }, {});
    
    Object.entries(submissionsByUser).forEach(([userId, submissions]) => {
      const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
      console.log(`  User ${userId}: ${submissions.length} submissions, total score: ${totalScore}`);
    });
    
  } catch (error) {
    console.error('Error in final debugging:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

finalDebug();
