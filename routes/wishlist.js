const express = require('express');
const router = express.Router();

// Wishlist routes
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Get wishlist', data: [] });
});

router.post('/add', (req, res) => {
  // TODO: Implement add to wishlist
  res.json({ success: false, message: 'Not implemented' });
});

router.delete('/:id', (req, res) => {
  // TODO: Implement remove from wishlist
  res.json({ success: false, message: 'Not implemented' });
});

module.exports = router;
