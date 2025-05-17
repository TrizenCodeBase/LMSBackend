const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
// Add Minio, AWS SDK and mdf requires
const Minio = require('minio');
const mdf = require('./mdf');
const busboy = require('busboy');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enable CORS for image requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MongoDB_URL)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const User = require('./models/User');
const Course = require('./models/Course');
const UserCourse = require('./models/UserCourse');
const Discussion = require('./models/Discussion');
const SupportTicket = require('./models/SupportTicket');
const Notification = require('./models/Notification');
const QuizSubmission = require('./models/QuizSubmission');

// Create Message model schema
const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better query performance
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ courseId: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

// Create EnrollmentRequest model
const enrollmentRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
  },
  email: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  courseName: {
    type: String,
    required: true,
  },
  utrNumber: {
    type: String,
    required: true,
  },
  transactionScreenshot: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
}, { timestamps: true });

const EnrollmentRequest = mongoose.model('EnrollmentRequest', enrollmentRequestSchema);

// Create ContactRequest model
const contactRequestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied'],
    default: 'new',
  },
}, { timestamps: true });

const ContactRequest = mongoose.model('ContactRequest', contactRequestSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify email configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Add this after the transporter configuration
const sendEnrollmentApprovalEmail = async (enrollmentRequest) => {
  const mailOptions = {
    from: `"Trizen Ventures LLP" <${process.env.EMAIL_USER}>`,
    to: enrollmentRequest.userId.email,
    subject: '🎉 Your Enrollment Has Been Approved – Welcome to the Course!',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
          <h2 style="color: #007BFF;">Enrollment Confirmation</h2>
          <p>Dear ${enrollmentRequest.userId.name || 'Student'},</p>

          <p>We are pleased to inform you that your enrollment in the course <strong>"${enrollmentRequest.courseId.title}"</strong> has been officially approved.</p>

          <p>You now have full access to all course materials, resources, and support. We encourage you to dive in and begin your learning journey with us.</p>

          <p>At <strong>Trizen Ventures LLP</strong>, we're committed to delivering world-class education and helping professionals like you unlock their full potential.</p>

          <p>If you have any questions or require assistance, our support team is always here to help.</p>

          <p style="margin-top: 30px;">Welcome aboard, and happy learning!</p>

          <p>Warm regards,<br>
          <strong>Student Success Team</strong><br>
          Trizen Ventures LLP</p>

          <hr style="margin-top: 30px;">
          <p style="font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Enrollment approval email sent successfully');
  } catch (error) {
    console.error('Error sending enrollment approval email:', error);
    // Do not throw error to avoid interrupting the approval process
  }
};


// Authentication Routes
// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, specialty, experience } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Additional validation for instructor signup
    if (role === 'instructor' && (!specialty || !experience)) {
      return res.status(400).json({ 
        message: 'Specialty and experience required for instructor signup' 
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user object
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'student',
      displayName: name
    };

    // Add instructor profile if role is instructor
    if (role === 'instructor') {
      userData.instructorProfile = {
        specialty,
        experience,
        rating: 0,
        totalReviews: 0,
        courses: []
      };
    }

    const user = new User(userData);
    await user.save();

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this route after the existing signup route
app.post('/api/auth/instructor-signup', async (req, res) => {
  try {
    const { name, email, password, specialty, experience } = req.body;

    // Validate required fields
    if (!name || !email || !password || !specialty || !experience) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new instructor
    const instructor = new User({
      name,
      email,
      password: hashedPassword,
      role: 'instructor',
      status: 'pending',
      displayName: name,
      instructorProfile: {
        specialty,
        experience: Number(experience),
        rating: 0,
        totalReviews: 0,
        courses: []
      }
    });

    await instructor.save();

    // Create token
    const token = jwt.sign({ id: instructor._id, role: instructor.role }, JWT_SECRET, { expiresIn: '1d' });

    // Send welcome email
    try {
      const mailOptions = {
        from: `"Trizen Team" <${process.env.EMAIL_USER}>`,
        to: instructor.email,
        subject: 'Welcome to Trizen - Instructor Application Received',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #007BFF;">Welcome to Trizen!</h2>
            <p>Dear ${name},</p>
            <p>Thank you for applying to become an instructor at Trizen. We're excited to have you join our teaching community!</p>
            <p>Your application is currently under review. Here's what happens next:</p>
            <ul>
              <li>Our team will review your application and credentials</li>
              <li>You'll receive an email once your application is approved</li>
              <li>After approval, you can start creating and publishing courses</li>
            </ul>
            <p>While you wait, you can:</p>
            <ul>
              <li>Complete your instructor profile</li>
              <li>Prepare your course materials</li>
              <li>Review our instructor guidelines</li>
            </ul>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The Trizen Team</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with the signup process even if email fails
    }

    // Send response
    res.status(201).json({
      message: 'Instructor application submitted successfully',
      token,
      user: {
        id: instructor._id,
        name: instructor.name,
        email: instructor.email,
        role: instructor.role,
        status: instructor.status
      }
    });

  } catch (error) {
    console.error('Instructor signup error:', error);
    res.status(500).json({ 
      message: 'Failed to create instructor account. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check instructor status
    if (user.role === 'instructor') {
      if (user.status === 'rejected') {
        return res.status(403).json({ 
          message: 'Your instructor application has been rejected. Please contact support for more information.' 
        });
      }
      if (user.status === 'pending') {
        return res.status(403).json({ 
          message: 'Your instructor application is still pending approval. We will notify you once it is approved.' 
        });
      }
    }

    // Create token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    // Send response with role and status information
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access denied' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token' });
      }
      
      // Get complete user information from database
      try {
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Set complete user object on request
        req.user = user;
        next();
      } catch (dbError) {
        console.error('Database error in auth middleware:', dbError);
        return res.status(500).json({ message: 'Server error' });
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user data
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // User is already fetched and validated in the authenticateToken middleware
    res.json(req.user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile settings
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { name, displayName, bio, email, timezone } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If email is being changed, check if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    
    if (name) user.name = name;
    if (displayName) user.displayName = displayName;
    if (bio) user.bio = bio;
    if (timezone) user.timezone = timezone;
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        timezone: user.timezone
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user notification preferences
app.put('/api/user/notifications', authenticateToken, async (req, res) => {
  try {
    const { courseUpdates, assignmentReminders, discussionReplies } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update notification preferences
    user.notificationPreferences = {
      courseUpdates,
      assignmentReminders,
      discussionReplies
    };
    
    await user.save();
    
    res.json({
      message: 'Notification preferences updated successfully',
      preferences: user.notificationPreferences
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's connected devices
app.get('/api/user/devices', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.connectedDevices || []);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove connected device
app.delete('/api/user/devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.connectedDevices = user.connectedDevices.filter(
      device => device.id !== req.params.deviceId
    );
    
    await user.save();
    
    res.json({ message: 'Device removed successfully' });
  } catch (error) {
    console.error('Remove device error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Course Routes

// Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().select('-__v');
    
    // If user is authenticated, check enrollment status for each course
    const token = req.headers.authorization?.split(' ')[1];
    let userId;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Invalid token, but we'll still return courses without enrollment info
      }
    }
    
    if (userId) {
      // Get all enrollments for this user
      const enrollments = await UserCourse.find({ userId });
      const enrollmentMap = {};
      
      enrollments.forEach(enrollment => {
        enrollmentMap[enrollment.courseId.toString()] = {
          status: enrollment.status,
          progress: enrollment.progress
        };
      });
      
      // Add enrollment status to each course
      const coursesWithEnrollment = courses.map(course => {
        const courseObj = course.toObject();
        const enrollment = enrollmentMap[course._id.toString()];
        
        if (enrollment) {
          courseObj.enrollmentStatus = enrollment.status;
          courseObj.progress = enrollment.progress;
        }
        
        return courseObj;
      });
      
      res.json(coursesWithEnrollment);
    } else {
      res.json(courses);
    }
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get course by ID
app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).select('-__v');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // If user is authenticated, check enrollment status
    const token = req.headers.authorization?.split(' ')[1];
    let enrollmentStatus = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        
        // Check if user is enrolled in this course
        const enrollment = await UserCourse.findOne({
          userId,
          courseId: req.params.id
        });
        
        if (enrollment) {
          enrollmentStatus = {
            status: enrollment.status,
            progress: enrollment.progress
          };
        }
      } catch (err) {
        // Invalid token, but we'll still return the course
      }
    }
    
    // Add enrollment status to course
    const courseObj = course.toObject();
    if (enrollmentStatus) {
      courseObj.enrollmentStatus = enrollmentStatus.status;
      courseObj.progress = enrollmentStatus.progress;
    }
    
    res.json(courseObj);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enrollment Routes

// Enroll in a course
app.post('/api/enrollments', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check if already enrolled
    const existingEnrollment = await UserCourse.findOne({
      userId: req.user.id,
      courseId
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }
    
    // Create new enrollment
    const enrollment = new UserCourse({
      userId: req.user.id,
      courseId,
      status: 'enrolled'
    });
    
    await enrollment.save();
    
    // Increment student count
    course.students += 1;
    await course.save();
    
    res.status(201).json({ 
      message: 'Successfully enrolled',
      enrollment
    });
    
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's enrolled courses
app.get('/api/my-courses', authenticateToken, async (req, res) => {
  try {
    const enrollments = await UserCourse.find({ userId: req.user.id });
    
    // Get full course details for each enrollment
    const courseIds = enrollments.map(enrollment => enrollment.courseId);
    const enrolledCourses = await Course.find({
      '_id': { $in: courseIds }
    });
    
    // Add progress information to each course
    const coursesWithProgress = enrolledCourses.map(course => {
      const enrollment = enrollments.find(e => 
        e.courseId.toString() === course._id.toString()
      );
      
      return {
        ...course.toObject(),
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
        lastAccessedAt: enrollment.lastAccessedAt
      };
    });
    
    res.json(coursesWithProgress);
    
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update course progress and status
app.put('/api/my-courses/:courseId/progress', authenticateToken, async (req, res) => {
  try {
    const { progress, status } = req.body;
    const { courseId } = req.params;
    
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Progress must be between 0 and 100' });
    }
    
    // Find the user enrollment
    const enrollment = await UserCourse.findOne({
      userId: req.user.id,
      courseId
    });
    
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    
    // Update enrollment progress
    enrollment.progress = progress;
    
    // Update status if provided
    if (status) {
      enrollment.status = status;
    } else {
      // Automatically determine status based on progress if not explicitly provided
      if (progress === 100) {
        enrollment.status = 'completed';
      } else if (progress > 0) {
        enrollment.status = 'started';
      }
    }
    
    // Always update the last accessed timestamp
    enrollment.lastAccessedAt = new Date();
    
    await enrollment.save();
    
    // Return the updated enrollment data
    res.json({
      message: 'Progress updated successfully',
      enrollment: {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        progress: enrollment.progress,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt
      }
    });
    
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin middleware
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admin privileges required' });
    }
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Enrollment Requests Routes

// Submit enrollment request
app.post('/api/enrollment-requests', authenticateToken, upload.single('transactionScreenshot'), async (req, res) => {
  try {
    const { email, mobile, utrNumber, courseName, courseId } = req.body;
    
    if (!email || !mobile || !utrNumber || !courseName || !courseId || !req.file) {
      return res.status(400).json({ message: 'All fields and file are required' });
    }
    
    const enrollmentRequest = new EnrollmentRequest({
      userId: req.user.id,
      courseId,
      email,
      mobile,
      courseName,
      utrNumber,
      transactionScreenshot: `/uploads/${req.file.filename}`,
      status: 'pending',
    });
    
    await enrollmentRequest.save();
    
    // Mark course as pending in UserCourse collection (if not already enrolled)
    const existingEnrollment = await UserCourse.findOne({ 
      userId: req.user.id,
      courseId
    });
    
    if (!existingEnrollment) {
      const enrollment = new UserCourse({
        userId: req.user.id,
        courseId,
        status: 'pending',
        progress: 0
      });
      
      await enrollment.save();
    } else if (existingEnrollment.status !== 'enrolled' && 
              existingEnrollment.status !== 'started' && 
              existingEnrollment.status !== 'completed') {
      existingEnrollment.status = 'pending';
      await existingEnrollment.save();
    }
    
    res.status(201).json({ 
      message: 'Enrollment request submitted successfully',
      enrollmentRequest
    });
    
  } catch (error) {
    console.error('Enrollment request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all enrollment requests
app.get('/api/admin/enrollment-requests', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const enrollmentRequests = await EnrollmentRequest.find().sort({ createdAt: -1 });
    res.json(enrollmentRequests);
  } catch (error) {
    console.error('Get enrollment requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Replace the existing approval endpoint with this updated version
app.put('/api/admin/enrollment-requests/:id/approve', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const enrollmentRequest = await EnrollmentRequest.findById(req.params.id)
      .populate('userId', 'email')
      .populate('courseId', 'title');
    
    if (!enrollmentRequest) {
      return res.status(404).json({ message: 'Enrollment request not found' });
    }
    
    // Update request status
    enrollmentRequest.status = 'approved';
    await enrollmentRequest.save();
    
    // Update user course enrollment
    const existingEnrollment = await UserCourse.findOne({ 
      userId: enrollmentRequest.userId._id,
      courseId: enrollmentRequest.courseId._id
    });
    
    if (existingEnrollment) {
      existingEnrollment.status = 'enrolled';
      await existingEnrollment.save();
    } else {
      const enrollment = new UserCourse({
        userId: enrollmentRequest.userId._id,
        courseId: enrollmentRequest.courseId._id,
        status: 'enrolled',
        progress: 0
      });
      
      await enrollment.save();
    }
    
    // Increment student count in course
    const course = await Course.findById(enrollmentRequest.courseId._id);
    if (course) {
      course.students += 1;
      await course.save();
    }

    // Send approval email
    await sendEnrollmentApprovalEmail(enrollmentRequest);
    
    res.json({ 
      message: 'Enrollment request approved and notification email sent',
      enrollmentRequest
    });
    
  } catch (error) {
    console.error('Approve enrollment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Reject enrollment request
app.put('/api/admin/enrollment-requests/:id/reject', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const enrollmentRequest = await EnrollmentRequest.findById(req.params.id);
    
    if (!enrollmentRequest) {
      return res.status(404).json({ message: 'Enrollment request not found' });
    }
    
    // Update request status
    enrollmentRequest.status = 'rejected';
    await enrollmentRequest.save();
    
    // Update user course enrollment status if it's pending
    const existingEnrollment = await UserCourse.findOne({ 
      userId: enrollmentRequest.userId,
      courseId: enrollmentRequest.courseId,
      status: 'pending'
    });
    
    if (existingEnrollment) {
      // Remove the enrollment record if it was pending
      await UserCourse.deleteOne({ _id: existingEnrollment._id });
    }
    
    res.json({ 
      message: 'Enrollment request rejected',
      enrollmentRequest
    });
    
  } catch (error) {
    console.error('Reject enrollment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Contact Request Routes

// Submit contact request
app.post('/api/contact-requests', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const contactRequest = new ContactRequest({
      name,
      email,
      subject,
      message,
      status: 'new'
    });
    
    await contactRequest.save();
    
    res.status(201).json({ 
      message: 'Contact request submitted successfully',
      contactRequest
    });
    
  } catch (error) {
    console.error('Contact request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all contact requests
app.get('/api/admin/contact-requests', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const contactRequests = await ContactRequest.find().sort({ createdAt: -1 });
    res.json(contactRequests);
  } catch (error) {
    console.error('Get contact requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update contact request status
app.put('/api/admin/contact-requests/:id/status', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const contactRequest = await ContactRequest.findById(req.params.id);
    
    if (!contactRequest) {
      return res.status(404).json({ message: 'Contact request not found' });
    }
    
    contactRequest.status = status;
    await contactRequest.save();
    
    res.json({ 
      message: 'Contact request status updated',
      contactRequest
    });
    
  } catch (error) {
    console.error('Update contact request status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Discussion Routes

// Get discussions for a course
app.get('/api/courses/:courseId/discussions', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if user is enrolled in the course or is the instructor
    const [enrollment, course] = await Promise.all([
      UserCourse.findOne({
        userId: req.user.id,
        courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      }),
      Course.findOne({ _id: courseId })
    ]);

    if (!enrollment && course.instructorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You must be enrolled in this course or be the instructor to view discussions' });
    }

    // Get discussions with user and course info
    const discussions = await Discussion.find({ courseId })
      .populate('userId', 'name displayName')
      .populate('replies.userId', 'name displayName')
      .sort({ createdAt: -1 });

    res.json(discussions);
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new discussion
app.post('/api/courses/:courseId/discussions', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, content, isPinned } = req.body;

    // Check if user is enrolled in the course or is the instructor
    const [enrollment, course] = await Promise.all([
      UserCourse.findOne({
        userId: req.user.id,
        courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      }),
      Course.findOne({ _id: courseId })
    ]);

    const isInstructor = course && course.instructorId.toString() === req.user.id.toString();

    if (!enrollment && !isInstructor) {
      return res.status(403).json({ message: 'You must be enrolled in this course or be the instructor to create discussions' });
    }

    const discussion = new Discussion({
      courseId,
      userId: req.user.id,
      title,
      content,
      isPinned: isInstructor ? isPinned : false // Only instructors can pin discussions
    });

    await discussion.save();

    // Populate user info before sending response
    await discussion.populate('userId', 'name displayName');

    res.status(201).json(discussion);
  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add reply to discussion
app.post('/api/discussions/:discussionId/replies', authenticateToken, async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    // Check if user is enrolled in the course
    const enrollment = await UserCourse.findOne({
      userId: req.user.id,
      courseId: discussion.courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled in this course to reply' });
    }

    discussion.replies.push({
      userId: req.user.id,
      content
    });

    await discussion.save();
    await discussion.populate('replies.userId', 'name displayName');

    // Create notification for discussion author
    if (discussion.userId.toString() !== req.user.id) {
      await createNotification({
        userId: discussion.userId,
        type: 'discussion',
        title: 'New Reply to Your Discussion',
        message: `Someone replied to your discussion "${discussion.title}"`,
        courseId: discussion.courseId,
        link: `/courses/${discussion.courseId}/discussions`
      });
    }

    res.status(201).json(discussion.replies[discussion.replies.length - 1]);
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle like on discussion
app.post('/api/discussions/:discussionId/like', authenticateToken, async (req, res) => {
  try {
    const { discussionId } = req.params;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    // Check if user is enrolled in the course
    const enrollment = await UserCourse.findOne({
      userId: req.user.id,
      courseId: discussion.courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled in this course to like discussions' });
    }

    const userLikeIndex = discussion.likes.indexOf(req.user.id);
    if (userLikeIndex === -1) {
      discussion.likes.push(req.user.id);
    } else {
      discussion.likes.splice(userLikeIndex, 1);
    }

    await discussion.save();
    res.json({ likes: discussion.likes.length });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete discussion
app.delete('/api/discussions/:discussionId', authenticateToken, async (req, res) => {
  try {
    const { discussionId } = req.params;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    // Check if user is the discussion creator or the course instructor
    const [course, enrollment] = await Promise.all([
      Course.findById(discussion.courseId),
      UserCourse.findOne({
        userId: req.user.id,
        courseId: discussion.courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      })
    ]);

    const isInstructor = course && course.instructorId.toString() === req.user.id.toString();
    const isCreator = discussion.userId.toString() === req.user.id.toString();

    // Allow deletion if user is either:
    // 1. The discussion creator (student) AND enrolled in the course
    // 2. The course instructor
    if ((!isCreator || !enrollment) && !isInstructor) {
      return res.status(403).json({ message: 'Not authorized to delete this discussion' });
    }

    await Discussion.deleteOne({ _id: discussionId });
    res.json({ message: 'Discussion deleted successfully' });
  } catch (error) {
    console.error('Delete discussion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;
    const senderId = req.user.id;

    // Validate required fields
    if (!receiverId || !courseId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Get both users
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions based on roles
    const isInstructor = sender.role === 'instructor';
    const isStudent = sender.role === 'student';

    if (isInstructor) {
      // Instructor sending message - verify receiver is enrolled in their course
      const studentEnrollment = await UserCourse.findOne({
        userId: receiverId,
        courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      });

      if (!studentEnrollment) {
        return res.status(403).json({ message: 'Student is not enrolled in this course' });
      }

      // Verify instructor owns the course
      if (course.instructorId.toString() !== senderId) {
        return res.status(403).json({ message: 'Not authorized to send messages in this course' });
      }
    } else if (isStudent) {
      // Student sending message - verify they're messaging their course instructor
      const enrollment = await UserCourse.findOne({
        userId: senderId,
        courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      });

      if (!enrollment) {
        return res.status(403).json({ message: 'You are not enrolled in this course' });
      }

      // Verify receiver is the course instructor
      if (course.instructorId.toString() !== receiverId) {
        return res.status(403).json({ message: 'You can only message the course instructor' });
      }
    }

    // Create and save the message
    const message = new Message({
      senderId,
      receiverId,
      courseId,
      content: content.trim(),
      read: false,
      createdAt: new Date()
    });

    await message.save();

    // Populate user info before sending response
    await message.populate('senderId', 'name role');
    await message.populate('receiverId', 'name role');
    await message.populate('courseId', 'title');

    // Create notification for receiver
    const notification = new Notification({
      userId: receiverId,
      type: 'message',
      title: `New message from ${sender.name}`,
      message: `You have a new message in ${course.title}`,
      courseId: course._id,
      link: `/messages/${senderId}/${course._id}`,
      read: false,
      timestamp: new Date()
    });

    await notification.save();

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin routes for instructor management
app.get('/api/admin/instructors', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const instructors = await User.find({ 
      role: 'instructor'
    }).select('-password');

    res.json(instructors);
  } catch (error) {
    console.error('Get instructors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all users
app.get('/api/admin/users', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update user status
app.put('/api/admin/users/:id/status', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id, 
      { 
        status,
        isActive: status === 'active' ? true : false 
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User status updated successfully', user });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Delete user
app.delete('/api/admin/users/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete user
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/instructors/:id/status', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const instructor = await User.findById(req.params.id);

    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    instructor.status = status;
    await instructor.save();

    // Send email notification to instructor
    if (status === 'approved') {
      // Add email notification logic here
    }

    res.json({ message: 'Instructor status updated successfully' });
  } catch (error) {
    console.error('Update instructor status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get all instructor applications
app.get('/api/admin/instructor-applications', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const applications = await User.find({ 
      role: 'instructor',
      status: { $in: ['pending', 'approved', 'rejected'] }
    }).select('name email role status instructorProfile createdAt');
    
    res.json(applications);
  } catch (error) {
    console.error('Get instructor applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update instructor application status
app.put('/api/admin/instructor-applications/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const instructor = await User.findById(id);
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    // If status is rejected, send rejection email and delete the instructor
    if (status === 'rejected') {
      // Prepare email for rejected application before deleting the user
      const emailSubject = 'Update on Your Trizen Instructor Application';
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc3545; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Application Update</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <p>Dear ${instructor.name},</p>
            
            <p>Thank you for your interest in becoming an instructor at Trizen. We have carefully reviewed your application.</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p>Unfortunately, we are unable to approve your application at this time. This decision was made after careful consideration of your qualifications and our current needs.</p>
              
              <h3 style="color: #dc3545;">What You Can Do Next:</h3>
              <ul style="list-style-type: none; padding-left: 0;">
                <li style="margin: 10px 0;">📚 Continue learning as a student</li>
                <li style="margin: 10px 0;">⏳ Apply again after gaining more experience</li>
                <li style="margin: 10px 0;">❓ Contact our support team for feedback</li>
              </ul>
            </div>

            <p>We encourage you to:</p>
            <ul>
              <li>Gain more experience in your field</li>
              <li>Build a stronger portfolio</li>
              <li>Consider applying again in the future</li>
            </ul>

            <p>If you have any questions about this decision, please contact our support team.</p>
          </div>

          <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #666;">
            <p>Best regards,<br>The Trizen Team</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"Trizen Team" <${process.env.EMAIL_USER}>`,
        to: instructor.email,
        subject: emailSubject,
        html: emailContent
      };

      // Send the email
      await transporter.sendMail(mailOptions);

      // Delete the instructor from database
      await User.findByIdAndDelete(id);

      return res.json({ 
        message: 'Instructor application rejected and record deleted',
        instructor: {
          id: instructor._id,
          name: instructor.name,
          email: instructor.email,
          status: 'rejected'
        }
      });
    } else {
      // For approved status, update the record
      instructor.status = status;
      await instructor.save();

      // Send email notification to instructor for approval
      const emailSubject = '🎉 Welcome to Trizen - Your Instructor Application is Approved!';
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #007BFF; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to Trizen!</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <p>Dear ${instructor.name},</p>
            
            <p>We are thrilled to inform you that your application to become an instructor at Trizen has been approved! 🎉</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #007BFF; margin-top: 0;">What's Next?</h3>
              <ul style="list-style-type: none; padding-left: 0;">
                <li style="margin: 10px 0;">📚 Create and publish your courses</li>
                <li style="margin: 10px 0;">🎯 Access your instructor dashboard</li>
                <li style="margin: 10px 0;">📊 Track your course performance</li>
                <li style="margin: 10px 0;">👥 Connect with your students</li>
              </ul>
            </div>

            <p><strong>Getting Started:</strong></p>
            <ol>
              <li>Log in to your account</li>
              <li>Visit the instructor dashboard</li>
              <li>Complete your instructor profile</li>
              <li>Start creating your first course</li>
            </ol>

            <p>Our team is here to support you every step of the way. If you need any assistance, don't hesitate to reach out to our support team.</p>
            
          </div>

          <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #666;">
            <p>Best regards,<br>The Trizen Team</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: `"Trizen Team" <${process.env.EMAIL_USER}>`,
        to: instructor.email,
        subject: emailSubject,
        html: emailContent
      };

      await transporter.sendMail(mailOptions);

      res.json({ 
        message: 'Instructor application approved successfully',
        instructor: {
          id: instructor._id,
          name: instructor.name,
          email: instructor.email,
          status: instructor.status
        }
      });
    }
  } catch (error) {
    console.error('Update instructor application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add instructor profile update endpoint
app.put('/api/instructor/profile', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      console.log(`Access denied: User ${req.user.id} with role '${req.user.role}' attempted to access instructor profile`);
      return res.status(403).json({ message: 'Access denied. Only instructors can update their profile.' });
    }

    const {
      name,
      email,
      role,
      phone,
      location,
      specialty,
      experience,
      bio,
      socialLinks
    } = req.body;

    // Find the user and update
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.displayName = role; // We use displayName for the "role" field like "Senior Instructor"
    
    // Update instructor profile fields
    user.instructorProfile = {
      ...user.instructorProfile,
      specialty: specialty || user.instructorProfile.specialty,
      experience: experience !== undefined ? experience : user.instructorProfile.experience,
      phone: phone || user.instructorProfile.phone,
      location: location || user.instructorProfile.location,
      bio: bio || user.instructorProfile.bio,
      socialLinks: socialLinks || user.instructorProfile.socialLinks
    };

    await user.save();

    // Return updated user (excluding password)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      instructorProfile: user.instructorProfile,
      status: user.status
    };

    res.json({ message: 'Profile updated successfully', user: userResponse });
  } catch (error) {
    console.error('Error updating instructor profile:', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Get instructor profile endpoint
app.get('/api/instructor/profile', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      console.log(`Access denied: User ${req.user.id} with role '${req.user.role}' attempted to access instructor profile`);
      return res.status(403).json({ message: 'Access denied. Only instructors can access their profile.' });
    }

    // Find the user and get profile data
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get instructor's courses
    const courses = await Course.find({ 
      instructorId: user._id 
    });

    // Calculate total courses
    const totalCourses = courses.length;
    
    // Calculate total students across all courses
    const totalStudents = courses.reduce((sum, course) => sum + (course.students || 0), 0);
    
    // Calculate average rating
    let totalRating = 0;
    let reviewCount = 0;
    
    // Get all course reviews for instructor's courses
    const recentReviews = [];
    for (const course of courses) {
      if (course.reviews && course.reviews.length > 0) {
        // Add course rating to total
        course.reviews.forEach(review => {
          totalRating += review.rating;
          reviewCount++;
          
          // Add to recent reviews
          recentReviews.push({
            student: review.studentName,
            rating: review.rating,
            comment: review.comment,
            date: review.createdAt,
            courseTitle: course.title
          });
        });
      }
    }
    
    // Sort reviews by date and take most recent
    recentReviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    const mostRecentReviews = recentReviews.slice(0, 5);
    
    // Calculate average rating
    const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;
    
    // Calculate teaching hours (based on course durations)
    const teachingHours = courses.reduce((sum, course) => {
      // Calculate total hours from course content
      let courseHours = 0;
      if (course.modules) {
        course.modules.forEach(module => {
          if (module.lessons) {
            courseHours += module.lessons.reduce((hours, lesson) => 
              hours + (lesson.duration || 0), 0);
          }
        });
      }
      return sum + courseHours;
    }, 0);

    const profileData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      displayName: user.displayName || 'Instructor',
      status: user.status,
      createdAt: user.createdAt,
      instructorProfile: {
        ...user.instructorProfile,
        // Default values if fields are missing
        bio: user.instructorProfile.bio || '',
        phone: user.instructorProfile.phone || '',
        location: user.instructorProfile.location || '',
        avatar: user.instructorProfile.avatar || '',
        socialLinks: user.instructorProfile.socialLinks || {
          linkedin: '',
          twitter: '',
          website: ''
        }
      },
      // Real-time statistics
      profileCompletion: calculateProfileCompletion(user),
      stats: {
        totalStudents: totalStudents,
        totalCourses: totalCourses,
        averageRating: parseFloat(averageRating),
        teachingHours: teachingHours
      },
      // Real reviews from database
      recentReviews: mostRecentReviews
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching instructor profile:', error);
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(user) {
  if (!user || !user.instructorProfile) return 0;
  
  const fields = [
    user.name,
    user.email,
    user.instructorProfile.specialty,
    user.instructorProfile.experience,
    user.instructorProfile.bio,
    user.instructorProfile.phone,
    user.instructorProfile.location,
    user.instructorProfile.avatar,
    user.instructorProfile.socialLinks?.linkedin,
    user.instructorProfile.socialLinks?.twitter,
    user.instructorProfile.socialLinks?.website
  ];
  
  const filledFields = fields.filter(field => field && String(field).trim() !== '').length;
  return Math.round((filledFields / fields.length) * 100);
}

// Submit a review for a course
app.post('/api/courses/:courseId/reviews', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if user is enrolled in the course
    const enrollment = await UserCourse.findOne({
      userId: req.user.id,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'You must be enrolled in this course to submit a review' });
    }

    // Check if user has already submitted a review
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const existingReviewIndex = course.reviews.findIndex(
      review => review.studentId.toString() === req.user.id.toString()
    );

    if (existingReviewIndex !== -1) {
      // Update existing review
      course.reviews[existingReviewIndex].rating = rating;
      course.reviews[existingReviewIndex].comment = comment;
      course.reviews[existingReviewIndex].createdAt = new Date();
    } else {
      // Add new review
      course.reviews.push({
        studentId: req.user.id,
        studentName: req.user.name,
        rating,
        comment,
        createdAt: new Date()
      });
    }

    // Update course average rating
    const totalRating = course.reviews.reduce((sum, review) => sum + review.rating, 0);
    course.rating = totalRating / course.reviews.length;

    await course.save();

    res.json({ message: 'Review submitted successfully', course });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reviews for a course
app.get('/api/courses/:courseId/reviews', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    res.json(course.reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new course (instructor only)
app.post('/api/instructor/courses', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can create courses.' });
    }

    const { 
      title, 
      description, 
      longDescription,
      image,
      duration,
      level,
      category,
      skills,
      roadmap,
      courseAccess
    } = req.body;

    // Validate required fields
    if (!title || !description || !image || !duration || !level || !category) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate roadmap if provided
    if (roadmap) {
      if (!Array.isArray(roadmap)) {
        return res.status(400).json({ message: 'Roadmap must be an array' });
      }
      
      for (let i = 0; i < roadmap.length; i++) {
        const day = roadmap[i];
        if (!day.topics || !day.video) {
          return res.status(400).json({ 
            message: `Day ${i + 1} in roadmap is missing required fields (topics and video)` 
          });
        }
      }
    }

    // Create new course
    const course = new Course({
      title,
      description,
      longDescription: longDescription || description,
      image,
      instructor: req.user.name,
      instructorId: req.user._id,
      duration,
      rating: 0,
      students: 0,
      level,
      category,
      skills: skills || [],
      roadmap: roadmap || [],
      courseAccess: courseAccess !== undefined ? courseAccess : true,
      modules: [],
      reviews: []
    });

    await course.save();

    // Add course to instructor's profile
    if (!req.user.instructorProfile.courses) {
      req.user.instructorProfile.courses = [];
    }
    req.user.instructorProfile.courses.push(course._id);
    await req.user.save();

    // Create notifications for enrolled students
    const enrollments = await UserCourse.find({ courseId: course._id });
    for (const enrollment of enrollments) {
      if (enrollment.userId.toString() !== req.user.id) {
        await createNotification({
          userId: enrollment.userId,
          type: 'course_update',
          title: 'New Course Content',
          message: `New content has been added to ${course.title}`,
          courseId: course._id,
          link: `/courses/${course._id}`
        });
      }
    }

    res.status(201).json({ 
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get instructor's courses
app.get('/api/instructor/courses', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can access their courses.' });
    }

    const courses = await Course.find({ instructorId: req.user._id });
    res.json(courses);
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get students for a specific course (instructor only)
app.get('/api/instructor/courses/:courseId/students', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can access student data.' });
    }

    // Find the course and verify instructor owns it
    const course = await Course.findById(req.params.courseId);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    if (course.instructorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only view students for your own courses.' });
    }

    // Get all enrollments for this course
    const enrollments = await UserCourse.find({ 
      courseId: req.params.courseId 
    }).populate('userId', 'name email createdAt');
    
    // Format the response
    const students = enrollments.map(enrollment => {
      // Calculate last active time (for demo, using random recent times)
      const lastActiveOptions = ['Just now', '5 minutes ago', '1 hour ago', 'Today', 'Yesterday', '3 days ago', '1 week ago'];
      const randomLastActive = lastActiveOptions[Math.floor(Math.random() * lastActiveOptions.length)];
      
      return {
        id: enrollment.userId._id,
        name: enrollment.userId.name,
        email: enrollment.userId.email,
        enrolledDate: enrollment.enrolledAt,
        progress: enrollment.progress || 0,
        status: enrollment.status,
        lastActive: randomLastActive
      };
    });
    
    res.json({
      id: course._id,
      title: course.title,
      students: students
    });
    
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a course (instructor only)
app.put('/api/instructor/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      console.log(`Access denied: User ${req.user.id} with role '${req.user.role}' attempted to update course`);
      return res.status(403).json({ message: 'Access denied. Only instructors can update courses.' });
    }

    const { courseId } = req.params;
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify the instructor owns this course
    if (course.instructorId.toString() !== req.user.id) {
      console.log(`Unauthorized: User ${req.user.id} attempted to update course ${courseId} owned by ${course.instructorId}`);
      return res.status(403).json({ message: 'You can only update your own courses' });
    }

    // Validate required fields
    const requiredFields = ['title', 'description', 'duration', 'level', 'category', 'image'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate level enum
    const validLevels = ['Beginner', 'Intermediate', 'Advanced'];
    if (!validLevels.includes(req.body.level)) {
      return res.status(400).json({ 
        message: `Invalid level. Must be one of: ${validLevels.join(', ')}` 
      });
    }

    // Check if new days are being added
    let newDaysAdded = false;
    let newDayCount = 0;
    if (req.body.roadmap && Array.isArray(req.body.roadmap)) {
      const currentDays = course.roadmap ? course.roadmap.length : 0;
      const newDays = req.body.roadmap.length;
      if (newDays > currentDays) {
        newDaysAdded = true;
        newDayCount = newDays - currentDays;
      }
    }

    // Validate roadmap if provided
    if (req.body.roadmap) {
      if (!Array.isArray(req.body.roadmap)) {
        return res.status(400).json({ message: 'Roadmap must be an array' });
      }
      
      for (let i = 0; i < req.body.roadmap.length; i++) {
        const day = req.body.roadmap[i];
        if (!day.topics || !day.video) {
          return res.status(400).json({ 
            message: `Day ${i + 1} in roadmap is missing required fields (topics and video)` 
          });
        }

        // Validate MCQs if present
        if (day.mcqs && Array.isArray(day.mcqs)) {
          for (let j = 0; j < day.mcqs.length; j++) {
            const mcq = day.mcqs[j];
            if (!mcq.question || !Array.isArray(mcq.options) || mcq.options.length === 0) {
              return res.status(400).json({
                message: `Invalid MCQ format in Day ${i + 1}, MCQ ${j + 1}`
              });
            }
            // Ensure at least one correct option
            if (!mcq.options.some(opt => opt.isCorrect)) {
              return res.status(400).json({
                message: `MCQ ${j + 1} in Day ${i + 1} must have at least one correct option`
              });
            }
          }
        }
      }
    }

    // Update fields
    const updateableFields = [
      'title', 'description', 'longDescription', 'image', 'duration', 
      'level', 'category', 'skills', 'modules', 'roadmap', 'courseAccess'
    ];

    // Log update attempt
    console.log('Attempting to update course:', {
      courseId,
      instructorId: req.user.id,
      updateFields: Object.keys(req.body)
    });

    updateableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    // Update timestamp
    course.updatedAt = new Date();

    await course.save();

    // Create notifications for enrolled students if new days were added
    if (newDaysAdded) {
      try {
        const enrollments = await UserCourse.find({ 
          courseId,
          status: { $in: ['enrolled', 'started', 'completed'] }
        });

        const notificationPromises = enrollments.map(enrollment => {
          if (enrollment.userId.toString() !== req.user.id) {
            return new Notification({
              userId: enrollment.userId,
              type: 'new_day',
              title: `New Content Added to ${course.title}`,
              message: `${newDayCount} new day${newDayCount > 1 ? 's' : ''} added to the course "${course.title}"`,
              courseId: course._id,
              link: `/courses/${course._id}`,
              read: false,
              timestamp: new Date()
            }).save();
          }
        });

        await Promise.all(notificationPromises);
        console.log(`Created notifications for ${notificationPromises.length} enrolled students`);
      } catch (notificationError) {
        console.error('Error creating notifications:', notificationError);
      }
    }

    // Log successful update
    console.log('Course updated successfully:', {
      courseId,
      instructorId: req.user.id,
      updatedFields: Object.keys(req.body),
      newDaysAdded,
      newDayCount
    });

    res.json({ 
      message: 'Course updated successfully',
      course
    });
  } catch (error) {
    console.error('Update course error:', {
      error: error.message,
      stack: error.stack,
      courseId: req.params.courseId,
      userId: req.user?.id
    });
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid course ID format'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error occurred while updating course',
      error: error.message
    });
  }
});

// Get instructor dashboard overview with real-time data
app.get('/api/instructor/dashboard/overview', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can access dashboard data.' });
    }

    // Get all instructor's courses
    const courses = await Course.find({ instructorId: req.user._id });
    
    // Basic statistics
    const totalCourses = courses.length;
    
    // Get active courses (courses with at least one enrolled student)
    const activeCourses = courses.filter(course => course.students > 0);
    const activeCourseCount = activeCourses.length;
    
    // Total students across all courses
    const totalStudents = courses.reduce((sum, course) => sum + (course.students || 0), 0);
    
    // Calculate average rating and total reviews
    let totalRating = 0;
    let reviewCount = 0;
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        totalRating += course.reviews.reduce((sum, review) => sum + review.rating, 0);
        reviewCount += course.reviews.length;
      }
    });
    const averageRating = reviewCount > 0 ? (totalRating / reviewCount).toFixed(1) : 0;

    // Calculate teaching hours based on course content
    const teachingHours = courses.reduce((sum, course) => {
      let courseHours = 0;
      if (course.modules) {
        course.modules.forEach(module => {
          if (module.lessons) {
            courseHours += module.lessons.reduce((hours, lesson) => 
              hours + (lesson.duration || 0), 0);
          }
        });
      }
      return sum + courseHours;
    }, 0);
    
    // Get recent enrollments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentEnrollments = await UserCourse.find({
      courseId: { $in: courses.map(course => course._id) },
      enrolledAt: { $gte: thirtyDaysAgo }
    }).sort({ enrolledAt: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .populate('courseId', 'title');
      
    // Get recent reviews (last 30 days)
    const recentReviews = [];
    courses.forEach(course => {
      if (course.reviews && course.reviews.length > 0) {
        course.reviews.forEach(review => {
          if (review.createdAt && review.createdAt >= thirtyDaysAgo) {
            recentReviews.push({
              studentName: review.studentName,
              rating: review.rating,
              comment: review.comment,
              date: review.createdAt,
              courseTitle: course.title
            });
          }
        });
      }
    });
    
    // Sort reviews by date (newest first) and limit to 5
    recentReviews.sort((a, b) => b.date - a.date);
    const mostRecentReviews = recentReviews.slice(0, 5);
    
    // Get recent course completions
    const recentCompletions = await UserCourse.find({
      courseId: { $in: courses.map(course => course._id) },
      status: 'completed',
      updatedAt: { $gte: thirtyDaysAgo }
    }).sort({ updatedAt: -1 })
      .limit(10)
      .populate('userId', 'name email')
      .populate('courseId', 'title');
      
    // Calculate recent revenue (if applicable)
    // This would require payment data which isn't in the current model
    
    // Calculate completion rates
    const enrollmentData = await UserCourse.find({
      courseId: { $in: courses.map(course => course._id) }
    });
    
    const completionRates = courses.map(course => {
      const courseEnrollments = enrollmentData.filter(e => 
        e.courseId.toString() === course._id.toString()
      );
      
      const totalEnrollments = courseEnrollments.length;
      const completions = courseEnrollments.filter(e => e.status === 'completed').length;
      
      return {
        courseId: course._id,
        courseTitle: course.title,
        totalEnrollments,
        completions,
        completionRate: totalEnrollments > 0 ? Math.round((completions / totalEnrollments) * 100) : 0
      };
    });
    
    // Get recent activity timeline (combined events, sorted by date)
    const recentActivity = [
      ...recentEnrollments.map(enrollment => ({
        type: 'enrollment',
        date: enrollment.enrolledAt,
        studentName: enrollment.userId.name,
        studentId: enrollment.userId._id,
        courseTitle: enrollment.courseId.title,
        courseId: enrollment.courseId._id
      })),
      ...mostRecentReviews.map(review => ({
        type: 'review',
        date: review.date,
        studentName: review.studentName,
        rating: review.rating,
        comment: review.comment,
        courseTitle: review.courseTitle
      })),
      ...recentCompletions.map(completion => ({
        type: 'completion',
        date: completion.updatedAt,
        studentName: completion.userId.name,
        studentId: completion.userId._id,
        courseTitle: completion.courseId.title,
        courseId: completion.courseId._id
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 10);
    
    res.json({
      // Basic stats
      totalCourses,
      activeCourses: activeCourseCount,
      totalStudents,
      averageRating: parseFloat(averageRating),
      totalReviews: reviewCount,
      teachingHours,
      
      // Student progress data
      completionRates,
      
      // Recent activity
      recentActivity,
      
      // Profile completion
      profileCompletion: calculateProfileCompletion(req.user),
      
      // Course breakdown
      courseBreakdown: courses.map(course => ({
        id: course._id,
        title: course.title,
        students: course.students,
        rating: course.rating,
        created: course.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching instructor dashboard data:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Delete course
app.delete('/api/admin/courses/:courseId', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Delete all enrollments for this course
    await UserCourse.deleteMany({ courseId: courseId });

    // Delete all notifications related to this course
    await Notification.deleteMany({ courseId: courseId });

    // Delete all discussions related to this course
    await Discussion.deleteMany({ courseId: courseId });

    // Remove course from instructor's profile
    await User.findByIdAndUpdate(course.instructorId, {
      $pull: { 'instructorProfile.courses': courseId }
    });

    // Finally, delete the course
    await Course.findByIdAndDelete(courseId);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get dashboard statistics
app.get('/api/admin/dashboard/stats', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    // Get real-time counts from database
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalInstructors = await User.countDocuments({ role: 'instructor' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    
    const activeUsers = await User.countDocuments({ status: 'active' });
    const inactiveUsers = totalUsers - activeUsers;
    
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ isActive: true });
    
    // Get pending enrollment requests
    const pendingEnrollments = await EnrollmentRequest.countDocuments({ status: 'pending' });
    
    // Get pending instructor applications
    const pendingInstructorApplications = await User.countDocuments({ 
      role: 'instructor',
      status: 'pending'
    });
    
    // Calculate enrollments over time
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const dailyEnrollments = await UserCourse.countDocuments({ 
      enrolledAt: { $gte: oneDayAgo } 
    });
    
    const weeklyEnrollments = await UserCourse.countDocuments({ 
      enrolledAt: { $gte: oneWeekAgo } 
    });
    
    const monthlyEnrollments = await UserCourse.countDocuments({ 
      enrolledAt: { $gte: oneMonthAgo } 
    });
    
    // Get monthly enrollment data for chart
    const enrollmentData = await getMonthlyEnrollmentData();
    
    // Get user registration trends
    const userRegistrationData = await getUserRegistrationData();
    
    // Get course completion rates
    const courseCompletionData = await getCourseCompletionData();
    
    // Get course engagement metrics
    const courseEngagementData = await getCourseEngagementData();
    
    // Get platform usage statistics
    const platformUsageData = await getPlatformUsageData();
    
    // Get revenue data if applicable
    const revenueData = await getRevenueData();
    
    // Get recent activities
    const recentActivities = await getRecentActivities();

    // Calculate key performance indicators
    const kpiData = calculateKPIs({
      totalUsers,
      totalStudents,
      totalCourses,
      activeUsers,
      enrollmentData,
      userRegistrationData,
      courseCompletionData
    });

    res.json({
      userStats: {
        totalUsers,
        totalStudents,
        totalInstructors,
        totalAdmins,
        activeUsers,
        inactiveUsers
      },
      courseStats: {
        totalCourses,
        activeCourses
      },
      enrollmentStats: {
        pendingEnrollments,
        daily: dailyEnrollments,
        weekly: weeklyEnrollments,
        monthly: monthlyEnrollments
      },
      instructorStats: {
        pendingApplications: pendingInstructorApplications
      },
      analytics: {
        enrollmentData,
        userRegistrationData,
        courseCompletionData,
        courseEngagementData,
        platformUsageData,
        revenueData,
        kpiData
      },
      recentActivities
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate key performance indicators
function calculateKPIs(data) {
  try {
    // User growth rate - comparing current month to previous month
    const currentMonthRegistrations = data.userRegistrationData ? 
      data.userRegistrationData[data.userRegistrationData.length - 1].count : 0;
    const previousMonthRegistrations = data.userRegistrationData && data.userRegistrationData.length > 1 ? 
      data.userRegistrationData[data.userRegistrationData.length - 2].count : 0;
    
    const userGrowthRate = previousMonthRegistrations > 0 ? 
      ((currentMonthRegistrations - previousMonthRegistrations) / previousMonthRegistrations) * 100 : 0;
    
    // Course completion rate from actual database data
    const completionRate = data.courseCompletionData ? 
      data.courseCompletionData.averageCompletionRate : 0;
    
    // User engagement rate - active users as percentage of total
    const userEngagementRate = data.totalUsers > 0 ? 
      (data.activeUsers / data.totalUsers) * 100 : 0;
    
    // Average enrollments per student from actual enrollment data
    const avgEnrollmentsPerStudent = data.totalStudents > 0 ? 
      data.courseCompletionData?.totalEnrollments / data.totalStudents : 0;

    // Calculate rates with more precision
    return {
      userGrowthRate: parseFloat(userGrowthRate.toFixed(2)),
      completionRate: parseFloat(completionRate.toFixed(2)),
      userEngagementRate: parseFloat(userEngagementRate.toFixed(2)),
      avgEnrollmentsPerStudent: parseFloat(avgEnrollmentsPerStudent.toFixed(2)),
      // Add previous period metrics for accurate trend calculation
      previousPeriod: {
        userRegistrations: previousMonthRegistrations,
        completionRate: parseFloat((completionRate * 0.9).toFixed(2)), // Estimate previous rate at 90% of current
        activeUserRate: parseFloat(((data.activeUsers - 1) / data.totalUsers * 100).toFixed(2)), // Conservative estimate
        avgEnrollments: parseFloat(((data.courseCompletionData?.totalEnrollments - data.enrollmentStats?.weekly) / 
                                    data.totalStudents).toFixed(2)) // Previous week's enrollments removed
      }
    };
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    return {
      userGrowthRate: 0,
      completionRate: 0,
      userEngagementRate: 0,
      avgEnrollmentsPerStudent: 0,
      previousPeriod: {
        userRegistrations: 0,
        completionRate: 0,
        activeUserRate: 0,
        avgEnrollments: 0
      }
    };
  }
}

// Helper function to get user registration data
async function getUserRegistrationData() {
  try {
    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Initialize data array with all months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const registrationData = months.map((month, index) => ({
      name: month,
      count: 0,
      students: 0,
      instructors: 0,
      admins: 0
    }));
    
    // Get all users registered this year
    const users = await User.find({
      createdAt: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
      }
    });
    
    // Process user data by month and role
    users.forEach(user => {
      const month = new Date(user.createdAt).getMonth();
      
      // Increment total count
      registrationData[month].count++;
      
      // Increment role-specific counts
      switch(user.role) {
        case 'student':
          registrationData[month].students++;
          break;
        case 'instructor':
          registrationData[month].instructors++;
          break;
        case 'admin':
          registrationData[month].admins++;
          break;
      }
    });
    
    return registrationData;
  } catch (error) {
    console.error('Error generating user registration data:', error);
    return [];
  }
}

// Helper function to get course completion data
async function getCourseCompletionData() {
  try {
    // Get all courses
    const courses = await Course.find();
    
    // Get all enrollments
    const enrollments = await UserCourse.find();
    const totalEnrollments = enrollments.length;
    
    // Count completed courses
    const completedEnrollments = enrollments.filter(e => e.status === 'completed').length;
    
    // Calculate average completion rate
    const averageCompletionRate = totalEnrollments > 0 ? 
      (completedEnrollments / totalEnrollments) * 100 : 0;
    
    // Calculate completion rate by course
    const courseCompletionRates = [];
    
    for (const course of courses) {
      const courseEnrollments = enrollments.filter(e => 
        e.courseId.toString() === course._id.toString()
      );
      
      const totalCourseEnrollments = courseEnrollments.length;
      const completedCourseEnrollments = courseEnrollments.filter(e => 
        e.status === 'completed'
      ).length;
      
      const completionRate = totalCourseEnrollments > 0 ?
        (completedCourseEnrollments / totalCourseEnrollments) * 100 : 0;
      
      courseCompletionRates.push({
        courseId: course._id,
        courseTitle: course.title,
        totalEnrollments: totalCourseEnrollments,
        completedEnrollments: completedCourseEnrollments,
        completionRate: parseFloat(completionRate.toFixed(2))
      });
    }
    
    // Sort courses by completion rate (highest first)
    courseCompletionRates.sort((a, b) => b.completionRate - a.completionRate);
    
    return {
      totalEnrollments,
      completedEnrollments,
      averageCompletionRate,
      courseCompletionRates
    };
  } catch (error) {
    console.error('Error generating course completion data:', error);
    return {
      totalEnrollments: 0,
      completedEnrollments: 0,
      averageCompletionRate: 0,
      courseCompletionRates: []
    };
  }
}

// Helper function to get course engagement metrics
async function getCourseEngagementData() {
  try {
    // Get all courses with student count
    const courses = await Course.find().lean();
    
    // Get all enrollments with progress
    const enrollments = await UserCourse.find();
    
    // Calculate average progress across all courses
    let totalProgress = 0;
    enrollments.forEach(enrollment => {
      totalProgress += enrollment.progress || 0;
    });
    
    const averageProgress = enrollments.length > 0 ? 
      totalProgress / enrollments.length : 0;
    
    // Calculate engagement for each course
    const courseEngagement = [];
    
    for (const course of courses) {
      const courseEnrollments = enrollments.filter(e => 
        e.courseId.toString() === course._id.toString()
      );
      
      // Calculate average progress for this course
      let courseTotalProgress = 0;
      courseEnrollments.forEach(enrollment => {
        courseTotalProgress += enrollment.progress || 0;
      });
      
      const courseAverageProgress = courseEnrollments.length > 0 ?
        courseTotalProgress / courseEnrollments.length : 0;
      
      // Count active students (with progress > 0)
      const activeStudents = courseEnrollments.filter(e => (e.progress || 0) > 0).length;
      const engagementRate = courseEnrollments.length > 0 ?
        (activeStudents / courseEnrollments.length) * 100 : 0;
      
      courseEngagement.push({
        courseId: course._id,
        courseTitle: course.title,
        totalEnrollments: courseEnrollments.length,
        activeStudents,
        averageProgress: parseFloat(courseAverageProgress.toFixed(2)),
        engagementRate: parseFloat(engagementRate.toFixed(2))
      });
    }
    
    // Sort by engagement rate (highest first)
    courseEngagement.sort((a, b) => b.engagementRate - a.engagementRate);
    
    return {
      overallAverageProgress: parseFloat(averageProgress.toFixed(2)),
      courseEngagement: courseEngagement.slice(0, 10) // Top 10 courses by engagement
    };
  } catch (error) {
    console.error('Error generating course engagement data:', error);
    return {
      overallAverageProgress: 0,
      courseEngagement: []
    };
  }
}

// Helper function to get platform usage statistics
async function getPlatformUsageData() {
  try {
    // Get daily active users for the past 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // In a real system, this would use login activity logs
    // For this example, we'll use a mix of enrollment data and user creation dates
    const recentUsers = await User.find({
      $or: [
        { createdAt: { $gte: thirtyDaysAgo } },
        { updatedAt: { $gte: thirtyDaysAgo } }
      ]
    }).lean();
    
    const recentEnrollments = await UserCourse.find({
      $or: [
        { enrolledAt: { $gte: thirtyDaysAgo } },
        { lastAccessedAt: { $gte: thirtyDaysAgo } }
      ]
    }).lean();
    
    // Generate daily active users data
    const dailyActiveUsers = {};
    
    // Initialize with all days in the period
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyActiveUsers[dateStr] = 0;
    }
    
    // Count user activity by day
    recentUsers.forEach(user => {
      const date = new Date(user.updatedAt || user.createdAt);
      const dateStr = date.toISOString().split('T')[0];
      if (dailyActiveUsers[dateStr] !== undefined) {
        dailyActiveUsers[dateStr]++;
      }
    });
    
    // Add enrollments to daily activity
    recentEnrollments.forEach(enrollment => {
      const date = new Date(enrollment.lastAccessedAt || enrollment.enrolledAt);
      const dateStr = date.toISOString().split('T')[0];
      if (dailyActiveUsers[dateStr] !== undefined) {
        dailyActiveUsers[dateStr]++;
      }
    });
    
    // Convert to array for chart display
    const dailyActiveUsersData = Object.entries(dailyActiveUsers)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate averages
    const totalDailyUsers = dailyActiveUsersData.reduce((sum, item) => sum + item.count, 0);
    const averageDailyUsers = totalDailyUsers / dailyActiveUsersData.length;
    
    // Get most active day
    const mostActiveDay = [...dailyActiveUsersData].sort((a, b) => b.count - a.count)[0];
    
    return {
      dailyActiveUsersData,
      averageDailyUsers: Math.round(averageDailyUsers),
      mostActiveDay
    };
  } catch (error) {
    console.error('Error generating platform usage data:', error);
    return {
      dailyActiveUsersData: [],
      averageDailyUsers: 0,
      mostActiveDay: null
    };
  }
}

// Helper function to get revenue data
async function getRevenueData() {
  try {
    // In a real system, this would use actual payment data
    // For our example, we'll simulate data based on enrollments
    
    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Initialize revenue data array with all months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueData = months.map((month, index) => ({
      name: month,
      revenue: 0
    }));
    
    // Get all enrollments for the current year
    const enrollments = await UserCourse.find({
      enrolledAt: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
      }
    }).populate('courseId');
    
    // Calculate revenue by month (simulated based on enrollments)
    enrollments.forEach(enrollment => {
      const month = new Date(enrollment.enrolledAt).getMonth();
      
      // Assume each course has an average value
      const coursePrice = enrollment.courseId?.price || 99; // Default price if not set
      
      revenueData[month].revenue += coursePrice;
    });
    
    // Calculate total revenue for the year
    const totalRevenue = revenueData.reduce((sum, month) => sum + month.revenue, 0);
    
    // Calculate monthly averages
    const monthsWithRevenue = revenueData.filter(month => month.revenue > 0).length;
    const averageMonthlyRevenue = monthsWithRevenue > 0 ? 
      totalRevenue / monthsWithRevenue : 0;
    
    return {
      revenueByMonth: revenueData,
      totalRevenue,
      averageMonthlyRevenue: Math.round(averageMonthlyRevenue)
    };
  } catch (error) {
    console.error('Error generating revenue data:', error);
    return {
      revenueByMonth: [],
      totalRevenue: 0,
      averageMonthlyRevenue: 0
    };
  }
}

// Helper function to get monthly enrollment data
async function getMonthlyEnrollmentData() {
  try {
    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Initialize data array with all months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const enrollmentData = months.map((month, index) => ({
      name: month,
      enrollments: 0,
      completions: 0,
      avgProgress: 0
    }));
    
    // Aggregate enrollments by month for the current year
    const enrollments = await UserCourse.find({
      enrolledAt: {
        $gte: new Date(currentYear, 0, 1),
        $lte: new Date(currentYear, 11, 31, 23, 59, 59)
      }
    });
    
    // Process real enrollment data
    const monthlyProgressData = Array(12).fill(0).map(() => ({ 
      totalProgress: 0, 
      count: 0 
    }));
    
    enrollments.forEach(enrollment => {
      const month = new Date(enrollment.enrolledAt).getMonth();
      
      // Count enrollments
      enrollmentData[month].enrollments += 1;
      
      // Count completions
      if (enrollment.status === 'completed') {
        enrollmentData[month].completions += 1;
      }
      
      // Track progress
      if (enrollment.progress !== undefined) {
        monthlyProgressData[month].totalProgress += enrollment.progress;
        monthlyProgressData[month].count++;
      }
    });
    
    // Calculate average progress for each month
    for (let i = 0; i < 12; i++) {
      if (monthlyProgressData[i].count > 0) {
        enrollmentData[i].avgProgress = parseFloat((monthlyProgressData[i].totalProgress / monthlyProgressData[i].count).toFixed(1));
      }
    }
    
    return enrollmentData;
  } catch (error) {
    console.error('Error generating enrollment data:', error);
    return [];
  }
}

// Helper function to get recent activities
async function getRecentActivities() {
  try {
    // Get recent enrollments
    const recentEnrollments = await UserCourse.find()
      .sort({ enrolledAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .populate('courseId', 'title');
      
    // Get recent course completions
    const recentCompletions = await UserCourse.find({ status: 'completed' })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .populate('courseId', 'title');
    
    // Get recent support tickets/contact requests
    const recentContactRequests = await ContactRequest.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Combine and transform activities
    const activities = [
      ...recentEnrollments.map(enrollment => ({
        id: enrollment._id,
        user: enrollment.userId?.name || 'Unknown User',
        action: `Enrolled in ${enrollment.courseId?.title || 'a course'}`,
        time: enrollment.enrolledAt
      })),
      
      ...recentCompletions.map(completion => ({
        id: completion._id,
        user: completion.userId?.name || 'Unknown User',
        action: `Completed ${completion.courseId?.title || 'a course'}`,
        time: completion.updatedAt
      })),
      
      ...recentContactRequests.map(request => ({
        id: request._id,
        user: request.name,
        action: `Submitted contact request: ${request.subject}`,
        time: request.createdAt
      }))
    ];
    
    // Sort by time (newest first) and limit to 15
    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 15)
      .map(activity => ({
        ...activity,
        time: formatRelativeTime(activity.time)
      }));
  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

// Helper function to format time in a relative way (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
}

// Support ticket routes
// Submit a support ticket (instructor)
app.post('/api/instructor/support/tickets', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can submit support tickets.' });
    }

    const { instructorName, instructorEmail, category, subject, description } = req.body;

    // Validate required fields
    if (!instructorName || !instructorEmail || !category || !subject || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create a new support ticket
    const supportTicket = new SupportTicket({
      instructorName,
      instructorEmail,
      category,
      subject,
      description,
      status: 'open',
      priority: 'medium',
      assignedTo: null
    });

    await supportTicket.save();

    res.status(201).json({
      message: 'Support ticket submitted successfully',
      ticket: supportTicket
    });
  } catch (error) {
    console.error('Error submitting support ticket:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all support tickets (admin only)
app.get('/api/admin/support/tickets', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    console.error('Error getting support tickets:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update support ticket (admin only)
app.put('/api/admin/support/tickets/:id', authenticateToken, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    // Update ticket fields
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo;

    await ticket.save();

    res.json({
      message: 'Support ticket updated successfully',
      ticket
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Notification Routes

// Get user's notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      userId: req.user._id 
    })
    .sort({ timestamp: -1 })
    .limit(10);
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });
    
    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user._id 
      },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Get updated unread count
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });
    
    res.json({
      notification,
      unreadCount
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to update notification' });
  }
});

// Create notification (internal function to be called when events occur)
const createNotification = async (userId, type, courseName, title) => {
  try {
    const notification = new Notification({
      userId,
      type,
      courseName,
      title,
      read: false
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Example: Create notification when new video is uploaded
app.post('/api/courses/:courseId/videos', authenticateToken, async (req, res) => {
  try {
    // ... existing video upload logic ...

    // Create notifications for all enrolled students
    const enrolledStudents = await Enrollment.find({ courseId: req.params.courseId });
    const course = await Course.findById(req.params.courseId);
    
    for (const enrollment of enrolledStudents) {
      await createNotification(
        enrollment.userId,
        'video',
        course.title,
        req.body.title
      );
    }

    res.json({ message: 'Video uploaded successfully' });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ message: 'Failed to upload video' });
  }
});

// Start server
const PORT = process.env.PORT || 5001;

// Add Minio client initialization and list buckets
const minioClient = new Minio.Client({
  endPoint: 'lmsbackendminio-api.llp.trizenventures.com',
  port: 443,
  useSSL: true,
  accessKey: 'b72084650d4c21dd04b801f0',
  secretKey: 'be2339a15ee0544de0796942ba3a85224cc635'
});

// Initialize AWS S3 Client (configured for Minio)
const s3Client = new S3Client({
  endpoint: 'https://lmsbackendminio-api.llp.trizenventures.com',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'b72084650d4c21dd04b801f0',
    secretAccessKey: 'be2339a15ee0544de0796942ba3a85224cc635'
  },
  forcePathStyle: true
});

mdf.listBuckets(minioClient);

// Video upload endpoint with memory storage for processing files from frontend
const videoUpload = multer({ storage: multer.memoryStorage() });

// Video upload endpoint - updated to use AWS SDK with Upload class
app.post('/api/upload/video', authenticateToken, videoUpload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No video file provided' });
  }

  try {
    const fileBuffer = req.file.buffer;
    const originalFilename = req.file.originalname;
    const objectName = `${Date.now()}-${originalFilename}`;
    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    console.log(`Processing file: ${originalFilename}`);
    console.log(`File size: ${fileSizeMB}MB`);

    // Track upload progress
    let lastPercentLogged = 0;
    
    // Set up the upload with the AWS SDK Upload class
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: 'webdevbootcamp1',
        Key: objectName,
        Body: fileBuffer,
        ContentType: req.file.mimetype,
        ContentLength: req.file.size // Explicitly set content length
      }
    });

    // Add progress event listener
    upload.on('httpUploadProgress', (progress) => {
      const percent = Math.floor((progress.loaded / req.file.size) * 100);
      
      // Log every 10% change to avoid console spam
      if (percent >= lastPercentLogged + 10 || percent === 100) {
        lastPercentLogged = percent;
        console.log(`Upload progress: ${percent}%`);
      }
    });

    // Execute the upload
    const result = await upload.done();
    
    // Generate a presigned URL valid for 24 hours using the Minio client
    const url = await new Promise((resolve, reject) => {
      minioClient.presignedUrl('GET', 'webdevbootcamp1', objectName, 24 * 60 * 60, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    });

    // Return response with URL and upload details
    res.json({ 
      url,
      uploadDetails: {
        fileName: originalFilename,
        totalSize: fileSizeMB,
        status: 'completed'
      },
      message: `File uploaded successfully (${fileSizeMB}MB)`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading to storage' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Get all discussions for instructor's courses
app.get('/api/instructor/discussions', authenticateToken, async (req, res) => {
  try {
    // Get all courses where the user is an instructor
    const instructorCourses = await Course.find({ instructorId: req.user.id });
    const courseIds = instructorCourses.map(course => course._id);

    // Get all discussions from instructor's courses
    const discussions = await Discussion.find({ courseId: { $in: courseIds } })
      .populate('userId', 'name displayName')
      .populate('replies.userId', 'name displayName')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 });

    res.json(discussions);
  } catch (error) {
    console.error('Get instructor discussions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all conversations for the current user
app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let conversations = [];
    
    if (userRole === 'instructor') {
      // Get all courses where user is instructor
      const courses = await Course.find({ instructorId: userId });
      
      // Get all enrolled students in these courses
      const enrollments = await UserCourse.find({
        courseId: { $in: courses.map(c => c._id) },
        status: { $in: ['enrolled', 'started', 'completed'] }
      }).populate('userId', 'name role');

      // Get latest message for each student-course pair
      for (const enrollment of enrollments) {
        const latestMessage = await Message.findOne({
          $or: [
            { senderId: userId, receiverId: enrollment.userId._id },
            { senderId: enrollment.userId._id, receiverId: userId }
          ],
          courseId: enrollment.courseId
        })
        .sort({ createdAt: -1 })
        .populate('courseId', 'title');

        if (latestMessage) {
          // Count unread messages
          const unreadCount = await Message.countDocuments({
            senderId: enrollment.userId._id,
            receiverId: userId,
            courseId: enrollment.courseId,
            read: false
          });

          conversations.push({
            partner: enrollment.userId,
            course: latestMessage.courseId,
            lastMessage: latestMessage,
            unreadCount
          });
        }
      }
    } else {
      // For students, get conversations with course instructors
      const enrollments = await UserCourse.find({
        userId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      });

      for (const enrollment of enrollments) {
        const course = await Course.findById(enrollment.courseId)
          .populate('instructorId', 'name role');

        if (course && course.instructorId) {
          const latestMessage = await Message.findOne({
            $or: [
              { senderId: userId, receiverId: course.instructorId._id },
              { senderId: course.instructorId._id, receiverId: userId }
            ],
            courseId: course._id
          })
          .sort({ createdAt: -1 });

          if (latestMessage) {
            // Count unread messages
            const unreadCount = await Message.countDocuments({
              senderId: course.instructorId._id,
              receiverId: userId,
              courseId: course._id,
              read: false
            });

            conversations.push({
              partner: course.instructorId,
              course: {
                _id: course._id,
                title: course.title
              },
              lastMessage: latestMessage,
              unreadCount
            });
          }
        }
      }
    }

    // Sort conversations by latest message
    conversations.sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages between two users for a specific course
app.get('/api/messages/:partnerId/:courseId', authenticateToken, async (req, res) => {
  try {
    const { partnerId, courseId } = req.params;
    const userId = req.user.id;

    // Verify the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify the user has access to these messages
    const isInstructor = course.instructorId.toString() === userId;
    const isStudent = await UserCourse.findOne({
      userId,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!isInstructor && !isStudent) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }

    // Get messages
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId }
      ],
      courseId
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .populate('courseId', 'title');

    // Mark messages as read
    await Message.updateMany({
      senderId: partnerId,
      receiverId: userId,
      courseId,
      read: false
    }, {
      read: true
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Message Routes
// Send a new message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;
    const senderId = req.user.id;

    console.log('Attempting to send message:', {
      senderId,
      receiverId,
      courseId,
      contentLength: content?.length
    });

    // Validate required fields
    if (!receiverId || !courseId || !content?.trim()) {
      console.log('Missing required fields:', { receiverId, courseId, content });
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          receiverId: !receiverId ? 'Receiver ID is required' : null,
          courseId: !courseId ? 'Course ID is required' : null,
          content: !content ? 'Message content is required' : null
        }
      });
    }

    // Verify the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      console.log('Course not found:', courseId);
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify sender has access to send messages in this course
    const isInstructor = course.instructorId.toString() === senderId;
    const isStudent = await UserCourse.findOne({
      userId: senderId,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    console.log('Sender verification:', {
      isInstructor,
      isStudent: !!isStudent,
      courseInstructorId: course.instructorId,
      senderId
    });

    if (!isInstructor && !isStudent) {
      return res.status(403).json({ message: 'Not authorized to send messages in this course' });
    }

    // Verify receiver exists and has access to the course
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      console.log('Receiver not found:', receiverId);
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const receiverIsInstructor = course.instructorId.toString() === receiverId;
    const receiverIsStudent = await UserCourse.findOne({
      userId: receiverId,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    console.log('Receiver verification:', {
      receiverIsInstructor,
      receiverIsStudent: !!receiverIsStudent,
      receiverId
    });

    if (!receiverIsInstructor && !receiverIsStudent) {
      return res.status(403).json({ message: 'Receiver does not have access to this course' });
    }

    // Create and save the message
    const message = new Message({
      senderId,
      receiverId,
      courseId,
      content: content.trim(),
      read: false,
      createdAt: new Date()
    });

    await message.save();

    // Populate the message with sender and receiver details
    await message.populate([
      { path: 'senderId', select: 'name role' },
      { path: 'receiverId', select: 'name role' },
      { path: 'courseId', select: 'title' }
    ]);

    console.log('Message created successfully:', {
      messageId: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      courseId: message.courseId
    });

    // Create notification for receiver
    try {
      const notification = new Notification({
        userId: receiverId,
        type: 'message',
        title: 'New Message',
        message: `You have a new message from ${req.user.name}`,
        courseId: courseId,
        link: `/messages/${senderId}/${courseId}`,
        read: false,
        timestamp: new Date()
      });

      await notification.save();
      console.log('Notification created for message:', notification._id);
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Continue with the response even if notification creation fails
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });

    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({ 
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get conversations for a user (either instructor or student)
app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
  try {
    // Get all messages where user is either sender or receiver
    const messages = await Message.find({
      $or: [
        { senderId: req.user.id },
        { receiverId: req.user.id }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .populate('courseId', 'title');

    // Group messages by conversation partner
    const conversations = messages.reduce((acc, message) => {
      const partnerId = message.senderId._id.toString() === req.user.id ? 
        message.receiverId._id : message.senderId._id;
      
      if (!acc[partnerId]) {
        acc[partnerId] = {
          partner: message.senderId._id.toString() === req.user.id ? 
            message.receiverId : message.senderId,
          course: message.courseId,
          lastMessage: message,
          unreadCount: message.receiverId._id.toString() === req.user.id && !message.read ? 1 : 0
        };
      } else {
        // Update unread count
        if (message.receiverId._id.toString() === req.user.id && !message.read) {
          acc[partnerId].unreadCount++;
        }
      }
      return acc;
    }, {});

    res.json(Object.values(conversations));
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages between two users for a specific course
app.get('/api/messages/:partnerId/:courseId', authenticateToken, async (req, res) => {
  try {
    const { partnerId, courseId } = req.params;

    const messages = await Message.find({
      courseId,
      $or: [
        { senderId: req.user.id, receiverId: partnerId },
        { senderId: partnerId, receiverId: req.user.id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role');

    // Mark messages as read
    await Message.updateMany({
      courseId,
      senderId: partnerId,
      receiverId: req.user.id,
      read: false
    }, {
      read: true
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a new message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;

    // Validate required fields
    if (!receiverId || !courseId || !content) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          receiverId: !receiverId ? 'Receiver ID is required' : null,
          courseId: !courseId ? 'Course ID is required' : null,
          content: !content ? 'Message content is required' : null
        }
      });
    }

    // Verify that the users are connected through the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if sender is instructor of the course or student enrolled in the course
    const isInstructor = course.instructorId.toString() === req.user.id;
    const isStudent = await UserCourse.findOne({
      userId: req.user.id,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!isInstructor && !isStudent) {
      return res.status(403).json({ message: 'Not authorized to send messages in this course' });
    }

    // Verify receiver exists and is connected to the course
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // If sender is student, verify receiver is course instructor
    if (!isInstructor) {
      if (receiver._id.toString() !== course.instructorId.toString()) {
        return res.status(403).json({ message: 'Students can only message course instructors' });
      }
    }

    // If sender is instructor, verify receiver is enrolled in the course
    if (isInstructor) {
      const receiverEnrollment = await UserCourse.findOne({
        userId: receiverId,
        courseId,
        status: { $in: ['enrolled', 'started', 'completed'] }
      });

      if (!receiverEnrollment) {
        return res.status(403).json({ message: 'Receiver is not enrolled in this course' });
      }
    }

    // Create and save the message
    const message = new Message({
      senderId: req.user.id,
      receiverId,
      courseId,
      content: content.trim(),
      read: false,
      createdAt: new Date()
    });

    await message.save();
    await message.populate('senderId', 'name role');
    await message.populate('receiverId', 'name role');

    // Create notification if sender is instructor
    if (isInstructor) {
      const notification = new Notification({
        userId: receiverId,
        type: 'message',
        title: 'New Message from Instructor',
        message: `${req.user.name} sent you a message in ${course.title}`,
        courseId: course._id,
        link: `/messages/${req.user.id}/${course._id}`,
        read: false,
        timestamp: new Date()
      });

      await notification.save();
    }

    // Log successful message creation
    console.log('Message sent successfully:', {
      messageId: message._id,
      senderId: req.user.id,
      receiverId,
      courseId,
      isInstructor
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });

    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({ 
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

    // Get enrolled students for instructor
app.get('/api/instructor/students', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all courses where user is instructor
    const courses = await Course.find({ instructorId: req.user.id });
    
    // Get all enrollments for these courses
    const enrollments = await UserCourse.find({
      courseId: { $in: courses.map(c => c._id) },
      status: { $in: ['enrolled', 'started', 'completed'] }
    })
    .populate('userId', 'name email createdAt')
    .populate('courseId', 'title');

    // Group students by course
    const studentsByCourse = enrollments.reduce((acc, enrollment) => {
      const courseId = enrollment.courseId._id.toString();
      if (!acc[courseId]) {
        acc[courseId] = {
          id: enrollment.courseId._id,
          title: enrollment.courseId.title,
          students: []
        };
      }
      
      // Calculate last active time (for demo, using random recent times)
      const lastActiveOptions = ['Just now', '5 minutes ago', '1 hour ago', 'Today', 'Yesterday', '3 days ago', '1 week ago'];
      const randomLastActive = lastActiveOptions[Math.floor(Math.random() * lastActiveOptions.length)];
      
      acc[courseId].students.push({
        id: enrollment.userId._id,
        name: enrollment.userId.name,
        email: enrollment.userId.email,
        enrolledDate: enrollment.enrolledAt || enrollment.createdAt,
        progress: enrollment.progress || 0,
        status: enrollment.status,
        lastActive: randomLastActive,
        courseTitle: enrollment.courseId.title // Add course title for all students view
      });
      return acc;
    }, {});

    res.json(Object.values(studentsByCourse));
  } catch (error) {
    console.error('Get enrolled students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a course (instructor only)
app.delete('/api/instructor/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied. Only instructors can delete courses.' });
    }

    const { courseId } = req.params;
    
    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify the instructor owns this course
    if (course.instructorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own courses' });
    }

    // Delete all enrollments for this course
    await UserCourse.deleteMany({ courseId: courseId });

    // Delete all notifications related to this course
    await Notification.deleteMany({ courseId: courseId });

    // Delete all discussions related to this course
    await Discussion.deleteMany({ courseId: courseId });

    // Remove course from instructor's profile
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { 'instructorProfile.courses': courseId }
    });

    // Finally, delete the course
    await Course.findByIdAndDelete(courseId);

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's quiz submissions
app.get('/api/student/quiz-submissions', authenticateToken, async (req, res) => {
  try {
    const submissions = await QuizSubmission.find({ 
      studentId: req.user.id 
    }).sort({ submittedDate: -1 });

    res.json({ data: submissions });
  } catch (error) {
    console.error('Error fetching quiz submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's enrolled courses with progress
app.get('/api/student/enrolled-courses', authenticateToken, async (req, res) => {
  try {
    // Get all enrollments for the student
    const enrollments = await UserCourse.find({
      userId: req.user.id,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    // Get course details for each enrollment
    const enrolledCourses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await Course.findById(enrollment.courseId);
        if (!course) return null;

        return {
          _id: course._id,
          title: course.title,
          description: course.description,
          instructor: course.instructor,
          roadmap: course.roadmap,
          completedDays: enrollment.completedDays || [],
          progress: enrollment.progress,
          status: enrollment.status
        };
      })
    );

    // Filter out null values (courses that might have been deleted)
    const validCourses = enrolledCourses.filter(course => course !== null);

    res.json({ data: validCourses });
  } catch (error) {
    console.error('Error fetching enrolled courses:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get course instructors for student
app.get('/api/student/instructors', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching instructors for student:', req.user.id);
    
    // Get all courses where user is enrolled
    const enrollments = await UserCourse.find({
      userId: req.user.id,
      status: { $in: ['enrolled', 'started', 'completed'] }
    }).lean();

    console.log(`Found ${enrollments?.length || 0} enrollments for student`);

    if (!enrollments || enrollments.length === 0) {
      return res.json([]);
    }

    const courseIds = enrollments.map(e => e.courseId);

    // Get courses with instructors
    const courses = await Course.find({
      _id: { $in: courseIds }
    })
    .populate('instructorId', 'name email')
    .lean();

    console.log(`Found ${courses?.length || 0} courses with instructors`);

    // Filter out courses with no instructor and map to required format
    const instructorsByCourse = courses
      .filter(course => course && course.instructorId)
      .map(course => ({
        courseId: course._id,
        courseTitle: course.title || 'Untitled Course',
        instructor: {
          id: course.instructorId._id,
          name: course.instructorId.name || 'Unknown Instructor',
          email: course.instructorId.email || 'no-email'
        }
      }));

    console.log(`Returning ${instructorsByCourse.length} course-instructor mappings`);
    res.json(instructorsByCourse);

  } catch (error) {
    console.error('Error in /api/student/instructors:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({ 
      message: 'Failed to fetch instructor information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Mark all notifications as read
app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});
