import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection
const MONGODB_URL = process.env.MongoDB_URL || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function comprehensiveBugAnalysis() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('Connected to MongoDB');

    console.log('\n🔍 COMPREHENSIVE BUG ANALYSIS');
    console.log('='.repeat(80));

    const bugs = [];

    // 1. Quiz Submission Issues
    console.log('\n📝 ANALYZING QUIZ SUBMISSIONS...');
    
    const quizSubmissions = await mongoose.connection.db.collection('quizsubmissions').find({}).toArray();
    
    // Check for inconsistent userId types
    const stringUserIds = quizSubmissions.filter(sub => typeof sub.userId === 'string');
    const objectIdUserIds = quizSubmissions.filter(sub => sub.userId instanceof mongoose.Types.ObjectId);
    const hasStudentId = quizSubmissions.filter(sub => sub.studentId);
    
    if (stringUserIds.length > 0) {
      bugs.push({
        category: 'Quiz Submissions',
        severity: 'HIGH',
        issue: 'String userId fields found',
        count: stringUserIds.length,
        description: 'Some quiz submissions have string userId instead of ObjectId'
      });
    }
    
    if (hasStudentId.length > 0) {
      bugs.push({
        category: 'Quiz Submissions',
        severity: 'HIGH',
        issue: 'studentId field still exists',
        count: hasStudentId.length,
        description: 'studentId field should be removed for consistency'
      });
    }

    // Check for invalid scores
    const invalidScores = quizSubmissions.filter(sub => sub.score < 0 || sub.score > 100);
    if (invalidScores.length > 0) {
      bugs.push({
        category: 'Quiz Submissions',
        severity: 'MEDIUM',
        issue: 'Invalid quiz scores',
        count: invalidScores.length,
        description: 'Quiz scores outside valid range (0-100)'
      });
    }

    // 2. Course Progress Issues
    console.log('\n📚 ANALYZING COURSE PROGRESS...');
    
    const userCourses = await mongoose.connection.db.collection('usercourses').find({}).toArray();
    
    // Check for progress calculation inconsistencies
    const progressIssues = [];
    for (const userCourse of userCourses) {
      if (userCourse.completedDays && userCourse.completedDays.length > 0) {
        const course = await mongoose.connection.db.collection('courses').findOne({ 
          courseUrl: userCourse.courseUrl 
        });
        
        if (course && course.roadmap) {
          const expectedProgress = Math.round((userCourse.completedDays.length / course.roadmap.length) * 100);
          if (userCourse.progress !== expectedProgress) {
            progressIssues.push({
              courseUrl: userCourse.courseUrl,
              actual: userCourse.progress,
              expected: expectedProgress,
              completedDays: userCourse.completedDays.length,
              totalDays: course.roadmap.length
            });
          }
        }
      }
    }
    
    if (progressIssues.length > 0) {
      bugs.push({
        category: 'Course Progress',
        severity: 'HIGH',
        issue: 'Incorrect progress calculations',
        count: progressIssues.length,
        description: 'Course progress percentages don\'t match completed days',
        details: progressIssues.slice(0, 5) // Show first 5 examples
      });
    }

    // 3. Enrollment Issues
    console.log('\n🎓 ANALYZING ENROLLMENTS...');
    
    const enrollmentRequests = await mongoose.connection.db.collection('enrollmentrequests').find({}).toArray();
    
    // Check for duplicate transaction IDs
    const transactionIds = enrollmentRequests.map(req => req.transactionId);
    const duplicateTransactionIds = transactionIds.filter((id, index) => transactionIds.indexOf(id) !== index);
    
    if (duplicateTransactionIds.length > 0) {
      bugs.push({
        category: 'Enrollment',
        severity: 'HIGH',
        issue: 'Duplicate transaction IDs',
        count: duplicateTransactionIds.length,
        description: 'Multiple enrollment requests with same transaction ID'
      });
    }

    // Check for orphaned enrollment requests
    const orphanedRequests = [];
    for (const request of enrollmentRequests) {
      const user = await mongoose.connection.db.collection('users').findOne({ _id: request.userId });
      const course = await mongoose.connection.db.collection('courses').findOne({ _id: request.courseId });
      
      if (!user || !course) {
        orphanedRequests.push({
          requestId: request._id,
          userId: request.userId,
          courseId: request.courseId,
          userExists: !!user,
          courseExists: !!course
        });
      }
    }
    
    if (orphanedRequests.length > 0) {
      bugs.push({
        category: 'Enrollment',
        severity: 'MEDIUM',
        issue: 'Orphaned enrollment requests',
        count: orphanedRequests.length,
        description: 'Enrollment requests referencing non-existent users or courses'
      });
    }

    // 4. User Data Issues
    console.log('\n👤 ANALYZING USER DATA...');
    
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    
    // Check for duplicate emails
    const emails = users.map(user => user.email);
    const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
    
    if (duplicateEmails.length > 0) {
      bugs.push({
        category: 'User Management',
        severity: 'HIGH',
        issue: 'Duplicate email addresses',
        count: duplicateEmails.length,
        description: 'Multiple users with same email address'
      });
    }

    // Check for invalid user roles
    const invalidRoles = users.filter(user => !['student', 'admin', 'instructor'].includes(user.role));
    if (invalidRoles.length > 0) {
      bugs.push({
        category: 'User Management',
        severity: 'MEDIUM',
        issue: 'Invalid user roles',
        count: invalidRoles.length,
        description: 'Users with roles not in allowed list'
      });
    }

    // 5. Course Data Issues
    console.log('\n📖 ANALYZING COURSE DATA...');
    
    const courses = await mongoose.connection.db.collection('courses').find({}).toArray();
    
    // Check for courses without roadmap
    const coursesWithoutRoadmap = courses.filter(course => !course.roadmap || course.roadmap.length === 0);
    if (coursesWithoutRoadmap.length > 0) {
      bugs.push({
        category: 'Course Management',
        severity: 'MEDIUM',
        issue: 'Courses without roadmap',
        count: coursesWithoutRoadmap.length,
        description: 'Courses missing roadmap data'
      });
    }

    // Check for invalid course URLs
    const invalidCourseUrls = courses.filter(course => !course.courseUrl || course.courseUrl.length < 5);
    if (invalidCourseUrls.length > 0) {
      bugs.push({
        category: 'Course Management',
        severity: 'LOW',
        issue: 'Invalid course URLs',
        count: invalidCourseUrls.length,
        description: 'Courses with missing or too short URLs'
      });
    }

    // 6. Review System Issues
    console.log('\n⭐ ANALYZING REVIEW SYSTEM...');
    
    const reviews = await mongoose.connection.db.collection('reviews').find({}).toArray();
    
    // Check for invalid ratings
    const invalidRatings = reviews.filter(review => review.rating < 1 || review.rating > 5);
    if (invalidRatings.length > 0) {
      bugs.push({
        category: 'Review System',
        severity: 'MEDIUM',
        issue: 'Invalid review ratings',
        count: invalidRatings.length,
        description: 'Reviews with ratings outside 1-5 range'
      });
    }

    // Check for duplicate reviews
    const reviewKeys = reviews.map(review => `${review.courseId}-${review.studentId}`);
    const duplicateReviews = reviewKeys.filter((key, index) => reviewKeys.indexOf(key) !== index);
    if (duplicateReviews.length > 0) {
      bugs.push({
        category: 'Review System',
        severity: 'HIGH',
        issue: 'Duplicate reviews',
        count: duplicateReviews.length,
        description: 'Multiple reviews from same student for same course'
      });
    }

    // 7. Message System Issues
    console.log('\n💬 ANALYZING MESSAGE SYSTEM...');
    
    const messages = await mongoose.connection.db.collection('messages').find({}).toArray();
    
    // Check for orphaned messages
    const orphanedMessages = [];
    for (const message of messages) {
      const sender = await mongoose.connection.db.collection('users').findOne({ _id: message.senderId });
      const receiver = await mongoose.connection.db.collection('users').findOne({ _id: message.receiverId });
      const course = await mongoose.connection.db.collection('courses').findOne({ _id: message.courseId });
      
      if (!sender || !receiver || !course) {
        orphanedMessages.push({
          messageId: message._id,
          senderExists: !!sender,
          receiverExists: !!receiver,
          courseExists: !!course
        });
      }
    }
    
    if (orphanedMessages.length > 0) {
      bugs.push({
        category: 'Message System',
        severity: 'MEDIUM',
        issue: 'Orphaned messages',
        count: orphanedMessages.length,
        description: 'Messages referencing non-existent users or courses'
      });
    }

    // 8. Notification System Issues
    console.log('\n🔔 ANALYZING NOTIFICATION SYSTEM...');
    
    const notifications = await mongoose.connection.db.collection('notifications').find({}).toArray();
    
    // Check for orphaned notifications
    const orphanedNotifications = [];
    for (const notification of notifications) {
      const user = await mongoose.connection.db.collection('users').findOne({ _id: notification.userId });
      if (!user) {
        orphanedNotifications.push({
          notificationId: notification._id,
          userId: notification.userId
        });
      }
    }
    
    if (orphanedNotifications.length > 0) {
      bugs.push({
        category: 'Notification System',
        severity: 'LOW',
        issue: 'Orphaned notifications',
        count: orphanedNotifications.length,
        description: 'Notifications for non-existent users'
      });
    }

    // 9. Discussion System Issues
    console.log('\n💭 ANALYZING DISCUSSION SYSTEM...');
    
    const discussions = await mongoose.connection.db.collection('discussions').find({}).toArray();
    
    // Check for orphaned discussions
    const orphanedDiscussions = [];
    for (const discussion of discussions) {
      const user = await mongoose.connection.db.collection('users').findOne({ _id: discussion.userId });
      const course = await mongoose.connection.db.collection('courses').findOne({ _id: discussion.courseId });
      
      if (!user || !course) {
        orphanedDiscussions.push({
          discussionId: discussion._id,
          userExists: !!user,
          courseExists: !!course
        });
      }
    }
    
    if (orphanedDiscussions.length > 0) {
      bugs.push({
        category: 'Discussion System',
        severity: 'MEDIUM',
        issue: 'Orphaned discussions',
        count: orphanedDiscussions.length,
        description: 'Discussions referencing non-existent users or courses'
      });
    }

    // 10. Data Consistency Issues
    console.log('\n🔗 ANALYZING DATA CONSISTENCY...');
    
    // Check for inconsistent field usage
    const inconsistentFields = [];
    
    // Check if any collections use different field names for same concept
    const userIdFields = {
      'quizsubmissions': quizSubmissions.map(q => typeof q.userId),
      'usercourses': userCourses.map(uc => typeof uc.userId),
      'enrollmentrequests': enrollmentRequests.map(er => typeof er.userId),
      'reviews': reviews.map(r => typeof r.studentId),
      'messages': messages.map(m => typeof m.senderId),
      'notifications': notifications.map(n => typeof n.userId),
      'discussions': discussions.map(d => typeof d.userId)
    };
    
    for (const [collection, types] of Object.entries(userIdFields)) {
      const uniqueTypes = [...new Set(types)];
      if (uniqueTypes.length > 1) {
        inconsistentFields.push({
          collection,
          types: uniqueTypes,
          description: 'Inconsistent ID field types'
        });
      }
    }
    
    if (inconsistentFields.length > 0) {
      bugs.push({
        category: 'Data Consistency',
        severity: 'HIGH',
        issue: 'Inconsistent field types',
        count: inconsistentFields.length,
        description: 'Different collections use different data types for same concept',
        details: inconsistentFields
      });
    }

    // Generate Summary Report
    console.log('\n📊 BUG ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    const severityCounts = {
      HIGH: bugs.filter(bug => bug.severity === 'HIGH').length,
      MEDIUM: bugs.filter(bug => bug.severity === 'MEDIUM').length,
      LOW: bugs.filter(bug => bug.severity === 'LOW').length
    };
    
    console.log(`Total Issues Found: ${bugs.length}`);
    console.log(`High Priority: ${severityCounts.HIGH}`);
    console.log(`Medium Priority: ${severityCounts.MEDIUM}`);
    console.log(`Low Priority: ${severityCounts.LOW}`);
    
    console.log('\n🔴 HIGH PRIORITY ISSUES:');
    bugs.filter(bug => bug.severity === 'HIGH').forEach(bug => {
      console.log(`• ${bug.category}: ${bug.issue} (${bug.count} instances)`);
    });
    
    console.log('\n🟡 MEDIUM PRIORITY ISSUES:');
    bugs.filter(bug => bug.severity === 'MEDIUM').forEach(bug => {
      console.log(`• ${bug.category}: ${bug.issue} (${bug.count} instances)`);
    });
    
    console.log('\n🟢 LOW PRIORITY ISSUES:');
    bugs.filter(bug => bug.severity === 'LOW').forEach(bug => {
      console.log(`• ${bug.category}: ${bug.issue} (${bug.count} instances)`);
    });

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      totalIssues: bugs.length,
      severityBreakdown: severityCounts,
      issues: bugs
    };
    
    console.log('\n📄 Detailed report saved to bugs_analysis_report.json');
    
    return report;

  } catch (error) {
    console.error('Error in comprehensive bug analysis:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

comprehensiveBugAnalysis();
