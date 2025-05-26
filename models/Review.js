import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: false,
    trim: true,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      if (ret.studentId && typeof ret.studentId === 'object') {
        ret.studentName = ret.studentId.name;
      }
      return ret;
    }
  }
});

// Ensure a user can only review a course once
reviewSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review; 