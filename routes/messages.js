const express = require('express');
const router  = express.Router();
const Message = require('../models/Message');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/messages — Contact form submit (public)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message, type } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject aur message required hain' });
    }

    const newMessage = await Message.create({ name, email, phone, subject, message, type });

    res.status(201).json({
      success: true,
      message: 'Aapka message mil gaya! Hum jald hi reply karenge.',
      id: newMessage._id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/auth — Logged in user ka message
router.post('/auth', protect, async (req, res) => {
  try {
    const { subject, message, type } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject aur message dein' });
    }

    const newMessage = await Message.create({
      name:        req.user.name,
      email:       req.user.email,
      phone:       req.user.phone || '',
      subject,
      message,
      type,
      sender:      req.user._id,
      senderModel: 'User'
    });

    res.status(201).json({ success: true, message: 'Message send ho gaya!', id: newMessage._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: Messages
// ─────────────────────────────────────────────

// GET /api/messages/admin — Sab messages
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Message.countDocuments(filter)
    ]);

    res.json({ success: true, total, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/messages/admin/:id/status — Status update
router.put('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const msg = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!msg) return res.status(404).json({ success: false, message: 'Message nahi mila' });
    res.json({ success: true, message: 'Status update ho gaya', msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/messages/admin/:id — Delete
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message delete ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
