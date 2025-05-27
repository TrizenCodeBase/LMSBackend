import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const MongoDB_URL = 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

if (!MongoDB_URL) {
  console.error('MongoDB_URL is not defined in environment variables');
  process.exit(1);
}

// Define schemas
const userCourseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  courseUrl: String,
  status: {
    type: String,
    enum: ['pending', 'enrolled', 'started', 'completed'],
    default: 'enrolled'
  },
  progress: {
    type: Number,
    default: 0
  },
  completedDays: [{
    type: Number
  }],
  daysCompletedPerDuration: {
    type: String,
    default: '0/0'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
});

const courseSchema = new mongoose.Schema({
  duration: String,
  roadmap: [{
    day: Number,
    topics: String,
    video: String
  }],
  courseUrl: String
});

// Function to extract number of days from duration string
const extractDurationDays = (duration) => {
  const match = duration.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

async function fixUserCourseProgress() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MongoDB_URL);
    console.log('Connected to MongoDB successfully');

    // Initialize models
    const UserCourse = mongoose.model('UserCourse', userCourseSchema);
    const Course = mongoose.model('Course', courseSchema);

    // Get all user course enrollments with populated course data
    const enrollments = await UserCourse.find({}).populate({
      path: 'courseId',
      select: 'duration roadmap courseUrl'
    });
    
    console.log(`Found ${enrollments.length} enrollments to process`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // Process each enrollment
    for (const enrollment of enrollments) {
      try {
        const course = enrollment.courseId;
        
        if (!course) {
          console.log(`Course not found for enrollment ${enrollment._id}, skipping...`);
          errorDetails.push({
            enrollmentId: enrollment._id,
            error: 'Course not found'
          });
          errors++;
          continue;
        }

        // Get total duration days from course duration
        const totalDurationDays = course.duration ? extractDurationDays(course.duration) : 0;
        
        if (totalDurationDays === 0) {
          console.log(`Invalid duration for course ${course._id}, skipping...`);
          errorDetails.push({
            enrollmentId: enrollment._id,
            courseId: course._id,
            courseUrl: course.courseUrl,
            error: 'Invalid duration'
          });
          errors++;
          continue;
        }

        // Calculate new progress based on completed days and total duration
        const completedDaysCount = enrollment.completedDays?.length || 0;
        const newProgress = Math.round((completedDaysCount / totalDurationDays) * 100);
        const daysCompletedPerDuration = `${completedDaysCount}/${totalDurationDays}`;

        // Determine new status based on progress
        let newStatus = 'enrolled';
        if (newProgress === 100) {
          newStatus = 'completed';
        } else if (newProgress > 0) {
          newStatus = 'started';
        }

        // Check if update is needed
        if (enrollment.progress !== newProgress || 
            enrollment.status !== newStatus || 
            enrollment.daysCompletedPerDuration !== daysCompletedPerDuration) {
          
          // Log the changes that will be made
          console.log(`\nUpdating enrollment ${enrollment._id}:`);
          console.log('Course URL:', course.courseUrl);
          console.log('Current values:', {
            progress: enrollment.progress,
            status: enrollment.status,
            completedDays: completedDaysCount,
            daysCompletedPerDuration: enrollment.daysCompletedPerDuration
          });
          console.log('New values:', {
            progress: newProgress,
            status: newStatus,
            completedDays: completedDaysCount,
            totalDurationDays,
            daysCompletedPerDuration,
            calculation: `${completedDaysCount} completed days / ${totalDurationDays} total days = ${newProgress}%`
          });

          // Update the enrollment
          await UserCourse.findByIdAndUpdate(enrollment._id, {
            progress: newProgress,
            status: newStatus,
            daysCompletedPerDuration,
            lastAccessedAt: new Date()
          });

          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error processing enrollment ${enrollment._id}:`, error);
        errorDetails.push({
          enrollmentId: enrollment._id,
          error: error.message
        });
        errors++;
      }
    }

    // Print summary
    console.log('\n=== Update Summary ===');
    console.log(`Total enrollments processed: ${enrollments.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (no changes needed): ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Print error details if any
    if (errorDetails.length > 0) {
      console.log('\n=== Error Details ===');
      errorDetails.forEach((error, index) => {
        console.log(`\nError ${index + 1}:`);
        console.log(JSON.stringify(error, null, 2));
      });
    }

  } catch (error) {
    console.error('Script error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the fix
fixUserCourseProgress().catch(console.error); 