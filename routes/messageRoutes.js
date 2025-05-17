const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Course = require('../models/Course');
const Notification = require('../models/Notification');
const { isAuthenticated } = require('../middleware/auth');
const mongoose = require('mongoose');

// Get all conversations for the current user
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all courses where the user is either an instructor or a student
    const courses = await Course.find({
      $or: [
        { instructorId: userId },
        { 'students.userId': userId }
      ]
    });

    // Get all messages for these courses
    const messages = await Message.find({
      courseId: { $in: courses.map(c => c._id) },
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .populate('courseId', 'title');

    // Group messages by partner and course
    const conversationsMap = new Map();
    
    for (const message of messages) {
      const partner = message.senderId._id.toString() === userId.toString() 
        ? message.receiverId 
        : message.senderId;
      
      const key = `${partner._id}-${message.courseId._id}`;
      
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          partner: {
            _id: partner._id,
            name: partner.name,
            role: partner.role
          },
          course: {
            _id: message.courseId._id,
            title: message.courseId.title
          },
          lastMessage: message,
          unreadCount: message.receiverId._id.toString() === userId.toString() && !message.read ? 1 : 0
        });
      } else {
        const conv = conversationsMap.get(key);
        if (message.receiverId._id.toString() === userId.toString() && !message.read) {
          conv.unreadCount++;
        }
      }
    }

    res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Get messages between current user and a partner in a course
router.get('/:partnerId/:courseId', isAuthenticated, async (req, res) => {
  try {
    const { partnerId, courseId } = req.params;
    const userId = req.user._id;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(partnerId) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid partner or course ID' });
    }

    // Find messages where user is either sender or receiver
    const messages = await Message.find({
      courseId,
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .populate('courseId', 'title');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Get messages for a specific instructor
router.get('/instructor/:instructorId', isAuthenticated, async (req, res) => {
  try {
    const { instructorId } = req.params;
    const userId = req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({ message: 'Invalid instructor ID' });
    }

    // Find messages where user is either sender or receiver
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: instructorId },
        { senderId: instructorId, receiverId: userId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role')
    .populate('courseId', 'title');

    res.json(messages);
  } catch (error) {
    console.error('Error fetching instructor messages:', error);
    res.status(500).json({ message: 'Error fetching instructor messages' });
  }
});

// Send a message to an instructor
router.post('/instructor/:instructorId', isAuthenticated, async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { content } = req.body;
    const senderId = req.user._id;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
      return res.status(400).json({ message: 'Invalid instructor ID' });
    }

    // Check if sender and instructor exist
    const [sender, instructor] = await Promise.all([
      User.findById(senderId),
      User.findById(instructorId)
    ]);

    if (!sender || !instructor) {
      return res.status(400).json({ message: 'Invalid sender or instructor' });
    }

    // Verify instructor role
    if (instructor.role !== 'instructor') {
      return res.status(403).json({ message: 'Recipient must be an instructor' });
    }

    // Find a course where both users are involved
    const course = await Course.findOne({
      instructorId: instructorId,
      'students.userId': senderId
    });

    if (!course) {
      return res.status(403).json({ message: 'You can only message instructors of your enrolled courses' });
    }

    // Create and save the message
    const message = new Message({
      senderId,
      receiverId: instructorId,
      courseId: course._id,
      content: content.trim()
    });

    await message.save();

    // Create notification if sender is instructor
    if (sender.role === 'instructor') {
      const notification = new Notification({
        userId: instructorId,
        type: 'message',
        title: `New message from ${sender.name}`,
        description: content.length > 50 ? content.substring(0, 47) + '...' : content,
        data: {
          messageId: message._id,
          senderId: senderId,
          courseId: course._id
        }
      });
      await notification.save();
    }

    // Populate the saved message
    await message.populate([
      { path: 'senderId', select: 'name role' },
      { path: 'receiverId', select: 'name role' },
      { path: 'courseId', select: 'title' }
    ]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending instructor message:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error sending instructor message' });
  }
});

// Send a new message
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;
    const senderId = req.user._id;

    // Validate required fields
    if (!receiverId || !courseId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(receiverId) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid receiver or course ID' });
    }

    // Check if sender and receiver exist
    const [sender, receiver, course] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
      Course.findById(courseId)
    ]);

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'Invalid sender or receiver' });
    }

    if (!course) {
      return res.status(400).json({ message: 'Course not found' });
    }

    // Validate messaging permissions
    if (sender.role === 'student' && receiver.role === 'student') {
      return res.status(403).json({ message: 'Students cannot message other students' });
    }

    // Check if users are part of the course
    const isInstructorInCourse = course.instructorId.toString() === senderId.toString() || 
                                course.instructorId.toString() === receiverId.toString();
    const isStudentInCourse = course.students.some(s => 
      s.userId.toString() === senderId.toString() || 
      s.userId.toString() === receiverId.toString()
    );

    if (!isInstructorInCourse || !isStudentInCourse) {
      return res.status(403).json({ 
        message: 'Both users must be part of the course to exchange messages' 
      });
    }

    // Create and save the message
    const message = new Message({
      senderId,
      receiverId,
      courseId,
      content: content.trim()
    });

    await message.save();

    // Create notification if sender is instructor
    if (sender.role === 'instructor') {
      const notification = new Notification({
        userId: receiverId,
        type: 'message',
        title: `New message from ${sender.name}`,
        description: content.length > 50 ? content.substring(0, 47) + '...' : content,
        data: {
          messageId: message._id,
          senderId: senderId,
          courseId: courseId
        }
      });
      await notification.save();
    }

    // Populate the saved message
    await message.populate([
      { path: 'senderId', select: 'name role' },
      { path: 'receiverId', select: 'name role' },
      { path: 'courseId', select: 'title' }
    ]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Mark messages as read
router.post('/:partnerId/read', isAuthenticated, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user._id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ message: 'Invalid partner ID' });
    }

    // Update all unread messages from partner to user
    await Message.updateMany(
      {
        senderId: partnerId,
        receiverId: userId,
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

module.exports = router; 