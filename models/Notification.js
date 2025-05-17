const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['course_update', 'assignment', 'discussion', 'new_day', 'message'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  },
  read: {
    type: Boolean,
    default: false
  },
  link: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient querying
notificationSchema.index({ userId: 1, timestamp: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 