import mongoose from 'mongoose';

const userCourseSchema = new mongoose.Schema({
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
    enum: ['pending', 'enrolled', 'started', 'completed'],
    default: 'enrolled'
  },
  progress: {
    type: Number,
    default: 0
  },
  completedDays: [{
    type: Number
  }],
  daysCompletedPerDuration: {
    type: String,
    default: '0/0'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add compound index for userId and courseId
userCourseSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Pre-save middleware to populate courseUrl
userCourseSchema.pre('save', async function(next) {
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

export default mongoose.model('UserCourse', userCourseSchema);
