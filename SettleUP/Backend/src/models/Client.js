const mongoose = require('mongoose');
const validator = require('validator');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  companyName: {
    type: String,
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'inactive'],
    default: 'pending'
  },
  region: {
    timezone: String,
    currency: String,
    country: String
  },
  paymentSchedules: [{
    description: String,
    amount: Number,
    currency: String,
    dueDate: Date,
    frequency: {
      type: String,
      enum: ['one-time', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending'
    },
    lastNotified: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Client', clientSchema);