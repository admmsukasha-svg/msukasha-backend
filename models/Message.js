const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  phone:   { type: String, default: '' },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['contact', 'support', 'complaint', 'inquiry'],
    default: 'contact'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'closed'],
    default: 'unread'
  },
  // Agar logged in user ne bheja
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['User', 'Seller']
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
