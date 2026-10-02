const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, HttpError, cleanText, isEmail } = require('../utils/helpers');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// POST /api/register
router.post('/register', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const email = cleanText(b.email, 254).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';

  if (!isEmail(email)) throw new HttpError(400, 'A valid email address is required.');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'Password must be 8 to 128 characters.');

  const firstName = cleanText(b.firstName, 60);
  const lastName = cleanText(b.lastName, 60);
  const name = cleanText(b.name, 120) || `${firstName} ${lastName}`.trim();
  if (!name) throw new HttpError(400, 'Your name is required.');

  // Clients can only choose buyer or seller. Admin is assigned with scripts/make-admin.js.
  const wantsSeller = [b.role, b.accountType].some((v) => String(v || '').toLowerCase() === 'seller');
  const role = wantsSeller ? 'seller' : 'buyer';

  if (await User.exists({ email })) throw new HttpError(409, 'This email is already registered.');

  const user = await User.create({
    name, firstName, lastName, email,
    passwordHash: await bcrypt.hash(password, 12),
    phone: cleanText(b.phone, 30),
    city: cleanText(b.city, 80),
    companyName: cleanText(b.companyName, 160),
    role, accountType: role
  });

  res.status(201).json({ token: signToken(user), user });
}));

// POST /api/login
router.post('/login', asyncHandler(async (req, res) => {
  const email = cleanText(req.body && req.body.email, 254).toLowerCase();
  const password = typeof (req.body && req.body.password) === 'string' ? req.body.password : '';

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password.');

  res.json({ token: signToken(user), user });
}));

// GET /api/profile
router.get('/profile', requireAuth, (req, res) => res.json({ user: req.user }));

// PUT /api/profile
router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  if (b.name !== undefined) u.name = cleanText(b.name, 120) || u.name;
  if (b.phone !== undefined) u.phone = cleanText(b.phone, 30);
  if (b.city !== undefined) u.city = cleanText(b.city, 80);
  if (b.companyName !== undefined) u.companyName = cleanText(b.companyName, 160);
  if (b.profile && typeof b.profile === 'object') {
    if (b.profile.about !== undefined) u.profile.about = cleanText(b.profile.about, 1000);
    if (b.profile.address !== undefined) u.profile.address = cleanText(b.profile.address, 300);
  }
  await u.save();
  res.json({ user: u });
}));

// PUT /api/password
router.put('/password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    throw new HttpError(400, 'New password must be 8 to 128 characters.');
  }
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    throw new HttpError(401, 'Current password is incorrect.');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ message: 'Password updated.' });
}));

module.exports = router;
