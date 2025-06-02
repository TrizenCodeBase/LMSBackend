import express from 'express';
import User from '../models/User.js';
import UserCourse from '../models/UserCourse.js';
import QuizSubmission from '../models/QuizSubmission.js';

const router = express.Router();

// Get students for leaderboard
router.get('/students', async (req, res) => {
  try {
    // Get all students with their basic info
    const students = await User.find({ role: 'student' })
      .select('name _id avatar userId')
      .lean();

    // Get enrolled courses for each student
    const enrolledCourses = await UserCourse.aggregate([
      {
        $group: {
          _id: '$userId',
          enrolledCourses: { 
            $push: { 
              $toString: '$courseId'  // Convert ObjectId to string
            }
          },
          courseProgress: {
            $push: {
              courseId: { $toString: '$courseId' },  // Convert courseId to string
              progress: '$progress',
              score: '$score'
            }
          }
        }
      }
    ]);

    // Create maps for quick lookups
    const courseMap = new Map(
      enrolledCourses.map(entry => [entry._id, {
        courses: entry.enrolledCourses,
        progress: entry.courseProgress
      }])
    );

    // Get quiz scores for each student
    const quizScores = await QuizSubmission.aggregate([
      {
        $match: { isCompleted: true }
      },
      {
        $group: {
          _id: '$userId',
          totalScore: { $sum: '$score' },
          quizCount: { $sum: 1 }
        }
      }
    ]);

    const quizMap = new Map(
      quizScores.map(entry => [entry._id, {
        totalScore: entry.totalScore,
        quizCount: entry.quizCount
      }])
    );

    // Combine all data and calculate metrics
    const studentList = students.map(student => {
      const userId = student._id.toString();
      const courseData = courseMap.get(userId) || { courses: [], progress: [] };
      const quizData = quizMap.get(userId) || { totalScore: 0, quizCount: 0 };

      // Calculate course points (average of progress scores)
      const coursePoints = courseData.progress.reduce((sum, course) => 
        sum + (course.score || 0), 0) / (courseData.progress.length || 1);

      // Calculate total points
      const totalPoints = coursePoints + quizData.totalScore;

      return {
        userId: student.userId || userId,
        name: student.name,
        avatar: student.avatar,
        metrics: {
          coursesEnrolled: courseData.courses.length,
          coursePoints: Math.round(coursePoints * 10) / 10,
          quizPoints: Math.round(quizData.totalScore * 10) / 10,
          totalPoints: Math.round(totalPoints * 10) / 10,
          enrolledCourses: courseData.courses
        }
      };
    });

    // Sort by total points and assign ranks
    studentList.sort((a, b) => b.metrics.totalPoints - a.metrics.totalPoints);
    studentList.forEach((student, index) => {
      student.rank = index + 1;
    });

    res.json(studentList);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
});

export default router; 