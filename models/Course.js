import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String },
  duration: { type: Number }, // in minutes
  resources: [{ type: String }]
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  lessons: [lessonSchema]
});

const mcqOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true }
});

const mcqQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [mcqOptionSchema],
  explanation: { type: String }
});

const roadmapDaySchema = new mongoose.Schema({
  day: { type: Number, required: true },
  topics: { type: String, required: true },
  video: { type: String, required: true },
  transcript: { type: String },
  notes: { type: String },
  mcqs: [mcqQuestionSchema] // Add MCQ questions to each day
});

const courseSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  longDescription: { type: String },
  instructor: { type: String, required: true },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseUrl: {
    type: String,
    unique: true
  },
  duration: { type: String, required: true },
  rating: { type: Number, default: 0 },
  students: { type: Number, default: 0 },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Beginner to Intermediate'],
    required: true
  },
  category: { type: String, required: true },
  language: { type: String, required: true }, // Programming language or course language
  skills: [{ type: String }],
  courses: [{
    title: { type: String },
    details: { type: String }
  }],
  testimonials: [{
    text: { type: String },
    author: { type: String },
    since: { type: String }
  }],
  modules: [moduleSchema],
  reviews: [reviewSchema],
  roadmap: [roadmapDaySchema],
  courseAccess: { type: Boolean, default: true },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate courseUrl
courseSchema.pre('save', async function(next) {
  if (this.isNew || !this.courseUrl) {
    // Get last 5 characters of course ID
    const courseIdSuffix = this._id.toString().slice(-5);
    
    // Convert course name to URL-friendly format
    const courseNameSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    // Get instructor's userId
    const instructor = await mongoose.model('User').findById(this.instructorId);
    const instructorUserId = instructor ? instructor.userId : 'unknown';
    
    // Combine all parts to create courseUrl
    this.courseUrl = `${courseIdSuffix}-${courseNameSlug}-${instructorUserId}`;
  }
  next();
});

export default mongoose.model('Course', courseSchema);
