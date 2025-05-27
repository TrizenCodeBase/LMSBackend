import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from './models/Course.js';
import UserCourse from './models/UserCourse.js';

// Load environment variables
dotenv.config();

const updateUserCoursesUrl = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    // Get all user courses that don't have a courseUrl
    const userCourses = await UserCourse.find();
    console.log(`Found ${userCourses.length} user courses to update`);

    // Update each user course
    for (const userCourse of userCourses) {
      try {
        // Get the course details
        const course = await Course.findById(userCourse.courseId);
        if (course && course.courseUrl) {
          // Update the user course with courseUrl
          await UserCourse.findByIdAndUpdate(userCourse._id, {
            courseUrl: course.courseUrl
          });
          console.log(`Updated user course: ${userCourse._id} with URL: ${course.courseUrl}`);
        } else {
          console.log(`Course not found or no courseUrl for user course: ${userCourse._id}`);
        }
      } catch (error) {
        console.error(`Error updating user course ${userCourse._id}:`, error);
      }
    }

    console.log('Successfully updated all user courses');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error updating user course URLs:', error);
    process.exit(1);
  }
};

// Run the update
updateUserCoursesUrl(); 