import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugMultipleStudents() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    console.log('\n=== MULTIPLE STUDENTS DEBUGGING ===');
    
    // Get all students
    const allStudents = await mongoose.connection.db.collection('users').find({ role: 'student' }).limit(10).toArray();
    console.log(`Found ${allStudents.length} students to analyze`);
    
    for (const student of allStudents) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 ANALYZING STUDENT: ${student.name} (${student.userId})`);
      console.log(`${'='.repeat(60)}`);
      
      // 1. Get enrolled courses
      const enrolledCourses = await mongoose.connection.db.collection('usercourses').find({ userId: student._id }).toArray();
      console.log(`\n📚 ENROLLED COURSES: ${enrolledCourses.length}`);
      
      enrolledCourses.forEach((course, index) => {
        console.log(`\nCourse ${index + 1}:`);
        console.log(`  Course URL: ${course.courseUrl}`);
        console.log(`  Status: ${course.status}`);
        console.log(`  Progress: ${course.progress}%`);
        console.log(`  Completed Days: ${course.completedDays?.join(', ') || 'None'}`);
        console.log(`  Days Completed Per Duration: ${course.daysCompletedPerDuration}`);
        
        // Calculate expected progress
        if (course.completedDays && course.completedDays.length > 0) {
          const expectedProgress = Math.round((course.completedDays.length / 26) * 100);
          console.log(`  Expected Progress: ${expectedProgress}%`);
          console.log(`  Progress Discrepancy: ${expectedProgress - course.progress}%`);
        }
      });
      
      // 2. Get quiz submissions
      const quizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({ studentId: student._id }).toArray();
      console.log(`\n📝 QUIZ SUBMISSIONS: ${quizSubmissions.length}`);
      
      if (quizSubmissions.length > 0) {
        // Group by day
        const submissionsByDay = quizSubmissions.reduce((acc, submission) => {
          const key = `Day ${submission.dayNumber}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(submission);
          return acc;
        }, {});
        
        console.log('\nQuiz submissions by day:');
        Object.entries(submissionsByDay).forEach(([dayKey, submissions]) => {
          const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
          const avgScore = totalScore / submissions.length;
          console.log(`  ${dayKey}: ${submissions.length} attempts, avg: ${avgScore.toFixed(2)}%`);
        });
        
        // 3. Calculate scores using different methods
        console.log('\n🧮 SCORE CALCULATIONS:');
        
        // Method 1: Simple sum of all quiz scores
        const totalQuizScore = quizSubmissions.reduce((sum, sub) => sum + sub.score, 0);
        console.log(`Method 1 - Total Quiz Score (Sum): ${totalQuizScore}`);
        
        // Method 2: Average of all quiz scores
        const avgQuizScore = totalQuizScore / quizSubmissions.length;
        console.log(`Method 2 - Average Quiz Score: ${avgQuizScore.toFixed(2)}`);
        
        // Method 3: Average by day, then sum
        const dayAverages = Object.values(submissionsByDay).map(day => {
          const totalScore = day.reduce((sum, sub) => sum + sub.score, 0);
          return totalScore / day.length;
        });
        const sumOfDayAverages = dayAverages.reduce((sum, avg) => sum + avg, 0);
        console.log(`Method 3 - Sum of Day Averages: ${sumOfDayAverages.toFixed(2)}`);
        
        // 4. Course progress
        const totalCourseProgress = enrolledCourses.reduce((sum, course) => sum + (course.progress || 0), 0);
        console.log(`\n📈 COURSE PROGRESS: ${totalCourseProgress}%`);
        
        // 5. Expected total scores
        console.log('\n📊 EXPECTED TOTAL SCORES:');
        console.log(`Method 1 Total: ${totalCourseProgress + totalQuizScore}`);
        console.log(`Method 2 Total: ${totalCourseProgress + avgQuizScore}`);
        console.log(`Method 3 Total: ${totalCourseProgress + sumOfDayAverages}`);
        
        // 6. Check for issues
        console.log('\n🔍 POTENTIAL ISSUES:');
        
        // Check course progress discrepancy
        const courseWithIssues = enrolledCourses.find(course => {
          if (course.completedDays && course.completedDays.length > 0) {
            const expectedProgress = Math.round((course.completedDays.length / 26) * 100);
            return expectedProgress !== course.progress;
          }
          return false;
        });
        
        if (courseWithIssues) {
          console.log(`⚠️  Course progress bug detected!`);
          console.log(`   Expected: ${Math.round((courseWithIssues.completedDays.length / 26) * 100)}%`);
          console.log(`   Actual: ${courseWithIssues.progress}%`);
        }
        
        // Check if quiz submissions have both userId and studentId
        const submissionsWithBothIds = quizSubmissions.filter(sub => sub.userId && sub.studentId);
        if (submissionsWithBothIds.length > 0) {
          console.log(`⚠️  Quiz submissions have both userId and studentId fields`);
        }
        
      } else {
        console.log('\n❌ No quiz submissions found');
      }
      
      console.log(`\n${'='.repeat(60)}`);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY OF FINDINGS:');
    console.log('='.repeat(60));
    
    const studentsWithIssues = [];
    const studentsWithQuizSubmissions = [];
    
    for (const student of allStudents) {
      const enrolledCourses = await mongoose.connection.db.collection('usercourses').find({ userId: student._id }).toArray();
      const quizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({ studentId: student._id }).toArray();
      
      // Check for course progress issues
      const hasCourseProgressIssue = enrolledCourses.some(course => {
        if (course.completedDays && course.completedDays.length > 0) {
          const expectedProgress = Math.round((course.completedDays.length / 26) * 100);
          return expectedProgress !== course.progress;
        }
        return false;
      });
      
      if (hasCourseProgressIssue) {
        studentsWithIssues.push({
          name: student.name,
          userId: student.userId,
          issue: 'Course Progress Bug'
        });
      }
      
      if (quizSubmissions.length > 0) {
        studentsWithQuizSubmissions.push({
          name: student.name,
          userId: student.userId,
          submissions: quizSubmissions.length,
          avgScore: (quizSubmissions.reduce((sum, sub) => sum + sub.score, 0) / quizSubmissions.length).toFixed(2)
        });
      }
    }
    
    console.log(`\nStudents with course progress issues: ${studentsWithIssues.length}`);
    studentsWithIssues.forEach(student => {
      console.log(`  - ${student.name} (${student.userId}): ${student.issue}`);
    });
    
    console.log(`\nStudents with quiz submissions: ${studentsWithQuizSubmissions.length}`);
    studentsWithQuizSubmissions.forEach(student => {
      console.log(`  - ${student.name} (${student.userId}): ${student.submissions} submissions, avg: ${student.avgScore}%`);
    });
    
  } catch (error) {
    console.error('Error in multiple students debugging:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugMultipleStudents();
