const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError, cleanText, isObjectId } = require('../utils/helpers');

const router = express.Router();
const userIdOf = (value) => String(value && (value._id || value));
const isParticipant = (message, uid) => userIdOf(message.sender) === uid || userIdOf(message.receiver) === uid;

// POST /api/messages
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const me = String(req.user._id);
  const receiverId = String(b.receiverId || '');
  const text = cleanText(b.text, 2000);

  if (!isObjectId(receiverId) || receiverId === me) throw new HttpError(400, 'Invalid recipient.');
  if (!text) throw new HttpError(400, 'Message cannot be empty.');
  if (!(await User.exists({ _id: receiverId, isActive: true }))) throw new HttpError(404, 'Recipient not found.');

  const expectedConversationId = [me, receiverId].sort().join('_');
  const conversationId = cleanText(b.conversationId, 120) || expectedConversationId;
  if (conversationId !== expectedConversationId) throw new HttpError(400, 'Invalid conversation.');

  const existing = await Message.findOne({ conversationId }).select('sender receiver');
  const participants = new Set([me, receiverId]);
  if (existing && [userIdOf(existing.sender), userIdOf(existing.receiver)].some((id) => !participants.has(id))) {
    throw new HttpError(409, 'This conversation is not valid for these participants.');
  }

  const message = await Message.create({ conversationId, sender: req.user._id, receiver: receiverId, text });
  res.status(201).json({ message, conversationId });
}));

// GET /api/messages (the logged-in user's conversation inbox)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const me = req.user._id;
  const messages = await Message.find({ $or: [{ sender: me }, { receiver: me }] })
    .sort({ createdAt: -1 })
    .limit(1000)
    .populate('sender', 'name')
    .populate('receiver', 'name')
    .lean();

  const conversations = new Map();
  messages.forEach((message) => {
    if (conversations.has(message.conversationId)) return;
    const senderIsMe = String(message.sender._id) === String(me);
    const participant = senderIsMe ? message.receiver : message.sender;
    conversations.set(message.conversationId, {
      conversationId: message.conversationId,
      participant: { id: String(participant._id), name: participant.name },
      lastMessage: { text: message.text, createdAt: message.createdAt, senderId: String(message.sender._id) }
    });
  });

  res.json({ conversations: Array.from(conversations.values()) });
}));

// GET /api/messages/:conversationId
router.get('/:conversationId', requireAuth, asyncHandler(async (req, res) => {
  const me = String(req.user._id);
  const conversationId = cleanText(req.params.conversationId, 120);
  const ids = conversationId.split('_');
  if (ids.length !== 2 || !ids.includes(me) || ids[0] >= ids[1] || !ids.every(isObjectId)) {
    throw new HttpError(403, 'You are not part of this conversation.');
  }
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(500);
  if (messages.some((message) => !isParticipant(message, me))) {
    throw new HttpError(403, 'You are not part of this conversation.');
  }
  res.json({ messages });
}));

module.exports = router;
