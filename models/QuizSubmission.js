import mongoose from 'mongoose';

const quizSubmissionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  courseName: {
    type: String,
    required: true
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
    }],
    explanation: String
  }],
  selectedAnswers: {
    type: Map,
    of: String
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: true,
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'graded'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Create compound index to prevent duplicate submissions
quizSubmissionSchema.index({ studentId: 1, courseId: 1, dayNumber: 1 }, { unique: true });

// Pre-save middleware to ensure completion status
quizSubmissionSchema.pre('save', function(next) {
  if (this.score >= 0) {
    this.isCompleted = true;
    this.status = 'completed';
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

// Method to check if quiz is completed
quizSubmissionSchema.methods.isQuizCompleted = function() {
  return this.isCompleted && this.completedAt != null;
};

const QuizSubmission = mongoose.model('QuizSubmission', quizSubmissionSchema);

export default QuizSubmission; 