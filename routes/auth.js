const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_EXPIRES = '7d';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

function safeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  return u;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const user = new User({ name, email, password, phone });
    await user.save(); // password is hashed in model pre('save')

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.status(201).json({ success: true, message: 'User registered', token, user: safeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    // password has select:false in model, so select explicitly
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({ success: true, message: 'Logged in', token, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Me (optional) - return current user using token
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, user: safeUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
