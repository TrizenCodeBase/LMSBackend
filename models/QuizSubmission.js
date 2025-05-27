import mongoose from 'mongoose';

const quizSubmissionSchema = new mongoose.Schema({
  courseUrl: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  }
}, {
  timestamps: true
});

// Drop any existing indexes
quizSubmissionSchema.indexes().forEach(index => {
  quizSubmissionSchema.index(index.fields, { background: true, unique: false });
});

// Create a new compound unique index
quizSubmissionSchema.index(
  { userId: 1, courseUrl: 1, dayNumber: 1, attemptNumber: 1 },
  { unique: true, background: true }
);

// Add a pre-save hook to ensure attemptNumber is set
quizSubmissionSchema.pre('save', async function(next) {
  if (this.isNew && !this.attemptNumber) {
    try {
      const lastSubmission = await this.constructor.findOne({
        userId: this.userId,
        courseUrl: this.courseUrl,
        dayNumber: this.dayNumber
      }).sort({ attemptNumber: -1 });

      this.attemptNumber = lastSubmission ? lastSubmission.attemptNumber + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

export default mongoose.model('QuizSubmission', quizSubmissionSchema); 