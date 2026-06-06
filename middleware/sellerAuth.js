const jwt    = require('jsonwebtoken');
const Seller = require('../models/Seller');

// Seller authenticate karo
const sellerProtect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Seller login karo pehle' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Seller account required' });
    }

    const seller = await Seller.findById(decoded.id).select('-password');
    if (!seller || !seller.isActive) {
      return res.status(401).json({ success: false, message: 'Seller not found or inactive' });
    }

    if (seller.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Account approval pending hai. Admin se contact karo.' });
    }

    if (seller.status === 'rejected' || seller.status === 'suspended') {
      return res.status(403).json({ success: false, message: `Account ${seller.status} hai.` });
    }

    req.seller = seller;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expire ho gaya, dobara login karo' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = { sellerProtect };
