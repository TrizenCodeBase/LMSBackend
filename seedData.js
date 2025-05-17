
const Course = require('./models/Course');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const courseData = [
  {
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    title: "Machine Learning Fundamentals",
    description: "Learn the foundations of machine learning algorithms and their practical applications",
    longDescription: "This comprehensive course teaches you the core concepts of machine learning from the ground up. You'll master supervised and unsupervised learning techniques, neural networks, and deep learning fundamentals. Through hands-on projects, you'll implement algorithms for real-world data analysis and prediction tasks.",
    instructor: "Dr. Ada Johnson",
    duration: "36 hours",
    rating: 4.8,
    students: 8745,
    level: "Beginner",
    category: "ai",
    skills: ["Python", "TensorFlow", "Neural Networks", "Data Analysis", "Statistical Modeling", "Supervised Learning", "Unsupervised Learning", "Regression Analysis"],
    courses: [
      {
        title: "Introduction to Machine Learning",
        details: "Course 1 • 12 hours • 4.9 ★ (623 ratings)"
      },
      {
        title: "Neural Networks and Deep Learning",
        details: "Course 2 • 14 hours • 4.7 ★ (512 ratings)"
      },
      {
        title: "Applied Machine Learning Projects",
        details: "Course 3 • 10 hours • 4.8 ★ (478 ratings)"
      }
    ],
    testimonials: [
      {
        text: "This course gave me the skills I needed to transition into a machine learning role at my company.",
        author: "Michael T.",
        since: "Learner since 2022"
      },
      {
        text: "Clear explanations of complex concepts. The projects really helped cement my understanding.",
        author: "Sarah J.",
        since: "Learner since 2021"
      }
    ]
  },
  {
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    title: "AWS Cloud Practitioner",
    description: "Master AWS fundamentals and prepare for the Cloud Practitioner certification",
    longDescription: "Prepare for the AWS Certified Cloud Practitioner exam with this thorough introduction to Amazon Web Services. Learn about AWS core services, security, architecture, pricing, and support. By the end of this course, you'll understand cloud concepts and how to implement them using AWS services.",
    instructor: "Raj Patel",
    duration: "30 hours",
    rating: 4.9,
    students: 6521,
    level: "Beginner",
    category: "cloud",
    skills: ["Amazon Web Services (AWS)", "Cloud Computing", "EC2", "S3", "RDS", "IAM", "CloudFormation", "Lambda"],
    courses: [
      {
        title: "AWS Core Services",
        details: "Course 1 • 10 hours • 4.9 ★ (756 ratings)"
      },
      {
        title: "AWS Security and Compliance",
        details: "Course 2 • 8 hours • 4.8 ★ (521 ratings)"
      },
      {
        title: "AWS Certification Exam Preparation",
        details: "Course 3 • 12 hours • 4.9 ★ (843 ratings)"
      }
    ],
    testimonials: [
      {
        text: "Passed my AWS certification on the first try thanks to this course!",
        author: "Diego M.",
        since: "Learner since 2023"
      },
      {
        text: "Great balance of theory and hands-on practice with AWS services.",
        author: "Priya S.",
        since: "Learner since 2022"
      }
    ]
  },
  // Add more courses from courseData in courseService.ts
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MongoDB_URL);
    console.log('Connected to MongoDB to seed data');
    
    // Clear existing data
    await Course.deleteMany({});
    console.log('Cleared existing courses');
    
    // Insert new data
    await Course.insertMany(courseData);
    console.log('Courses successfully seeded');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
