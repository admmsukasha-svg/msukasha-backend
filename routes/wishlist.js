const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

// GET /api/wishlist — Wishlist dekho
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist', 'name images price salePrice status seller');
    res.json({ success: true, wishlist: user.wishlist, count: user.wishlist.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/wishlist/toggle/:productId — Add ya remove toggle
router.post('/toggle/:productId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const productId = req.params.productId;

    const idx = user.wishlist.indexOf(productId);
    let action;

    if (idx === -1) {
      user.wishlist.push(productId);
      action = 'added';
    } else {
      user.wishlist.splice(idx, 1);
      action = 'removed';
    }

    await user.save();
    res.json({
      success: true,
      action,
      message: action === 'added' ? 'Wishlist mein add ho gaya' : 'Wishlist se remove ho gaya',
      count: user.wishlist.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/wishlist/clear — Clear wishlist
router.delete('/clear', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { wishlist: [] });
    res.json({ success: true, message: 'Wishlist clear ho gayi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
