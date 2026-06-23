const express = require('express');
const router = express.Router();

// Products routes
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Get all products', data: [] });
});

router.get('/:id', (req, res) => {
  res.json({ success: true, message: 'Get product by ID', id: req.params.id });
});

router.post('/', (req, res) => {
  // TODO: Implement create product
  res.json({ success: false, message: 'Not implemented' });
});

router.put('/:id', (req, res) => {
  // TODO: Implement update product
  res.json({ success: false, message: 'Not implemented' });
});

router.delete('/:id', (req, res) => {
  // TODO: Implement delete product
  res.json({ success: false, message: 'Not implemented' });
});

module.exports = router;
