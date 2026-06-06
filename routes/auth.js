const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const Seller  = require('../models/Seller');
const { protect }       = require('../middleware/auth');
const { sellerProtect } = require('../middleware/sellerAuth');

// JWT token banao
const generateToken = (id, role = 'buyer') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ─────────────────────────────────────────────
//  BUYER AUTH  (msukasha.com)
// ─────────────────────────────────────────────

// POST /api/auth/register — Buyer register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email aur password required hain' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Yeh email already registered hai' });
    }

    const user = await User.create({ name, email, password, phone });
    const token = generateToken(user._id, 'buyer');

    res.status(201).json({
      success: true,
      message: 'Registration ho gayi!',
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login — Buyer login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email aur password dein' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email ya password galat hai' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email ya password galat hai' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account suspend kar diya gaya hai' });
    }

    const token = generateToken(user._id, 'buyer');

    res.json({
      success: true,
      message: 'Login ho gaye!',
      token,
      user: {
        id:      user._id,
        name:    user.name,
        email:   user.email,
        role:    user.role,
        phone:   user.phone,
        address: user.address
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me — Buyer profile
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/me — Profile update
router.put('/me', protect, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address', 'avatar'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile update ho gayi', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/change-password — Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Purana aur naya password dein' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Purana password galat hai' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password change ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  SELLER AUTH  (sellermsukasha.com)
// ─────────────────────────────────────────────

// POST /api/auth/seller/register — Seller register
router.post('/seller/register', async (req, res) => {
  try {
    const { businessName, ownerName, email, password, phone, businessType, city } = req.body;

    if (!businessName || !ownerName || !email || !password || !phone) {
      return res.status(400).json({ success: false, message: 'Saari required fields bharein' });
    }

    const exists = await Seller.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Yeh email already registered hai' });
    }

    const seller = await Seller.create({
      businessName, ownerName, email, password, phone, businessType,
      address: { city: city || '' }
    });

    res.status(201).json({
      success: true,
      message: 'Registration ho gayi! Admin approval ke baad login kar paoge.',
      seller: {
        id:           seller._id,
        businessName: seller.businessName,
        email:        seller.email,
        status:       seller.status
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/seller/login — Seller login
router.post('/seller/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email aur password dein' });
    }

    const seller = await Seller.findOne({ email }).select('+password');
    if (!seller) {
      return res.status(401).json({ success: false, message: 'Email ya password galat hai' });
    }

    const isMatch = await seller.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email ya password galat hai' });
    }

    if (seller.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Account abhi pending hai. Admin approval ka intezar karo.' });
    }
    if (seller.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'Account reject kar diya gaya hai.' });
    }
    if (seller.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account suspend kar diya gaya hai.' });
    }

    const token = generateToken(seller._id, 'seller');

    res.json({
      success: true,
      message: 'Login ho gaye!',
      token,
      seller: {
        id:           seller._id,
        businessName: seller.businessName,
        ownerName:    seller.ownerName,
        email:        seller.email,
        phone:        seller.phone,
        status:       seller.status,
        logo:         seller.logo
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/seller/me — Seller profile
router.get('/seller/me', sellerProtect, async (req, res) => {
  res.json({ success: true, seller: req.seller });
});

// PUT /api/auth/seller/me — Seller profile update
router.put('/seller/me', sellerProtect, async (req, res) => {
  try {
    const allowed = ['businessName', 'ownerName', 'phone', 'description', 'logo', 'address', 'bankDetails'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const seller = await Seller.findByIdAndUpdate(req.seller._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile update ho gayi', seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/seller/change-password
router.put('/seller/change-password', sellerProtect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const seller = await Seller.findById(req.seller._id).select('+password');
    const isMatch = await seller.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Purana password galat hai' });
    }
    seller.password = newPassword;
    await seller.save();
    res.json({ success: true, message: 'Password change ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
