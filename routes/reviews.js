const express = require('express');
const router = express.Router();

// Reviews routes
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Get all reviews', data: [] });
});

router.get('/:productId', (req, res) => {
  res.json({ success: true, message: 'Get reviews by product', productId: req.params.productId });
});

router.post('/', (req, res) => {
  // TODO: Implement create review
  res.json({ success: false, message: 'Not implemented' });
});

router.delete('/:id', (req, res) => {
  // TODO: Implement delete review
  res.json({ success: false, message: 'Not implemented' });
});

module.exports = router;
