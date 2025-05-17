const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  instructorName: {
    type: String,
    required: true,
  },
  instructorEmail: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['technical', 'content', 'students', 'payments', 'account', 'other']
  },
  subject: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'closed'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema); 