import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
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
  dayNumber: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true,
    default: ''
  }
}, {
  timestamps: true
});

// Create a compound index for userId, courseId, and dayNumber
noteSchema.index({ userId: 1, courseId: 1, dayNumber: 1 }, { unique: true });

export default mongoose.model('Note', noteSchema); 