import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateStudentId, generateInstructorId, generateRandomString } from './generateUserId.js';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  },
  referralCount: {
    type: Number,
    default: 0,
    min: 0
  },
  displayName: String,
  avatar: {
    type: String,
    default: function() {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.userId || this._id}`;
    }
  },
  bio: {
    type: String,
    maxlength: 500
  },
  phone: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending', 'approved', 'rejected'],
    default: 'active'
  },
  instructorProfile: {
    specialty: String,
    experience: Number,
    phone: String,
    location: String,
    bio: String,
    socialLinks: {
      linkedin: String,
      twitter: String,
      website: String
    },
    courses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }]
  },
  notificationPreferences: {
    courseUpdates: {
      type: Boolean,
      default: true
    },
    assignmentReminders: {
      type: Boolean,
      default: true
    },
    discussionReplies: {
      type: Boolean,
      default: true
    }
  },
  connectedDevices: [{
    deviceId: String,
    deviceName: String,
    lastActive: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    }
  }
}, {
  timestamps: true
});

// Add indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// Pre-save middleware to generate and set userId based on role
userSchema.pre('save', async function(next) {
  // Only generate userId if it's not already set (new user)
  if (!this.userId) {
    if (this.role === 'student') {
      this.userId = generateStudentId();
    } else if (this.role === 'instructor') {
      this.userId = generateInstructorId();
    } else if (this.role === 'admin') {
      // For admin, we can use a similar format or customize as needed
      this.userId = `TAD${generateRandomString(4)}`;
    }
  }
  next();
});

export default mongoose.model('User', userSchema);
