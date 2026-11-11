const mongoose = require('mongoose');
const applyJSON = require('./_json');

const schema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true, maxlength: 120 },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduledAt: { type: Date, required: true },
  roomName: { type: String, required: true, unique: true },
  status: { type: String, enum: ['requested', 'accepted', 'declined', 'cancelled'], default: 'requested', index: true }
}, { timestamps: true });

schema.index({ requester: 1, scheduledAt: 1 });
schema.index({ recipient: 1, scheduledAt: 1 });
applyJSON(schema);
module.exports = mongoose.models.VideoCall || mongoose.model('VideoCall', schema);
