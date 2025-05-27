import express from 'express';
import QuizSubmission from '../models/QuizSubmission.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// ... existing routes ...

// Handle quiz submission
router.post('/:courseUrl/quiz-submission', auth, async (req, res) => {
  try {
    const { courseUrl } = req.params;
    const { dayNumber, title, questions, selectedAnswers, score, submittedDate } = req.body;

    // Validate required fields
    if (!courseUrl || !dayNumber || !questions || !selectedAnswers || score === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create new quiz submission
    const quizSubmission = new QuizSubmission({
      courseUrl,
      userId: req.user._id, // From auth middleware
      dayNumber,
      title,
      questions,
      selectedAnswers,
      score,
      submittedDate: new Date(submittedDate)
    });

    // Save to database
    await quizSubmission.save();

    return res.status(201).json(quizSubmission);
  } catch (error) {
    console.error('Error saving quiz submission:', error);
    
    // Check for duplicate submission error
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'You have already submitted this quiz'
      });
    }
    
    return res.status(500).json({ message: 'Error saving quiz submission' });
  }
});

export default router; 