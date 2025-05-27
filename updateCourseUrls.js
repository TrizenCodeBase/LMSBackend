import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from './models/Course.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const updateCourseUrls = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB');

    // Get all courses that don't have a courseUrl
    const courses = await Course.find({ courseUrl: { $exists: false } });
    console.log(`Found ${courses.length} courses to update`);

    // Update each course
    for (const course of courses) {
      // Get last 5 characters of course ID
      const courseIdSuffix = course._id.toString().slice(-5);
      
      // Convert course name to URL-friendly format
      const courseNameSlug = course.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      // Get instructor's userId
      const instructor = await User.findById(course.instructorId);
      const instructorUserId = instructor ? instructor.userId : 'unknown';
      
      // Create courseUrl
      const courseUrl = `${courseIdSuffix}-${courseNameSlug}-${instructorUserId}`;
      
      // Update the course
      await Course.findByIdAndUpdate(course._id, { courseUrl });
      console.log(`Updated course: ${course.title} with URL: ${courseUrl}`);
    }

    console.log('Successfully updated all courses');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error updating course URLs:', error);
    process.exit(1);
  }
};

// Run the update
updateCourseUrls(); 