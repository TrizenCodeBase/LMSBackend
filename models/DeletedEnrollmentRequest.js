const mongoose = require('mongoose');

const deletedEnrollmentRequestSchema = new mongoose.Schema({
  originalId: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  courseUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'deleted'],
    default: 'pending'
  },
  paymentScreenshot: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  mobileNumber: {
    type: String,
    required: true
  },
  rejectionReason: String,
  approvedAt: Date,
  rejectedAt: Date,
  deletedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Pre-save middleware to populate courseUrl
deletedEnrollmentRequestSchema.pre('save', async function(next) {
  if (!this.courseUrl) {
    try {
      const course = await mongoose.model('Course').findById(this.courseId);
      if (course && course.courseUrl) {
        this.courseUrl = course.courseUrl;
      }
    } catch (error) {
      console.error('Error populating courseUrl:', error);
    }
  }
  next();
});

module.exports = mongoose.model('DeletedEnrollmentRequest', deletedEnrollmentRequestSchema); 