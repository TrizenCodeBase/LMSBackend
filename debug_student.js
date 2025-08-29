import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas inline to avoid import issues
const userSchema = new mongoose.Schema({
  name: String,
  userId: String,
  role: String
});

const userCourseSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  courseId: mongoose.Schema.Types.ObjectId,
  courseUrl: String,
  status: String,
  progress: Number,
  completedDays: [Number],
  daysCompletedPerDuration: String
});

const quizSubmissionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  courseUrl: String,
  dayNumber: Number,
  score: Number,
  attemptNumber: Number,
  isCompleted: Boolean,
  submittedDate: Date,
  title: String
});

const courseSchema = new mongoose.Schema({
  title: String,
  courseUrl: String,
  roadmap: [{
    day: Number
  }]
});

// Create models
const User = mongoose.model('User', userSchema);
const UserCourse = mongoose.model('UserCourse', userCourseSchema);
const QuizSubmission = mongoose.model('QuizSubmission', quizSubmissionSchema);
const Course = mongoose.model('Course', courseSchema);

async function debugStudentData() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    const studentId = 'TST0YSQ';
    
    console.log('\n=== DEBUGGING STUDENT DATA ===');
    console.log(`Student ID: ${studentId}`);
    
    // 1. Find the student
    const student = await User.findOne({ userId: studentId });
    if (!student) {
      console.log('❌ Student not found!');
      return;
    }
    
    console.log('\n📋 STUDENT INFO:');
    console.log(`Name: ${student.name}`);
    console.log(`User ID: ${student.userId}`);
    console.log(`MongoDB _id: ${student._id}`);
    console.log(`Role: ${student.role}`);
    
    // 2. Get enrolled courses
    console.log('\n📚 ENROLLED COURSES:');
    const enrolledCourses = await UserCourse.find({ userId: student._id });
    console.log(`Total enrolled courses: ${enrolledCourses.length}`);
    
    enrolledCourses.forEach((course, index) => {
      console.log(`\nCourse ${index + 1}:`);
      console.log(`  Course ID: ${course.courseId}`);
      console.log(`  Course URL: ${course.courseUrl}`);
      console.log(`  Status: ${course.status}`);
      console.log(`  Progress: ${course.progress}%`);
      console.log(`  Completed Days: ${course.completedDays?.join(', ') || 'None'}`);
      console.log(`  Days Completed Per Duration: ${course.daysCompletedPerDuration}`);
    });
    
    // 3. Get course details
    console.log('\n🎯 COURSE DETAILS:');
    for (const enrolledCourse of enrolledCourses) {
      const course = await Course.findById(enrolledCourse.courseId);
      if (course) {
        console.log(`\nCourse: ${course.title}`);
        console.log(`  Course URL: ${course.courseUrl}`);
        console.log(`  Total Days in Roadmap: ${course.roadmap?.length || 0}`);
        console.log(`  Roadmap Days: ${course.roadmap?.map(day => day.day).join(', ') || 'None'}`);
      }
    }
    
    // 4. Get all quiz submissions
    console.log('\n📝 QUIZ SUBMISSIONS:');
    const quizSubmissions = await QuizSubmission.find({ userId: student._id });
    console.log(`Total quiz submissions: ${quizSubmissions.length}`);
    
    if (quizSubmissions.length > 0) {
      console.log('\nDetailed Quiz Submissions:');
      quizSubmissions.forEach((submission, index) => {
        console.log(`\nSubmission ${index + 1}:`);
        console.log(`  Course URL: ${submission.courseUrl}`);
        console.log(`  Day Number: ${submission.dayNumber}`);
        console.log(`  Score: ${submission.score}%`);
        console.log(`  Attempt Number: ${submission.attemptNumber}`);
        console.log(`  Is Completed: ${submission.isCompleted}`);
        console.log(`  Submitted Date: ${submission.submittedDate}`);
        console.log(`  Title: ${submission.title}`);
      });
      
      // Group by course and day
      const submissionsByDay = quizSubmissions.reduce((acc, submission) => {
        const key = `${submission.courseUrl}-Day${submission.dayNumber}`;
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
    
    // 5. Calculate scores using different methods
    console.log('\n🧮 SCORE CALCULATIONS:');
    
    // Method 1: Simple sum of all quiz scores (Backend method)
    const totalQuizScore = quizSubmissions.reduce((sum, sub) => sum + sub.score, 0);
    console.log(`Method 1 - Total Quiz Score (Backend): ${totalQuizScore}`);
    
    // Method 2: Average of all quiz scores
    const avgQuizScore = quizSubmissions.length > 0 ? totalQuizScore / quizSubmissions.length : 0;
    console.log(`Method 2 - Average Quiz Score: ${avgQuizScore.toFixed(2)}`);
    
    // Method 3: Average by day, then sum (Frontend method)
    const submissionsByDayForCalc = quizSubmissions.reduce((acc, submission) => {
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
    
    // Course progress calculation
    const totalCourseProgress = enrolledCourses.reduce((sum, course) => sum + (course.progress || 0), 0);
    console.log(`Total Course Progress: ${totalCourseProgress}%`);
    
    // Expected total scores
    console.log('\n📈 EXPECTED TOTAL SCORES:');
    console.log(`Backend Method Total: ${totalCourseProgress + totalQuizScore}`);
    console.log(`Frontend Method Total: ${totalCourseProgress + sumOfDayAverages}`);
    
    // 6. Check for any issues
    console.log('\n🔍 POTENTIAL ISSUES:');
    
    // Check if student has multiple userId formats
    const allStudentsWithSameName = await User.find({ name: student.name });
    if (allStudentsWithSameName.length > 1) {
      console.log(`⚠️  Multiple users with same name found: ${allStudentsWithSameName.length}`);
      allStudentsWithSameName.forEach((s, i) => {
        console.log(`  User ${i + 1}: ${s.userId} (${s._id})`);
      });
    }
    
    // Check for quiz submissions with different userId formats
    const submissionsWithStringId = await QuizSubmission.find({ userId: studentId });
    const submissionsWithObjectId = await QuizSubmission.find({ userId: student._id });
    
    console.log(`Quiz submissions with string userId (${studentId}): ${submissionsWithStringId.length}`);
    console.log(`Quiz submissions with ObjectId (${student._id}): ${submissionsWithObjectId.length}`);
    
    if (submissionsWithStringId.length > 0) {
      console.log('\nSubmissions with string userId:');
      submissionsWithStringId.forEach((sub, i) => {
        console.log(`  ${i + 1}. Day ${sub.dayNumber}: ${sub.score}%`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging student data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugStudentData();
