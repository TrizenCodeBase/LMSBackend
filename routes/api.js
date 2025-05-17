const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const QuizSubmission = require('../models/QuizSubmission');

// ... existing routes ...

// Submit quiz results
router.post('/quiz-submissions', authenticateToken, async (req, res) => {
  try {
    const {
      courseId,
      dayNumber,
      title,
      score,
      completedAt,
      isCompleted,
      status
    } = req.body;

    // Create new quiz submission
    const quizSubmission = new QuizSubmission({
      studentId: req.user.id,
      courseId,
      courseName: title,
      dayNumber,
      title,
      score,
      completedAt,
      isCompleted,
      status
    });

    // Save to database
    await quizSubmission.save();

    res.status(201).json({
      message: 'Quiz submission saved successfully',
      data: quizSubmission
    });
  } catch (error) {
    console.error('Error saving quiz submission:', error);
    
    // Check for duplicate submission error
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'You have already submitted this quiz'
      });
    }
    
    res.status(500).json({
      message: 'Error saving quiz submission',
      error: error.message
    });
  }
});

module.exports = router; 