const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  // Personal Info
  fullName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true, lowercase: true },
  phone:     { type: String, required: true, trim: true },
  city:      { type: String, default: '' },

  // Job Info
  position:    { type: String, required: true, trim: true },
  department: {
    type: String,
    enum: ['account_management', 'finance', 'hrm', 'tech', 'marketing', 'operations', 'other'],
    default: 'other'
  },
  experience:  { type: String, default: '' }, // e.g. "2 years"
  education:   { type: String, default: '' },
  skills:      [String],

  // Application
  coverLetter: { type: String, default: '' },
  cvUrl:       { type: String, default: '' }, // link ya file path

  status: {
    type: String,
    enum: ['received', 'under_review', 'shortlisted', 'interviewed', 'hired', 'rejected'],
    default: 'received'
  },
  adminNotes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
