const mongoose = require('mongoose');

const enrollmentRequestSchema = new mongoose.Schema({
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
    required: true,
    unique: true
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
  deletedAt: Date
}, {
  timestamps: true
});

// Pre-save middleware to populate courseUrl
enrollmentRequestSchema.pre('save', async function(next) {
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

module.exports = mongoose.model('EnrollmentRequest', enrollmentRequestSchema); 