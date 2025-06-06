import express from 'express';
import auth from '../middleware/auth.js';
import QuizSubmission from '../models/QuizSubmission.js';
import UserCourse from '../models/UserCourse.js';
import User from '../models/User.js';
import Course from '../models/Course.js';

const router = express.Router();

const MAX_ATTEMPTS = 2;

// ... existing routes ...

// Submit quiz results
router.post('/quiz-submissions', auth, async (req, res) => {
  try {
    const {
      courseUrl,
      dayNumber,
      title,
      questions,
      selectedAnswers,
      score,
      submittedDate
    } = req.body;

    // Validate required fields
    if (!courseUrl || !dayNumber || !questions || !selectedAnswers || score === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check existing attempts - check both userId and studentId
    const existingAttempts = await QuizSubmission.find({
      $or: [
        { userId: req.user._id },
        { studentId: req.user._id }
      ],
      courseUrl,
      dayNumber
    }).sort({ attemptNumber: -1 });

    // Check if max attempts reached
    if (existingAttempts.length >= MAX_ATTEMPTS) {
      return res.status(400).json({
        message: 'Maximum attempts reached for this quiz',
        error: 'max_attempts_reached'
      });
    }

    // Check if already completed with perfect score
    const hasPerfectScore = existingAttempts.some(attempt => attempt.score === 100);
    if (hasPerfectScore) {
      return res.status(400).json({
        message: 'Quiz already completed with perfect score',
        error: 'perfect_score_achieved'
      });
    }

    // Calculate new attempt number
    const attemptNumber = existingAttempts.length + 1;

    // Create new quiz submission with both userId and studentId
    const quizSubmission = new QuizSubmission({
      courseUrl,
      userId: req.user._id,
      studentId: req.user._id,
      dayNumber,
      title,
      questions,
      selectedAnswers,
      score,
      submittedDate: new Date(submittedDate),
      attemptNumber,
      isCompleted: score >= 10,
      completedAt: score >= 10 ? new Date() : undefined,
      needsLeaderboardUpdate: true // Flag for leaderboard update
    });

    // Save to database
    await quizSubmission.save();

    // If quiz is completed (score >= 10), update course progress
    if (score >= 10) {
      // Get current progress
      const userCourse = await UserCourse.findOne({
        userId: req.user._id,
        courseUrl
      });

      if (userCourse) {
        // Add the day to completedDays if not already present
        const completedDays = new Set(userCourse.completedDays || []);
        completedDays.add(dayNumber);
        userCourse.completedDays = Array.from(completedDays).sort((a, b) => a - b);

        // Update progress percentage
        const course = await Course.findOne({ courseUrl });
        if (course) {
          const totalDays = course.roadmap?.length || 1;
          userCourse.progress = Math.round((completedDays.size / totalDays) * 100);
          userCourse.status = userCourse.progress === 100 ? 'completed' : 'started';
          await userCourse.save();
        }
      }

      // Trigger leaderboard update for this course
      await QuizSubmission.updateMany(
        { courseUrl },
        { $set: { needsLeaderboardUpdate: true } }
      );
    }

    // Calculate remaining attempts
    const remainingAttempts = MAX_ATTEMPTS - attemptNumber;

    res.status(201).json({
      message: 'Quiz submission saved successfully',
      data: {
        ...quizSubmission.toObject(),
        attemptNumber,
        remainingAttempts
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Error submitting quiz' });
  }
});

// Get quiz submissions for a specific quiz
router.get('/quiz-submissions/:courseUrl/:dayNumber', auth, async (req, res) => {
  try {
    const { courseUrl, dayNumber } = req.params;
    
    const submissions = await QuizSubmission.find({
      userId: req.user._id,
      courseUrl,
      dayNumber: parseInt(dayNumber)
    }).sort({ attemptNumber: -1 });

    res.status(200).json({
      message: 'Quiz submissions retrieved successfully',
      data: submissions
    });
  } catch (error) {
    console.error('Error retrieving quiz submissions:', error);
    res.status(500).json({
      message: 'Error retrieving quiz submissions',
      error: error.message
    });
  }
});

// Get all quiz submissions for a course
router.get('/quiz-submissions/:courseUrl', auth, async (req, res) => {
  try {
    const { courseUrl } = req.params;
    
    // Remove the userId filter to get submissions from all users
    const submissions = await QuizSubmission.find({
      courseUrl,
      isCompleted: true // Only get completed submissions
    }).sort({ dayNumber: 1, attemptNumber: -1 });

    // Group submissions by user and calculate their average scores
    const submissionsByUser = submissions.reduce((acc, submission) => {
      const userId = submission.userId.toString();
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(submission);
      return acc;
    }, {});

    // Calculate average scores for each user
    const userScores = Object.entries(submissionsByUser).map(([userId, userSubmissions]) => {
      const totalScore = userSubmissions.reduce((sum, sub) => sum + sub.score, 0);
      const averageScore = Math.round((totalScore / userSubmissions.length) * 10) / 10;
      
      return {
        userId,
        submissions: userSubmissions,
        averageScore,
        totalAttempts: userSubmissions.length
      };
    });

    res.status(200).json({
      message: 'Quiz submissions retrieved successfully',
      data: userScores
    });
  } catch (error) {
    console.error('Error retrieving quiz submissions:', error);
    res.status(500).json({
      message: 'Error retrieving quiz submissions',
      error: error.message
    });
  }
});

// Get all user progress for a course
router.get('/usercourses/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const userCourses = await UserCourse.find({ courseId });
    res.json(userCourses);
  } catch (error) {
    console.error('Error fetching usercourses for course:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name _id userId');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this new route for the leaderboard
router.get('/leaderboard/students', async (req, res) => {
  try {
    // Get all students with their avatars and userId
    const students = await User.find({ role: 'student' })
      .select('name _id avatar avatarUrl userId')
      .lean();

    // First pipeline: Get course progress
    const studentProgress = await UserCourse.aggregate([
      {
        $addFields: {
          progressParts: {
            $cond: {
              if: { $ne: ['$daysCompletedPerDuration', null] },
              then: { $split: ['$daysCompletedPerDuration', '/'] },
              else: ['0', '1']
            }
          }
        }
      },
      {
        $addFields: {
          progressPercentage: {
            $cond: {
              if: {
                $and: [
                  { $ne: [{ $arrayElemAt: ['$progressParts', 1] }, '0'] },
                  { $ne: [{ $arrayElemAt: ['$progressParts', 1] }, null] }
                ]
              },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $toDouble: { $arrayElemAt: ['$progressParts', 0] } },
                      { $toDouble: { $arrayElemAt: ['$progressParts', 1] } }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          coursesEnrolled: { $sum: 1 },
          averageProgress: { $avg: '$progressPercentage' }
        }
      }
    ]);

    // Second pipeline: Get quiz scores
    const quizScores = await QuizSubmission.aggregate([
      {
        $match: {
          isCompleted: true
        }
      },
      {
        $group: {
          _id: '$userId',
          averageScore: { $avg: '$score' }
        }
      }
    ]);

    // Create maps for both course progress and quiz scores
    const progressMap = new Map(
      studentProgress.map(item => [
        item._id.toString(),
        {
          coursesEnrolled: item.coursesEnrolled,
          coursePoints: Math.round(item.averageProgress || 0)
        }
      ])
    );

    const quizMap = new Map(
      quizScores.map(item => [
        item._id.toString(),
        Math.round(item.averageScore || 0)
      ])
    );

    const generateAvatarUrl = (name) => {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    };

    const studentList = students.map(student => {
      const progressData = progressMap.get(student._id.toString()) || { coursesEnrolled: 0, coursePoints: 0 };
      const quizPoints = quizMap.get(student._id.toString()) || 0;
      const totalPoints = progressData.coursePoints + quizPoints;

      // Use avatarUrl if it exists, then fall back to avatar field, then generate from name
      const avatarUrl = student.avatarUrl || student.avatar || generateAvatarUrl(student.name);

      return {
        userId: student.userId || student._id.toString(), // Use userId from users collection
        name: student.name,
        avatar: avatarUrl,
        metrics: {
          coursesEnrolled: progressData.coursesEnrolled,
          coursePoints: progressData.coursePoints,
          quizPoints: quizPoints,
          totalPoints: totalPoints
        }
      };
    });

    // Sort by total points (highest to lowest)
    studentList.sort((a, b) => b.metrics.totalPoints - a.metrics.totalPoints);

    // Reassign ranks after sorting
    studentList.forEach((student, index) => {
      student.rank = index + 1;
    });

    res.json(studentList);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
});

// Update user avatar
router.put('/users/avatar', auth, async (req, res) => {
  try {
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }

    // Update user's avatar
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Avatar updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ message: 'Error updating avatar' });
  }
});

export default router; 