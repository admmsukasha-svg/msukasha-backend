const crypto = require('crypto');
const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const VideoCall = require('../models/VideoCall');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError, cleanText, isObjectId } = require('../utils/helpers');

const router = express.Router();

// POST /api/video-calls (request a call with an existing conversation participant)
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const recipientId = String(body.recipientId || '');
  const conversationId = cleanText(body.conversationId, 120);
  const scheduledAt = new Date(body.scheduledAt);
  const now = Date.now();

  if (!isObjectId(recipientId) || recipientId === String(req.user._id)) {
    throw new HttpError(400, 'Invalid call participant.');
  }
  const expectedConversationId = [String(req.user._id), recipientId].sort().join('_');
  if (conversationId !== expectedConversationId || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < now || scheduledAt.getTime() > now + 90 * 24 * 60 * 60 * 1000) {
    throw new HttpError(400, 'Choose a call time within the next 90 days.');
  }
  const conversationExists = await Message.exists({
    conversationId,
    $or: [
      { sender: req.user._id, receiver: recipientId },
      { sender: recipientId, receiver: req.user._id }
    ]
  });
  if (!conversationExists) throw new HttpError(403, 'A call can only be requested with someone in your conversation.');
  if (!(await User.exists({ _id: recipientId, isActive: true }))) throw new HttpError(404, 'Participant not found.');

  const roomName = `msukasha-${crypto.randomBytes(24).toString('hex')}`;
  const call = await VideoCall.create({
    conversationId,
    requester: req.user._id,
    recipient: recipientId,
    scheduledAt,
    roomName
  });
  res.status(201).json({ call });
}));

// GET /api/video-calls/my
router.get('/my', requireAuth, asyncHandler(async (req, res) => {
  const calls = await VideoCall.find({ $or: [{ requester: req.user._id }, { recipient: req.user._id }] })
    .sort({ scheduledAt: 1 })
    .limit(100)
    .populate('requester', 'name')
    .populate('recipient', 'name');
  res.json({
    calls: calls.map((call) => {
      const item = call.toJSON();
      item.joinUrl = `https://meet.jit.si/${call.roomName}`;
      return item;
    })
  });
}));

// PATCH /api/video-calls/:id (recipient accepts/declines, requester cancels)
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'Call request not found.');
  const call = await VideoCall.findById(req.params.id);
  if (!call) throw new HttpError(404, 'Call request not found.');

  const action = String((req.body || {}).action || '');
  const requester = String(call.requester) === String(req.user._id);
  const recipient = String(call.recipient) === String(req.user._id);
  if (action === 'cancel' && requester && call.status === 'requested') {
    call.status = 'cancelled';
  } else if ((action === 'accept' || action === 'decline') && recipient && call.status === 'requested') {
    call.status = action === 'accept' ? 'accepted' : 'declined';
  } else {
    throw new HttpError(403, 'You cannot update this call request.');
  }

  await call.save();
  await call.populate('requester', 'name');
  await call.populate('recipient', 'name');
  const result = call.toJSON();
  result.joinUrl = `https://meet.jit.si/${call.roomName}`;
  res.json({ call: result });
}));

module.exports = router;
