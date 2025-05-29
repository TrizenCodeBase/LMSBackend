import express from 'express';
import auth from '../middleware/auth.js';
import QuizSubmission from '../models/QuizSubmission.js';
import UserCourse from '../models/UserCourse.js';
import User from '../models/User.js';

const router = express.Router();

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

    // Find the latest attempt number for this quiz
    const latestSubmission = await QuizSubmission.findOne({
      userId: req.user._id,
      courseUrl,
      dayNumber
    }).sort({ attemptNumber: -1 });

    // Calculate new attempt number
    const attemptNumber = latestSubmission ? latestSubmission.attemptNumber + 1 : 1;

    // Create new quiz submission with attempt number
    const quizSubmission = new QuizSubmission({
      courseUrl,
      userId: req.user._id,
      dayNumber,
      title,
      questions,
      selectedAnswers,
      score,
      submittedDate: new Date(submittedDate),
      attemptNumber
    });

    // Save to database
    await quizSubmission.save();

    res.status(201).json({
      message: 'Quiz submission saved successfully',
      data: {
        ...quizSubmission.toObject(),
        attemptNumber
      }
    });
  } catch (error) {
    console.error('Error saving quiz submission:', error);
    
    // Check for duplicate submission error
    if (error.code === 11000) {
      // Get the current attempt number and suggest next attempt
      try {
        const latestSubmission = await QuizSubmission.findOne({
          userId: req.user._id,
          courseUrl: req.body.courseUrl,
          dayNumber: req.body.dayNumber
        }).sort({ attemptNumber: -1 });

        const nextAttemptNumber = latestSubmission ? latestSubmission.attemptNumber + 1 : 1;

        return res.status(400).json({
          message: 'Please try submitting again',
          error: 'submission_conflict',
          nextAttemptNumber
        });
      } catch (innerError) {
      return res.status(400).json({
          message: 'Error handling submission conflict',
          error: 'submission_error'
      });
      }
    }
    
    res.status(500).json({
      message: 'Error saving quiz submission',
      error: error.message
    });
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
    
    const submissions = await QuizSubmission.find({
      userId: req.user._id,
      courseUrl
    }).sort({ dayNumber: 1, attemptNumber: -1 });

    // Group submissions by dayNumber but keep all attempts
    const submissionsByDay = submissions.reduce((acc, submission) => {
      const dayNumber = submission.dayNumber;
      if (!acc[dayNumber]) {
        acc[dayNumber] = [];
      }
      acc[dayNumber].push(submission);
      return acc;
    }, {});

    // Convert to array and sort attempts by attemptNumber in descending order
    const allSubmissions = Object.values(submissionsByDay)
      .flat()
      .sort((a, b) => {
        if (a.dayNumber === b.dayNumber) {
          return b.attemptNumber - a.attemptNumber; // Sort attempts in descending order
        }
        return a.dayNumber - b.dayNumber; // Sort days in ascending order
      });

    res.status(200).json({
      message: 'Quiz submissions retrieved successfully',
      data: allSubmissions
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
    const user = await User.findById(req.params.id).select('name _id');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 