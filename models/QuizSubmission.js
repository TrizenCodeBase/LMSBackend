import mongoose from 'mongoose';

const quizSubmissionSchema = new mongoose.Schema({
  courseUrl: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  dayNumber: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  questions: [{
    question: String,
    options: [{
      text: String,
      isCorrect: Boolean
    }]
  }],
  selectedAnswers: [Number],
  score: {
    type: Number,
    required: true
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  needsLeaderboardUpdate: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Create indexes for optimal query performance
quizSubmissionSchema.index({ userId: 1 });
quizSubmissionSchema.index({ courseUrl: 1 });
quizSubmissionSchema.index({ userId: 1, courseUrl: 1, dayNumber: 1 });
quizSubmissionSchema.index({ isCompleted: 1 });

export default mongoose.model('QuizSubmission', quizSubmissionSchema); 